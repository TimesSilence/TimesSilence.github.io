---
title: "ZooKeeper 实战教程：Docker 部署、zkCli 命令、四字命令与 Curator 客户端"
date: 2023-09-24 16:56:00
updated: 2023-09-24 16:56:00
permalink: knowledge/distributed-system/distributed-process-coordination/zookeeper/zookeeper-in-action/
categories:
  - 分布式系统
tags:
  - ZooKeeper
  - Curator
  - Docker
description: "用 Curator 编写三个可运行示例：基于临时顺序节点的分布式锁、NodeCache 配置管理、LeaderLatch 选主，附 Docker 环境搭建与运行说明。"
---

概念看完不如亲手跑通一次。本文用 Docker 起一个 ZooKeeper，再用 Curator 写出三个完整可运行的 Java 示例：分布式锁、配置管理、选主，重点讲清每段代码背后的协调语义。

<!-- more -->

## 环境准备

一条命令起单节点 ZK，足够本地实验：

```bash
docker run -d --name zookeeper -p 2181:2181 zookeeper:3.8
```

项目里引入 Curator 依赖（4.x 对应 ZK 3.5+）：

```xml
<dependency>
    <groupId>org.apache.curator</groupId>
    <artifactId>curator-framework</artifactId>
    <version>4.3.0</version>
</dependency>
<dependency>
    <groupId>org.apache.curator</groupId>
    <artifactId>curator-recipes</artifactId>
    <version>4.3.0</version>
</dependency>
```

三个示例共用同一个客户端工厂方法：

```java
static CuratorFramework newClient() {
    CuratorFramework client = CuratorFrameworkFactory.builder()
            .connectString("127.0.0.1:2181")
            .retryPolicy(new ExponentialBackoffRetry(1000, 3))
            .sessionTimeoutMs(15000)
            .build();
    client.start();
    return client;
}
```

## 分布式锁：临时顺序节点 + 监听前驱

先说原理。让所有竞争者都在 `/locks/order` 下创建临时顺序节点，得到 `/locks/order/c-0000000001` 这样的路径；**序号最小者持锁**，其余人不监听整个目录，只监听自己前一个序号的节点。持有者释放锁（删除节点或会话过期被服务端清除）时，只有紧邻的后继收到事件被唤醒。如果每个人都监听整个目录，一次释放会唤醒全部等待者，重新竞争又全部失败，这就是惊群（羊群效应）；监听前驱把唤醒数量压到 1。

为什么不用"创建同名节点、成功者持锁"的简化方案？那样确实能互斥，但所有失败者只能反复重试或一起监听同一个节点，既不公平也有惊群；顺序节点方案让每个等待者各就各位，按创建先后依次获锁，天然公平。临时语义则解决另一个致命问题：持锁进程崩溃时，会话过期触发节点自动删除，锁必定释放，不会出现数据库锁表那种需要人工清理的死锁。

Curator 的 `InterProcessMutex` 正是这套算法的成熟实现，直接使用即可：

```java
public class DistributedLockDemo {
    public static void main(String[] args) throws Exception {
        try (CuratorFramework client = newClient()) {
            InterProcessMutex lock = new InterProcessMutex(client, "/locks/order");
            if (lock.acquire(10, TimeUnit.SECONDS)) {
                try {
                    System.out.println("拿到锁，执行临界区逻辑");
                } finally {
                    lock.release(); // 主动删除自己的临时顺序节点
                }
            }
        }
    }
}
```

临时语义保证持锁进程崩溃时锁自动释放，不会像基于数据库或固定节点名的方案那样死锁。要验证效果，开两个进程同时跑，观察二者串行进入临界区；再 kill 持锁进程，观察另一个进程在会话过期后接管。

## 配置管理：NodeCache 持续监听

裸 Watcher 触发一次就失效，配置中心场景直接套 Curator 的 `NodeCache`：它在内部完成重新注册和断连补拉，对外提供"当前值 + 变更回调"的持续视图。

```java
public class ConfigDemo {
    public static void main(String[] args) throws Exception {
        try (CuratorFramework client = newClient()) {
            // 初始化配置
            client.create().creatingParentsIfNeeded()
                    .forPath("/config/app", "v1".getBytes());

            NodeCache cache = new NodeCache(client, "/config/app");
            cache.getListenable().addListener(() -> {
                byte[] data = cache.getCurrentData().getData();
                System.out.println("配置更新为: " + new String(data));
            });
            cache.start(true);

            // 模拟配置变更
            client.setData().forPath("/config/app", "v2".getBytes());
            Thread.sleep(3000);
        }
    }
}
```

运行后能看到回调打印"配置更新为： v2"。真实项目里，启动时读一次配置、变更回调里刷新本地开关即可；回调线程要轻量，重活交给业务线程池。需要监听整棵配置树（新增、删除子配置）时改用 `TreeCache`，它能把任意深度的子节点变更都聚合到同一个监听入口。

## 选主：LeaderLatch

多个实例竞争同一个 Leader 身份，用 Curator 的 `LeaderLatch`：

```java
public class LeaderDemo {
    public static void main(String[] args) throws Exception {
        String id = "instance-" + UUID.randomUUID().toString().substring(0, 8);
        try (CuratorFramework client = newClient()) {
            LeaderLatch latch = new LeaderLatch(client, "/election/master", id);
            latch.start();
            while (true) {
                if (latch.hasLeadership()) {
                    System.out.println(id + " 是 Leader，开始干活");
                }
                Thread.sleep(2000);
            }
        }
    }
}
```

其底层同样是临时顺序节点取最小者。同时启动三个进程，日志里只有一个打印"是 Leader"；kill 掉 Leader 进程，会话过期后临时节点被删除，下一个序号最小的实例获得 Leadership。注意 `LeaderLatch` 有"脑裂抖动"细节：网络抖动导致会话被判定过期后，旧 Leader 可能还在干活，临界操作前应以 `hasLeadership()` 为准，必要时再叠加外部 fencing 手段。

## 运行说明

1. `docker run` 起 ZK 后，用 `docker exec -it zookeeper zkCli.sh` 进入命令行，可执行 `ls /locks/order`、`get /config/app` 观察节点变化。
2. 锁与选主示例都需要多进程验证：用 `mvn -q exec:java` 或 IDE 各开一个运行实例。
3. 实验完删除容器即可重置环境；代码里的路径都在测试 chroot 之外，互不影响。

## 小结

- 分布式锁的正确姿势是临时顺序节点 + 只监听前驱，惊群和死锁都由这个结构消除。
- 配置管理用 NodeCache/TreeCache，把一次性 Watcher 的重新注册细节交给 Curator。
- 选主用 LeaderLatch，并以 `hasLeadership()` 作为干活前的最终判据。
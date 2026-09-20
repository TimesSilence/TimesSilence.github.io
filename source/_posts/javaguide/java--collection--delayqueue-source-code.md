---
title: "DelayQueue 源码分析"
date: 2019-04-16 13:45:00
updated: 2019-04-16 13:45:00
permalink: knowledge/java/collection/delayqueue-source-code/
categories:
  - Java
tags:
  - Java集合
  - DelayQueue
  - 并发
description: "深入 DelayQueue 源码：Delayed 接口契约、PriorityQueue 按到期时间排序、leader-follower 线程模型与 awaitNanos 精确睡眠的设计，覆盖订单超时关闭、缓存过期等落地场景。"
---

`DelayQueue` 是 JUC 中唯一的延迟阻塞队列：元素必须实现 `Delayed` 接口，只有剩余到期时间归零后才允许被取走。它用 `PriorityQueue` 按到期时间排序，用 leader-follower 模式把定时醒来的线程压到只有一个，是订单超时关闭、缓存过期这类单机延迟调度的标准答案。

<!-- more -->

## 它解决什么问题

「N 分钟后做一件事」是业务高频需求：下单 15 分钟未支付自动关闭、缓存条目到期清理、会话超时剔除。朴素做法要么为每个任务开定时器、让线程 sleep，任务一多线程爆炸；要么起个线程轮询扫描全量任务，白白烧 CPU。理想的结构是一个按到期时间自动排序的队列：消费者永远只关心队头那个最近到期的元素，没到期就精确睡眠对应时长。`DelayQueue` 就是这个结构——它是无界阻塞队列，但「阻塞」的语义不是队列满，而是队头元素还没到期。

## 核心原理

### Delayed 契约

入队元素必须实现 `Delayed` 接口，它只定义一个方法，同时继承了 `Comparable`：

```java
public interface Delayed extends Comparable<Delayed> {
    long getDelay(TimeUnit unit);
}
```

两个方法各司其职，又必须保持一致。`getDelay` 返回剩余延迟时间（按参数指定的单位换算），返回 0 或负数表示已到期——这是「能否取出」的判据；`compareTo` 决定元素在内部堆中的位置，通常按到期时间戳升序。契约的命门在于一致性：`compareTo` 定义的顺序必须与 `getDelay` 的到期先后吻合，否则堆顶不是最早到期的元素，整个调度语义随之崩塌。

### 内部结构

四个成员变量撑起全部逻辑：

```java
private final transient ReentrantLock lock = new ReentrantLock();
private final PriorityQueue<E> q = new PriorityQueue<E>();
private Thread leader = null;
private final Condition available = lock.newCondition();
```

`PriorityQueue` 是小顶堆，堆顶恒为 `compareTo` 最小的元素，也就是最早到期的任务。所有存取由同一把 `ReentrantLock` 保护，等待唤醒共用一个条件变量 `available`。第三个变量 `leader` 是全文最精妙的设计，放到 `take` 里详述。

## 深入机制

### offer：入堆与选择性唤醒

```java
public boolean offer(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        q.offer(e);
        if (q.peek() == e) {      // 新元素直接成为堆顶
            leader = null;
            available.signal();
        }
        return true;
    } finally {
        lock.unlock();
    }
}
```

队列无界，入队永远成功返回 `true`，`put` 也直接复用它。关键在 `if` 分支：新元素入堆后如果恰好坐上堆顶，说明「最早到期」的任务换人了，等待者按旧到期时间定的闹钟已经失效，于是清掉 `leader` 并 `signal` 一个等待线程，让它回 `take` 的循环里重新评估。若新元素没当上堆顶，现有等待节奏依然正确，什么都不做——这是一次精打细算的选择性唤醒。

### take：leader-follower 的主战场

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        for (;;) {
            E first = q.peek();
            if (first == null)
                available.await();               // 队空，无限期等
            else {
                long delay = first.getDelay(NANOSECONDS);
                if (delay <= 0)
                    return q.poll();             // 队头已到期，取出返回
                first = null;                    // 等待期间不持有引用
                if (leader != null)
                    available.await();           // 已有 leader，作为 follower 无限期等
                else {
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread;         // 自荐为 leader
                    try {
                        available.awaitNanos(delay);  // 精确睡到队头到期
                    } finally {
                        if (leader == thisThread)
                            leader = null;       // 卸任
                    }
                }
            }
        }
    } finally {
        if (leader == null && q.peek() != null)
            available.signal();                  // 交棒：唤醒下一个等待者
        lock.unlock();
    }
}
```

按分支拆解：

1. **队列为空**：线程在 `available` 上无限期 `await`，直到 `offer` 入队后被 `signal`。
2. **队头已到期**：直接 `poll` 返回。注意最外层 `finally` 里还有一次 `signal`——本线程取走了队头，若队列里还有元素且此刻没有 leader，就唤醒一个后继者来评估新队头，保证等待链不断。
3. **队头未到期且已有 leader**：说明已有线程认领了「盯梢」队头的职责，当前线程作为 follower 无限期等待，由 leader 到期取走元素后通过 `finally` 的 `signal` 唤醒。
4. **队头未到期且无 leader**：当前线程自荐为 leader，用 `awaitNanos(delay)` 精确睡到队头到期。醒来后在 `finally` 里卸任，进入下一轮 `for` 循环，此时队头通常已到期，走分支 2 取走。

leader 机制解决的是定时等待的浪费。假如没有 `leader` 字段，N 个消费者都会 `awaitNanos(delay)` 在同一时刻醒来抢锁，但只有一个能取走元素，其余 N-1 个白醒一圈再重算睡眠时间——典型的惊群。有了 leader，只有它对表睡眠，其余线程一觉睡到被显式唤醒，定时醒来的次数从 N 降到 1；leader 离职时再 `signal` 选出新 leader，等待成本被压到最低。`first = null` 这行同样考究：等待期间线程不再需要队头元素，提前断开引用，避免线程栈长生命周期地钉住一个暂时用不上的对象。

## 工程实践

- **订单超时关闭**：下单时投递一个 30 分钟后到期的检查任务，消费者 `take` 到后查单，未支付则关单。任务执行异常要 catch 住并重新入队或走补偿，否则该订单永久漏检。
- **缓存过期**：把 key 封装为 `Delayed` 元素入队，到期后从缓存中删除；`Delayed` 对象里只放 key，别持有大对象引用。
- **时钟选择**：用 `System.currentTimeMillis()` 计算到期点会受 NTP 校时影响——时钟回拨会让任务推迟到期。`getDelay` 以 `System.nanoTime()` 为基准则天然免疫，因为 nanoTime 单调递增。`ScheduledThreadPoolExecutor` 内部的 `DelayedWorkQueue` 正是基于 nanoTime 的自定义堆，设计思路与 `DelayQueue` 一脉相承，但它并非直接组合 `DelayQueue`。
- **无界的风险**：大量长期任务会堆积在内存里。多实例部署时各实例各自消费会重复执行，跨进程场景应改用 MQ 延迟消息或统一调度中心。

## 对比与权衡

| 维度 | DelayQueue | Timer/TimerTask | ScheduledThreadPoolExecutor | MQ 延迟消息 |
| --- | --- | --- | --- | --- |
| 排序结构 | PriorityQueue 小顶堆 | 数组堆 TaskQueue | 自定义 DelayedWorkQueue 堆 | 服务端时间轮/多级队列 |
| 执行模型 | 调用方自行 take 执行 | 单一后台线程串行 | 线程池并发执行 | 消费者集群 |
| 长任务影响 | 只堵当前 take 线程 | 拖垮后续所有任务 | 线程池隔离，影响可控 | 无 |
| 可靠性 | 内存态，重启丢失 | 内存态，重启丢失 | 内存态，重启丢失 | 持久化、可重试 |
| 适用规模 | 单机中等规模 | 少量简单任务 | 单机生产级调度 | 分布式海量任务 |

`DelayQueue` 只解决「按到期时间排序」和「未到期不允许取」两件事，执行模型完全交给使用者，这是它比 `Timer` 灵活的地方——`Timer` 的单线程一旦被长任务堵住，后续任务全部延迟。但内存态、无持久化是它的天花板，要求不丢任务的场景必须换方案。

## 面试视角

**DelayQueue 如何保证元素按到期时间出队？** 元素实现 `Delayed`，`compareTo` 按到期时间比较，底层 `PriorityQueue` 小顶堆保证堆顶恒为最早到期者；`take` 先查堆顶的 `getDelay`，大于 0 就睡眠对应时长，直到小于等于 0 才取出。

**leader 字段是干什么的？** 它是 leader-follower 模式的落地：第一个发现队头未到期的线程自荐为 leader，用 `awaitNanos` 精确睡到到期时刻，其余线程作为 follower 无限期等待；leader 取走元素后在 `finally` 中 `signal` 唤醒继任者。这把「N 个线程同时定时醒来抢一个元素」的惊群降为只有 leader 定时醒来。

**offer 里为什么只在 q.peek() == e 时才 signal？** 只有新元素成为堆顶，「最早到期时间」才发生变化，等待者按旧时间定的闹钟才需要作废重算。新元素排在后面时，现有等待节奏依然正确，`signal` 只会带来一次无谓的唤醒和锁竞争。

**take 中的 first = null 有什么作用？** 等待期间线程不再需要队头元素，把局部引用置空可以让 GC 及时回收它，避免线程栈长期持有大对象；下一轮循环会重新 `peek` 拿引用。

**DelayQueue 线程安全吗？** 是。所有对内部 `PriorityQueue` 的访问都在同一把 `ReentrantLock` 保护下进行，等待唤醒经由锁派生的 `Condition` 完成，`take` 用 `lockInterruptibly` 支持中断响应。

## 小结

- `DelayQueue` = `PriorityQueue`（按到期时间的小顶堆）+ `ReentrantLock` + 单个 `Condition available`；元素契约是 `Delayed` 的 `getDelay` 与 `compareTo`，两者语义必须一致。
- `take` 四种分支：空队列无限等、队头到期直接取、有 leader 则无限等、无 leader 则 `awaitNanos` 精确睡眠；leader 机制把定时醒来的线程数压到 1。
- `offer` 只在新元素登顶时 `signal`，配合 `finally` 中的交棒 `signal`，等待链既不丢通知也不多余。
- 适合单机中等规模延迟调度；要持久化、要分布式，换 MQ 延迟消息或调度中心。
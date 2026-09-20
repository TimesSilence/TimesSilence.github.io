---
title: "Docker 核心概念总结"
date: 2022-12-12 17:33:00
updated: 2022-12-12 17:33:00
permalink: knowledge/tools/docker/docker-intro/
categories:
  - 开发工具
tags:
  - 开发工具
description: "Docker 容器化技术的核心概念详解：容器与虚拟机的本质区别在于共享内核（namespace + cgroup），镜像采用分层与联合文件系统，Dockerfile 有多阶段构建等最佳实践，编排则交给 Kubernetes。"
---

Docker 解决的核心问题是「应用环境的封装与一致性交付」：它借助 Linux 内核的 namespace 与 cgroup 能力，把进程隔离成轻量容器；再用分层镜像和联合文件系统把应用及其依赖打包成可复制、可分发的标准单元。理解「共享内核」和「镜像分层」这两条主线，Docker 的大部分设计就顺理成章了。

<!-- more -->

## 容器 vs 虚拟机：本质区别在哪里

很多人初学时会把容器当成「轻量虚拟机」，这个类比容易误导。两者的虚拟化层级完全不同：

- **虚拟机（VM）** 虚拟的是硬件。Hypervisor（如 VMware、KVM）在物理机上模拟出完整的 CPU、内存、磁盘、网卡，每台 VM 上都要跑一个独立的 Guest OS 内核，应用再跑在这个内核之上。隔离非常彻底，但代价是每台 VM 都要占用数 GB 的磁盘和内存，启动以分钟计。
- **容器** 虚拟的是操作系统。容器里没有独立内核，所有容器进程直接运行在宿主机的同一个 Linux 内核上。所谓「容器里看到的系统」，只是内核给进程制造出的一种「错觉」。

这种「错觉」靠内核的两个特性实现：

1. **Namespace（命名空间）**：负责「看不见别人」。Linux 提供 PID、Mount、Network、UTS、IPC、User 等多种 namespace。容器进程进入自己的 PID namespace 后，只能看到 namespace 内的进程；进入自己的 Mount namespace 后，看到的是独立的文件系统视图；Network namespace 则给容器一套独立的网卡、IP 和端口空间。进程还是那些进程，只是视野被内核裁剪过了。
2. **Cgroup（控制组）**：负责「用不了多少」。namespace 隔离了视图，但 CPU、内存这类资源大家还是共用的。cgroup 对进程组施加资源配额：最多用几个核、多少内存、多少磁盘 IO，超限就限流或 OOM Kill。没有 cgroup，一个失控容器就能拖垮整台宿主机。

一句话概括：**容器 = 被 namespace 隔离了视图、被 cgroup 限制了资源的普通进程**。所以它启动快（不用引导内核，fork 一个进程就行）、开销小（不跑多余的操作系统），代价是隔离强度不如 VM——容器逃逸、内核漏洞影响面更大，这也是生产环境常把容器跑在 VM 里的原因。

| 维度 | 虚拟机 | 容器 |
| --- | --- | --- |
| 虚拟化层级 | 硬件 | 操作系统（进程级） |
| 内核 | 每台 VM 独立内核 | 共享宿主机内核 |
| 镜像体积 | 通常 GB 级 | 通常几十到几百 MB |
| 启动速度 | 分钟级 | 秒级甚至毫秒级 |
| 隔离强度 | 强（硬件边界） | 较弱（共享内核） |
| 典型用途 | 隔离不同租户/环境 | 隔离不同应用/服务 |

## 镜像分层与联合文件系统

镜像（Image）是容器的只读模板，容器是镜像跑起来后的实例。镜像最精妙的设计是**分层**。

一个镜像由若干只读层（layer）堆叠而成。Dockerfile 里的每一条 `FROM`、`RUN`、`COPY` 指令，大体都会生成一个新层。每一层只记录相对上一层的文件增量（新增、修改、删除标记），层与层之间通过内容哈希标识。这带来三个直接收益：

- **复用**：十个 Java 应用镜像都基于同一个 `eclipse-temurin:17-jre` 基础镜像，那基础层在本地和仓库里只存一份。
- **传输友好**：`docker push/pull` 按层增量同步，已存在的层直接跳过。
- **构建缓存**：构建时某一层指令和上下文没变，就直接复用缓存，秒级完成。

多层文件要合并成容器看到的单一目录树，靠的是**联合文件系统（UnionFS）**，Docker 默认使用 overlay2 驱动：多个只读下层（lowerdir）叠加，再盖一个可写上层（upperdir）。容器启动时新增的就是这个可写层——容器内的一切写入都发生在可写层，删除下层文件其实是在上层写一个 whiteout 标记「遮住」它。这也解释了两个常见困惑：一是**容器删掉后数据就没了**（可写层随容器销毁），所以持久化数据要挂数据卷（volume）；二是**镜像里 `RUN rm` 删文件不会让镜像变小**（下层内容还在，只是被遮住）。

## 镜像、容器、仓库的关系

三者关系可以用代码世界类比：镜像像类，容器像实例，仓库（Registry）像 Maven 中央仓库。`docker pull` 从仓库拉镜像，`docker run` 用镜像创建容器，`docker push` 把本地镜像推回仓库分发。Docker Hub 是默认公共仓库，企业内部一般自建 Harbor 等私有仓库。

## Dockerfile 最佳实践

Dockerfile 是镜像的构建说明书，写法直接决定镜像大小、构建速度和安全性。

### 多阶段构建：编译与运行分离

编译需要 JDK/Maven 等重型工具链，运行只需要 JRE。多阶段构建让编译产物从前一个阶段「拷贝」到干净的运行时镜像，最终镜像不带任何编译工具：

```dockerfile
# 第一阶段：构建
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

# 第二阶段：运行时
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

最终镜像可能从 800MB 压到 200MB 以内。

### 善用层缓存

构建缓存按指令逐层判断，**把变化少的指令放前面，变化多的放后面**。上面的例子先 `COPY pom.xml` 再拉依赖，最后才 `COPY src`——改代码不会导致依赖重新下载。同理，`apt-get install` 应合并成一条 `RUN` 并清理缓存：

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```

### 最小镜像与安全

- 基础镜像选小：优先 `-slim`、`-alpine` 变体（注意 alpine 用 musl libc，个别场景有兼容性坑），甚至考虑 distroless。
- 用 `.dockerignore` 排除 `.git`、日志、本地配置，减小构建上下文。
- 不要用 root 跑应用，加 `USER` 指令切到普通用户。
- 镜像标签固定具体版本（`17.0.9-jre`），避免 `latest` 带来的不可复现构建。

## 从容器到编排

单机 Docker 解决了「一个应用怎么跑」，但几十上百个容器跨多台机器时，谁来调度、扩容、自愈、做服务发现？这是容器编排问题，事实标准是 **Kubernetes（K8s）**：一个以 Pod 为最小调度单位、用声明式 API 管理容器集群的编排系统。Docker 是打包容器的砖，K8s 是用这些砖盖楼的工地。学 Docker 到能写出规范镜像、跑通多服务编排，就可以接着看 K8s 了。

## 小结

- 容器的本质是共享宿主机内核的隔离进程，隔离靠 namespace，限额靠 cgroup；与虚拟机是互补而非替代关系。
- 镜像分层 + UnionFS 带来复用、增量传输和构建缓存；容器可写层易失，持久化交给数据卷。
- Dockerfile 记住三件事：多阶段构建、按变化频率排指令、最小化基础镜像与非 root 运行。
- 单机容器之上是编排，编排的答案是 Kubernetes。
---
title: "Java 19 新特性概览"
date: 2022-01-27 14:42:00
updated: 2022-01-27 14:42:00
permalink: knowledge/java/new-features/java19/
categories:
  - Java
tags:
  - Java新特性
  - Java19
description: "Java 19 新特性：虚拟线程首次预览、结构化并发孵化与 Record 模式预览，通往 Java 21 的桥梁版本。"
---

Java 19 于 2022 年 9 月发布，虽然是非 LTS 版本，分量却不轻：Project Loom 的核心成果虚拟线程在此首次预览，配套的结构化并发进入孵化器，Record 模式也同步亮相——Java 高并发编程的写法自此开始改写。

<!-- more -->

## 版本定位

19 本身只有六个月支持期，不适合生产常驻，但它是通往 Java 21 的桥梁：虚拟线程、结构化并发、Record 模式都在这里首发试水，又都在 21 转正。想在 21 落地后立刻上手的团队，最好从这个版本就开始跟踪。

## 虚拟线程（首次预览）

虚拟线程（JEP 425）是 Project Loom 酝酿多年的核心交付物，目标是把"廉价并发"带进 Java。它是由 JVM 调度、而非操作系统直接调度的轻量级线程：成千上万个虚拟线程复用少量载体平台线程，发生阻塞时虚拟线程从载体上卸载，不再把宝贵的 OS 线程耗在等待 IO 上。

它针对的痛点很明确：传统"一个请求一个平台线程"的模型下，线程创建贵、切换走内核，IO 密集服务的并发上限被线程数卡死；反应式编程虽然能解，却割裂代码、难以调试。虚拟线程让"同步写法 + 高并发吞吐"重新成立：

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (var task : tasks) {
        executor.submit(task); // 每个任务一个虚拟线程，随用随弃
    }
}
```

也可以用 `Thread.ofVirtual().start(runnable)` 创建单个虚拟线程。

注意事项：

- 预览特性，编译运行需加 `--enable-preview`；正式转正在 Java 21。
- 虚拟线程提升的是吞吐而非延迟，CPU 密集任务不会因此变快。
- 19 的实现里，在 `synchronized` 块中发生阻塞会"钉住"载体线程（pinning），热点路径可改用 `ReentrantLock` 规避，该问题在后续版本逐步改善。
- 使用观念要转变：不要再池化虚拟线程，一个任务一个线程即可；需要限流时改用信号量。
- 警惕 `ThreadLocal`：百万级虚拟线程意味着百万份副本，大对象挂在线上会带来内存压力。

## 结构化并发（孵化）

用 `ExecutorService` 并发发起多个子任务时，失败后的取消、异常聚合、子任务泄漏防护都要手写，稍不留神就写出"父任务结束了、子任务还在跑"的泄漏代码。结构化并发（JEP 428）把一组子任务的生命周期绑定到同一个作用域：作用域关闭前所有 `fork` 出的子任务必须结束，任一失败可整体取消，错误统一传播：

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var user  = scope.fork(() -> loadUser(id));
    var order = scope.fork(() -> loadOrders(id));
    scope.join();          // 等待全部子任务完成
    scope.throwIfFailed(); // 任一失败则抛出
    return new Result(user.get(), order.get());
}
```

代码的级联关系一目了然，线程转储里也能呈现父子层级，可观察性明显改善。19 中它位于 `jdk.incubator.concurrent` 模块孵化，API 后续版本有过调整，当前阶段适合学习思想、积累用法，而不是直接上线。

## Record 模式（首次预览）

继 instanceof 与 switch 的类型模式之后，19 预览了 Record 的解构模式（JEP 405）：匹配类型的同时把组件拆解出来：

```java
record Point(int x, int y) {}

static int sum(Object obj) {
    if (obj instanceof Point(int x, int y)) {
        return x + y; // 无需再调用 x()、y()
    }
    return 0;
}
```

它让"sealed 层级 + Record + 模式匹配"这条数据导向编程的路进一步收敛，是模式匹配拼图的关键一块，同样在 Java 21 正式转正。

## 工程实践/升级建议

把 19 当作"试用装"：挑一两个 IO 密集的内部服务用虚拟线程改造并压测，摸清 pinning、`ThreadLocal` 内存占用、监控工具兼容性等真实问题，为 21 储备经验。生产的升级目标应当直接锁定 21，不必在 19 停留。

## 小结

Java 19 的价值不在当下而在趋势：虚拟线程把高并发模型拉回朴素的同步写法，结构化并发补齐任务生命周期管理，Record 模式完善数据解构。三者全部在 Java 21 转正——19 是最好的预习材料。
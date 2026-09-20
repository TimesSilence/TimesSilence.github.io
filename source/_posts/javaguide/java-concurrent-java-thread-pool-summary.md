---
title: "Java 线程池详解"
date: 2020-11-28 09:27:00
updated: 2020-11-28 09:27:00
permalink: knowledge/java/concurrent/java-thread-pool-summary/
categories:
  - Java
tags:
  - Java并发
  - 线程池
description: "ThreadPoolExecutor 七大参数、任务调度流程、四种拒绝策略与关闭语义，以及生产环境慎用 Executors 工厂方法的原因。"
---

线程池把「创建线程」这件昂贵的事变成一次性投入：线程用后归还、反复执行新任务，同时给并发度装上明确的上限。本篇把 ThreadPoolExecutor 的七大参数、任务从提交到被拒绝的完整链路、四种内置拒绝策略，以及 shutdown/shutdownNow/awaitTermination 的关闭语义一次讲透。

<!-- more -->

## 它解决什么问题

线程不是免费资源：每创建一个线程，JVM 都要为它分配约 1MB 的栈空间并发起系统调用，销毁同样有成本。如果每来一个任务就 new 一个 Thread，高并发下光是创建销毁的开销就足以拖垮服务，更别提线程数量失控带来的内存耗尽。线程池用「池化」思路回应这个矛盾，带来三个直接收益：

1. **降低开销**：线程执行完任务后不销毁，回到池中等待下一个任务，省去反复创建销毁的成本。
2. **加快响应**：池中常驻线程随取随用，任务到达即可执行，不必先等线程创建。
3. **便于管理**：线程数量、排队容量、超载行为都有边界，池还自带运行统计（任务总数、活跃线程数等），方便监控与调优。

Executor 框架把「任务」（Runnable/Callable）、「执行器」（ThreadPoolExecutor 等）和「异步结果」（Future）三件事解耦，其中 ThreadPoolExecutor 是整个框架的核心实现，也是本篇的主角。

## 核心原理

### 七大参数逐一拆解

ThreadPoolExecutor 最完整的构造方法接收七个参数，它们共同决定一个线程池的全部行为：

```java
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler)
```

- **corePoolSize（核心线程数）**：线程池长期维持的线程规模。默认按需创建，即使空闲也不回收（除非调用 `allowCoreThreadTimeOut(true)`）。
- **maximumPoolSize（最大线程数）**：线程数的上限。只有当队列满了，线程池才会在核心数之上继续扩招，最多到这个值。
- **keepAliveTime（空闲存活时间）**：超出核心数的线程空闲多久后被回收。
- **unit**：keepAliveTime 的时间单位。
- **workQueue（任务队列）**：核心线程忙不过来时新任务在此排队。常用实现有 `ArrayBlockingQueue`（有界）、`LinkedBlockingQueue`（可选容量，默认近无界）、`SynchronousQueue`（零容量，直接交接）。
- **threadFactory（线程工厂）**：定制线程的创建过程，最常见的用途是给线程起有意义的名字。
- **handler（拒绝策略）**：线程数到顶且队列已满（或池已关闭）时，决定如何处置新任务。

### 任务调度流程

调用 `execute()` 提交任务后，线程池按固定顺序决策：

1. 工作线程数 < corePoolSize：新建核心线程，立即执行任务。
2. 达到 corePoolSize：尝试把任务放入队列等待。
3. 队列已满且线程数 < maximumPoolSize：新建非核心线程执行任务。
4. 线程数已达 maximumPoolSize 且队列也满：触发拒绝策略。

这里有个反直觉的关键点：**非核心线程的扩招排在入队之后**。队列只要没满，线程数就永远停在核心数，maximumPoolSize 形同虚设——这正是无界队列的陷阱所在，后文还会展开。另外，非核心线程执行完手头任务后并不会立刻消失，而是和核心线程一样继续从队列抢任务，只是它用带超时的 `poll(keepAliveTime)` 取任务，超时取不到才退出销毁。

## 深入机制

### execute() 的三段判断

```java
public void execute(Runnable command) {
    if (command == null)
        throw new NullPointerException();
    int c = ctl.get();
    if (workerCountOf(c) < corePoolSize) {
        if (addWorker(command, true))
            return;
        c = ctl.get();
    }
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        if (!isRunning(recheck) && remove(command))
            reject(command);
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    else if (!addWorker(command, false))
        reject(command);
}
```

这段代码与上面的流程一一对应。值得留意的是入队后的 recheck：入队的瞬间线程池可能恰好被关闭，或者 worker 恰好全部退出，所以要二次检查状态，必要时把任务移出队列走拒绝，或补一个空任务线程兜底。线程池用单个 `AtomicInteger ctl` 的高 3 位存运行状态、低 29 位存线程数，一次 CAS 同时读写两者，这是 execute 这条高频路径仍能保持低开销的关键设计。

### 四种拒绝策略

线程池已关闭，或者线程数到顶且队列也塞满时，`RejectedExecutionHandler` 登场。JDK 内置四种：

- **AbortPolicy（默认）**：抛出 `RejectedExecutionException`。失败被暴露给调用方，适合不允许丢任务的核心链路，但业务必须捕获异常并做补偿（重试、落库待补偿等）。
- **CallerRunsPolicy**：由提交任务的线程自己执行该任务。提交速度因此被拖慢，形成天然的背压；代价是提交线程被占用——若它是 Tomcat 请求线程，会直接拉高接口延迟。池已关闭时该策略会丢任务。
- **DiscardPolicy**：静默丢弃，不留任何痕迹。适用于日志上报、指标采集这类可丢失的任务，排查问题时要有「任务可能悄悄没了」的意识。
- **DiscardOldestPolicy**：丢弃队列头部最老的任务，再重试入队新任务。适合只关心最新数据的场景；但搭配 `PriorityBlockingQueue` 时弹出的可能是优先级最高的任务，慎用。

内置策略不满足需求时可以自定义，常见思路是记录拒绝计数、把任务写入可靠存储等待补偿。

### 关闭语义：shutdown / shutdownNow / awaitTermination

三个方法常被混用，语义其实分工明确：

- **shutdown()**：温和关闭。不再接收新任务，队列中已提交的任务继续执行完，正在执行的任务不受打扰。方法立即返回，不等待终止。
- **shutdownNow()**：强制关闭。尝试中断所有正在执行的任务（发 interrupt 信号），并把队列中未执行的任务以 `List<Runnable>` 返回。注意它只是发信号，任务不响应中断就无法保证停止。
- **awaitTermination(timeout, unit)**：阻塞等待线程池进入 TERMINATED 状态，返回值表示是否在超时前等到。

状态流转是单向的：`RUNNING → SHUTDOWN → TIDYING → TERMINATED`，或 `RUNNING → STOP → TIDYING → TERMINATED`。标准的优雅关闭模板是三者组合：

```java
executor.shutdown();
try {
    if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
        executor.shutdownNow();
        if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
            log.error("线程池未能在预期时间内终止");
        }
    }
} catch (InterruptedException e) {
    executor.shutdownNow();
    Thread.currentThread().interrupt();
}
```

## 工程实践

### 为什么不能直接用 Executors

`Executors` 的工厂方法看似省事，隐患全藏在默认值里：

- **newFixedThreadPool / newSingleThreadExecutor**：队列是容量为 `Integer.MAX_VALUE` 的 `LinkedBlockingQueue`。任务提交快于消费时无限堆积，每个任务对象都占堆内存，最终 OOM。且队列永远满不了，maximumPoolSize 和 keepAliveTime 全部失效。
- **newCachedThreadPool**：队列是零容量的 `SynchronousQueue`，最大线程数却是 `Integer.MAX_VALUE`。任务执行慢、提交快时线程无限膨胀，CPU 和内存双双被打爆，同样是 OOM。
- **newScheduledThreadPool**：内部的 `DelayedWorkQueue` 自动扩容、近乎无界，延迟任务同样有堆积风险。

问题不在于这些方法本身，而在于参数不透明——使用者往往意识不到自己接过的是一个没有刹车的池子。生产环境应直接 `new ThreadPoolExecutor`，把上限写明白：

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    8, 16, 60L, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(200),
    r -> {
        Thread t = new Thread(r);
        t.setName("order-task-" + t.getId());
        return t;
    },
    new ThreadPoolExecutor.CallerRunsPolicy());
```

有界队列、命名线程工厂、显式拒绝策略，这三件事是底线。

### 队列选择的权衡

| 队列 | 容量特性 | 对线程数的影响 | 适用场景 |
| --- | --- | --- | --- |
| ArrayBlockingQueue | 固定有界 | 队列满才扩到 max | 需要明确容量上限 |
| LinkedBlockingQueue | 默认近无界，可指定容量 | 无界时 max 失效，常驻 core | 任务量平稳且设了容量 |
| SynchronousQueue | 零容量 | 任务直接交接，容易触达 max | 追求低排队延迟 |
| PriorityBlockingQueue | 无界，按优先级出队 | max 失效 | 任务有优先级差异 |

大队列能平滑流量，但会隐藏过载、拉长任务等待时间；小队列加更多线程响应更快，上下文切换成本也更高。通常宁可让拒绝策略尽早暴露问题，也不要用巨型队列掩盖容量不足。

## 面试视角

**execute() 提交任务后的完整流程是什么？** 线程数不足 core 先建核心线程；达到 core 后任务入队；队满且未到 max 建非核心线程；全满走拒绝策略。务必记住非核心线程的创建排在入队之后，所以无界队列下 max 永远不生效。

**为什么不推荐 Executors 的工厂方法？** Fixed 和 Single 用近无界队列，任务持续堆积导致 OOM；Cached 线程数无上限，线程爆炸耗尽 CPU 和内存；根本问题是默认值把资源风险藏了起来。

**shutdown() 和 shutdownNow() 有什么区别？** 前者不再接收新任务，但会把队列中已提交的任务执行完，且不中断执行中的任务；后者尝试中断所有任务，并返回未执行的任务列表。两者都立即返回，需配合 `awaitTermination` 等待真正终止。

**核心线程会被回收吗？** 默认不会，空闲也常驻；调用 `allowCoreThreadTimeOut(true)` 后，核心线程空闲超过 keepAliveTime 同样会被回收，这在负载波动大的场景下能省资源。

**CallerRunsPolicy 有什么副作用？** 任务在提交线程中执行，提交被拖慢形成背压；但提交线程若是 Web 请求线程，会占用它并拉高接口耗时。线程池已关闭时，该策略直接丢弃任务。

## 小结

- 七大参数里 core、max、workQueue 决定容量结构，keepAliveTime 管回收，threadFactory 和 handler 管创建与兜底。
- 「核心线程 → 队列 → 非核心线程 → 拒绝」是理解一切线程池现象的总纲，无界队列会让 maximumPoolSize 失效。
- 四种拒绝策略没有银弹：不能丢用 Abort 加补偿，要背压用 CallerRuns，可丢弃用 Discard，只认最新用 DiscardOldest。
- shutdown 温和、shutdownNow 强制、awaitTermination 等待，三者组合才是完整的优雅关闭。
- 生产环境放弃 Executors 工厂方法，用有界队列和显式参数把风险控制在配置里。
---
title: "Java并发常见面试题总结（下）"
date: 2021-01-13 14:02:00
updated: 2021-01-13 14:02:00
permalink: knowledge/java/concurrent/java-concurrent-questions-03/
categories:
  - Java
tags:
  - Java并发
  - 面试
description: "并发面试下篇深度解析：ThreadLocal 原理与内存泄漏、线程池参数与拒绝策略、CompletableFuture 异步编排、AQS 与并发工具类。"
---

并发面试下篇围绕四条主线展开：ThreadLocal 的原理与泄漏、线程池的参数与运行流程、CompletableFuture 的异步编排、AQS 及其衍生的同步工具。这四块是「原理 + 实战」结合最紧的部分，回答时必须落到源码机制上，只背 API 很容易被追问击穿。

<!-- more -->

## 考察地图

- **ThreadLocal**：底层数据结构、内存泄漏成因与弱引用设计、跨线程传递方案。考察「值存在哪、谁引用谁」这条链路的理解。
- **线程池**：为什么不推荐 Executors、任务处理流程、拒绝策略与风险、异常后线程去留、线程数设定。考察能否把七个参数串成一条执行链。
- **异步编排**：Future 的局限、CompletableFuture 的编排与异常处理。考察异步工程化思维。
- **AQS 与同步工具**：AQS 核心原理、CountDownLatch/CyclicBarrier/Semaphore 的分工。考察「一个框架如何长出一族工具」。
- 建议自行查阅：ThreadLocal 基本用法、线程池命名实践、动态调整线程池参数、优先级任务线程池设计、虚拟线程入门——多为记忆性或开放性内容，掌握主线后再补。

## ThreadLocal

### ThreadLocal 的底层原理是什么？

**结论**：值不存在 `ThreadLocal` 里，而存在每个线程自己的 `ThreadLocalMap` 中；`ThreadLocal` 只是访问这张表的钥匙。

**原理**：`Thread` 类持有 `threadLocals` 字段（`ThreadLocalMap` 类型）。调用 `set()` 时先取当前线程的 map，再以 `ThreadLocal` 实例本身为 key 写入：

```java
public void set(T value) {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = t.threadLocals; // 首次调用才创建
    if (map != null) map.set(this, value);
    else createMap(t, value);
}
```

同一线程声明多个 `ThreadLocal`，共用这一张 map。`ThreadLocalMap` 处理哈希冲突用的是线性探测（开放寻址），而非 HashMap 的链表法。

**延伸**：正因为值跟着线程走，线程销毁则数据自然回收——这也是「线程池复用线程」会引出泄漏问题的结构性原因。

> 追问：key 的哈希码如何设计？提示：`AtomicInteger` 累加黄金分割数 `0x61c88647`，让哈希值在 2 的幂数组上分布最均匀。

### ThreadLocal 为什么会内存泄漏？key 为什么要设计成弱引用？

**结论**：`Entry` 的 key 是对 `ThreadLocal` 的弱引用，value 却是强引用。`ThreadLocal` 失去外部强引用后 key 被 GC 回收变成 null，value 却因线程存活而残留在 map 中，形成泄漏。

**原理**：引用链是 `Thread → ThreadLocalMap → Entry →(强) value`。线程池里核心线程长期存活，key 为 null 的过期条目会不断累积。若 key 用强引用，外部即使放弃 `ThreadLocal`，entry 也拽着它不放，key 和 value 双双泄漏；弱引用至少保证 key 可回收，且 `get/set/remove` 时会顺带清理过期条目——但这只是被动兜底，不可靠。

**延伸**：标准对策两条——`ThreadLocal` 声明为 `static final` 避免重复创建实例；用完在 `finally` 中 `remove()`。泄漏之外还有脏数据风险：线程复用时下一个任务可能读到上一个任务遗留的用户上下文。

> 追问：为什么泄漏在线程池场景被放大？提示：从「线程不死，map 不回收」与「跨任务数据污染」两条路径回答。

### 异步或线程池场景下，如何跨线程传递 ThreadLocal 的值？

**结论**：值绑定在线程上，异步切线程后天然丢失。JDK 的 `InheritableThreadLocal` 只能在线程创建瞬间复制一次，解决不了线程池复用；工程方案是阿里的 `TransmittableThreadLocal`（TTL）。

**原理**：`InheritableThreadLocal` 在 `Thread` 构造时把父线程的 `inheritableThreadLocals` 拷贝给子线程，但线程池里的线程只创建一次，后续任务拿到的可能是上一个任务的脏数据。TTL 改为与任务绑定，用装饰器包装任务，分三步（CRR）：

- **Capture**：提交任务时捕获父线程所有 TTL 变量的快照；
- **Replay**：工作线程执行前把快照写入，并备份该线程的旧值；
- **Restore**：执行完恢复旧值，杜绝污染。

**延伸**：接入方式有显式包装（`TtlRunnable.get()` / `TtlExecutors`）和 Java Agent 字节码增强两种。典型场景是 TraceId、用户上下文、压测流量标记的透传。

> 追问：子线程里修改 TTL 的值会污染父线程吗？提示：取决于重写的 `copy()` 是否做了深拷贝。

## 线程池

### 为什么不推荐用 Executors 创建线程池？

**结论**：`FixedThreadPool` 与 `SingleThreadExecutor` 的任务队列容量是 `Integer.MAX_VALUE`，任务无限堆积导致 OOM；`CachedThreadPool` 最大线程数无上限，可能创建海量线程同样 OOM。

**原理**：看工厂方法的源码即可确认：

```java
// 队列等效无界，永远塞不满
new ThreadPoolExecutor(n, n, 0L, MS, new LinkedBlockingQueue<Runnable>());
// 最大线程数等效无限，队列又不存元素
new ThreadPoolExecutor(0, Integer.MAX_VALUE, 60L, SECONDS, new SynchronousQueue<>());
```

《阿里巴巴 Java 开发手册》强制改用 `ThreadPoolExecutor` 构造方法，目的就是逼开发者显式面对队列容量、最大线程数、拒绝策略这三个决定系统生死的参数。

**延伸**：`ScheduledThreadPool` 用的 `DelayedWorkQueue` 也是无界队列，存在同样的堆积风险。

> 追问：有界队列加拒绝策略与无界队列的本质区别是什么？提示：前者把压力显式暴露给提交方，后者悄悄吃掉内存直到崩溃。

### 线程池处理任务的流程是怎样的？

**结论**：任务按「核心线程 → 任务队列 → 非核心线程 → 拒绝策略」四步流动。

**原理**：当前线程数小于 `corePoolSize`，直接新建线程执行；达到核心数后先入队排队；队列满了且线程数小于 `maximumPoolSize`，才创建非核心线程；全部占满则触发 `RejectedExecutionHandler`。注意队列优先于扩容——这正是 `SynchronousQueue`（不存元素）配 `CachedThreadPool` 会疯狂建线程的原因。空闲的非核心线程超过 `keepAliveTime` 会被回收，核心线程默认常驻，除非开启 `allowCoreThreadTimeOut`。

**延伸**：提交任务前可调用 `prestartAllCoreThreads()` 预热，避免冷启动时首批任务承担建线程的延迟。

> 追问：为什么要先入队再扩线程？提示：队列是削峰的廉价手段，线程是昂贵资源，扩容应滞后于缓冲。

### 线程池的拒绝策略有哪些？CallerRunsPolicy 有什么风险？

**结论**：内置四种——`AbortPolicy` 抛 `RejectedExecutionException`（默认）、`CallerRunsPolicy` 回退给提交线程同步执行、`DiscardPolicy` 静默丢弃、`DiscardOldestPolicy` 丢弃队首最老任务。

**原理**：`CallerRunsPolicy` 让提交者自己跑任务，天然形成反压、降低提交速度；代价是若任务耗时，提交线程（比如主线程或 Netty IO 线程）会被堵死，后续任务全部卡在提交阶段。且它只在池未关闭时生效，并非「绝不丢任务」。

**延伸**：要强保证需配合持久化兜底——拒绝时落任务表或发 MQ，有空闲再捞回执行；也可参考 Netty 另起临时线程、ActiveMQ 限时 `offer` 等待入队的思路。

> 追问：如何设计带降级和告警的自定义拒绝策略？提示：实现接口，结合 metrics 上报、异步落盘与限流熔断。

### 任务抛出异常后，线程池中的线程是销毁还是复用？

**结论**：`execute()` 提交的任务抛出未捕获异常，所在线程终止，线程池新建线程补齐；`submit()` 提交的异常被封进 `Future`，线程继续复用。

**原理**：`execute` 的异常会从 worker 的运行循环中抛出导致线程退出，线程池检测到后补偿一个同配置的新线程；`submit` 的任务被包装成 `FutureTask`，异常通过 `setException` 存进结果对象，只在 `get()` 时以 `ExecutionException` 形式抛出，线程本身安然无恙。

**延伸**：用 `submit` 却从不 `get`，异常会无声消失。对策：任务内自行 try-catch、记得 `get()`，或重写 `afterExecute` 统一提取异常。

> 追问：`afterExecute` 里如何拿到任务异常？提示：参数是 `Future` 时调 `get()` 捕获 `ExecutionException`，或直接捕获 `Runnable` 包装层的异常。

### 线程池的大小如何设定？

**结论**：没有银弹。经验公式：CPU 密集型设为 N+1（N 为核数），IO 密集型约 2N；更严谨的版本是 N × (1 + 等待时间 / 计算时间）。

**原理**：线程太少，CPU 吃不满、任务排长队；太多，上下文切换吞掉收益。IO 密集型任务大部分时间在等网络或磁盘，线程让出 CPU 的时间多，可以超配；CPU 密集型多出一个线程只为兜底缺页中断等偶发停顿。

**延伸**：公式只是起点。生产上靠压测加监控迭代——盯活跃线程数、队列深度、拒绝次数三个指标；美团公开的线程池参数动态化方案（配合配置中心热更新 `corePoolSize` 等）是成熟参照。

> 追问：如何判断任务是 CPU 密集还是 IO 密集？提示：看线程时间分布，用 JFR 或 VisualVM 统计运行态与等待态的比例。

## 异步编排

### Future 有什么局限？CompletableFuture 解决了什么？

**结论**：`Future` 只能 `get()` 阻塞取结果，不支持回调、不支持任务编排，多个 `Future` 组合只能人工轮询。`CompletableFuture` 同时实现 `Future` 与 `CompletionStage`，补齐了链式编排、回调和异常处理。

**原理**：`CompletionStage` 把异步计算抽象为阶段，`thenApply`（转换）、`thenCompose`（扁平串联）、`thenCombine`（两路合并）、`allOf/anyOf`（多路聚合）把阶段拼成流水线。默认跑在 `ForkJoinPool.commonPool`——全局共享池，生产上必须显式传自定义线程池做隔离。

**延伸**：异常处理三件套的分工：`exceptionally` 只在异常时执行并给兜底值，`handle` 正常异常都走并产出新结果，`whenComplete` 只观察不改变结果。

> 追问：`allOf` 中任一任务异常会怎样？提示：整体异常完成，但其他任务的正常结果仍需回到各自的 future 上单独取。

### 任务 T3 必须等 T1、T2 都完成才执行，怎么设计？

**结论**：`CompletableFuture.allOf(t1, t2).thenRunAsync(t3)`，并挂上异常处理。

**原理**：

```java
CompletableFuture<Void> t1 = CompletableFuture.runAsync(() -> task1(), executor);
CompletableFuture<Void> t2 = CompletableFuture.runAsync(() -> task2(), executor);
CompletableFuture.allOf(t1, t2)
        .thenRunAsync(() -> task3(), executor)
        .exceptionally(ex -> { log.error("pipeline failed", ex); return null; });
```

`allOf` 只聚合完成状态，不负责并行——是否并行取决于任务各自的提交方式与执行器。任一前置失败，聚合结果即异常完成，靠 `exceptionally/handle` 兜底，否则异常会静默吞掉。

**延伸**：需要消费前序返回值时用 `thenCombine(t1, t2, (a, b) -> ...)`；只要求任一完成则用 `anyOf`。老式写法是 `CountDownLatch` 倒数等待，可对比体会表达力差距。

> 追问：如果 T3 依赖的是 T1、T2 中谁先完成的结果呢？提示：`applyToEither` 或 `anyOf` 后取先到者的结果。

## AQS 与同步工具

### AQS 的核心原理是什么？

**结论**：AQS 用一个 `volatile int state` 表示同步状态，配一条 CLH 变体的双向等待队列，把「抢不到就排队阻塞、释放后唤醒后继」的通用流程固化成模板方法，子类只需实现 `tryAcquire/tryRelease` 等少量钩子。

**原理**：`state` 的更新走 CAS（`compareAndSetState`），保证原子性；抢资源失败的线程被封装成 Node 入队，先自旋重试，失败则 `park` 阻塞，前驱释放时 `unpark` 后继。同一副骨架，语义天差地别——`ReentrantLock` 用 state 记重入次数，`CountDownLatch` 用 state 记剩余倒数，`Semaphore` 用 state 记可用许可。

**延伸**：JDK 17 之后节点字段与入队实现有较大调整，但「状态 + 队列 + 模板方法」的核心思想未变，读新源码时对照这三个概念即可。

> 追问：AQS 队列为什么从 CLH 的单向链表改成双向？提示：取消等待与超时场景需要向前遍历并传播状态。

### CountDownLatch、CyclicBarrier、Semaphore 三者有什么区别？

**结论**：`CountDownLatch` 是一次性倒数器，线程等事件；`CyclicBarrier` 是可循环栅栏，线程等线程；`Semaphore` 是许可池，控制同时访问资源的并发数。

**原理**：Latch 基于 AQS 共享模式，state 初始为计数，`countDown()` 减到 0 时 `await()` 的线程全部唤醒，不可复位；Barrier 基于 `ReentrantLock + Condition`，固定 parties 个线程到齐后放行并自动重置进入下一代，还可注册一个 barrierAction 在放行前执行；Semaphore 的 state 即许可数，`acquire/release` 不要求同一线程完成——它没有锁的所有权语义，这是与互斥锁的本质差异。

**延伸**：选型口诀——主流程等 N 个子任务收尾用 Latch；分阶段并行计算、每轮对齐一次用 Barrier；单机限流、连接池配额用 Semaphore（分布式限流请出门左转 Redis + Lua）。

> 追问：CyclicBarrier 等待途中某线程被中断会怎样？提示：栅栏进入 broken 状态，其余等待线程收到 `BrokenBarrierException`，必须 `reset()` 才能复用。
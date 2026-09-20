---
title: "ThreadLocal 详解"
date: 2020-12-26 12:48:00
updated: 2020-12-26 12:48:00
permalink: knowledge/java/concurrent/threadlocal/
categories:
  - Java
tags:
  - Java并发
  - ThreadLocal
description: "从线程封闭出发，拆解 ThreadLocalMap 弱引用 Entry、线性探测与清理机制，剖析内存泄漏的真正根因，并给出线程池与跨线程上下文传递的正确姿势。"
---

ThreadLocal 用「每个线程一份副本」的方式实现线程封闭，是不加锁也能安全使用可变状态的经典手段；但 ThreadLocalMap 的弱引用 key 设计埋下了内存泄漏隐患，线程池场景下必须显式 remove。本文从数据结构一路讲到实战规范。

<!-- more -->

## 它解决什么问题

多线程共享可变变量通常要靠锁，而锁意味着竞争、阻塞与上下文切换。另一类思路是干脆不共享：让每个线程持有自己的独立副本，天然无须同步。这就是线程封闭（Thread Confinement），ThreadLocal 正是 JDK 对这一思想的官方实现。典型场景包括：为非线程安全的 SimpleDateFormat 在每个线程各备一份实例、在 MDC 中存放 traceId 让日志框架随手可取、在 Web 框架里传递当前请求的登录用户与租户上下文。

## 核心原理

结构上最关键的设计是「反转持有关系」：ThreadLocal 本身并不存数据，真正的数据存放在每个 Thread 对象的 threadLocals 字段里，那是一个 ThreadLocalMap。可以把 ThreadLocal 理解成一把钥匙——get/set 时先拿到当前线程，再到当前线程自己的 Map 里按钥匙读写。每个线程只碰自己的 Map，竞争在结构上就不存在，这是它无需加锁的根本原因。

ThreadLocalMap 与 HashMap 形似而神不同：它的 Entry 继承 WeakReference，key 是对 ThreadLocal 的弱引用，value 则是强引用；它没有链表，冲突靠开放寻址的线性探测解决；容量同样是 2 的幂，定位靠 `key.threadLocalHashCode & (len - 1)`。

## 深入机制

### 哈希与线性探测

每个 ThreadLocal 实例在创建时领取一个哈希码，取自一个全局 AtomicInteger 的累加值——每次创建累加 `0x61c88647`。这个常数源于黄金分割比例的乘法散列，能让连续创建的多个 ThreadLocal 在 2 的幂数组上分布得更均匀，压低探测长度。冲突发生时不挂链，而是向后逐槽位找空位插入；因此装载因子必须压得更低——扩容阈值是数组长度的 2/3，而不是 HashMap 的 0.75。

### 内存泄漏的真正原因

Entry 的 key 是弱引用：一旦业务代码不再持有某个 ThreadLocal 的强引用，GC 之后 key 被置空，Entry 就退化成「key 为 null、value 仍活着」的过期条目。此时 value 的回收只剩两条路：线程死亡导致整个 Map 不可达，或者后续 get/set 顺路清理——set 与 get 遇见过期条目会触发探测式清理 `expungeStaleEntry`，set 末尾还会做一次启发式清理 `cleanSomeSlots`，rehash 前也会全表清扫。

所以泄漏的本质不是「用了弱引用」，而是「线程不死 + 不再触发清理」：线程池里的 worker 长期存活，任务结束后若不 remove，value 就被 worker 的 Map 一直强引用着。大对象如此堆积，若 value 还持有其 Class，更会连带拖住整个 ClassLoader，在频繁部署的容器里酿成 Metaspace 溢出。反过来要看到：弱引用 key 恰恰是保护设计——它至少保证 ThreadLocal 本身可被回收，把问题收窄为 value 的暂时滞留。

### 正确用法范式

```java
public class TraceContext {
    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    public static void set(String traceId) { TRACE_ID.set(traceId); }
    public static String get() { return TRACE_ID.get(); }
    public static void clear() { TRACE_ID.remove(); }
}
```

要点有两个。其一，ThreadLocal 用 static final 持有：它本该是「全局唯一的钥匙」，静态持有保证钥匙始终有强引用、不会因 GC 变成 null key；若每次请求都 new 一个 ThreadLocal，既浪费槽位又源源不断制造过期条目。其二，用完必须在 finally 里 remove：

```java
try {
    TraceContext.set(traceId);
    chain.doFilter(request, response);
} finally {
    TraceContext.clear(); // worker 归还线程池之前必须清理
}
```

### 继承传递与线程池失效

InheritableThreadLocal 让子线程在创建时拷贝父线程的 inheritableThreadLocals，实现「父子传递」。但拷贝只发生在 `new Thread()` 的初始化阶段——线程池的 worker 早已建好，之后每次提交任务不会再触发拷贝，第一次带进来的旧值还会跨任务残留。这正是 InheritableThreadLocal 在线程池下给出错误答案的原因。

TransmittableThreadLocal（阿里开源的 TTL）的破解思路是把传递时机从「建线程」挪到「提交任务」：用装饰器包装 Runnable/Callable 或线程池，在 submit 那一刻捕获父线程快照，任务执行前回放、执行后清理恢复。Spring 体系中常见的自定义线程池装饰器在 execute 时复制 MDC 上下文，本质是同一种「捕获—回放—恢复」模式。

## 工程实践

- 清理动作必须放在 finally 或拦截器的 afterCompletion 中：只在正常分支 remove，异常路径上脏数据会留给下一个复用该线程的请求，表现为「串单」级别的诡异 bug。
- 不要把 ThreadLocal 当跨层传参的隐式通道滥用——它让方法签名说谎，排查时极难看穿。只用于真正的横切上下文：trace、用户、租户、事务资源。
- 异步编排（CompletableFuture、线程池 submit）会切换执行线程，ThreadLocal 值不会自动跟过去，需要显式捕获回放，或直接引入 TTL。
- 虚拟线程普及后更要谨慎：每任务一个虚拟线程意味着 ThreadLocal 副本数随任务量暴涨，用它缓存大对象的做法要重新评估。

## 对比与权衡

| 维度 | ThreadLocal | InheritableThreadLocal | TransmittableThreadLocal |
| --- | --- | --- | --- |
| 数据归属 | 当前线程私有 | 创建子线程时拷贝一份 | 提交任务时捕获并回放 |
| 线程池复用 | 不清理则残留，需 remove | 仅建线程时拷贝，复用场景失效 | 通过装饰任务/执行器正确传递 |
| 典型场景 | 线程内上下文隔离 | 手工 new Thread 的简单父子传递 | 线程池与异步框架下的上下文传递 |
| 使用成本 | JDK 内置 | JDK 内置 | 第三方依赖 + 包装执行器或 Agent |

## 面试视角

**ThreadLocal 为什么会内存泄漏？** 根因是 Entry 的 key 为弱引用、value 为强引用：ThreadLocal 失去强引用后 key 被 GC 清空，value 仍被线程的 Map 持有。线程池 worker 长期存活且后续操作未必触发清理，value 便持续滞留。规范用法是 static 持有钥匙、用完 remove。

**既然怕泄漏，为什么 key 还要设计成弱引用？** 若 key 也是强引用，ThreadLocal 对象本身将永远无法回收，泄漏会更彻底。弱引用至少保证 key 可被回收，把问题收窄为 value 的暂时滞留，同时 Map 读写时还会顺带清理过期条目。

**ThreadLocalMap 为什么用线性探测而非拉链法？** 每个线程的 ThreadLocal 数量极少（通常个位数），开放寻址在低装载因子下缓存友好、实现简单；配合黄金分割散列增量，冲突概率被压得很低，引入链表的复杂度得不偿失。

**InheritableThreadLocal 在线程池下有什么问题？** 值的拷贝只发生在子线程创建那一刻；线程池复用 worker，后续任务看到的仍是建线程时的旧快照，且跨任务残留。解决方向是把传递时机改到任务提交点，即 TransmittableThreadLocal 的思路。

## 小结

- ThreadLocal 通过「数据存进线程自身」实现线程封闭，以空间换隔离，规避加锁。
- ThreadLocalMap 采用弱引用 key + 开放寻址；泄漏根因是长寿命线程中滞留的强引用 value，弱引用 key 反而是保护设计。
- 工程铁律：static final 持有 ThreadLocal，try/finally 中 remove。
- 跨线程传递分清时机：手工建线程用 InheritableThreadLocal，线程池复用必须靠 TransmittableThreadLocal 这类「提交时捕获」方案。
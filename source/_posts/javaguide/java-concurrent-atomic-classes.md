---
title: "Atomic 原子类总结"
date: 2020-10-03 13:45:00
updated: 2020-10-03 13:45:00
permalink: knowledge/java/concurrent/atomic-classes/
categories:
  - Java
tags:
  - Java并发
  - 原子类
description: "按能力分组梳理 JUC 原子类：基本类型、数组、引用、字段更新器与 Adder/Accumulator，讲清 CAS 底层与 LongAdder 分段思想，并给出选型表。"
---

`java.util.concurrent.atomic` 包用 CAS 无锁算法为「单变量更新」提供了整套线程安全方案：从 AtomicInteger 到 LongAdder，覆盖了标量、数组、引用、字段和累加器五类需求。本文按能力分组拆解，并回答什么时候该从 AtomicLong 换成 LongAdder。

<!-- more -->

## 它解决什么问题

多线程下 `i++` 不是原子操作，加锁又太重——为一次自增付出 monitor 进出、队列阻塞的代价并不划算。原子类把「读-改-写」收敛为一条 CPU 原子指令（CAS），在无竞争时几乎零开销，有竞争时也只是失败重试而非挂起线程。它面向的是「单个变量的短小更新」这一狭窄但高频的场景：计数器、状态位、序列号、引用切换。一旦业务涉及多个变量的一致性或长流程，原子类就不在射程内了，那是锁的领域。

## 核心原理：CAS 与 volatile 的组合

以 AtomicInteger 为例，内部只有一个 `volatile int value`，所有更新最终落到 `Unsafe`（JDK 9 后为 VarHandle）的 `compareAndSetInt`：比较内存当前值与期望值，相等才写入新值，一步原子完成。`volatile` 保证可见性与有序性，CAS 保证复合操作的原子性，两者合起来等价于一个极简的无锁同步器。

失败处理交给调用方：`compareAndSet` 返回 false 只说明「有人抢先」，线程不被挂起，典型用法是自旋重试：

```java
AtomicInteger seq = new AtomicInteger(0);

public int nextId() {
    int prev;
    int next;
    do {
        prev = seq.get();
        next = prev + 1;
    } while (!seq.compareAndSet(prev, next));
    return next;
}
```

这段循环正是 `incrementAndGet()` 内部的逻辑。需要留意 `lazySet`：它以普通写语义设置新值，不保证其他线程立即可见，只保证最终一致，适合日志位、统计值这类对时效不敏感的场景，换取省掉内存屏障的开销。

## 深入机制：五组原子类

### 基本类型组

`AtomicInteger`、`AtomicLong`、`AtomicBoolean` 方法集几乎一致：`get`、`getAndIncrement`、`getAndAdd`、`compareAndSet`、`lazySet`。它们是低竞争下计数和状态标志的默认选择。

### 数组组

`AtomicIntegerArray`、`AtomicLongArray`、`AtomicReferenceArray` 把原子操作下沉到数组的每个元素，方法多一个下标参数。注意数组本身的引用不可变，原子性只覆盖单个元素的读写：

```java
AtomicIntegerArray hits = new AtomicIntegerArray(8);
hits.getAndIncrement(3);                       // 只原子更新下标 3
hits.compareAndSet(3, 1, 100);                 // 对单个元素做 CAS
```

### 引用组

`AtomicReference` 让「整体换一个对象」成为原子操作，配合不可变对象可以实现无锁的读写切换（典型如配置热更新）：

```java
AtomicReference<Config> holder = new AtomicReference<>(loadConfig());

public void reload() {
    holder.set(loadConfig());   // 读者永远拿到完整的旧配置或新配置
}
```

引用组的两个变体解决 ABA 问题：`AtomicStampedReference` 给引用绑一个 int 版本号，CAS 时引用与版本必须同时匹配，可感知「A→B→A」的中间变化；`AtomicMarkableReference` 只绑 boolean 标记，表达「是否被碰过」这一种信息。

### 字段更新器组

`AtomicIntegerFieldUpdater`、`AtomicLongFieldUpdater`、`AtomicReferenceFieldUpdater` 用于「类已存在且实例很多，不想为每个实例新增一个 Atomic 字段」的场景。约束严格：目标字段必须是 `volatile` 修饰、非 static 非 final、类型匹配，且对更新器可见：

```java
public class Node {
    volatile int state;
    private static final AtomicIntegerFieldUpdater<Node> STATE =
        AtomicIntegerFieldUpdater.newUpdater(Node.class, "state");

    boolean casState(int expect, int update) {
        return STATE.compareAndSet(this, expect, update);
    }
}
```

更新器是基于反射与 Unsafe 的静态工具，一百万个 Node 只共享一个 updater，比每个实例背一个 AtomicInteger 省内存。Netty 等框架大量使用这一模式。

### Adder 与 Accumulator 组

高竞争下，AtomicLong 的所有线程 CAS 同一个 value，失败率飙升。`LongAdder` 的思路是分段：内部维护一个 base 值和一组 Cell 单元，线程按哈希落到不同 Cell 上各自累加，只有 Cell 初始化或扩容冲突时才竞争，`sum()` 时把 base 与所有 Cell 加起来。

```java
LongAdder requests = new LongAdder();
requests.increment();
long total = requests.sum();   // 汇总，非原子快照
```

这是典型的空间换时间：写路径把单点竞争摊到多个缓存行（Cell 做了缓存行填充避免伪共享），吞吐随线程数近似线性；读路径 `sum()` 在并发写入时不是原子快照，只保证最终一致——监控计数、命中率统计这类「允许毫秒级误差」的场景正合适，对账结算则不行。`LongAccumulator` 把累加推广为任意二元运算（如 max、乘积），`DoubleAdder/DoubleAccumulator` 是浮点版本（注意浮点累加不保证结合律下的精确一致）。

## 工程实践

- **低竞争用 AtomicLong，高竞争只统计用 LongAdder**。经验分界大致是线程数超过 CPU 核数且冲突频繁时换 Adder；需要精确读值的场景（如发号器余额）仍用 AtomicLong 的 `get`。
- **别在 CAS 循环里放副作用**。重试意味着循环体可能执行多次，里面写日志、发消息会重复执行。
- **统计大盘用 Adder，报表口径要说明**。`sum()` 读到的是「求和瞬间各 Cell 的混合视图」，定时任务采样没问题，跨系统对账请改用事务或离线日志。
- **FieldUpdater 是框架级优化**。普通业务代码优先用 Atomic 字段，可读性远好于 updater；只有实例数量巨大、内存敏感时才值得引入。

## 对比与权衡

| 场景需求 | 推荐 | 理由 |
| --- | --- | --- |
| 低竞争计数、状态位 | AtomicInteger/Long/Boolean | 单变量 CAS，无竞争时开销接近普通读写 |
| 高并发纯统计（计数/求和） | LongAdder | Cell 分段消除热点，吞吐随线程扩展 |
| 高并发自定义聚合（max 等） | LongAccumulator | 加法之外的任意结合律二元运算 |
| 原子更新数组元素 | AtomicIntegerArray 等 | 元素级 CAS，数组引用不变 |
| 整体替换对象（配置热更） | AtomicReference | 引用切换原子，读者视角完整 |
| 需感知 ABA | AtomicStampedReference | 引用 + 版本戳双重校验 |
| 存量类大实例数字段 | AtomicXxxFieldUpdater | 省内存，要求 volatile 非 final 字段 |
| 需要精确一致的读 | AtomicLong（而非 Adder） | sum() 非原子快照 |

## 面试视角

**AtomicInteger 的原理是什么？** 内部一个 volatile 变量保证可见性，更新通过 CAS 指令完成：比较当前值与期望值，相等才写入，失败重试。volatile + CAS 的组合提供了原子性与可见性，无需加锁，低竞争下远轻于 synchronized。

**AtomicLong 和 LongAdder 怎么选？** AtomicLong 是所有线程竞争同一个变量，冲突激烈时大量 CAS 失败自旋；LongAdder 把值分散到 base 与多个 Cell，线程落不同单元各自累加，sum 时汇总。高并发只增统计用 LongAdder；需要随时读到精确值、或并发不高时用 AtomicLong。

**LongAdder 的 sum() 为什么不准确？** sum 只是遍历 base 与所有 Cell 求和，过程中其他线程仍在写入，拿到的是不同时间点的混合视图，并非某一瞬间的原子快照。它保证没有并发写入时的结果正确，适合监控统计，不适合对账。

**什么是 ABA 问题，原子类怎么应对？** 值从 A 变 B 再变回 A，CAS 检查时误以为没变过。若中间变化有副作用（如无锁栈节点复用），就会出错。`AtomicStampedReference` 把引用与 int 版本号绑定，CAS 同时校验两者，可识别任意次中间变化。

## 小结

- 原子类 = volatile 可见性 + CAS 原子性，面向单变量短更新，失败重试而非阻塞。
- 按能力分五组：基本类型、数组、引用（含 Stamped/Markable 解 ABA）、字段更新器（省内存的框架级工具）、Adder/Accumulator（分段聚合）。
- 高竞争统计首选 LongAdder，接受 sum() 非原子快照的代价；需要精确读值回到 AtomicLong；多变量一致性超出原子类能力，用锁或不可变对象整体 CAS。
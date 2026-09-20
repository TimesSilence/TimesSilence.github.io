---
title: "CAS 详解"
date: 2020-10-13 14:52:00
updated: 2020-10-13 14:52:00
permalink: knowledge/java/concurrent/cas/
categories:
  - Java
tags:
  - Java并发
  - CAS
description: "从乐观锁本质出发，拆解 CAS 的 Unsafe 实现与 CPU 原子指令、ABA 问题与 AtomicStampedReference、自旋开销，以及 LongAdder 分段思想相对 AtomicLong 的取舍。"
---

CAS（Compare-And-Swap）是乐观并发控制的硬件基石：比较内存当前值与期望值，相等才原子地换成新值。它不需要互斥就让单变量更新具备原子性，JUC 的原子类、AQS 的 state 变更都建立在这条指令之上。

<!-- more -->

## 它解决什么问题

悲观锁的思路是「先独占，再操作」：进入临界区前必须拿到锁，拿不到就阻塞。阻塞意味着上下文切换，竞争一多，调度开销常常超过临界区本身的耗时。

乐观锁反过来：**先假设没有冲突，直接动手；提交前校验一下有没有被别人改过，改过了就重来**。CAS 正是这个「校验并提交」动作的原子化实现。它回答三个问题：内存位置 V、期望值 A、新值 B——仅当 V 当前仍等于 A 时才写入 B，否则什么都不做。整个判断与写入由硬件保证不可中断，于是单变量的读-改-写不再需要锁。

代价也随之而来：CAS 只保护那一次比较与交换，多次 CAS 之间别的线程随意穿插，它不承诺业务层面的整体原子性；失败要重试，重试要烧 CPU。理解 CAS 就是理解这笔交换的边界。

## 核心原理

### 从 Java 方法到 CPU 指令

Java 侧表达 CAS 的入口是 `sun.misc.Unsafe`（JDK 9 之后更推荐 `VarHandle`），它提供三个 native 方法：

```java
boolean compareAndSwapObject(Object o, long offset, Object expected, Object x);
boolean compareAndSwapInt(Object o, long offset, int expected, int x);
boolean compareAndSwapLong(Object o, long offset, long expected, long x);
```

参数里的 `offset` 是字段在对象内存布局中的偏移量，配合对象引用即可定位到要修改的那块内存。HotSpot 会把这些调用识别为 intrinsic，在 JIT 编译时直接映射到目标平台的原子指令——x86 上是带 `LOCK` 前缀的 `CMPXCHG`，ARM 上是对应的 LL/SC 指令对。`LOCK` 前缀保证指令执行期间该缓存行的访问不被其他核插入，这就是「原子」二字的物理来源。具体实现取决于 JVM 与 CPU 架构，并非某种固定的 JNI 汇编写法。

### AtomicInteger 的标准套路

`java.util.concurrent.atomic` 包下的原子类全都建立在同一套模式上。以 `AtomicInteger`（JDK 8）为例：

```java
private static final Unsafe unsafe = Unsafe.getUnsafe();
private static final long valueOffset;

static {
    try {
        valueOffset = unsafe.objectFieldOffset
            (AtomicInteger.class.getDeclaredField("value"));
    } catch (Exception ex) { throw new Error(ex); }
}

private volatile int value;

public final boolean compareAndSet(int expect, int update) {
    return unsafe.compareAndSwapInt(this, valueOffset, expect, update);
}

public final int getAndIncrement() {
    return unsafe.getAndAddInt(this, valueOffset, 1);
}
```

三个要素一目了然：`value` 用 volatile 修饰保证可见性，`valueOffset` 在静态块里算好，`compareAndSet` 一行转发给 Unsafe。自增这样的复合操作则靠自旋完成：

```java
public final int getAndAddInt(Object o, long offset, int delta) {
    int v;
    do {
        v = getIntVolatile(o, offset);
    } while (!compareAndSwapInt(o, offset, v, v + delta));
    return v;
}
```

循环体每次先 volatile 读到当前值 v，再尝试 CAS 写成 v+delta；失败说明期间被别人改过，读新值再来一轮，直到成功。这就是「CAS + 自旋」的万能模板，也是自旋锁的最小形态。

## 深入机制

### ABA 问题与版本戳

CAS 只比较「值是否还等于 A」，可值等于 A 不代表没动过。想象一个用 CAS 维护的无锁栈，栈顶指针从 A 节点出发，期间被另一线程弹出 A、压入 B、又压回一个地址复用的 A——比较时看到的还是 A，但栈的内部结构早已面目全非。这就是 ABA 问题：对纯数值通常无害，对依赖「中间没发生过变化」这一前提的结构（链表、栈）可能是致命的。

标准解法是给每次变更配一个单调递增的**版本号/时间戳**，比较时连值带版本一起校验。JDK 的 `AtomicStampedReference` 就是这个思路：

```java
public boolean compareAndSet(V   expectedReference,
                             V   newReference,
                             int expectedStamp,
                             int newStamp) {
    Pair<V> current = pair;
    return
        expectedReference == current.reference &&
        expectedStamp == current.stamp &&
        ((newReference == current.reference &&
          newStamp == current.stamp) ||
         casPair(current, Pair.of(newReference, newStamp)));
}
```

引用与 stamp 被打包进一个不可变的 `Pair`，CAS 换的是整个 Pair 对象：值相同但 stamp 不同，照样判定失败。JDK 还提供只比较版本的 `AtomicMarkableReference`。工程上还有一条绕开 ABA 的路：像 `ConcurrentLinkedQueue` 那样每次变更都换全新节点对象，靠对象唯一性而非值比较来判断「没动过」。

### 自旋的代价

CAS 失败必须重试，高竞争下重试率飙升，CPU 大量时间花在空转上。两个缓解手段：

- **`pause` 指令**：自旋循环中插入它，一方面让流水线稍作停顿降低功耗，另一方面避免退出循环时因内存顺序冲突导致流水线清空。HotSpot 的自旋逻辑已内置。
- **退避（backoff）与降级**：连续失败时指数退避，或者干脆在高竞争场景换成分段结构或锁。CAS 的优势区间是低中竞争，不是万能替代。

另外记住 CAS 的天然边界：**一条指令只护得住一个内存位置**。要原子地更新多个字段，要么把它们封装进一个不可变对象用 `AtomicReference` 整体替换，要么回到锁。

### LongAdder：把热点拆开

`AtomicLong` 在高并发计数上的瓶颈很物理：所有线程对同一个缓存行做 CAS，失败率随线程数上升，缓存行在核间反复失效。`LongAdder` 的答案是**分段**——内部维护一个 `base` 值加一组 `Cell` 单元：

- 无竞争或低竞争时，直接 CAS 更新 `base`，开销与 `AtomicLong` 相当；
- 检测到竞争时，线程按哈希分散到不同 `Cell` 上各自累加，热点从一行摊到多行；
- 读取时 `sum()` 把 `base` 和所有 `Cell` 加总。

注意 `sum()` 返回的是**调用瞬间的快照近似**：汇总期间可能有并发累加，结果不保证强一致。统计类指标无所谓，当精确余额用就错了。

## 工程实践

- **按竞争强度选型**：低到中等竞争用 `AtomicInteger/AtomicLong` 足够；线程多、写密集（如全局限流计数、QPS 统计）换 `LongAdder`；需要读到的值实时精确，只能接受 AtomicLong 的开销或加锁。
- **多变量不变量别硬上 CAS**：两个字段必须同时满足某种关系时，封装成不可变对象用 `AtomicReference` 整体替换，或直接上锁。硬拆成多次 CAS 必然出现中间态。
- **警惕 ABA 的隐蔽性**：数值自增自减通常无感，但涉及对象复用（内存池、无锁数据结构）时，先问自己「值相等能否推出没变化」，答不上来就加版本戳。
- **别让 CAS 做重活**：自旋临界区里若夹杂慢操作（IO、锁），重试风暴会放大成 CPU 打满，比锁更难排查。

## 对比与权衡

| 维度 | synchronized | CAS 原子类（AtomicLong） | LongAdder |
| --- | --- | --- | --- |
| 并发策略 | 互斥阻塞 | 乐观重试，单热点 | 乐观重试，分段摊热点 |
| 低竞争开销 | 较高（有锁获取释放路径） | 低 | 低 |
| 高竞争表现 | 线程排队，吞吐受限 | 自旋空转，CPU 飙升 | 分散冲突，吞吐高 |
| 读一致性 | 临界区内强一致 | 读到的是某一时刻的真实值 | `sum()` 为弱一致快照 |
| 内存占用 | 无额外结构 | 一个值 | base + Cell 数组，竞争越大占用越多 |
| 典型场景 | 复杂不变量、多字段 | 低中竞争计数、状态翻转 | 高并发统计、监控计数 |

一句话：CAS 赢在无争用时的轻量，LongAdder 赢在高争用时的可扩展，锁赢在语义的普适与安全。

## 面试视角

**CAS 是怎么保证原子性的？** Java 层通过 `Unsafe.compareAndSwapXxx` 表达语义，HotSpot 将其编译为目标平台的原子指令，如 x86 的 `LOCK CMPXCHG`。LOCK 前缀保证比较与交换之间其他核无法干预该缓存行，原子性由硬件提供。

**ABA 问题怎么解决？** 本质是「值相等推不出没变化」。方案是给每次变更附加版本号或时间戳，比较时值与版本一起校验，JDK 对应 `AtomicStampedReference`/`AtomicMarkableReference`；或者像无锁队列那样每次替换都用新对象，靠对象身份规避。

**CAS 有什么缺点？** 三个：一是 ABA；二是高竞争下自旋重试开销大；三是只能原子更新单个变量，多字段不变量需要封装对象或回到锁。

**LongAdder 为什么比 AtomicLong 快？** AtomicLong 让所有线程竞争同一个缓存行，冲突率随线程数线性上升。LongAdder 把累加分散到 base 与多个 Cell 单元，大幅降低单行冲突，读时再汇总。代价是 sum() 只是弱一致快照，且占用更多内存。

**CAS 和 synchronized 怎么选？** 临界区小、竞争不激烈、操作是单变量更新时用 CAS 原子类；临界区涉及多变量不变量、逻辑复杂或竞争激烈到自旋空转时，synchronized（现代 JDK 有锁升级优化）往往更稳也更省 CPU。

## 小结

- CAS 是乐观锁的指令级实现：比较期望值再交换，原子性来自 `LOCK CMPXCHG` 这类硬件指令。
- Java 原子类的套路是「volatile 值 + Unsafe 偏移量 + 自旋重试」，JUC 大量组件都踩着这套模板。
- ABA 用版本戳解决；高竞争用 LongAdder 分段摊平热点；多字段一致性回到锁或整体替换。
- 选型看竞争强度与一致性要求，CAS 不是锁的全面替代，而是低中竞争区间的性能武器。
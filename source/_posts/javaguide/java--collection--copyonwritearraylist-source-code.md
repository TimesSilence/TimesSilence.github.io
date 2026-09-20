---
title: "CopyOnWriteArrayList 源码分析"
date: 2019-04-08 12:38:00
updated: 2019-04-08 12:38:00
permalink: knowledge/java/collection/copyonwritearraylist-source-code/
categories:
  - Java
tags:
  - Java集合
  - 并发
  - CopyOnWrite
description: "拆解 CopyOnWriteArrayList 的写时复制机制：add/set 的加锁拷贝流程、迭代器快照的弱一致性，以及读多写少场景的选型边界。"
---

CopyOnWriteArrayList 是 JUC 中唯一的线程安全 List 实现，思路极为激进：读操作完全无锁，写操作先加锁再整体复制底层数组，改完把引用一次性换掉。它用写时复制换来了读的极致性能，也把适用范围严格限定在「读远多于写」的场景里。

<!-- more -->

## 它解决什么问题

JDK 1.5 之前想要一个线程安全的 List，只有两条路：Vector，或者 `Collections.synchronizedList` 的包装器。两者的本质相同——在互斥锁上串行化所有方法，读读都互斥。而大量真实业务的特征是读操作数量碾压写操作：事件监听器列表、配置项、路由表，可能几天才改一次，但每秒被读几万次。给这样的场景配一把读写互斥的大锁，纯属浪费。

读写锁（ReentrantReadWriteLock）把读读放开了，但写和读仍然互斥，写发生时读要等待。CopyOnWriteArrayList 更进一步：**读不加锁，写也不阻塞读，只有写写互斥**。代价是写的时候复制整个数组——这就是名字里 Copy-On-Write 的含义，也是它一切优点与缺点的根源。

## 核心原理

类的全部家当只有两样：

```java
public class CopyOnWriteArrayList<E>
        implements List<E>, RandomAccess, Cloneable, Serializable {

    final transient ReentrantLock lock = new ReentrantLock();
    private transient volatile Object[] array;

    final Object[] getArray() { return array; }
    final void setArray(Object[] a) { array = a; }
}
```

- `array` 是当前数据快照，用 `volatile` 修饰保证引用替换对所有线程立即可见。关键点在于：任何线程拿到这个引用后，指向的数组内容**永远不会被原地修改**，所有修改都发生在新副本上。数组一旦发布就是事实不可变的。
- `lock` 只服务于写线程之间的互斥，读路径完全不碰它。

读因此退化成一次纯数组取下标：`get(index)` 就是 `getArray()[index]`，无锁、无内存屏障之外的任何开销，性能和裸 ArrayList 几乎一致。写则走固定四步：**加锁 → 复制出新数组 → 在副本上修改 → setArray 换掉引用 → 解锁**。读线程持有的旧数组引用不受任何影响，天然实现了「写不阻塞读」。

## 深入机制

### add：加锁 + 整体拷贝

```java
public boolean add(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        Object[] elements = getArray();
        int len = elements.length;
        Object[] newElements = Arrays.copyOf(elements, len + 1); // 复制旧数组并扩容 1
        newElements[len] = e;                                    // 在副本末尾写入
        setArray(newElements);                                   // volatile 引用替换
        return true;
    } finally {
        lock.unlock();
    }
}
```

几个细节值得注意：

1. **锁只挡写线程**。读线程此时仍在旧数组上自由访问，两边互不感知。释放锁放在 finally 中，保证异常时也能解锁。
2. **没有 ArrayList 式的 grow() 预留容量**。`Arrays.copyOf(elements, len + 1)` 造出的新数组刚好装下所有元素，`size()` 因此直接返回 `getArray().length`。每次 add 都是一次长度为 n 的数组拷贝，时间复杂度 O(n)。
3. **引用替换是发布点**。`setArray` 是唯一对外可见的状态变更，volatile 写保证了新数组内容对其他线程的可见性——按 happens-before 规则，线程在 volatile 写之前对副本的所有修改，对随后读到该 volatile 引用的线程都可见。

顺带一提，JDK 8 用的是 ReentrantLock；较新的 JDK 版本（如 JDK 21）已把锁换成 synchronized 加普通锁对象，语义完全不变，只是 synchronized 经过锁升级优化后已不需要显式锁类。

### set：值相同时也要写回引用

```java
public E set(int index, E element) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        Object[] elements = getArray();
        E oldValue = get(elements, index);
        if (oldValue != element) {
            int len = elements.length;
            Object[] newElements = Arrays.copyOf(elements, len);
            newElements[index] = element;
            setArray(newElements);
        } else {
            setArray(elements);  // 并非多余
        }
        return oldValue;
    } finally {
        lock.unlock();
    }
}
```

同一个引用还要 `setArray(elements)` 一次，看起来像死代码，实际是为了**保住 volatile 写的语义**。这个类的所有并发正确性都建立在「写线程做了一次 volatile 写，读线程的 volatile 读与之形成 happens-before」之上。如果值相同就跳过写回，读线程可能失去与其他写入操作之间的同步关系，语义上就破了口子。源码注释明确说这是一次「volatile write 的保障」，不是冗余。

remove 的思路相同，区别在于拷贝要分两段：删尾部元素直接 `copyOf(len - 1)`；删中间元素则 new 一个 `len - 1` 的数组，用两次 `System.arraycopy` 把 index 前和 index 后的部分分别拷入，最后替换引用。

### 迭代器：快照式弱一致性

```java
public Iterator<E> iterator() {
    return new COWIterator<E>(getArray(), 0);
}

static final class COWIterator<E> implements ListIterator<E> {
    private final Object[] snapshot;  // 创建迭代器那一刻的数组引用
    private int cursor;

    COWIterator(Object[] elements, int initialCursor) {
        cursor = initialCursor;
        snapshot = elements;
    }

    public boolean hasNext() { return cursor < snapshot.length; }

    @SuppressWarnings("unchecked")
    public E next() {
        if (!hasNext()) throw new NoSuchElementException();
        return (E) snapshot[cursor++];
    }
    // remove/set/add 全部直接抛 UnsupportedOperationException
}
```

迭代器做的唯一事情就是**把创建瞬间的数组引用固化下来**。之后无论列表被 add、remove 多少次，那些操作都在新数组上进行，迭代器遍历的始终是自己那份旧快照。由此得到两个重要性质：

- **永不抛 ConcurrentModificationException**。ArrayList 依赖 modCount 做 fail-fast 检查，而这里根本不存在「迭代期间被修改」的概念——快照不可变，检查无从谈起。
- **弱一致性**。迭代过程中看到的内容可能落后于最新状态，迭代开始后写入的元素本次遍历不可见。想看新数据，只能重新获取迭代器。

同样的逻辑也适用于 `get`：`getArray()` 取引用和下标取值是两步，中间若发生写替换，读到的就是旧数组里的旧值。这不算 bug，而是 COW 语义的一部分。

## 工程实践

**适合的场景**：监听器/回调列表（NIO、GUI、事件总线里的 subscriber 集合）、运行期很少变更的配置项与黑白名单、各类注册表。特征是写操作以天或小时计，读操作以毫秒计。批量写入时优先用 `addAll`——它只在锁内做一次拷贝，比循环 add 拷贝 n 次好得多。`addIfAbsent` 适合小集合去重。

**不适合的场景**：写操作频繁（每次写 O(n) 拷贝加一次数组分配，写 QPS 高时 CPU 和 GC 压力都会爆炸）；数据量大且仍会变更（几百万元素拷一次就是几十毫秒起步，老数组还等着 GC）；以及要求实时一致性的场景（读者必须容忍读到旧快照）。

```java
CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
listeners.add(this::onEvent);          // 低频注册
for (Runnable r : listeners) {         // 高频触发：无锁遍历，不怕有人同时注册
    r.run();
}
```

如果元素本身可变，注意快照只保护数组结构，不保护元素内部状态——元素字段的并发安全要另行保证。

## 对比与权衡

| 维度 | CopyOnWriteArrayList | Vector | Collections.synchronizedList | ReentrantReadWriteLock 方案 |
| --- | --- | --- | --- | --- |
| 读操作 | 无锁 | 方法级 synchronized | 互斥锁 | 读锁（读读共享，写写互斥） |
| 写操作开销 | O(n) 数组拷贝 | O(1)（摊销） | O(1)（摊销） | O(1)，但写时阻塞读 |
| 迭代器行为 | 快照，不抛 CME | fail-fast | fail-fast，遍历时需手动加锁 | 取决于实现 |
| 数据一致性 | 弱一致（旧快照） | 强一致 | 强一致 | 强一致 |
| 内存占用 | 写时短暂翻倍 | 低 | 低 | 低 |
| 适用场景 | 读极多、写极少 | 遗留代码 | 读写均衡、迭代时需强一致 | 读多但写不能拷贝的场景 |

一句话选型：写少读多且能容忍旧快照，COW 是最优解；读写比例接近或者数据量大到拷不起，退回到 synchronizedList（遍历时记得手动 synchronized 包裹）或读写锁；Vector 只存在于历史代码里。

## 面试视角

**读操作为什么可以不加锁？** 底层数组一旦被 setArray 发布就不再被原地修改，任何写都在新副本上进行；数组引用是 volatile 的，替换对所有线程立即可见。读线程拿到哪个引用就读哪个不可变快照，读到旧值属于设计允许的弱一致性，不存在读到一半被改坏的可能。

**迭代器为什么不抛 ConcurrentModificationException？** 迭代器创建时固化当前数组引用作为快照，之后所有修改都发生在新数组上，快照本身不可能被改动。没有「迭代中被并发修改」这种状态，fail-fast 检查自然不需要，remove 等修改方法直接抛 UnsupportedOperationException。

**写时复制的主要缺点是什么？** 一是内存，写期间新旧两个数组同时存活，大列表峰值占用翻倍；二是写性能，每次写 O(n) 拷贝，高频写会拖垮吞吐并制造大量待回收数组；三是弱一致性，读和迭代可能拿到旧数据，不能用于要求实时一致的场合。

**和 Collections.synchronizedList 的核心区别？** synchronizedList 所有方法（包括 get）都在互斥锁上串行，读读互斥，迭代时必须由使用方手动加锁否则可能抛 CME；COW 读完全无锁，写只在写线程间互斥，迭代基于快照天然安全，但写成本高一个量级。

**set 时新旧值相同为什么还要 setArray？** 为了维持 volatile 写语义。整个容器的可见性依赖写线程的 volatile 写与读线程的 volatile 读构成 happens-before，值相同就跳过写回会破坏这层同步保证，所以源码宁可做一次看似多余的引用写回。

## 小结

- 核心机制一句话：volatile 数组引用做快照，写操作加锁、拷贝、改副本、换引用，读操作零锁直达数组。
- 每次写都是 O(n) 拷贝且无容量预留，`size()` 就是数组长度；set 中同值也写回引用，是为了保住 volatile 语义。
- 迭代器是创建时刻的快照，弱一致、不抛 CME；get 同样可能读到旧值，这是语义而非缺陷。
- 适用边界清晰：读远多于写、列表不大、能容忍旧快照（监听器、配置、注册表）；写频繁或数据量大请换 synchronizedList 或读写锁方案。
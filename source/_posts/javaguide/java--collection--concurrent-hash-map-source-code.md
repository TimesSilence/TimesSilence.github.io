---
title: "ConcurrentHashMap 源码分析"
date: 2019-03-30 11:31:00
updated: 2019-03-30 11:31:00
permalink: knowledge/java/collection/concurrent-hash-map-source-code/
categories:
  - Java
tags:
  - Java集合
  - ConcurrentHashMap
  - 并发
description: "从 JDK 7 分段锁到 JDK 8 CAS+synchronized，拆解 ConcurrentHashMap 的 put 并发控制、sizeCtl 状态机、多线程协作扩容与分段计数机制。"
---

ConcurrentHashMap 是 Java 并发编程中使用频率最高的线程安全 Map。JDK 8 用「CAS + synchronized 锁桶头」替换了 JDK 7 的 Segment 分段锁，配合多线程协作扩容和分段计数，把锁的粒度压缩到了单个桶。本文以 JDK 8 源码为主线，顺带讲清 JDK 7 方案被放弃的原因。

<!-- more -->

## 它解决什么问题

HashMap 很快，但线程不安全：并发 put 会互相覆盖丢数据，`size` 的复合更新会丢失计数，JDK 7 的扩容甚至可能把链表接成环。最直接的补救是 Hashtable——所有方法挂 `synchronized`，读写都串行，相当于一张表一把大锁，并发度恒为 1。

真正的问题是：能不能让「不同桶」的写操作互不阻塞、让读操作彻底无锁？ConcurrentHashMap 就是对这个问题的两次回答。JDK 7 的回答是分段锁，JDK 8 的回答是 CAS 加桶级锁，后者在并发度、内存开销和代码结构上都更优，也成为今天分析的重点。

## 核心原理

**JDK 7：Segment 分段锁。** 一个 ConcurrentHashMap 由一个固定长度的 Segment 数组构成，每个 Segment 继承 ReentrantLock，内部再挂一个类似 HashMap 的 HashEntry 数组。定位一个 key 要做两次哈希：先用高位选中 Segment，再在段内定位桶。写操作只锁住所在 Segment，默认 16 个段意味着最多 16 个线程同时写。缺陷也很明显：Segment 数量初始化后不可变，并发度有硬上限；每个段要独立维护自己的表和计数，内存偏重；`size()` 需要跨段统计，实现别扭。

**JDK 8：Node 数组 + 链表 + 红黑树。** 存储结构直接对齐 HashMap——一张大 table，桶内先链表、达到阈值转红黑树。锁粒度从「段」降到「桶」：table 通过 volatile 保证可见性，读操作全程无锁；写操作按桶分情况，空桶 CAS 直接落位，非空桶用 synchronized 锁住桶首节点。理论上并发度等于数组长度，且随扩容增长，不再有固定上限。

另外一个容易忽略的规则：键和值都不允许为 null。原因是并发场景下 `get` 返回 null 无法区分「key 不存在」和「value 为 null」，而 `containsKey` 也不能补救——两次无锁调用之间状态可能已变。Hashtable 出于同样考虑禁 null，HashMap 没有并发需求才放行。

## 深入机制

### sizeCtl：一个变量兼任四种状态

JDK 8 用 `sizeCtl` 这一个 int 字段驱动表的整个生命周期，取值含义：

- `0`（默认值）：table 尚未初始化，首次初始化使用默认容量 16；
- `-1`：有线程正在初始化 table，其他线程应让出 CPU 等待；
- 正数 N：table 已初始化，N 表示下一次触发扩容的阈值；
- 负数（非 -1）：正在扩容，高 16 位是本次扩容的标识戳（由旧容量生成），低 16 位的值为「1 + 正在参与搬运的线程数」。

看懂 sizeCtl，初始化和扩容的代码就懂了一半。

### initTable：CAS 抢初始化权

```java
private final Node<K,V>[] initTable() {
    Node<K,V>[] tab; int sc;
    while ((tab = table) == null || tab.length == 0) {
        if ((sc = sizeCtl) < 0)
            Thread.yield();                 // 别人在初始化，让出 CPU
        else if (U.compareAndSwapInt(this, SIZECTL, sc, -1)) {
            try {
                if ((tab = table) == null || tab.length == 0) {
                    int n = (sc > 0) ? sc : DEFAULT_CAPACITY;
                    Node<K,V>[] nt = (Node<K,V>[])new Node<?,?>[n];
                    table = tab = nt;
                    sc = n - (n >>> 2);     // 0.75n，作为新阈值
                }
            } finally {
                sizeCtl = sc;
            }
            break;
        }
    }
    return tab;
}
```

没有锁，全靠 CAS：抢到把 sizeCtl 改成 -1 的线程负责建表，抢不到的线程读到的 sizeCtl 小于 0，走 `Thread.yield()` 自旋等待。建表线程在 finally 里把 sizeCtl 恢复为正数阈值，唤醒整个流程。经典的「CAS 选举 + 状态标记」模式。

### putVal：三级递进的并发控制

```java
final V putVal(K key, V value, boolean onlyIfAbsent) {
    if (key == null || value == null) throw new NullPointerException();
    int hash = spread(key.hashCode());
    int binCount = 0;
    for (Node<K,V>[] tab = table;;) {
        Node<K,V> f; int n, i, fh;
        if (tab == null || (n = tab.length) == 0)
            tab = initTable();                          // 第一级：CAS 初始化
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            if (casTabAt(tab, i, null,
                         new Node<K,V>(hash, key, value, null)))
                break;                                  // 第二级：空桶 CAS 落位，无锁
        }
        else if ((fh = f.hash) == MOVED)
            tab = helpTransfer(tab, f);                 // 正在扩容，先去帮忙搬运
        else {
            V oldVal = null;
            synchronized (f) {                          // 第三级：锁桶首节点
                if (tabAt(tab, i) == f) {               // 进锁后再校验桶首没变
                    if (fh >= 0) {
                        binCount = 1;
                        for (Node<K,V> e = f;; ++binCount) {
                            K ek;
                            if (e.hash == hash &&
                                ((ek = e.key) == key ||
                                 (ek != null && key.equals(ek)))) {
                                oldVal = e.val;
                                if (!onlyIfAbsent)
                                    e.val = value;
                                break;
                            }
                            Node<K,V> pred = e;
                            if ((e = e.next) == null) {
                                pred.next = new Node<K,V>(hash, key, value, null);
                                break;                  // 尾插
                            }
                        }
                    }
                    else if (f instanceof TreeBin) {
                        Node<K,V> p;
                        binCount = 2;
                        if ((p = ((TreeBin<K,V>)f).putTreeVal(hash, key, value)) != null) {
                            oldVal = p.val;
                            if (!onlyIfAbsent)
                                p.val = value;
                        }
                    }
                }
            }
            if (binCount != 0) {
                if (binCount >= TREEIFY_THRESHOLD)
                    treeifyBin(tab, i);                 // 达到 8，尝试树化
                if (oldVal != null)
                    return oldVal;
                break;
            }
        }
    }
    addCount(1L, binCount);
    return null;
}
```

逐层拆解：

1. **hash 扰动**：`spread` 做的是 `(h ^ (h >>> 16)) & 0x7fffffff`，高低位混合之外还多一步与运算，强制 hash 为非负——因为负 hash 被征用作特殊标记（MOVED = -1 表示桶已迁移，TREEBIN = -2 表示树化桶）。
2. **空桶快路径**：目标桶为空时直接 CAS 写入新节点，完全不加锁。哈希均匀时大多数 put 走这条路，这是 JDK 8 高并发能力的主要支撑。
3. **扩容协助**：发现桶首 hash 为 MOVED，说明这张表正在搬家，当前线程不袖手旁观，先调用 `helpTransfer` 参与搬运，搬完再拿新表重试。这是「协作式扩容」的入口。
4. **synchronized 锁桶首**：桶非空且未迁移时才加锁，锁对象是桶首节点 `f`。进入临界区后第一件事是复查 `tabAt(tab, i) == f`——从读桶首到拿到锁之间，桶首可能因其他线程的写或迁移而变化，不校验就会写进错误的桶。之后按链表尾插或树插入处理，逻辑与 HashMap 一致。
5. **树化判断**：`binCount >= 8` 调 `treeifyBin`，但内部会先检查表长，不足 64 时优先 `tryPresize` 扩容而不是树化，理由和 HashMap 相同：小表上的长链更可能是哈希不均，扩容比建树划算。

为什么选择 synchronized 而不是 ReentrantLock？桶首节点天然就是现成的锁对象，无需为每个桶额外维护锁实例，省内存；同时 JDK 6 之后 synchronized 有偏向锁、轻量级锁的升级优化，低竞争下开销与 ReentrantLock 相当。

### transfer：多线程协作扩容与 ForwardingNode

扩容由 `transfer` 方法执行，核心设计有三点：

- **新表先行**：`nextTable` 容量翻倍，所有迁移都朝它进行，旧表保持可读。
- **任务分片**：全局有一个 `transferIndex` 指针，初始指向旧表末尾。每个参与线程（包括触发者和来帮忙的）通过 CAS 从高到低领取一段连续的桶作为搬运区间，默认步长 16。领完即走，互不重叠，无需全局锁。
- **ForwardingNode 占位**：一个桶迁移完成后，在旧表该位置放一个 hash 为 MOVED 的 ForwardingNode，它持有新表引用。这个标记一石二鸟：写线程看到它知道该去帮忙；读线程看到它会顺着引用到新表查找，扩容期间 get 依然无锁可用。

迁移本身沿用 HashMap 的拆分技巧：新下标只取决于 `hash & oldCap` 这一位，为 0 留在原位，为 1 移到「原位 + oldCap」，一条链拆成两条，免重哈希。最后完成搬运的线程负责收尾，把 `table` 指向 `nextTable`。整个过程中 sizeCtl 的低 16 位记录着参与线程数，每进来一个帮忙的线程就 CAS 加 1，退出时减 1，减到初始值即宣告本次扩容结束。

### size 统计：baseCount + CounterCell 分散热点

并发下维护一个精确的元素总数代价极高——所有写线程争抢同一个计数器等于退化回全局锁。JDK 8 的方案是分片计数，思路与 LongAdder 一致：

- 没有竞争时，`addCount` 直接 CAS 累加 `baseCount`，路径最短；
- CAS 失败说明出现竞争，线程转而根据自己的 probe 值（线程级哈希）落到 `counterCells` 数组的某个槽位，对该 CounterCell 做 CAS 累加；
- 槽位冲突严重时，`fullAddCount` 会在轻量自旋锁 `cellsBusy` 保护下初始化或翻倍扩容 cells 数组，把热点进一步打散。

`size()` 最终走 `sumCount()`：读 baseCount，再不加锁地把所有 CounterCell 累加一遍。全程无锁意味着统计期间可能有写入穿插，结果是**近似值**。追求大计数可用返回 long 的 `mappingCount()`，但同样是弱一致的。在并发容器里，「某一瞬间的精确总数」本身就没有稳定语义，用一致性换吞吐是正确取舍。

## 工程实践

- **复合操作用自带原子方法**：「get 判断不存在再 put」是两步操作，中间会插入其他线程，必须改用 `putIfAbsent`、`computeIfAbsent`、`merge`。计数器场景一行 `map.merge(key, 1L, Long::sum)` 即可，比手动加锁干净得多。
- **别把 size() 当精确值用**：它是近似统计，拿它做「是否为空」之外的逻辑判断要慎重；判空优先用 `isEmpty()`。
- **预估初始容量**：扩容要全量迁移节点，即便多线程协作也不便宜。已知量级时用带容量参数的构造器一步到位，注意 CHM 的构造语义是「能容纳 initialCapacity 个元素」，内部已按负载因子换算，不需要再自行除以 0.75。
- **迭代是弱一致的**：迭代器反映创建时刻附近的表状态，不抛 ConcurrentModificationException，但也不保证看到后续写入，遍历中做关键决策前先想清楚语义。

## 对比与权衡

| 维度 | Hashtable | ConcurrentHashMap (JDK 7) | ConcurrentHashMap (JDK 8) | Collections.synchronizedMap |
| --- | --- | --- | --- | --- |
| 锁粒度 | 全表一把锁 | Segment 段锁（默认 16 段） | 桶首节点 | 全表一把锁（互斥对象） |
| 底层结构 | 数组 + 链表 | Segment 数组 + HashEntry + 链表 | Node 数组 + 链表 + 红黑树 | 包装任意 Map |
| 读操作 | 加锁 | 无锁（volatile） | 无锁（volatile） | 加锁 |
| 并发度上限 | 1 | 段数，固定 | 表长，随扩容增长 | 1 |
| null 键值 | 禁止 | 禁止 | 禁止 | 取决于被包装 Map |
| 复合原子操作 | 无 | 有 | 有（且更丰富） | 无，需外部同步 |
| size 语义 | 精确 | 段间统计，较准 | 近似值 | 精确 |

Hashtable 和 synchronizedMap 的本质相同，都是方法级互斥，读读也互斥，现代代码没有理由再选它们。JDK 8 相对 JDK 7 的提升可以概括为：锁粒度从段到桶、读保持无锁、结构复用 HashMap 的红黑树、扩容从单线程搬到多线程协作。

## 面试视角

**JDK 8 为什么放弃 Segment 分段锁？** Segment 数量初始化后固定，并发度有硬上限，且每个段独立持有表和计数，内存开销大；改成桶级锁后并发度随表长增长，结构上与 HashMap 统一，还能复用红黑树优化。配合 synchronized 的锁升级，低竞争下加锁成本已经很低，分段锁失去了存在意义。

**put 过程什么时候用 CAS、什么时候加锁？** 三种情况：table 未初始化时 CAS 竞争初始化权；目标桶为空时 CAS 写入，无锁；桶非空且未在迁移时，用 synchronized 锁住桶首节点再插入或覆盖，进锁后还要复查桶首未变。此外发现桶首 hash 为 MOVED 时会先协助扩容。

**sizeCtl 有哪些取值，分别代表什么？** 0 表示未初始化且用默认容量；-1 表示正在初始化；正数表示下一次扩容的阈值；扩容期间为负数，高 16 位是扩容标识戳，低 16 位记录参与搬运的线程数加一。

**扩容期间读操作会阻塞吗？** 不会。旧表迁移完成的桶会放置 ForwardingNode，get 读到它之后顺着引用去新表继续查找，全程无锁；未迁移的桶仍在旧表正常读。这也是 JDK 8 扩容设计的精髓：读写与迁移并行。

**为什么不允许 null 键和 null 值？** 并发环境下 get 返回 null 无法区分 key 不存在与 value 为 null，而 containsKey 复查无法弥补——两次独立的无锁调用之间状态可能已被其他线程改变。单线程的 HashMap 不存在这种歧义窗口，所以允许 null。

## 小结

- 演进主线：JDK 7 用固定数量的 Segment 分段锁换取有限并发，JDK 8 改为「volatile 表 + CAS + synchronized 锁桶首」，并发度随表长伸缩，读全程无锁。
- put 的并发控制分三级：CAS 初始化、空桶 CAS 落位、synchronized 锁桶首，中途遇到扩容还会先协助搬运。
- sizeCtl 是全局状态机：非负管初始化和阈值，负数管扩容进度与参与线程数。
- 扩容由多线程按步长认领区间协作完成，ForwardingNode 标记已迁移桶，保证扩容期间读写不阻塞。
- size 用 baseCount 加 CounterCell 分散热点，换得高吞吐，代价是结果为近似值；工程上用复合原子方法、预估容量、别依赖精确 size。
---
title: "HashMap 源码分析"
date: 2019-04-25 14:52:00
updated: 2019-04-25 14:52:00
permalink: knowledge/java/collection/hashmap-source-code/
categories:
  - Java
tags:
  - Java集合
  - HashMap
description: "从 JDK 8 源码出发，拆解 HashMap 的哈希定位、扰动函数、put 流程、2 倍扩容与树化机制，并给出工程与面试视角的权衡分析。"
---

HashMap 是 JDK 集合体系中最重要的哈希表实现：JDK 8 采用数组 + 链表 + 红黑树的组合结构，用一次位运算定位桶，用扰动函数摊平碰撞，用 2 倍扩容和拆分重映射控制迁移成本。读懂它，就拿到了理解 ConcurrentHashMap 与各类缓存实现的钥匙。

<!-- more -->

## 它解决什么问题

Map 的本质需求是「按 key 快速查到 value」。顺序表查找是 O(n)，二分是 O(log n)，而哈希表把 key 映射为数组下标，理想情况下一次定位，平均 O(1)。代价是哈希冲突不可避免：不同 key 可能算出同一个下标。HashMap 用拉链法承接冲突——数组的每个桶挂着一条链表，冲突元素依次链在后面。

在 JDK 集合家族里，HashMap 是 `Map` 接口的默认答案：它放弃线程安全和遍历顺序，换取单线程下极致的读写性能。Hashtable、ConcurrentHashMap、LinkedHashMap 都可以看作在 HashMap 这颗「性能内核」上叠加不同约束的产物。因此 HashMap 的源码是每个 Java 工程师绕不开的基本功。

## 核心原理

JDK 7 的 HashMap 是数组 + 链表，一旦恶意构造大量冲突 key，链表退化成单链，查找复杂度从 O(1) 跌到 O(n)，这就是著名的哈希碰撞攻击。JDK 8 引入第三条路径：当某个桶的链表长度达到阈值 8（`TREEIFY_THRESHOLD`）且数组长度不小于 64（`MIN_TREEIFY_CAPACITY`）时，链表转红黑树，查找降为 O(log n)；当树中节点缩减到 6（`UNTREEIFY_THRESHOLD`）以下时再退化回链表，因为短链表的遍历开销比维护树的旋转更小。

定位桶的核心只有一行：`tab[(n - 1) & hash]`。之所以能用 `&` 代替取模，关键在于容量 n 永远是 2 的幂。n = 2^k 时，n-1 的二进制恰好是低 k 位全 1 的掩码，`hash & (n-1)` 在数学上等价于 `hash % n`，只保留 hash 的低 k 位。位运算避免了除法指令，速度更快；更重要的是它让下标完全由 hash 的低位决定，这为后面扰动函数和扩容重分布的设计埋下了伏笔。

## 深入机制

### hash()：一次异或的扰动

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

既然下标只取 hash 的低 k 位，如果 key 的 hashCode 高位变化剧烈、低位几乎不变，冲突就会集中在低位上。`h >>> 16` 把高 16 位无符号右移到低位，再与原值异或，等于让高位信息混入低位。这样无论数组多小，高位差异都能参与定位，显著降低碰撞率。相比 JDK 7 连续四次移位异或，JDK 8 只做一次，是在扰动效果与计算开销之间的取舍——配合红黑树兜底，一次足够。

### putVal：插入的完整路径

```java
final V putVal(int hash, K key, V value, boolean onlyIfAbsent, boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;              // 首次 put 才懒初始化数组
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null); // 桶空，直接落位
    else {
        Node<K,V> e; K k;
        if (p.hash == hash && ((k = p.key) == key || (key != null && key.equals(k))))
            e = p;                                // 首节点命中，待覆盖
        else if (p instanceof TreeNode)
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value); // 走红黑树插入
        else {
            for (int binCount = 0; ; ++binCount) {
                if ((e = p.next) == null) {
                    p.next = newNode(hash, key, value, null);  // 尾插法
                    if (binCount >= TREEIFY_THRESHOLD - 1)
                        treeifyBin(tab, hash);      // 达到 8，尝试树化
                    break;
                }
                if (e.hash == hash && ((k = e.key) == key || (key != null && key.equals(k))))
                    break;                          // 链上命中，待覆盖
                p = e;
            }
        }
        if (e != null) {                            // key 已存在：覆盖旧值并返回
            V oldValue = e.value;
            if (!onlyIfAbsent || oldValue == null)
                e.value = value;
            afterNodeAccess(e);
            return oldValue;
        }
    }
    ++modCount;
    if (++size > threshold)
        resize();                                   // 超过阈值，扩容
    afterNodeInsertion(evict);
    return null;
}
```

按顺序拆解：

1. **懒初始化**：构造 HashMap 时并不分配数组，第一次 put 才发现 `table == null`，通过 `resize()` 建表。这让空 Map 的创建几乎零成本。
2. **寻址与空桶快路径**：`(n-1) & hash` 算下标，桶为空直接放新节点，这是命中缓存友好的最常见路径。
3. **首节点比对**：先比 hash 再比 `==` 最后才 `equals`，短路设计把最便宜的判断放最前面。
4. **分支处理**：桶首是 `TreeNode` 走树插入；否则沿链表遍历，命中即覆盖，走到尾部则用**尾插法**挂上新节点（JDK 7 是头插，这是 8 的重要改动）。
5. **树化判断**：插入后若链上节点数达到 8 就调 `treeifyBin`，但方法内部会先检查数组长度，不足 64 时只扩容不树化——小数组上的长链更可能是扰动不足，扩容重新散列往往比建树划算。
6. **扩容检查**：`size` 超过 `threshold`（容量 × 负载因子）才触发 `resize()`。

### resize()：两倍扩容与免重哈希的拆分

```java
// 节点重分布的核心片段
do {
    next = e.next;
    if ((e.hash & oldCap) == 0) {
        // 低位链：留在原下标 j
        if (loTail == null) loHead = e; else loTail.next = e;
        loTail = e;
    } else {
        // 高位链：移到 j + oldCap
        if (hiTail == null) hiHead = e; else hiTail.next = e;
        hiTail = e;
    }
} while ((e = next) != null);
```

扩容每次翻倍（`newCap = oldCap << 1`），阈值同步翻倍。真正的巧思在节点迁移：新容量是旧容量的 2 倍，意味着新下标只比旧下标多看 hash 的一位——就是 `oldCap` 对应的那个比特。`e.hash & oldCap` 为 0，说明该位是 0，节点仍在原下标 j；为 1 则移到 j + oldCap。全程不需要重新计算 hash，也不需要逐个取模，一次位与完成分流，且节点相对顺序在两条链内保持不变。桶上是树时调用 `split()` 做同样的二拆，拆完节点数不超过 6 就退化为链表。注意 `resize()` 同时承担初始化职责：无参构造走默认 16，指定容量的构造则把 `tableSizeFor` 的结果从 `threshold` 里取出来当首次容量。

### tableSizeFor：归一到 2 的幂

```java
static final int tableSizeFor(int cap) {
    int n = cap - 1;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    return (n < 0) ? 1 : (n >= MAXIMUM_CAPACITY) ? MAXIMUM_CAPACITY : n + 1;
}
```

目标是找到不小于 cap 的最小 2 的幂。`cap - 1` 防止 cap 本身已是 2 的幂时被翻倍；随后五次无符号右移并按位或，是一个倍增填充过程：第一步把最高位的 1 扩散到下一位，之后每步把已有的 1 再向右扩散一倍距离，五步覆盖 32 位，最终 n 变成「最高位起全 1」的数，`n + 1` 即为目标。整个过程无循环，常数时间完成。

## 工程实践

- **预估初始容量**：每次扩容都要重建数组并迁移全部节点，代价随数据量线性增长。已知要存 N 条数据时，用 `new HashMap<>((int)(N / 0.75f) + 1)` 一步到位，避免中途多次 rehash。Guava 的 `Maps.newHashMapWithExpectedSize` 内部就是这个算法。
- **别用可变对象做 key**：若 key 中参与 `hashCode/equals` 计算的字段被修改，节点的 hash 不会重算，这个 entry 会「卡」在旧桶里，之后无论 get 还是 remove 都找不到它，造成逻辑丢失和内存泄漏。key 应当不可变，`String`、包装类型是安全选择。
- **并发场景禁用裸 HashMap**：JDK 7 的头插法在并发扩容时可能把链表接成环，get 时 CPU 打满形成死循环；JDK 8 改成尾插消除了成环，但并发 put 仍会互相覆盖导致丢数据，`size` 也非原子更新。多线程读写请直接使用 ConcurrentHashMap。

## 对比与权衡

| 维度 | HashMap | Hashtable | ConcurrentHashMap | LinkedHashMap |
| --- | --- | --- | --- | --- |
| 线程安全 | 否 | 是（方法级 synchronized） | 是（分段/CAS + synchronized） | 否 |
| null key/value | 允许一个 null key、多个 null value | 均禁止 | 均禁止 | 允许，同 HashMap |
| 迭代顺序 | 无序 | 无序 | 无序 | 插入序或访问序 |
| 底层结构 | 数组+链表+红黑树 | 数组+链表 | 数组+链表+红黑树 | HashMap + 双向链表 |
| 典型场景 | 单线程缓存、索引 | 遗留代码，不推荐新用 | 高并发共享 Map | 需要顺序的 Map、LRU 缓存 |

选型逻辑很直接：单线程用 HashMap；并发用 ConcurrentHashMap，Hashtable 的全表锁在现代 JDK 中已无存在价值；需要按插入或访问顺序遍历、实现 LRU 时选 LinkedHashMap。

## 面试视角

**为什么容量必须是 2 的幂？** 一是 `hash & (n-1)` 能替代取模，位运算远快于除法；二是扩容时新下标只取决于 hash 的一个比特位，`e.hash & oldCap` 一次判断就能把节点分到原位置或原位置+oldCap，免去了全量重新哈希。

**为什么树化阈值是 8、退化是 6？** 哈希均匀时，单个桶的链表长度服从泊松分布，长度达到 8 的概率不足千万分之一，正常情况几乎不触发树化，8 是防御极端碰撞的兜底值。退化和树化之间留出 6 到 8 的缓冲带，是为了避免链表长度在阈值附近波动时频繁地进行树与链表的相互转换。

**负载因子为什么默认 0.75？** 它是空间利用率与冲突率的折中：调大则数组更满、链表更长、查询变慢；调小则哈希更稀疏但浪费内存、扩容更频繁。0.75 是官方在时间与空间成本之间给出的统计最优经验值，配合 2 的幂容量，12/16 的填充度能让泊松分布下的链长保持很短。

**HashMap 线程不安全具体体现在哪？** JDK 7 并发扩容的头插法可能形成环形链表，导致 get 死循环；JDK 8 尾插法虽无环，但两个线程同时 put 到同一桶会互相覆盖丢数据，`++size` 的复合操作也会丢失更新，扩容期间读写交错还可能读到迁移中的中间状态。

## 小结

- HashMap 的性能内核是「位运算寻址 + 拉链法」，一切设计都围绕让 `(n-1) & hash` 这行代码高效且均匀。
- 扰动函数把高位混入低位，弥补小容量下低位信息不足的缺陷；容量恒为 2 的幂是整套位运算体系成立的前提。
- put 走懒初始化、空桶快路径、链表尾插、树化判断四段逻辑；resize 用 `e.hash & oldCap` 把迁移成本压到一次位判断。
- 工程上记住三件事：预分配容量、key 必须不可变、并发场景直接换 ConcurrentHashMap。
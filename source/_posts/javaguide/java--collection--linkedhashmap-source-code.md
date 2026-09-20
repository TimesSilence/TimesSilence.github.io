---
title: "LinkedHashMap 源码分析"
date: 2019-05-03 15:59:00
updated: 2019-05-03 15:59:00
permalink: knowledge/java/collection/linkedhashmap-source-code/
categories:
  - Java
tags:
  - Java集合
  - LinkedHashMap
  - LRU
description: "从 JDK 8 源码出发，拆解 LinkedHashMap 如何用 Entry 继承与三个空钩子方法在 HashMap 上叠加双向链表，实现插入序、访问序与 LRU 缓存。"
---

LinkedHashMap 是模板方法模式在 JDK 中的教科书级应用：它几乎不重写 HashMap 的增删查逻辑，只靠 Entry 多挂两个指针、再实现 HashMap 预留的三个空钩子，就让一个无序哈希表同时拥有了插入序、访问序和 LRU 淘汰能力。

<!-- more -->

## 它解决什么问题

HashMap 的迭代顺序由哈希桶的物理分布决定，既不按插入先后，也不随访问变化，而且扩容后还会重排。很多场景恰恰需要顺序：配置项希望按录入顺序输出，日志聚合希望按出现次序遍历，缓存希望按「最久未使用」淘汰。这些需求的共同点是需要一条贯穿所有条目的逻辑次序。

朴素的方案是 HashMap 外面再套一个 List 记顺序，但两个结构要手工保持同步，删除时还要在 List 里 O(n) 查找。LinkedHashMap 的答案是：让节点本身就生活在两个结构里——哈希桶负责 O(1) 查找，一条额外的双向链表负责维护次序，二者共用同一份节点，任何修改都同步发生。

## 核心原理

LinkedHashMap 继承 HashMap，哈希表的全部机制（位运算寻址、拉链、树化、扩容）原样复用。它叠加的东西只有三样：

1. **双向链表**：字段 `head`、`tail` 串起所有条目，迭代时沿链表走而不扫桶。
2. **排序模式**：字段 `accessOrder`，false 表示链表按插入先后排列（默认），true 表示每次访问后把节点移到尾部，链表即按访问先后排列。
3. **钩子回调**：HashMap 在 put/remove/get 的关键位置预留了三个空方法——`afterNodeInsertion`、`afterNodeRemoval`、`afterNodeAccess`，LinkedHashMap 覆写它们来维护链表。

由于节点同时挂在哈希桶和链表上，任何一条路径的修改都会联动另一条路径，同步问题在结构层面被消灭。

## 深入机制

### Entry 继承链：一处继承，两处受益

```java
static class Entry<K,V> extends HashMap.Node<K,V> {
    Entry<K,V> before, after;  // 双向链表的前驱与后继
    Entry(int hash, K key, V value, Node<K,V> next) {
        super(hash, key, value, next);
    }
}
```

而 HashMap 的树节点声明是：

```java
static final class TreeNode<K,V> extends LinkedHashMap.Entry<K,V> { ... }
```

这个继承方向初看反直觉：HashMap 的 TreeNode 居然继承自 LinkedHashMap 的内部类。原因是桶上的链表一旦树化，节点类型变成 TreeNode；对 LinkedHashMap 来说，树化后的节点仍然必须留在双向链表里，所以 TreeNode 必须携带 before/after 指针。让 TreeNode 继承 Entry，一次继承同时满足两个结构的需求。反过来若把 before/after 直接加在 HashMap.Node 上，则所有纯 HashMap 用户都要为永远不用的指针付内存——JDK 的选择是把成本留给「树节点」这个本来就更重、且出现概率低（良好哈希下按泊松分布极少达到树化阈值）的类型。

新节点进入链表靠覆写工厂方法：

```java
Node<K,V> newNode(int hash, K key, V value, Node<K,V> next) {
    LinkedHashMap.Entry<K,V> p = new LinkedHashMap.Entry<>(hash, key, value, next);
    linkNodeLast(p);          // 追加到双向链表尾部
    return p;
}

private void linkNodeLast(LinkedHashMap.Entry<K,V> p) {
    LinkedHashMap.Entry<K,V> last = tail;
    tail = p;
    if (last == null)
        head = p;
    else {
        p.before = last;
        last.after = p;
    }
}
```

HashMap 的 putVal 在需要新节点时调用的是 `newNode`——这是多态：父类流程跑到这里，实际执行的是子类版本，新 Entry 在落入哈希桶的同时被尾插进链表。插入序就是这样来的：不加任何额外操作，链表天然按插入先后排列。树节点走同样的路（覆写的 `newTreeNode` 内部也调 linkNodeLast）。

### afterNodeAccess：访问序的实现

LinkedHashMap 是少数重写了 get 的 Map 子类：

```java
public V get(Object key) {
    Node<K,V> e;
    if ((e = getNode(hash(key), key)) == null)
        return null;
    if (accessOrder)
        afterNodeAccess(e);   // 访问序模式：把命中节点移到链表尾
    return e.value;
}
```

`afterNodeAccess` 做的是标准双向链表「摘除 + 尾插」：把 e 的前驱和后继直接对接，再把 e 挂到 tail 后面。注意 putVal 中「key 已存在、覆盖旧值」的分支也会调用它——也就是说在 accessOrder 模式下，put 一个已有 key 也算一次访问，会把节点刷到最新位置。这个细节对 LRU 语义是正确的，但也是容易踩的坑：一个看似只读的 get/put 覆盖，实际上改动了迭代顺序，还会递增 modCount，正在迭代的线程可能因此收到 ConcurrentModificationException。

### afterNodeInsertion 与 removeEldestEntry：淘汰的触发点

```java
void afterNodeInsertion(boolean evict) { // possibly remove eldest
    LinkedHashMap.Entry<K,V> first;
    if (evict && (first = head) != null && removeEldestEntry(first)) {
        K key = first.key;
        removeNode(hash(key), key, null, false, true);
    }
}

protected boolean removeEldestEntry(Map.Entry<K,V> eldest) {
    return false;   // 默认永不淘汰
}
```

HashMap 每次 putVal 成功插入新节点后回调 `afterNodeInsertion`。LinkedHashMap 的实现里，三个条件同时成立才会删掉头节点：evict 为 true（普通 put 传 true；`putAll` 与反序列化路径传 false，避免批量加载时误淘汰）、链表非空、以及 `removeEldestEntry` 返回 true。默认实现恒 false，即默认链表只增不删、永不淘汰——淘汰策略完全交给子类决定。删除走 `removeNode`，它会先在哈希表里摘除节点，再回调 `afterNodeRemoval` 把节点从双向链表摘出（前驱后继对接、清空指针），两条结构一步同步。

### 迭代为什么更快

HashMap 的迭代器要扫描整个 table 数组、跳过空桶，耗时与「容量」成正比；LinkedHashMap 的迭代器从 head 出发沿 after 指针走，耗时与「元素个数」成正比。当表大而稀疏时（容量大、元素少），差距最明显；并且迭代顺序稳定，不受扩容重排影响。代价是 put/remove 每次要多维护几个指针，写路径略慢。

## 工程实践

一个生产可用的 LRU 骨架：

```java
public class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int maxEntries;

    public LruCache(int maxEntries) {
        // 初始容量按上限预留，0.75 负载因子，accessOrder = true
        super((int) (maxEntries / 0.75f) + 1, 0.75f, true);
        this.maxEntries = maxEntries;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > maxEntries;
    }
}
```

使用与验证：

```java
LruCache<Integer, String> cache = new LruCache<>(3);
cache.put(1, "one");
cache.put(2, "two");
cache.put(3, "three");
cache.get(1);            // 访问 1，把它刷到最新；此时最老是 2
cache.put(4, "four");    // 触发淘汰，最老的 2 被移除
// 剩余键的迭代顺序：3, 1, 4
```

三个实践要点：构造时按 `maxEntries / 0.75 + 1` 预留容量，避免缓存打满前先触发哈希扩容；这个实现不是线程安全的，并发场景需要 `Collections.synchronizedMap` 包一层，或直接使用 Caffeine、Guava Cache 这类成熟组件；`removeEldestEntry` 里可以做资源释放（比如关闭 eldest 对应的连接），但不要在里面向自身 put/remove，会引发不可预期的递归回调。

## 对比与权衡

| 维度 | HashMap | LinkedHashMap | TreeMap |
| --- | --- | --- | --- |
| 迭代顺序 | 无序，随哈希分布 | 插入序或访问序 | 按 key 自然序/比较器 |
| 底层结构 | 数组+链表+红黑树 | 同左，外加双向链表 | 红黑树 |
| get/put 复杂度 | O(1) | O(1)，常数略大 | O(log n) |
| 迭代耗时 | 与容量成正比 | 与元素个数成正比 | 与元素个数成正比 |
| 额外内存 | 无 | 每节点 before/after 两指针 | 每节点父/左/右/颜色 |
| 典型用途 | 通用 K-V 存储 | 顺序输出、LRU 缓存 | 范围查询、排序遍历 |

取舍清晰：只要顺序语义（插入或访问），LinkedHashMap 以微小的写路径开销换来 O(1) 查找和稳定迭代；要的是「排序」而非「次序」，才轮到 TreeMap。

## 面试视角

**LinkedHashMap 如何保证顺序？** 节点 Entry 继承 HashMap.Node 并增加 before/after 指针，所有条目额外串成一条双向链表。覆写 newNode 让新节点尾插进链表形成插入序；accessOrder 为 true 时，get 命中和覆盖已有 key 都会触发 afterNodeAccess 把节点移到尾部，形成访问序。

**LinkedHashMap 几乎不重写 put/get，逻辑是怎么织进去的？** HashMap 在 putVal、removeNode、getNode 的路径上预留了 afterNodeInsertion、afterNodeRemoval、afterNodeAccess 三个空钩子，子类覆写后被多态回调。这是典型的模板方法模式，HashMap 的流程骨架不动，LinkedHashMap 只在钩子里维护链表。

**TreeNode 为什么继承的是 LinkedHashMap.Entry？** 桶内链表树化后节点变成 TreeNode，而 LinkedHashMap 要求所有节点（包括树节点）都留在双向链表里，因此 TreeNode 必须带有 before/after 指针，继承 Entry 一处解决。代价是纯 HashMap 的树节点也多背两个引用，但树化在良好哈希下概率极低，JDK 认为可以接受。

**怎么用 LinkedHashMap 实现 LRU？** 构造时 accessOrder 传 true，使每次访问把节点移到链表尾，链表头即最久未使用；覆写 removeEldestEntry 在 size 超限时返回 true，插入后回调 afterNodeInsertion 就会删除头节点。注意 putAll 和反序列化不会触发淘汰（evict 为 false），且该实现非线程安全。

**LinkedHashMap 迭代比 HashMap 快在哪里？** HashMap 迭代要扫描全部桶、跳过空槽，耗时随容量增长；LinkedHashMap 沿双向链表迭代，耗时只随元素个数增长，且顺序稳定不受扩容影响。元素稀疏时差距尤其明显。

## 小结

- LinkedHashMap = HashMap 的查找能力 + 一条贯穿所有节点的双向链表，节点身兼桶元素与链表元素两个身份。
- 插入序靠覆写 newNode 尾插链表，访问序靠 afterNodeAccess 把命中节点移到尾部，删除同步靠 afterNodeRemoval。
- LRU 的全部工作只有两步：accessOrder 设为 true，覆写 removeEldestEntry；淘汰在 afterNodeInsertion 中触发，putAll 除外。
- 迭代与元素数成正比、顺序稳定，是其相对 HashMap 的结构性优势；写路径略慢、内存略大是代价。
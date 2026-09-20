---
title: "Java集合常见面试题总结(下)"
date: 2019-03-04 08:10:00
updated: 2019-03-04 08:10:00
permalink: knowledge/java/collection/java-collection-questions-02/
categories:
  - Java
tags:
  - Java集合
  - 面试
description: "Java 集合面试题（下）：HashMap 底层结构与线程安全问题、ConcurrentHashMap 两版实现演进、并发容器的 null 语义与复合操作原子性。"
---

集合面试的下篇聚焦 Map 体系与并发容器：HashMap 的哈希设计、树化与线程安全问题，ConcurrentHashMap 两版实现的演进，以及并发语境下的 null 语义与复合操作陷阱。这一篇的问题几乎全是高频考点。

<!-- more -->

## 考察地图

- **Map 对比**：HashMap vs Hashtable、HashMap vs HashSet、HashMap vs TreeMap。考察选型语义与继承体系。
- **HashMap 原理**：底层结构、容量为什么是 2 的幂、线程不安全的具体表现。考察哈希表设计功底，是集合面试的「流量担当」。
- **并发容器**：ConcurrentHashMap vs Hashtable、JDK 7 到 JDK 8 的实现演进、null 禁令、复合操作原子性。考察并发设计的权衡思路。
- 建议自行查阅：HashMap 的多种遍历方式及性能对比、Collections 工具类方法清单——偏记忆性内容，知道结论即可，不建议投入深抠。

## Map 对比

### HashMap 和 Hashtable 的区别？

**结论**：Hashtable 是方法级 synchronized 的古老线程安全实现，已被淘汰；HashMap 非线程安全、性能更好，并发场景应选 ConcurrentHashMap 而不是 Hashtable。

**原理**：差异主要有四点。线程安全上，Hashtable 全表一把锁，get 与 put 都互斥，并发性能极差。null 支持上，HashMap 允许一个 null key 和多个 null value，Hashtable 遇 null 直接抛 NullPointerException。容量上，HashMap 默认 16、扩容 2 倍、恒为 2 的幂；Hashtable 默认 11、扩容为 2n+1、直接使用指定容量。结构上，JDK 8 的 HashMap 有链表转红黑树的优化并对哈希值做了高低位扰动，Hashtable 仍是纯数组加链表、直接使用原始 hashCode。

**延伸**：被追问「为什么不推荐 Hashtable」时，补一句它继承自过时的 Dictionary 抽象类，比单说「效率低」更能体现对集合体系演进的理解。

> 追问：Hashtable 的锁加在什么对象上？提示：synchronized 修饰实例方法，锁的是 this，即整张表。

### HashMap 和 HashSet 的区别？

**结论**：HashSet 底层就是一个 HashMap，元素作为 key 存入，value 统一是静态占位对象 PRESENT。

**原理**：HashSet 的源码极薄，除 clone 与序列化外全部委托给内部的 map：

```java
public boolean add(E e) {
    return map.put(e, PRESENT) == null;
}
```

put 返回旧 value，为 null 说明此前不存在，add 据此返回是否新增成功。差异在语义层：HashMap 实现 Map、存键值对、按 key 计算哈希；HashSet 实现 Set、只存元素、用元素自身计算哈希并按 equals 去重。

**延伸**：同理 LinkedHashSet 委托 LinkedHashMap、TreeSet 委托 TreeMap——「Set 是 Map 的退化视图」是 JDK 集合里经典的复用手法。

> 追问：HashSet 复用 HashMap，TreeSet 的排序能力从哪来？提示：排序发生在 key 的比较器上，与 value 存什么无关。

### HashMap 和 TreeMap 的区别？

**结论**：HashMap 按哈希存取、无序、操作接近 O(1)；TreeMap 基于红黑树按 key 排序，操作 O(log n)，并额外支持范围查询与子集视图。

**原理**：TreeMap 实现了 NavigableMap 与 SortedMap 接口，提供 ceilingEntry、floorEntry、subMap、headMap 等定向搜索和子集能力，全部建立在红黑树 O(log n) 的平衡搜索之上。代价是 key 必须可比较：要么实现 Comparable 自然排序，要么构造时传入 Comparator。HashMap 不承诺任何顺序，依赖 hashCode 与 equals 定位。

**延伸**：选型口诀：「取最值、范围统计、按序遍历」选 TreeMap；「纯键值查找」选 HashMap；「要插入顺序」选 LinkedHashMap（哈希表加双向链表）。

> 追问：TreeMap 的 subMap 返回拷贝还是视图？提示：视图，对子映射的结构性修改会反映回原 map。

## HashMap 原理

### HashMap 的底层实现是怎样的？

**结论**：JDK 8 起为数组 + 链表 + 红黑树：哈希冲突先挂链表，链表过长且数组足够大时转红黑树。

**原理**：put 时 key 的 hashCode 经扰动函数 `(h = key.hashCode()) ^ (h >>> 16)` 混合高低位，再用 `(n-1) & hash` 定位桶。桶空直接放入；冲突则遍历链表，key 相同覆盖、否则尾插。尾插后链表长度达到阈值 8 时尝试树化：若数组长度小于 64 则优先扩容，达到 64 才真正转红黑树。阈值 8 来自泊松分布——理想哈希下链表达到 8 的概率不足千万分之一；树退化回链表的阈值是 6，与 8 之间留出缓冲带防止频繁抖动。

**延伸**：树化把桶内查找从 O(n) 降到 O(log n)，但树节点内存约为普通节点的两倍，短链表上并不划算——这正是「数组小于 64 先扩容」的动机：扩容能把冲突元素重新摊开，成本往往低于树化。

> 追问：为什么树化阈值是 8 而不是 4 或 16？提示：泊松分布的概率拐点与树/链表节点内存开销之间的平衡。

### HashMap 的长度为什么是 2 的幂次方？

**结论**：为了让 `hash & (n-1)` 等价于取模、让哈希低位全部参与定位，并让扩容迁移只看一个高位。

**原理**：n 为 2 的幂时 n-1 的二进制低位全为 1，`hash & (n-1)` 等价于 `hash % n`，位运算远快于取余。更关键的是扩容：容量翻倍后，元素的新位置只取决于 hash 新增参与运算的那一位——为 0 留在原索引，为 1 移到「原索引 + 旧容量」：

```java
// JDK 8 扩容时判断节点新位置
if ((e.hash & oldCap) == 0) {
    // 留在原索引
} else {
    // 移到 原索引 + oldCap
}
```

无需重新计算哈希，迁移动作被压到最低，且元素被均匀地劈成两半。

**延伸**：这也解释了为什么带参构造会用 tableSizeFor 把传入容量向上取整到 2 的幂——一切设计都为这套位运算服务。

> 追问：Hashtable 为什么不要求 2 的幂？提示：它用取模定位，代价是更慢，且负哈希值还要额外处理。

### HashMap 为什么线程不安全？

**结论**：并发 put 会丢数据、size 计数失真；JDK 7 及之前并发扩容还可能形成环形链表，get 命中后死循环打满 CPU。

**原理**：数据覆盖：两个线程哈希到同一个空桶，都通过「桶为空」的检查后先后写入，后者覆盖前者。size 失真：`++size` 不是原子操作，两个线程各插入一次，计数可能只增加了 1。死循环是 JDK 7 特有：扩容转移链表采用头插法，两个线程对同一组节点并发头插，可能形成 A.next=B、B.next=A 的环，之后 get 命中该桶便无限循环。JDK 8 改为尾插法消除了成环，但数据覆盖依旧存在。

**延伸**：结论要记牢——任何版本都不应在并发下裸用 HashMap，线程安全的替代是 ConcurrentHashMap，而不是 Hashtable 或 synchronizedMap 这类全表锁方案。

> 追问：JDK 8 尾插法为什么能避免成环？提示：尾插保持节点相对顺序，迁移后链不会倒置交叉。

## 并发容器

### ConcurrentHashMap 和 Hashtable 的区别？

**结论**：二者都线程安全，但锁粒度天差地别：Hashtable 全表一把锁，ConcurrentHashMap 只锁桶首节点，读完全无锁。

**原理**：Hashtable 的 synchronized 修饰在方法上，任意两个操作都互斥。ConcurrentHashMap 在 JDK 8 中结构与 HashMap 一致（数组 + 链表/红黑树），写入时空桶用 CAS 放置首节点、非空桶用 synchronized 锁住桶首节点——不同桶的写互不阻塞；节点的 val 和 next 用 volatile 修饰，get 不加锁也能读到最新值。并发度从 Hashtable 的 1 提升到接近桶数量的级别。

**延伸**：回答时点出锁粒度的演进史——全表锁（Hashtable）→ 分段锁（CHM JDK 7）→ 桶级锁（CHM JDK 8），能体现对并发设计趋势的理解。

> 追问：CHM 的 get 不加锁为什么能保证可见性？提示：val/next 是 volatile，写锁的解锁与后续读构成 happens-before 关系。

### JDK 1.7 和 JDK 1.8 的 ConcurrentHashMap 实现有什么不同？

**结论**：1.7 用 Segment 分段锁，默认 16 段、并发度固定；1.8 取消分段，改为 Node 数组 + CAS + synchronized 锁桶首节点，并引入红黑树。

**原理**：1.7 的结构是 Segment 数组套 HashEntry 数组，Segment 继承 ReentrantLock 充当锁角色，段数初始化后不可变，并发写上限被段数锁死。1.8 的结构对齐 HashMap：空桶插入走 CAS，非空桶 synchronized 锁首节点；链表超阈值转红黑树；size 统计改用 baseCount + CounterCell 分片计数，高并发下避免全局竞争。

**延伸**：1.8 敢放弃分段的背景是 JDK 6 之后 synchronized 大幅优化（偏向锁、轻量级锁），细粒度锁的开销已可接受，而分段带来的内存开销和固定并发度反而成了负担。

> 追问：JDK 7 的 size() 为什么最多尝试三次无锁统计后就对所有 Segment 加锁？提示：无锁统计可能错过并发修改，多次不一致只能全局加锁换准确性。

### ConcurrentHashMap 为什么不允许 null 键和 null 值？

**结论**：为了消除并发语境下的二义性——get 返回 null 时，分不清是「key 不存在」还是「value 本身就是 null」。

**原理**：单线程的 HashMap 允许 null，因为可以用 containsKey 二次确认消解歧义；并发场景下 get 与 containsKey 之间可能有其他线程插入或删除，两次调用观察到的已不是同一个状态，歧义无法消解。这是 ConcurrentHashMap 作者 Doug Lea 本人的设计解释：并发容器无法容忍这种在非并发 map 里「勉强可以接受」的模糊性。另外，value 为 null 还会与 merge、compute 系列方法的语义冲突——这些 API 约定函数返回 null 即删除该 key。

**延伸**：确实需要「空」语义时，可用静态空对象哨兵或用 Optional 包装 value。

> 追问：get 加 containsKey 组合判断能替代允许 null 吗？提示：不能，两次调用之间状态可能已变——这正是禁止 null 的根本原因。

### ConcurrentHashMap 能保证复合操作的原子性吗？

**结论**：不能。线程安全只保证单个方法调用的原子性，check-then-act 式的复合操作仍需使用原子方法。

**原理**：经典翻车写法：

```java
if (!map.containsKey(key)) {
    map.put(key, value); // 判断与写入之间可能插入其他线程
}
```

两个线程都通过检查后先后 put，先写的数据被覆盖。正确姿势是改用 CHM 提供的原子复合方法——putIfAbsent、computeIfAbsent、computeIfPresent、compute、merge，它们内部在桶锁或 CAS 保护下完成「读-算-写」全过程：

```java
map.computeIfAbsent(key, k -> loadValue(k));
```

**延伸**：computeIfAbsent 的 mapping 函数在桶锁内执行，耗时逻辑会阻塞同桶的其他操作；函数里也不要再写回同一个 map，否则可能死锁。用外层 synchronized 包住复合操作虽然可行，但会退化成全表串行，违背使用 CHM 的初衷。

> 追问：CHM 的这些原子方法加的是什么锁？提示：与 put 一致——空桶 CAS，非空桶 synchronized 锁首节点。
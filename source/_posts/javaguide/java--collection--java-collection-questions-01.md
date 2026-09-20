---
title: "Java集合常见面试题总结(上)"
date: 2019-02-24 17:03:00
updated: 2019-02-24 17:03:00
permalink: knowledge/java/collection/java-collection-questions-01/
categories:
  - Java
tags:
  - Java集合
  - 面试
description: "Java 集合面试题（上）：List/Set/Queue/Map 体系与选型、ArrayList 扩容机制、fail-fast、Set 排序契约与 Queue 家族高频考点。"
---

集合面试的上篇围绕三条主线：框架体系的选型逻辑、List 两大实现的底层差异与扩容机制、Set 与 Queue 家族的排序和去重语义。题目按主题分组，每题给出结论、原理与追问方向。

<!-- more -->

## 考察地图

- **框架体系**：List/Set/Queue/Map 的区别、集合如何选型。考察对集合整体设计语言的把握，属于开场必答题。
- **List**：ArrayList 与数组、ArrayList 与 LinkedList、扩容机制、fail-fast 与 fail-safe。考察对数组和链表两种底层结构及复杂度分析的理解。
- **Set**：Comparable 与 Comparator、HashSet/LinkedHashSet/TreeSet 异同。考察排序契约与哈希去重的底层依赖。
- **Queue**：Queue 与 Deque、ArrayDeque 与 LinkedList、PriorityQueue。考察队列 API 语义与堆结构。
- 建议自行查阅：Vector 与 Stack 的区别（已被淘汰）、ArrayList 能否存 null、各实现类底层数据结构清单——偏记忆性，面试中多为铺垫而非考点本身。

## 框架体系

### 说说 List、Set、Queue、Map 四者的区别？

**结论**：List 有序可重复；Set 元素唯一；Queue 按排队规则决定先后顺序；Map 存键值对，key 唯一、value 可重复，且 Map 不继承 Collection。

**原理**：Collection 是单列集合的根接口，向下派生 List、Set、Queue 三个子接口；Map 是独立的双列体系，操作单位是键值对。「无序」要精确表述：HashSet、HashMap 的无序指元素位置由哈希值决定而非插入顺序，不等于随机；LinkedHashMap、TreeMap 则通过双向链表或红黑树额外维护了顺序，是有序的。

**延伸**：答这题时主动带出常用实现类（ArrayList、HashSet、ArrayDeque、HashMap）及各自底层结构，能直接引出面试官的下一问，把节奏握在自己手里。

> 追问：为什么 Map 不继承 Collection？提示：语义不同——Collection 操作单个元素，Map 操作键值对，强行继承会污染接口契约。

### 如何选用合适的集合？

**结论**：先按「键值对还是单元素」区分 Map 与 Collection，再按「是否唯一、是否有序、是否线程安全」逐层收窄。

**原理**：键值查找选 Map：要排序用 TreeMap，要保留插入顺序用 LinkedHashMap，要并发用 ConcurrentHashMap，否则 HashMap。单元素场景：要求唯一选 Set（HashSet 快、TreeSet 有序、LinkedHashSet 保序）；不限唯一选 List，随机访问多用 ArrayList；栈和队列优先 ArrayDeque。

**延伸**：选型题本质是复杂度题——能说出「这个操作在你选的结构上是 O(1) 还是 O(n)」才算答完整，只背名字等于没答。

> 追问：需要「保留插入顺序 + 快速判重」时选什么？提示：LinkedHashSet，或者 List 与 HashMap 组合使用。

## List

### ArrayList 和数组有什么区别？

**结论**：数组定长、可存基本类型；ArrayList 底层是动态数组，自动扩容、只存对象、提供丰富 API。

**原理**：数组创建后长度固定，删除元素要手动搬移后续元素；ArrayList 内部持有 Object[]，容量不足时自动扩容拷贝，也可用 trimToSize() 主动收缩。泛型带来编译期类型检查，代价是基本类型必须装箱（int 变 Integer）。创建上数组必须指定长度，ArrayList 可以无参起步。

**延伸**：海量基本类型数据用 ArrayList 会有明显的装箱拆箱与内存开销，性能敏感场景可考虑 fastutil 这类原始类型集合库。

> 追问：ArrayList 的 elementData 为什么用 transient 修饰？提示：序列化时只写实际元素而非整个数组，看 writeObject 的自定义实现。

### ArrayList 与 LinkedList 的区别？

**结论**：ArrayList 基于动态数组，随机访问 O(1)、尾部增删均摊 O(1)；LinkedList 基于双向链表，仅头尾操作 O(1)，中间增删仍需 O(n) 定位。绝大多数场景选 ArrayList。

**原理**：差异来自内存布局。数组连续存储，get(i) 直接按偏移取址；链表节点分散，get(i) 要从较近一端遍历，平均走 n/4 个节点。ArrayList 实现了空标记接口 RandomAccess，Collections.binarySearch 等算法会据此选择按下标还是按迭代器遍历。内存占用上，ArrayList 浪费在尾部预留容量，LinkedList 每个节点额外携带 prev、next 两个引用。

**延伸**：「链表适合频繁增删」是典型误答——LinkedList 只有头尾增删是 O(1)，按位置增删要先花 O(n) 找到节点，连作者 Josh Bloch 都公开表示自己从不用 LinkedList。

> 追问：RandomAccess 接口里有方法吗？它如何影响 Collections 工具类的行为？提示：空标记接口，binarySearch 用 instanceof 分支选择遍历策略。

### 说一说 ArrayList 的扩容机制

**结论**：容量不足时扩容为旧容量的 1.5 倍，通过 Arrays.copyOf 把元素整体拷贝到新数组。

**原理**：add 前先做容量检查；无参构造的 ArrayList 首次 add 时才初始化为默认容量 10（懒初始化），此后 size+1 超过容量就触发 grow：

```java
int newCapacity = oldCapacity + (oldCapacity >> 1); // 1.5 倍
```

拷贝走 System.arraycopy 级别的原生操作，单次 O(n)，但均摊到每次 add 上仍是 O(1)。扩容有上限，超过 MAX_ARRAY_SIZE 时才退化为按 Integer.MAX_VALUE 尝试。

**延伸**：能预估元素数量时应带容量构造（如 new ArrayList<>(1000)），批量 addAll 前同理，避免多次扩容引发的连锁拷贝。

> 追问：扩容因子为什么是 1.5 而不是 2？提示：1.5 倍在若干次扩容后有机会复用之前释放的内存块，2 倍则永远越扩越大无法复用。

### 什么是 fail-fast 和 fail-safe？

**结论**：fail-fast 指迭代期间检测到结构性修改立即抛 ConcurrentModificationException；fail-safe 指基于快照迭代，允许并发修改，但读到的是旧数据。

**原理**：ArrayList、HashMap 维护 modCount 计数，迭代器创建时记下 expectedModCount，每次 next() 前比对：

```java
final void checkForComodification() {
    if (modCount != expectedModCount)
        throw new ConcurrentModificationException();
}
```

单线程 foreach 里调 list.remove() 同样触发——foreach 底层就是迭代器，而 remove 走的是集合自身方法，modCount 变了迭代器不知情。fail-safe 的代表是 CopyOnWriteArrayList：写操作复制新数组再整体替换引用，迭代器遍历的是创建时的旧快照，绝不抛 CME，代价是读不到实时数据。

**延伸**：fail-fast 是「尽力而为」的检测机制，JDK 文档明确不保证一定抛出，绝不能拿它当并发正确性手段。

> 追问：为什么迭代器自己的 remove() 不会触发 CME？提示：它删除后会把 expectedModCount 同步为最新的 modCount。

## Set

### Comparable 和 Comparator 的区别？

**结论**：Comparable 定义类的自然排序，compareTo 写在类内部；Comparator 是外部传入的定制排序策略，compare 与类解耦，一个类可配多个比较器。

**原理**：Comparable 在 java.lang 包，实现后对象「天生可排序」，TreeSet、Collections.sort 可直接使用；Comparator 在 java.util 包，作为策略对象传入排序方法，适合按不同字段做多套排序。两者返回值约定一致：负数小于、零等于、正数大于。

```java
TreeMap<Person, String> map = new TreeMap<>(
    (p1, p2) -> Integer.compare(p1.getAge(), p2.getAge()));
```

**延伸**：写比较器不要用减法防溢出（a - b 可能溢出翻转符号），用 Integer.compare；Java 8 起 Comparator.comparing(Person::getAge) 的组合式写法更可读。

> 追问：compareTo 返回 0 在 TreeSet 里意味着什么？提示：视为同一元素，后加的进不来——去重语义以比较器为准，可能与 equals 不一致。

### HashSet、LinkedHashSet、TreeSet 有什么异同？

**结论**：三者都保证元素唯一、都非线程安全；区别在底层结构：HashSet 基于哈希表，LinkedHashSet 加一条双向链表维持插入序，TreeSet 基于红黑树维持排序。

**原理**：HashSet 的 add 实际是委托给内部 HashMap，去重靠 hashCode 定位桶、equals 判同，插入查找接近 O(1)；TreeSet 靠 compareTo 或 Comparator 决定元素位置与唯一性，操作 O(log n)；LinkedHashSet 继承 HashSet，迭代按插入顺序输出。注意 TreeSet 的「唯一」由比较结果定义，与 equals 可能不一致。

**延伸**：自定义对象进 HashSet 必须同时重写 equals 和 hashCode；进 TreeSet 则必须可比较，否则运行时抛 ClassCastException。

> 追问：对象放进 HashSet 后修改了参与 hashCode 的字段会怎样？提示：对象「卡」在旧桶里，contains 和 remove 全部失效，形成逻辑泄漏。

## Queue

### Queue 与 Deque 的区别？

**结论**：Queue 是单端队列，遵循 FIFO；Deque 是双端队列，两端都可插入删除，还能当栈用。

**原理**：Queue 的方法按失败处理方式分「抛异常 / 返回特殊值」两组：add、remove、element 对应 offer、poll、peek。Deque 在首尾各复制了一套（offerFirst、pollLast、peekLast 等），并额外提供 push、pop 模拟栈语义。队列满或空时，返回特殊值的版本更可控，生产代码优先 offer、poll、peek。

**延伸**：Deque 当栈用在语义上等价于被淘汰的 Stack 类，且面向接口编程更干净，官方推荐用 Deque 替代 Stack。

> 追问：为什么官方建议弃用 Stack？提示：Stack 继承 Vector，方法级 synchronized 开销大，继承还暴露了非栈操作。

### ArrayDeque 与 LinkedList 谁更适合做队列和栈？

**结论**：ArrayDeque。两者都实现 Deque，但 ArrayDeque 基于循环数组，LinkedList 基于链表，前者内存友好且无节点分配开销。

**原理**：ArrayDeque 用数组加头尾指针实现，容量恒为 2 的幂，用位运算绕环，扩容时整体拷贝，均摊插入 O(1)；LinkedList 每次插入都要新建节点对象，GC 压力大，数组的内存局部性对 CPU 缓存也更友好。注意 ArrayDeque 禁止 null 元素，LinkedList 允许。

**延伸**：ArrayDeque 禁 null 的原因与队列语义有关：poll、peek 返回 null 表示队列为空，存入 null 会产生二义性——这个「null 二义性」论点在 ConcurrentHashMap 上还会再遇到。

> 追问：ArrayDeque 容量为什么是 2 的幂？提示：用 (index & length-1) 位运算替代取模绕环，与 HashMap 取桶是同一思路。

### 说一说 PriorityQueue

**结论**：基于数组实现的小顶堆，优先级最高（最小）的元素先出队；非线程安全、不允许 null。

**原理**：插入时元素上浮、删除堆顶后下沉调整，offer 与 poll 都是 O(log n)，peek 是 O(1)。默认按自然排序，要求元素实现 Comparable，否则构造时传入 Comparator。一个常见误区：迭代器遍历顺序不等于优先级顺序——堆只保证堆顶最小，内部数组并不全局有序，要按优先级消费必须反复 poll。

**延伸**：Top K、合并 K 个有序链表、堆排序是 PriorityQueue 的高频算法场景；并发环境对应的选择是 PriorityBlockingQueue。

> 追问：已入堆元素的优先级字段被修改会怎样？提示：堆结构不会自动调整，该元素位置失效，应取出修改后重新入堆。
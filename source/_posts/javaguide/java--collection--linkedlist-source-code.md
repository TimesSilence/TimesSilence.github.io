---
title: "LinkedList 源码分析"
date: 2019-05-12 16:06:00
updated: 2019-05-12 16:06:00
permalink: knowledge/java/collection/linkedlist-source-code/
categories:
  - Java
tags:
  - Java集合
  - LinkedList
description: "从 JDK 8 源码出发，拆解 LinkedList 的双向链表结构、Node 设计、折半定位优化、作为 Queue/Deque 的用法，并用真实成本模型破除「链表插入一定快」的直觉。"
---

LinkedList 是 JDK 中唯一的链表实现：它同时实现 List 与 Deque，头尾插删 O(1)，随机访问却只能折半遍历。读懂它的 Node 设计与 node() 定位逻辑，再对照 ArrayList 的连续内存模型，就能理解为什么官方作者都很少用它——「链表插入快」是个被过度传播的误解。

<!-- more -->

## 它解决什么问题

链表的经典卖点是「插入删除不用搬移元素」：改动只涉及相邻节点的指针重连，与列表长度无关。LinkedList 把这个数据结构搬进集合框架，并顺手实现了 Deque 接口，让它可以同时扮演列表、队列、双端队列、栈四种角色。

但要清醒：链表免除的是「搬移」，不是「定位」。在指定下标插入前，仍然要先走到那个下标——这一步在链表上是 O(n) 的逐节点跳转，而 ArrayList 的搬移是连续内存上的批量拷贝。两种 O(n) 的常数天差地别，这是后面对比的关键。

## 核心原理

```java
public class LinkedList<E>
        extends AbstractSequentialList<E>
        implements List<E>, Deque<E>, Cloneable, java.io.Serializable {

    transient int size = 0;
    transient Node<E> first;   // 头节点
    transient Node<E> last;    // 尾节点

    private static class Node<E> {
        E item;
        Node<E> next;          // 后继
        Node<E> prev;          // 前驱

        Node(Node<E> prev, E element, Node<E> next) {
            this.item = element;
            this.next = next;
            this.prev = prev;
        }
    }
}
```

结构上一目了然：每个节点携带数据和前后两个引用，列表只持有 `first`、`last`、`size` 三个字段。头尾都在手，所以从头或从尾出发的操作都是 O(1)。

对比 ArrayList 的接口列表会发现 LinkedList 没有实现 `RandomAccess`：按下标访问在链表上不存在「快速通道」，这个标记接口的缺失本身就是对算法层的声明——「别对我用 for-i 遍历」。

## 深入机制

### 尾部插入：linkLast

```java
public boolean add(E e) {
    linkLast(e);
    return true;
}

void linkLast(E e) {
    final Node<E> l = last;
    final Node<E> newNode = new Node<>(l, e, null);
    last = newNode;
    if (l == null)
        first = newNode;   // 空表：新节点同时是头
    else
        l.next = newNode;  // 旧尾节点的后继指向新节点
    size++;
    modCount++;
}
```

`add(E)` 就是尾插。先记下旧尾节点，创建新节点并把它的 prev 指向旧尾，再把 `last` 拨到新节点，最后补接旧尾的 next。空表的特殊分支让新节点兼任头节点。全程没有循环、没有搬移，严格的 O(1)。

### 随机访问为什么慢：node() 的折半查找

```java
Node<E> node(int index) {
    if (index < (size >> 1)) {
        Node<E> x = first;
        for (int i = 0; i < index; i++)
            x = x.next;                // 靠近头部：从头向后走
        return x;
    } else {
        Node<E> x = last;
        for (int i = size - 1; i > index; i--)
            x = x.prev;                // 靠近尾部：从尾向前走
        return x;
    }
}
```

`get(index)`、`remove(index)`、`add(index, e)` 都要先经过 `node(index)` 定位。这里有一个常被忽略的优化：利用双向链表的特性，先比较 index 与 `size >> 1`，从较近的一端出发，最坏情况下遍历 n/2 个节点，平均 n/4。这是「折半」的真实含义——只是起点选择的优化，不是二分查找，复杂度依然是 O(n)。

更关键的是这 O(n) 的质量：每次 `x.next` 都是一次堆上指针跳转，节点对象的内存地址彼此不相邻，CPU 缓存行基本作废，每跳一次都可能是一次缓存未命中。相比之下 ArrayList 的 `get(i)` 是基地址加偏移的一次访存，命中缓存的概率极高。同样的 O(n)，链表的实际耗时可以是数组搬移的数倍甚至数十倍。

### 删除：unlink 的指针重连

```java
E unlink(Node<E> x) {
    final E element = x.item;
    final Node<E> next = x.next;
    final Node<E> prev = x.prev;

    if (prev == null) {
        first = next;          // x 是头节点
    } else {
        prev.next = next;
        x.prev = null;         // 断开 x 的前向引用，帮助 GC
    }

    if (next == null) {
        last = prev;           // x 是尾节点
    } else {
        next.prev = prev;
        x.next = null;
    }

    x.item = null;             // 清空数据引用
    size--;
    modCount++;
    return element;
}
```

unlink 的逻辑是标准的双向链表摘除：分四步处理「前驱为空说明 x 是头」「后继为空说明 x 是尾」两个边界，把 x 两侧的节点直接对接，再把 x 自身的引用全部置空。注意头插、头删、尾插、尾删这四个操作都不需要调用 node() 定位，所以它们是真正的 O(1)——这是 LinkedList 唯一压倒性的优势区间。

### 作为 Queue 与 Deque

LinkedList 实现了 Deque 的全部方法，本质是对头尾操作的别名封装：

| 角色 | 方法 | 对应的链表操作 |
| --- | --- | --- |
| 队列（FIFO） | `offer(e)` / `poll()` / `peek()` | 尾插 / 头删 / 读头 |
| 栈（LIFO） | `push(e)` / `pop()` / `peek()` | 头插 / 头删 / 读头 |
| 双端队列 | `addFirst/addLast/removeFirst/removeLast` | 四个方向的头尾操作 |

需要区分两个方法族的行为差异：`offer/peek/poll` 这一族在队列为空时返回 null 或 false，而 `removeFirst/getFirst` 在空表时抛 `NoSuchElementException`。写代码时按「是否需要异常语义」来选。

迭代器方面，LinkedList 的 ListItr 同样用 `expectedModCount` 做 fail-fast 校验，迭代器自身的 remove 通过 unlink 摘除节点并同步计数，是遍历中删除的唯一安全方式。

## 工程实践

- **默认不用 LinkedList**：JDK 作者 Josh Bloch 公开表示过他自己几乎不用它。需要 List 时默认 ArrayList，需要队列或栈时用 ArrayDeque——后者是循环数组实现，头尾操作同样 O(1)，但内存连续、无节点对象开销，实际性能全面优于 LinkedList。
- **遍历永远用迭代器**：对 LinkedList 写 `for (int i = 0; i < list.size(); i++) list.get(i)` 是 O(n²) 的灾难，每次 get 都从头或尾重新走一遍。增强 for 循环底层走迭代器，是 O(n) 的正确姿势。
- **合理的用武之地**：元素数量不大、且操作集中在「头尾进出 + 顺序遍历 + 迭代器中途删除」的场景，LinkedList 是称职的。LRU 语义在 Map 侧由 LinkedHashMap 承担，不需要自己动手拿 LinkedList 拼。

## 对比与权衡

| 维度 | LinkedList | ArrayList | ArrayDeque |
| --- | --- | --- | --- |
| 底层结构 | 双向链表 | 动态数组 | 循环数组 |
| get/set(i) | O(n)，折半定位 | O(1) | 不支持按下标（非 List） |
| 头尾插删 | O(1) | 头 O(n)、尾均摊 O(1) | O(1) |
| 中间插删 | 定位 O(n) + 重链 O(1) | 搬移 O(n) | 不支持 |
| 每元素内存 | 节点对象 + 两个引用，开销大 | 仅预留空槽 | 仅预留空槽 |
| 缓存友好性 | 差，指针跳转 | 好，连续内存 | 好，连续内存 |

「链表插入快」的直觉只覆盖了重链那一步。完整成本 = 定位 + 修改：LinkedList 在中间插入时是「慢定位 + 快修改」，ArrayList 是「快定位（O(1) 直接到）+ 快搬移（native 批量拷贝连续内存）」。实测中后者几乎总是更快，只有头部插入这一个点位 LinkedList 稳赢——而这个点位又被 ArrayDeque 接管。这就是 LinkedList 地位尴尬的根本原因。

## 面试视角

**LinkedList 的 get(index) 是怎么实现的？** 通过 `node(index)` 定位：先比较 index 与 size 的一半，小于一半从头节点沿 next 向后走，否则从尾节点沿 prev 向前走，最多遍历 n/2 个节点。这是起点折半优化，不是二分查找，时间复杂度仍是 O(n)。

**LinkedList 插入元素真的是 O(1) 吗？** 分情况：头尾插入是 O(1)，因为 first/last 引用在手，只需重接指针；指定下标插入要先 `node(index)` 定位，平均遍历 n/4 个节点，定位成本 O(n)，总成本 O(n)。所谓「链表插入 O(1)」成立的前提是「已经拿到了目标节点」。

**为什么不能对 LinkedList 用 for-i 循环遍历？** `get(i)` 每次都要从端点重新走到 i，循环一遍的总开销是 O(n²)。增强 for 或显式迭代器沿 next 指针单趟走完，才是 O(n)。

**LinkedList 和 ArrayList 怎么选？** 查多、按下标访问多，选 ArrayList；真正需要频繁的从头尾两端进出（队列语义）时，也优先选 ArrayDeque 而非 LinkedList。LinkedList 仅在「迭代器中途大量删除 + 几乎不按下标访问」这类少见场景有优势。

**LinkedList 为什么没实现 RandomAccess？** RandomAccess 是标记接口，声明「按下标访问是廉价的」。链表的下标访问必须逐节点走指针，内存不连续、缓存不友好，实现该接口反而会误导 `Collections.binarySearch` 这类算法选用按下标的快路径。

## 小结

- LinkedList 是带 first/last 双指针的双向链表，头尾操作 O(1)，指定下标操作必须先折半定位，O(n)。
- node() 的「折半」只是选近端起点，且链表的 O(n) 因指针跳转和缓存未命中，实际代价远高于数组搬移。
- 它同时实现了 Deque，可当队列和栈用，但这两个角色在工程上通常由 ArrayDeque 以更优性能接管。
- 记住选型顺序：List 默认 ArrayList，栈/队列默认 ArrayDeque，LinkedList 只在明确的迭代器删改场景出场。
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
description: "理解 LinkedList 双向链表结构、Deque 操作与和 ArrayList 的性能差异。"
---

`LinkedList` 实现双向链表，同时实现 `List` 与 `Deque`，可在头尾 O(1) 插删；随机访问需遍历，工程里多数场景仍被 `ArrayList` 取代。

<!-- more -->

## 核心概念

节点 `Node<E>` 含 `item、prev、next`；维护 `first/last` 与 `size`。继承 `AbstractSequentialList`，随机访问的 `get(index)` 会从头或尾折半遍历，O(n)。实现队列/栈：`offer/poll/peek`、`push/pop`。不支持 `RandomAccess`，增强 for 仍可用迭代器顺序访问。

## 关键机制与实践

**头尾操作** `addFirst/addLast` 仅改指针，O(1)。**中间插入** 先定位再链接，平均 O(n)。Josh Bloch 曾公开表示很少用 LinkedList——常数因子大、缓存不友好。真正需要双端队列时，可评估 `ArrayDeque`（数组环形缓冲，通常更快）。

```java
Deque<String> dq = new LinkedList<>();
dq.addFirst("head");
dq.addLast("tail");
```

## 常见误区与小结

- 认为链表任意位置插入都是 O(1)（找位置仍是 O(n)）。
- 用 LinkedList 做大量 `get(i)`（应用 ArrayList）。
- 忽略 `ArrayDeque` 作为栈/队列的替代。

结论：**默认 List 用 ArrayList；双端队列优先 ArrayDeque；LinkedList 了解即可**。
---
title: "ArrayList 源码分析"
date: 2019-03-21 10:24:00
updated: 2019-03-21 10:24:00
permalink: knowledge/java/collection/arraylist-source-code/
categories:
  - Java
tags:
  - Java集合
  - ArrayList
description: "理解 ArrayList 动态数组、扩容策略、RandomAccess 与 fail-fast 迭代机制。"
---

`ArrayList` 是最常用的动态数组实现：随机访问 O(1)，尾部追加均摊 O(1)，中间插入删除需搬移元素。理解扩容与 `modCount` 能解释很多线上异常。

<!-- more -->

## 核心概念

底层 `transient Object[] elementData`，`size` 记录元素个数。JDK 8+ 空构造延迟分配，首次 add 才扩到默认 10。扩容：`grow` 约为 **1.5 倍**（`newCapacity = old + (old >> 1)`），复制到新数组。实现 `RandomAccess` 标记支持快速下标访问。

## 关键机制与实践

`add(E)` 尾插；`add(index, E)` 需 `System.arraycopy` 腾位。`remove` 同理左移或右移。迭代器检查 `expectedModCount == modCount`，结构修改抛 `ConcurrentModificationException`（fail-fast）。`subList` 是原列表视图，父列表修改会影响子列表。

```java
List<String> list = new ArrayList<>(16);
list.add("a");
list.get(0); // O(1)
```

## 常见误区与小结

- 循环里 `remove(i)` 漏减索引或应用迭代器 remove。
- 预设容量：`new ArrayList<>(expectedSize)` 减少扩容次数。
- 多线程共享 `ArrayList` 不加锁（应换 `CopyOnWriteArrayList` 或同步包装）。

与 `LinkedList`：**查多用 ArrayList，头尾频繁插删且少随机访问可考虑 LinkedList**。
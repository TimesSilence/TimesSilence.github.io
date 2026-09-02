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
description: "掌握 HashMap 数组+链表/红黑树结构、hash 扰动、扩容与 JDK8 树化阈值。"
---

`HashMap` 基于哈希表，JDK 8 为 **数组 + 链表 + 红黑树**：冲突链过长时树化降低查找至 O(log n)。非线程安全，允许一个 null 键与多个 null 值。

<!-- more -->

## 核心概念

默认容量 16，负载因子 0.75，阈值 `capacity * loadFactor` 触发扩容为 2 倍。**hash 扰动**：`(h = key.hashCode()) ^ (h >>> 16)` 再 `(n-1) & hash` 定位桶。链表长度 ≥8 且 table 长度 ≥64 时转红黑树；≤6 退化为链表。扩容时 rehash 节点到新表，JDK 8 优化为按位拆链。

## 关键机制与实践

`put`：无桶则新建 Node；hash 相同再比 key `equals`；冲突尾插或树插入。`get` 沿链或树查找。重写 `key` 的 `hashCode/equals` 是正确使用前提。并发场景用 `ConcurrentHashMap`，不要用 `Collections.synchronizedMap` 冒充高并发方案。

```java
// JDK 8 扰动函数思想：高 16 位参与索引，减少碰撞
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

## 常见误区与小结

- 多线程 put 导致死链或丢数据（JDK 7 扩容 rehash 尤甚）。
- 用可变对象作 key 且修改参与 hash 的字段。
- 误以为树化阈值 8 必然变树（table 小于 64 先扩容）。

HashMap 是面试与工程基石：**懂 hash、扩容、equals 契约，才懂 CHM 与缓存设计**。
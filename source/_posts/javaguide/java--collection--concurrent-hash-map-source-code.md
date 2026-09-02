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
description: "对比 JDK7 Segment 分段锁与 JDK8 CAS+synchronized 的 ConcurrentHashMap 实现演进。"
---

`ConcurrentHashMap` 是线程安全的哈希表：JDK 7 用 **Segment 分段锁** 限制竞争范围；JDK 8 改为 **Node 数组 + CAS + synchronized 桶头**，结构更接近 HashMap，并发度与内存更优。

<!-- more -->

## 核心概念

**JDK 7**：固定 Segment 数组，每个 Segment 继承 ReentrantLock，内部小型 HashMap。**JDK 8**：单 table，`put` 空桶 CAS 占位，冲突则 synchronized 锁链表/树头节点；扩容多线程协助迁移。`size()` 用 `baseCount` + `CounterCell` 分散计数。不允许 null 键值（与 HashMap 不同，避免歧义）。

## 关键机制与实践

读操作大多无锁（volatile 读 table 与 Node val/next）。`computeIfAbsent` 等原子复合操作适合缓存场景。迭代器弱一致性，不抛 CME，但可能反映部分更新。与 `Collections.synchronizedMap` 比：CHM 粒度更细，读扩展性更好。

```java
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
map.computeIfAbsent("key", k -> expensiveLoad(k));
```

## 常见误区与小结

- 以为 CHM 所有操作都无锁（`size`、扩容、树化仍有同步）。
- 用 get-check-put 代替 `putIfAbsent` 导致竞态。
- JDK 7/8 实现混谈面试（需按版本答）。

高并发 Map 首选 CHM；**需要排序视图时另选 ConcurrentSkipListMap**。
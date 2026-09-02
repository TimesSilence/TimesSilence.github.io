---
title: "Java集合使用注意事项总结"
date: 2019-02-15 16:56:00
updated: 2019-02-15 16:56:00
permalink: knowledge/java/collection/java-collection-precautions-for-use/
categories:
  - Java
tags:
  - Java集合
  - 最佳实践
description: "归纳集合判空、Arrays.asList、subList、toMap 与并发容器选型等常见坑与规约。"
---

集合 API 丰富但坑点多：阿里规约与实战经验强调「可读性 + 正确性 + 并发边界」，很多线上 NPE 与 CME 都源于对集合语义的一知半解。

<!-- more -->

## 核心概念

**判空**用 `isEmpty()` 而非 `size()==0`（部分并发集合 `size()` 是 O(n)）。**Arrays.asList** 返回固定大小列表，不能 `add/remove`，且基本类型数组会被当作单个元素。**subList** 是父列表视图，结构性修改父列表会导致子列表行为未定义。**Stream toMap** 需处理 key 冲突与 null value（否则 NPE）。

## 关键机制与实践

`Collectors.toMap(k, v, (a,b)->a)` 指定 merge；`Optional.ofNullable` 过滤 null。foreach 里不要对 `ArrayList` 直接 remove，用 `Iterator.remove`。并发场景：`ConcurrentHashMap`、`CopyOnWriteArrayList` 各有适用面，不要万能 `synchronizedList`。集合转数组用 `list.toArray(new String[0])`（JDK 11+ 推荐）。

## 常见误区与小结

- `Arrays.asList(1,2).add(3)` 抛 UnsupportedOperationException。
- 对 subList  clear 误删父列表大量数据。
- 用 HashMap 在多线程 `put` 导致 CPU 100%（JDK 7）或数据丢失。

写集合代码时多问三句：**是否可变视图？是否线程安全？null 与重复 key 怎么处理？**
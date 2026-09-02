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
description: "理解 LinkedHashMap 双向链表维护插入/访问顺序及 LRU 缓存实现方式。"
---

`LinkedHashMap` 继承 `HashMap`，在哈希桶之外用**双向链表**串起所有条目，从而支持按插入顺序或访问顺序迭代——是实现简易 LRU 的经典结构。

<!-- more -->

## 核心概念

`Entry` 扩展 HashMap 的 Node，增加 `before/after` 指针。构造参数 `accessOrder`：false 为插入顺序，true 为访问顺序（get 会把节点移到链表尾）。覆盖 `afterNodeAccess` 等钩子维护链表。迭代按链表走，复杂度 O(n)，与 bucket 数量无关，遍历往往比 HashMap 更稳定。

## 关键机制与实践

LRU 思路：`accessOrder=true`，重写 `removeEldestEntry` 在 size 超限时删最老（链表头）条目。注意线程安全需外包同步或使用 Caffeine 等专业缓存。与 `TreeMap` 按 key 排序不同，LinkedHashMap 顺序是插入或访问时间语义。

```java
LinkedHashMap<String, String> lru = new LinkedHashMap<>(16, 0.75f, true) {
    @Override protected boolean removeEldestEntry(Map.Entry<String, String> e) {
        return size() > 100;
    }
};
```

## 常见误区与小结

- 以为 LinkedHashMap 会按 key 排序（那是 TreeMap）。
- LRU 只依赖 LinkedHashMap 而不处理加载/过期逻辑（生产用 Guava/Caffeine）。
- 忽略 accessOrder 下 `get` 也会改顺序的副作用。

**要顺序遍历或 LRU，LinkedHashMap；要按 key 排序，TreeMap**。
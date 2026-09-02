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
description: "归纳并发容器、Queue、PriorityQueue 与 HashMap/CHM 进阶面试题要点。"
---

集合面试下篇聚焦并发与特殊队列：CHM 演进、BlockingQueue 家族、CopyOnWrite 与 WeakHashMap 等，常与线程池、缓存一起考。

<!-- more -->

## 核心概念

**ConcurrentHashMap**：7 分段锁 vs 8 CAS+synchronized。**BlockingQueue**：`ArrayBlockingQueue` 有界单锁、`LinkedBlockingQueue` 可选容量、`SynchronousQueue` 不存元素直接交接。**CopyOnWriteArrayList**：写时复制，读无锁。**PriorityQueue** 小顶堆，非线程安全。**WeakHashMap** 弱引用键，利于缓存自动回收。

## 关键机制与实践

线程池队列选型：有界 ArrayBlockingQueue + 拒绝策略防 OOM；`SynchronousQueue` 配合 `maximumPoolSize` 实现直接 handoff。CHM 的 `computeIfAbsent` 做本地缓存；注意 value 加载勿过慢阻塞桶锁。对比 `HashTable`、`Collections.synchronizedXxx` 的全表锁与 CHM 细粒度。

## 常见误区与小结

- 认为 `ConcurrentHashMap` 完全等同线程安全 HashMap（复合操作仍需原子方法）。
- PriorityQueue 迭代顺序不等于优先级顺序（需 poll peek）。
- WeakHashMap  value 强引用仍会导致内存泄漏。

下篇与源码分析文章配合：**能画结构、能说锁粒度、能举线程池例子**，集合模块面试基本稳了。
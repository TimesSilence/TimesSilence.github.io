---
title: "CopyOnWriteArrayList 源码分析"
date: 2019-04-08 12:38:00
updated: 2019-04-08 12:38:00
permalink: knowledge/java/collection/copyonwritearraylist-source-code/
categories:
  - Java
tags:
  - Java集合
  - 并发
  - CopyOnWrite
description: "理解 CopyOnWriteArrayList 写时复制策略及在读多写少场景下的适用边界。"
---

`CopyOnWriteArrayList`（COW）在**写**时复制整个底层数组，读操作无锁访问快照，适合读远多于写、且能容忍短暂不一致的监听器、白名单等场景。

<!-- more -->

## 核心概念

内部 `volatile Object[] array` 持有当前快照。`add`/`set`/`remove`：`lock` → 复制新数组 → 修改 → 原子替换 array 引用 → `unlock`。迭代器持有创建时的数组引用，**不会抛 ConcurrentModificationException**（快照迭代）。写开销 O(n)，读 O(1) 且无锁。

## 关键机制与实践

典型用途：Servlet 监听器列表、配置热更新、Rx 订阅者集合。写频繁时复制成本与 GC 压力巨大，应换 `Collections.synchronizedList` 或并发队列。元素需稳定：迭代过程中看到的是旧快照，新写入对已有迭代器不可见。

```java
CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
listeners.add(this::onEvent);
for (Runnable r : listeners) { r.run(); } // 无锁读
```

## 常见误区与小结

- 在 COW 列表上高频写入（性能灾难）。
- 期望迭代器立刻看到最新写入（需重新获取迭代器或换结构）。
- 与 `Vector` 线程安全混淆（Vector 方法级 synchronized，读写都串行）。

口诀：**读多写少、写不频繁、快照可读即可** 时考虑 COW。
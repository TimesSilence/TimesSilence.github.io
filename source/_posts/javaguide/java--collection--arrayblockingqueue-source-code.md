---
title: "ArrayBlockingQueue 源码分析"
date: 2019-03-13 09:17:00
updated: 2019-03-13 09:17:00
permalink: knowledge/java/collection/arrayblockingqueue-source-code/
categories:
  - Java
tags:
  - Java集合
  - 并发
  - BlockingQueue
description: "学习 ArrayBlockingQueue 的有界数组、ReentrantLock 双锁与阻塞入队出队实现要点。"
---

`ArrayBlockingQueue` 是基于数组的**有界**阻塞队列，生产者与消费者共用一把 `ReentrantLock`，通过两个 `Condition` 实现「队满等待 / 队空等待」。

<!-- more -->

## 核心概念

内部环形数组 + `takeIndex`/`putIndex`/`count` 维护头尾与元素个数。构造时可指定公平/非公平锁。实现 `BlockingQueue`：`put` 队满阻塞，`take` 队空阻塞；还有 `offer`/`poll` 超时非阻塞变体。单锁设计简单，高并发下锁竞争可能成为瓶颈。

## 关键机制与实践

入队：`lock` → while 满则 `notFull.await` → 写入数组 → 更新索引 → `notEmpty.signal` → `unlock`。出队对称。`size()` 在锁内读取 `count`，一致性好。线程池 `ThreadPoolExecutor` 常用有界队列配合拒绝策略，防止无界堆积 OOM。

```java
BlockingQueue<Task> q = new ArrayBlockingQueue<>(100);
q.put(task);  // 满则阻塞
Task t = q.take(); // 空则阻塞
```

## 常见误区与小结

- 与 `LinkedBlockingQueue` 混淆：后者默认无界（或指定容量）、通常两把锁。
- 忽略 `fair=true` 对吞吐的影响（更公平但更慢）。
- 队列为 null 元素（`ArrayBlockingQueue` 不允许 null）。

选型：**需要固定容量、内存紧凑时用 ArrayBlockingQueue**；极高并发可考虑 `LinkedBlockingQueue` 或 Disruptor。
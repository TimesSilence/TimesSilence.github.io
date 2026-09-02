---
title: "DelayQueue 源码分析"
date: 2019-04-16 13:45:00
updated: 2019-04-16 13:45:00
permalink: knowledge/java/collection/delayqueue-source-code/
categories:
  - Java
tags:
  - Java集合
  - DelayQueue
  - 并发
description: "学习 DelayQueue 基于 PriorityQueue 的延迟元素调度与阻塞获取机制。"
---

`DelayQueue` 是无界阻塞队列，元素须实现 `Delayed`（按剩余延迟时间排序）。队头是最早到期的元素；`take` 在元素未到期时会阻塞等待。

<!-- more -->

## 核心概念

底层 **PriorityQueue** 按 `getDelay(NOW)` 小顶堆排序。`ReentrantLock` + `Condition available` 协调并发。`put`/`offer` 入堆并 `signal`；`take` 循环检查队头 delay 是否 ≤0，否则 `awaitNanos` 睡到最近到期时间。用于定时任务、缓存过期、订单超时关闭等。

## 关键机制与实践

`ScheduledThreadPoolExecutor` 的延迟调度与 DelayQueue 思想相近。自定义任务实现 `Delayed`：在 `compareTo` 与 `getDelay` 中保持一致的排序语义（通常按到期时间戳）。注意系统时钟调整对 `TimeUnit` 换算的影响；高精度场景评估 `System.nanoTime()`。

```java
public class DelayTask implements Delayed {
    private final long expireAt;
    public long getDelay(TimeUnit u) {
        return u.convert(expireAt - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
    }
}
```

## 常见误区与小结

- 元素未正确实现 `compareTo` 与 `getDelay` 一致性导致乱序。
- 把 DelayQueue 当普通优先级队列（到期语义是核心）。
- 大量长期延迟任务占堆内存（队列无界）。

适合**单机、中等规模延迟调度**；分布式定时请用 MQ 延迟消息或专用调度服务。
---
title: "如何基于Redis实现延时任务？"
date: 2021-03-29 12:58:00
updated: 2021-03-29 12:58:00
permalink: knowledge/database/redis/redis-delayed-task/
categories:
  - 数据库
tags:
  - Redis
  - 延迟队列
description: "基于 Redis 实现延迟任务的几种方案与取舍。"
---

延迟任务要同时满足「到时触发」与「至少一次执行」。Redis 提供多种轻量实现，但可靠性与精确度不同。

<!-- more -->

## 方案对比

| 方案 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| ZSet | score=执行时间 | 简单 | 单点需抢任务 |
| Keyspace 过期 | 过期事件通知 | 省结构 | 不保证触发、易丢 |
| Redisson DelayQueue | 内部队列 | 封装好 | 依赖组件 |
| Stream | 定时扫描+消费组 | 可 ACK | 需调度器 |

```bash
ZADD delay:tasks 1735689600000 "order:1001"
# 轮询 ZRANGEBYSCORE 取到期任务，Lua 原子 ZREM 防重复
```

## 实践建议

执行端幂等；任务状态机落 DB；多实例用 Lua/Redlock 抢任务；监控 pending 堆积。

## 与 MQ 分工

短延迟、量不大用 Redis；长延迟、堆积、审计要求用 RocketMQ 定时/延迟消息。

## 时钟依赖

多机 NTP 同步；延迟队列比较的是 Redis 所在机器时间。

## 实践复习清单

ZSet 延迟队列 Lua 原子；幂等消费；pending 监控；NTP 同步；与 MQ 边界；Redisson 方案评估。

## 常见坑

- 只靠 key 过期事件做金融级延迟扣款。
- ZSet 轮询无分布式锁导致重复执行。
- 时间戳单位混用秒与毫秒。

## 总结与自测

ZSet 延迟队列步骤；过期通知为何不可靠；幂等必须；与 MQ 边界。延迟任务要先定义「允许重复执行吗」。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。
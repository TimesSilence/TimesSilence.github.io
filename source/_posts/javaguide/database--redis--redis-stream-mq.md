---
title: "如何基于Redis实现消息队列？"
date: 2021-05-15 17:33:00
updated: 2021-05-15 17:33:00
permalink: knowledge/database/redis/redis-stream-mq/
categories:
  - 数据库
tags:
  - Redis
  - Stream
  - 消息队列
description: "用 Redis Stream 与消费组实现轻量消息队列的要点。"
---

Stream 让 Redis 具备可 ACK 的消息语义，适合轻量异步任务，但不等同于 Kafka 级日志系统。

<!-- more -->

## 核心命令

XADD 写入；XREAD/XREADGROUP 消费；XACK 确认；XPENDING 查未 ack；XCLAIM 转移超时消息。

```bash
XADD orders * type created id 1001
XGROUP CREATE orders cg1 $ MKSTREAM
XREADGROUP GROUP cg1 c1 COUNT 10 STREAMS orders >
```

## 与 List 队列差异

支持消费组、持久化消息 ID、pending 列表与范围查询，更适合多消费者竞争与重试。

## 实践建议

设置 MAXLEN 近似裁剪防无限增长；业务幂等；监控 lag 与 pending 数。

## 与 Pub/Sub 区别

Pub/Sub 无持久、无消费组；Stream 可持久、可回溯。广播用 Pub/Sub，任务队列用 Stream。

## 消费者崩溃恢复

XPENDING + XCLAIM 重新分配 idle 消息；设置 min-idle-time。

## 实践复习清单

XADD/XREADGROUP/XACK 流程；pending 重试 XCLAIM；MAXLEN 裁剪；与 PubSub 选型；lag 监控；幂等 business id。

## 常见坑

- 无 ACK 消费者崩溃导致消息挂 pending 无人处理。
- 用 Stream 扛超大吞吐日志流（应选 Kafka/Pulsar）。
- 忽略 `>` 与 `0` 读取语义差异。

## 总结与自测

Stream 消费组流程；XACK 作用；pending 处理；与 PubSub 选型。轻量队列也要定义 dead letter 与监控。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
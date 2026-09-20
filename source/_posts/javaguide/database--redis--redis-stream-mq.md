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
description: "Redis Stream 做消息队列：XADD/XREAD/XREADGROUP 消费模型、消费者组与 Pending 确认机制、与 List/PubSub 的对比，以及专业场景仍选 Kafka/RocketMQ 的原因。"
---

Redis 5.0 的 Stream 是第一种「像样的」消息队列数据结构：消息持久化、消费者组、ACK 确认一应俱全。它能覆盖轻量异步场景，但与 Kafka、RocketMQ 之间有清晰的能力边界。

<!-- more -->

## 先立标尺：生产级 MQ 需要哪些能力

评价一个消息队列方案，通常看七个维度：消息持久化、至少一次投递、消费确认（ACK）与重试、消费者组负载均衡、消息堆积能力、顺序保证、水平扩展。拿这把尺子去量 Redis 的三代方案，差距和进步一目了然。

## 三代方案：List → Pub/Sub → Stream

**List**：`RPUSH` 生产、`LPOP` 消费，配 `BLPOP/BRPOP` 阻塞读避免空转。问题是取走即删，没有 ACK——消费者处理失败，消息永久丢失；且一条消息只能被一个消费者拿到，不支持广播。

**Pub/Sub**：解决了广播，发布者向 Channel 投递，所有订阅者都能收到。但它发后即忘：不持久化、无 ACK、无堆积能力，订阅者不在线消息就没了，只能做对可靠性要求极低的实时通知。

**Stream**：5.0 新增，底层是 Radix Tree 加 listpack 的有序消息日志。消息 ID 为「毫秒时间戳-序列号」，全局唯一且递增，前缀高度重合正好被基数树压缩，因此内存占用低、还支持按 ID 范围高效查询（XRANGE）与回溯。

## Stream 的消费模型

```bash
# 生产：* 表示由服务端生成消息 ID
XADD orders * type created id 1001
# 创建消费者组，$ 表示从最新位置开始消费
XGROUP CREATE orders cg1 $ MKSTREAM
# 组内消费：> 表示只取从未投递过的新消息
XREADGROUP GROUP cg1 c1 COUNT 10 BLOCK 2000 STREAMS orders >
# 处理成功后确认
XACK orders cg1 1735689600000-0
```

三组命令对应两种消费方式：

- `XREAD` 直接读流，不属于任何消费者组，从 `0` 或指定 ID 开始读，适合广播式订阅与历史回溯。
- `XREADGROUP` 在消费者组内读，一条新消息只投递给组内一个消费者，天然负载均衡；`>` 取新消息，传 `0` 或具体 ID 则读自己 pending 列表里的待确认消息。
- 同一个流上可以挂多个消费者组，每组独立维护游标与 PEL，同一条消息能被多个业务方各自完整消费一遍——类似 Kafka 的多订阅，这是 Stream 相对 List 的本质升级。

## 消费者组与 Pending 确认机制

消费者组维护两个关键状态：

- **last_delivered_id**：组的消费游标，任何成员读到新消息都会把它向前推进，保证同一条新消息不会投递给两个成员。
- **PEL（Pending Entries List）**：已投递但尚未 ACK 的消息列表，记录消息归属的消费者、投递次数与闲置时长。

完整流转是：`XREADGROUP` 取到新消息 → 消息进入自己的 PEL → 处理成功后 `XACK` 将其移出 PEL。如果消费者崩溃没来得及 ACK，消息滞留在 PEL 中，闲置时间持续增长——这正是「至少一次投递」的实现基础：其他消费者用 `XPENDING` 发现滞留消息，再用 `XCLAIM`（带 min-idle-time 参数）把超时消息转移到自己名下重新处理。

两个必须记住的推论：一是 ACK 之前崩溃必然导致重复投递，**消费端必须幂等**；二是 XCLAIM 转移后仍反复失败的消息要有重试上限，超限转入死信（可落库或另建 Stream），否则 PEL 会越积越长。

## 实战要点

- 写入时带 `MAXLEN ~ 10000` 近似裁剪，防止流无限增长撑爆内存；近似裁剪按整节点删除，代价远小于精确裁剪。
- 监控 `XINFO GROUPS` 的 lag（未读新消息数）与 PEL 长度，堆积即告警。
- 消费者崩溃重启后，先用读 ID `0` 的方式处理自己 PEL 里的存量，再回到 `>` 读新消息。

## 为什么专业场景仍选 Kafka/RocketMQ

Stream 够用，但有三道硬边界：

1. **持久化强度**：Stream 依赖 RDB/AOF，`appendfsync everysec` 下宕机最坏丢约 1 秒数据；Kafka 多副本加磁盘顺序写，可靠性高一个量级。
2. **堆积能力**：Stream 全量驻留内存，堆积受单机内存限制；Kafka 基于磁盘，TB 级堆积性能依然稳定。
3. **吞吐与生态**：Kafka 分区模型可水平扩展到百万级 QPS，重平衡、事务消息、流处理生态完整；Stream 单机十万级已是上限附近，集群扩展能力有限。

结论很直接：项目里已有 Redis、业务量小、追求低延迟与低运维成本，Stream 是省去一套 MQ 部署的最优解；金融级业务、海量数据、严格不丢消息，老老实实选 Kafka、RabbitMQ 或 RocketMQ。
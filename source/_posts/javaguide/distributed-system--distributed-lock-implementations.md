---
title: "分布式锁实现方案详解：Redis、Redlock、ZooKeeper 与 Redisson 看门狗"
date: 2023-09-14 15:49:00
updated: 2023-09-14 15:49:00
permalink: knowledge/distributed-system/distributed-lock-implementations/
categories:
  - 分布式系统
tags:
  - 分布式锁
  - Redis
  - Redisson
  - ZooKeeper
description: "Redis 单节点与 Redlock、ZooKeeper 临时顺序节点、Redisson 看门狗等实现对比。"
---

选型分布式锁实现时，要比较的不只是"能不能锁"，还有失效语义、故障模型与运维成本。本文对比 Redis、Redlock、ZK 等主流实现及适用边界。

<!-- more -->

## 要解决什么问题

MySQL 锁表或 GET_LOCK 性能差且连接语义与业务线程生命周期耦合；Redis SET NX EX 看似简单但主从异步复制可能在 failover 后丢锁；Redlock 多节点方案在学术界仍有争议；ZK 临时顺序节点依赖 session 超时，临界区过长会丢锁。实现选型必须对齐 SLA 和可接受的极端情况。

## 核心原理

Redis 单实例：SET key random NX EX，释放 Lua 比较再 DEL。Redisson 看门狗后台续约。Redlock 向 N 个独立 master 加锁，过半成功且总耗时小于 TTL 才算成功。ZK 创建 EPHEMERAL_SEQUENTIAL 节点，监听前序节点释放实现公平锁；Curator InterProcessMutex 封装重试与 session 监听。DB 唯一索引插入也可作互斥但吞吐低。

## 方案权衡

Redis 适合高 QPS、短临界区、可配合幂等兜底；ZK 适合需要强协调语义、锁持有与 session 绑定的场景；DB 适合低并发或已有强 DB 依赖。Martin Kleppmann 指出 Redlock 在进程 pause 和时钟漂移下不能保证安全性，生产应配合 fencing 或业务层去重，而非迷信算法本身。

## 落地要点

Redis 锁 value 必须随机 UUID；了解主从切换窗口风险，关键路径加 token；ZK 锁监控 session 事件；压测锁竞争下 P99 和锁等待队列。优先缩短临界区而非无限续约；文档化"锁失败"时业务降级策略（快速失败 vs 排队）。

## 常见误区

误区：SETNX 不设过期永久死锁；DEL 不校验 owner；在 ZK 锁内执行分钟级任务；Redlock 节点共享同一交换机仍算"独立"。忽视 GC stop-the-world 导致锁过期后仍执行临界区，是 Redis 锁经典坑点。

## 小结

实现层选型没有绝对正确答案：短临界区、可幂等兜底优先 Redis+Redisson；需要会话绑定和公平锁再看 ZK/Curator。无论哪种实现，都要在架构评审里写清故障模型，并配合监控锁等待时间与持有时间，避免线上只看见慢接口却查不到锁竞争根因。
---
title: "MongoDB常见面试题总结（下）"
date: 2021-06-22 11:01:00
updated: 2021-06-22 11:01:00
permalink: knowledge/database/mongodb/mongodb-questions-02/
categories:
  - 数据库
tags:
  - MongoDB
  - 分片
  - 索引
description: "MongoDB 分片、索引优化与聚合管道相关面试与实践要点。"
---

下半部分面试聚焦分片键设计、聚合性能与安全模型。线上问题多出在「键选错」和「管道全表扫」。

<!-- more -->

## 分片键设计原则

选高基数、低频率变更、与查询模式匹配的字段。复合键常把范围查询字段放前。避免单调递增键导致写热点；必要时用 hashed shard key。

## 块迁移与平衡

Balancer 在 shard 间迁移 chunk；迁移期间有短暂性能波动。jumbo chunk 无法迁移需人工拆分或改键。

## 索引策略

```javascript
// 覆盖常见列表查询
db.logs.createIndex({ appId: 1, ts: -1 })
// 聚合前尽量 $match 前置并用索引
db.logs.aggregate([
  { $match: { appId: "a", ts: { $gte: ISODate("2026-01-01") } } },
  { $group: { _id: "$level", count: { $sum: 1 } } }
])
```

## 安全与权限

启用 auth、最小权限角色、网络隔离。生产禁用默认端口裸奔；审计日志跟踪 DDL 与高权限操作。

## 聚合优化套路

$match 尽量前置并命中索引；$project 早裁剪字段；允许磁盘 spill 时注意 temp 目录。explain on aggregate 看是否 IXSCAN。

## change stream 应用

监听 oplog 驱动下游缓存失效或搜索索引增量，比轮询 _id 更可靠。

## 实践复习清单

为典型查询写 createIndex 并 explain；分片集群画出 chunk 分布；知道 jumbo chunk 处理流程；聚合管道优化 checklist：match 前置、project 裁剪、allowDiskUse 告警；安全启用 auth 与 TLS。

## 常见坑

- $lookup 在大集合上无索引，内存排序超限。
- 聚合管道 $sort 在 $match 之前，无法下推索引。
- 分片集群上未 targeted 的 scatter-gather 查询打满所有 shard。

## 总结与自测

分片键为何忌单调递增？jumbo chunk 如何处理？聚合 $match 为何放前？$lookup 慢怎么优化？auth 与 TLS 为何必须？回答时结合一次你设计过的文档模型或索引，比背概念更有说服力。

## 原理延伸

MongoDB 把文档原子性、副本集复制与可选分片组合成横向扩展方案。schema 灵活不等于无需设计：嵌入与引用、索引与 working set、writeConcern 与 readPreference 共同决定延迟与一致性。聚合管道是分析利器，但 $lookup 与无索引 $match 容易把负载放大到集群级。生产环境必须启用 auth、TLS 与 least-privilege 角色，并把备份恢复与 failover 演练写进 runbook。
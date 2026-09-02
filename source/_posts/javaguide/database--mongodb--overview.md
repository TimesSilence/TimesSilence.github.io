---
title: "MongoDB 专题：文档模型、索引、副本集、分片、事务与常见面试题"
date: 2021-05-24 08:40:00
updated: 2021-05-24 08:40:00
permalink: knowledge/database/mongodb/overview/
categories:
  - 数据库
tags:
  - MongoDB
  - 文档数据库
  - 副本集
description: "概览 MongoDB 文档模型、索引、副本集、分片与事务等核心主题。"
---

MongoDB 以 BSON 文档为中心，适合 schema 演进快的业务。学习时要把「灵活」与「可控」平衡好。

<!-- more -->

## 文档模型要点

集合里存 JSON/BSON 文档，字段可嵌套数组与对象。同一集合内文档结构可以不同，但生产仍建议约定 schema 版本，避免字段爆炸。

## 核心机制

- **索引**：单字段、复合、多键（数组）、文本、地理空间；注意 ES 与 Mongo 文本索引差异。
- **副本集**：一主多从+仲裁，选举 failover；写关注 `writeConcern`，读关注 `readPreference`。
- **分片**：按 shard key 水平切分；选好键避免热点与 jumbo chunk。
- **事务**：4.0 副本集、4.2 分片支持多文档事务，但有性能与大小限制。

## 实践建议

```javascript
db.orders.createIndex({ userId: 1, createdAt: -1 })
db.orders.find({ userId: 123 }).sort({ createdAt: -1 }).limit(20)
```

大文档拆子文档；高频更新字段与冷数据分离；监控 workingSet 与慢查询 profiler。

## 容量与性能规划

working set 应 mostly 在 RAM；超过则 page fault 激增。写关注与读偏好组合决定延迟与一致性。压测时观察 wiredTiger cache usage、queue length、opcounters。

## 与关系型协作

Mongo 管文档型业务对象，账单流水仍可能落 MySQL。跨库 ID 用 UUID 或雪花，避免依赖单库自增。

## 实践复习清单

文档 schema 版本化；大数组拆表；副本集 writeConcern 与 readPreference 组合表；分片键评审模板；事务使用边界；change stream 消费幂等；profiler 慢查询阈值。

## 常见坑

- shard key 选单调递增 `_id`，导致单分片热点。
- 无索引的全表扫描拖垮集群。
- 把 Mongo 当 MySQL 用，复杂 JOIN 在应用层 N+1 查询。

## 总结与自测

文档模型相对关系型的优劣？副本集读偏好有哪些？分片与副本集关系？多文档事务限制？change stream 典型用途？建议用一个小项目完成 CRUD+索引+聚合+副本集 failover 观察。

## 原理延伸

MongoDB 把文档原子性、副本集复制与可选分片组合成横向扩展方案。schema 灵活不等于无需设计：嵌入与引用、索引与 working set、writeConcern 与 readPreference 共同决定延迟与一致性。聚合管道是分析利器，但 $lookup 与无索引 $match 容易把负载放大到集群级。生产环境必须启用 auth、TLS 与 least-privilege 角色，并把备份恢复与 failover 演练写进 runbook。
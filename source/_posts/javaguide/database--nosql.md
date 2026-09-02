---
title: "NoSQL基础常见面试题总结"
date: 2021-06-12 10:54:00
updated: 2021-06-12 10:54:00
permalink: knowledge/database/nosql/
categories:
  - 数据库
tags:
  - NoSQL
  - MongoDB
  - Redis
description: "对比 SQL 与 NoSQL 的模型、扩展与一致性差异，梳理四类 NoSQL 适用场景。"
---

NoSQL 不是「不要 SQL」，而是为特定数据模型与扩展模式做了取舍。理解 trade-off 才能正确选型。

<!-- more -->

## NoSQL 解决什么问题

当数据量大、结构多变、访问模式清晰且需要横向扩展时，键值、文档、宽列、图四类 NoSQL 各有优势。它们并非不能表达关系，只是存储与查询方式不同。

## 与关系型的关键差异

| 维度 | 关系型 | NoSQL |
|------|--------|-------|
| 模型 | 固定表结构 | 灵活 schema |
| 扩展 | 垂直+分库分表 | 原生分片横向扩展 |
| 事务 | 成熟 ACID | 多数最终一致，部分有限事务 |
| 查询 | SQL 标准化 | API/查询语言因产品而异 |

## 四类怎么选

- **键值（Redis）**：缓存、会话、计数、分布式锁。
- **文档（MongoDB）**：内容、配置、嵌套 JSON 业务对象。
- **宽列（HBase/Cassandra）**：时序、海量稀疏列、写多读少。
- **图（Neo4j）**：社交关系、推荐、风控关联分析。

## 实践建议

先用关系型把业务跑通，出现明确瓶颈再引入 NoSQL。跨存储的一致性用 Outbox、CDC 或业务补偿，不要幻想「双写一定一致」。

## CAP 与 BASE 怎么落地

分布式环境下 P 通常保留，在 C 与 A 间取舍。Redis Cluster 偏 AP；Mongo 副本集可配 writeConcern 提升 C。业务上要定义「可接受多旧」：购物车缓存旧几分钟也许 OK，余额不行。

## 混合架构模式

CQRS 读写分离存储、事件驱动同步是常见组合。写路径走 MySQL 保事务，读路径走 ES/Redis 做搜索与列表，中间用 CDC 拉齐。

## 实践复习清单

SQL vs NoSQL 表；CAP 业务取舍；Redis/Mongo/HBase/Neo4j 场景；CDC 一致性；混合架构图；避免 NoSQL 万能论。

## 常见坑

- 用 MongoDB 做复杂多表关联报表。
- 把 Redis 当唯一数据源却无持久化策略。
- 忽略 NoSQL 的运维成本：分片、副本、备份与版本升级。

## 总结与自测

NoSQL 全称含义；与 SQL 五维对比；四类数据库代表；CAP 怎么选；混合架构模式。选型题永远回到访问模式与一致性 SLA。
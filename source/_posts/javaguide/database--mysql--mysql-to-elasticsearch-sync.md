---
title: "MySQL数据同步到Elasticsearch详解：常见方案与一致性处理"
date: 2020-04-04 13:25:00
updated: 2020-04-04 13:25:00
permalink: knowledge/database/mysql/mysql-to-elasticsearch-sync/
categories:
  - 数据库
tags:
  - MySQL
  - Elasticsearch
  - CDC
description: "MySQL 同步到 ES 的常见方案与一致性处理思路。"
---

搜索与分析常需要 ES，但主库仍是 MySQL。关键是选对接同步通道并设计好一致性边界。

<!-- more -->

## 常见方案

| 方案 | 优点 | 风险 |
|------|------|------|
| 应用双写 | 简单 | 不一致、失败补偿复杂 |
| 定时扫库 | 易实现 | 延迟大、扫库压力 |
| Canal/Debezium | 近实时、解耦 | 运维与顺序性要设计 |
| Flink CDC | 流式清洗聚合 | 架构较重 |

## 一致性策略

以 MySQL 为准；ES 作最终一致读模型。失败重试+死信队列；全量重建与增量消费分离；版本号或 ts 防乱序覆盖。

## 实践建议

```json
PUT /orders/_doc/1001
{ "order_id": 1001, "status": "PAID", "updated_at": "2026-09-02T10:00:00Z" }
```

mapping 提前定义；bulk 写入；监控 lag 与 rejected 任务。

## 映射与分词

mapping 中 keyword vs text 决定聚合与搜索；中文分词器选型影响召回。全量 reindex 用 alias 切换零停机。

## 顺序与幂等

 canal 消费按 binlog position；ES 写入带 external_version 防旧覆盖新。

## 实践复习清单

选型 canal vs 双写；幂等键设计；全量+增量切换；alias 零停机 reindex；lag 监控；ES mapping 评审；失败 DLQ 重放。

## 常见坑

- 双写无幂等键，重试导致 ES 脏数据。
- 全量同步期间仍只走增量，漏历史变更。
- 用 ES 当主库做资金类强一致业务。

## 总结与自测

四种同步方案 trade-off；为何以 MySQL 为准；幂等如何实现；全量 reindex 流程；lag 监控项。搜索索引是读模型，不是第二套真相源。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
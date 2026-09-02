---
title: "MySQL执行计划分析"
date: 2020-03-26 12:18:00
updated: 2020-03-26 12:18:00
permalink: knowledge/database/mysql/mysql-query-execution-plan/
categories:
  - 数据库
tags:
  - MySQL
  - EXPLAIN
  - 慢SQL
description: "用 EXPLAIN 解读 MySQL 执行计划，定位慢 SQL 的入口方法。"
---

执行计划是优化器的「路线图」。看懂 type、key、rows、Extra，慢 SQL 排查才算入门。

<!-- more -->

## EXPLAIN 关键列

- **type**：system > const > eq_ref > ref > range > index > ALL，后三者需警惕。
- **key**：实际使用的索引。
- **rows**：估算扫描行数，不是结果行数。
- **Extra**：Using index（覆盖）、Using filesort、Using temporary、Using index condition 等。

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id=1 ORDER BY created_at DESC LIMIT 20;
```

## 分析套路

1. 是否走预期索引？否 → 谓词/类型/统计信息。
2. rows 是否过大？是 → 选择性或缺少联合索引。
3. 是否 filesort/temporary？是 → ORDER/GROUP 与索引不匹配。

## 实践建议

生产用 slow log + pt-query-digest；变更前对核心 SQL 做 EXPLAIN 评审。

## optimizer trace

复杂 SQL 可看 optimizer_trace 理解为何弃用索引。cost 常数随硬件调整。

## 直方图与索引跳跃扫描

8.0 index skip scan 允许在某些场景跳过最左前缀限制。

## 实践复习清单

EXPLAIN 各 type 含义背诵；ANALYZE 与 histogram；optimizer trace 一次实操；filesort/temporary 改写；核心 SQL 上线前 explain 评审。

## 常见坑

- 只看 type=index 以为比 ALL 好——index 可能是全索引扫描。
- 在 dev 小数据量下计划与生产完全不同，需用真实统计信息。

## 总结与自测

EXPLAIN 关键列；type 好坏顺序；filesort 如何减少；ANALYZE 何时跑；optimizer trace 用途。对每个核心接口 SQL 保留一份 explain 归档。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
---
title: "MySQL索引失效场景总结"
date: 2020-02-28 09:57:00
updated: 2020-02-28 09:57:00
permalink: knowledge/database/mysql/mysql-index-invalidation/
categories:
  - 数据库
tags:
  - MySQL
  - 索引失效
description: "总结 MySQL 索引失效的典型写法与优化思路。"
---

索引失效不是神秘现象，多是谓词写法、类型或统计信息让优化器放弃索引。

<!-- more -->

## 高频失效场景

1. 对索引列使用函数或运算：`WHERE YEAR(d)=2026`。
2. 隐式类型转换（见专题文）。
3. 联合索引不满足最左前缀。
4. 使用 `!=`、`NOT IN`、`OR`（部分可 merge，部分全扫）。
5. `LIKE '%xx'` 前缀通配。
6. 优化器判断回表成本高于全表扫（小表或选择性差）。

## 验证方法

```sql
EXPLAIN SELECT * FROM t WHERE ...;
SHOW INDEX FROM t;
ANALYZE TABLE t;
```

## 优化思路

改写 SQL 让谓词「索引用得上」；增加覆盖索引减少回表；必要时分区或归档冷数据。

## 优化器成本模型

rows 估算是统计信息驱动，数据分布突变后需 ANALYZE。histogram（8.0）改善选择性估计。

## 索引合并

index merge union/intersection 有时替代联合索引，但不一定稳定。

## 实践复习清单

收集 ten 条失效 SQL 改写对照；ANALYZE 后 replan；覆盖索引设计练习；filesort 告警；冗余索引清理；最左前缀 violations 扫描。

## 常见坑

- 见 key 列有值就认为走索引，忽略 rows 与 Extra 中 Using where/filesort。
- 盲目加索引导致写入变慢与优化器选择混乱。

## 总结与自测

背出八种失效场景；会用 EXPLAIN 验证；知道何时 statistics 过期；理解优化器选全表扫原因。每周选一条生产慢 SQL 做失效分析练习，进步最快。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
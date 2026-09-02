---
title: "SQL语句在MySQL中的执行过程"
date: 2020-01-14 14:22:00
updated: 2020-01-14 14:22:00
permalink: knowledge/database/mysql/how-sql-executed-in-mysql/
categories:
  - 数据库
tags:
  - MySQL
  - SQL执行
  - 优化器
description: "梳理一条 SQL 在 MySQL 中从连接器到存储引擎的完整执行路径。"
---

搞清 SQL 执行链路，才能理解权限校验、解析、优化、执行与结果返回各阶段在做什么。

<!-- more -->

## 执行阶段概览

1. **连接器**：TCP 连接、身份认证、权限缓存（修改权限需重连生效）。
2. **查询缓存**（8.0 前）：相同 SQL 命中缓存；8.0 已移除，不必再依赖。
3. **分析器**：词法语法解析，报错 Syntax error 出在这里。
4. **优化器**：选择索引、连接顺序、是否使用 ICP/MRR。
5. **执行器**：调用存储引擎接口，逐行或索引范围读取。
6. **存储引擎**：InnoDB 负责缓冲池、锁、MVCC 与日志。

## 查询 vs 更新

SELECT 可走只读快照；UPDATE/DELETE 需加锁并写 undo/redo。同一连接内语句顺序影响锁持有时间。

## 实践建议

```sql
EXPLAIN FORMAT=TREE SELECT * FROM orders WHERE user_id = 1 AND status = 'PAID';
```

用 profiling/performance_schema 看阶段耗时，区分解析慢还是引擎 IO 慢。

## Prepared Statement

预编译减少解析开销，防 SQL 注入。注意 max_prepared_stmt_count。ORM 默认 prepared 与连接池复用要匹配。

## 权限与 definer

视图/存储过程 DEFINER 影响执行权限边界；SECURITY INVOKER 更安全。

## 实践复习清单

能手绘连接器到引擎链路；区分解析错误与优化错误；会用 EXPLAIN ANALYZE；理解 prepared statement 与连接池；知道权限变更需重连；8.0 不再依赖 query cache。

## 常见坑

- 以为「有索引就一定走索引」，优化器可能选全表扫。
- 长事务占连接不释放，拖垮连接池。
- 在连接器层混用不同 charset 导致后续隐式转换。

## 总结与自测

连接器、分析器、优化器、执行器各自职责？prepared statement 好处？8.0 为何移除 query cache？权限修改何时生效？用一条 JOIN 更新 SQL 走读全链路，是检验理解的最好方式。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
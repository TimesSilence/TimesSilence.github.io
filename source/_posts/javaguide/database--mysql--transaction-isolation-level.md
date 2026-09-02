---
title: "MySQL事务隔离级别详解"
date: 2020-04-22 15:39:00
updated: 2020-04-22 15:39:00
permalink: knowledge/database/mysql/transaction-isolation-level/
categories:
  - 数据库
tags:
  - MySQL
  - 事务
  - 隔离级别
description: "MySQL 四种事务隔离级别与脏读、不可重复读、幻读的关系。"
---

隔离级别是并发正确性与性能的旋钮。InnoDB 默认 RR，但「可重复读」不等于完全无幻读。

<!-- more -->

## 四种级别

| 级别 | 脏读 | 不可重复读 | 幻读 |
|------|------|------------|------|
| READ UNCOMMITTED | 可能 | 可能 | 可能 |
| READ COMMITTED | 否 | 可能 | 可能 |
| REPEATABLE READ | 否 | 否 | InnoDB 当前读仍防 |
| SERIALIZABLE | 否 | 否 | 否 |

## InnoDB 实现要点

RC 每次 SELECT 新快照；RR 首次一致性读建 Read View。幻读在 RR 下通过 next-key lock 在当前读场景限制。

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT * FROM account WHERE id=1 FOR UPDATE;
COMMIT;
```

## 实践建议

大多数 OLTP 用默认 RR；若需要最新已提交读（如报表）可会话级 RC；避免长事务。

## 死锁与隔离

RR 下间隙锁增加死锁概率；应用捕获 1213 重试。锁等待 timeout 调优 innodb_lock_wait_timeout。

## 只读事务

START TRANSACTION READ ONLY 可路由只读副本（ProxySQL 等）。

## 实践复习清单

四种级别现象对照表；开两 session 验证 RR；死锁日志分析；gap lock 触发 SQL；只读事务路由；1213 重试策略。

## 常见坑

- 以为 RR 完全无幻读——快照读仍可能看到别事务已提交新行语义需区分。
- 全局改 RC 忽略 binlog/锁行为差异对死锁的影响。

## 总结与自测

四种级别现象表；InnoDB 默认级别；幻读与 gap lock；死锁 1213 处理；RC 与 RR 选型。开两个 mysql 客户端亲手验证不可重复读，印象最深刻。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。
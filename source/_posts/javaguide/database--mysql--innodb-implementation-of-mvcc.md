---
title: "InnoDB存储引擎对MVCC的实现"
date: 2020-05-10 17:53:00
updated: 2020-05-10 17:53:00
permalink: knowledge/database/mysql/innodb-implementation-of-mvcc/
categories:
  - 数据库
tags:
  - MySQL
  - MVCC
  - InnoDB
description: "InnoDB 如何通过隐藏列、undo log 与 Read View 实现多版本并发控制。"
---

MVCC 让读写少冲突：快照读不加锁，当前读才走锁。理解 Read View 是读懂 repeatable read 的关键。

<!-- more -->

## 三要素

- **隐藏列**：DB_TRX_ID（最后修改事务 ID）、DB_ROLL_PTR（回滚指针）。
- **undo log**：保存旧版本链，支持回滚与一致性读。
- **Read View**：事务启动时（或首次一致性读）生成，判断行版本可见性。

## 可见性规则（简化）

比较行的 trx_id 与 Read View 的 min/max 及活跃事务列表：若版本对当前事务不可见，沿 undo 链找更早版本。

## 快照读 vs 当前读

```sql
-- 快照读（普通 SELECT）
SELECT * FROM account WHERE id = 1;
-- 当前读（加锁读）
SELECT * FROM account WHERE id = 1 FOR UPDATE;
```

RR 下快照读可避免不可重复读；幻读靠间隙锁/next-key lock 在当前读场景防护。

## 实践建议

短事务、避免长查询占旧版本导致 undo 堆积；监控 History list length。

## 版本链长度

频繁 UPDATE 同一行会产生长 undo 链，读性能下降。业务上避免无意义 touch 全字段更新。

## RR 与 binlog

RR 配合 statement binlog 曾有主从不一致风险，现 ROW 格式为主流。

## 实践复习清单

区分快照读与当前读；理解 Read View 四字段；知道 undo 链过长危害；监控 History list length；短事务原则；RR 下 gap lock 场景；FOR UPDATE 使用规范。

## 常见坑

- 以为 MVCC 完全无锁——写仍冲突，当前读仍加锁。
- 长事务导致 purge 跟不上，表空间膨胀。

## 总结与自测

隐藏列含义？Read View 判断逻辑口头表述；快照读与当前读各举一例；长 undo 链危害；RR 能否完全避免幻读？结合一次 FOR UPDATE 实验截图，面试表达会更具体。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
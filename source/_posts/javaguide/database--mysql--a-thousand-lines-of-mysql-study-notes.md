---
title: "一千行 MySQL 学习笔记"
date: 2020-01-05 13:15:00
updated: 2020-01-05 13:15:00
permalink: knowledge/database/mysql/a-thousand-lines-of-mysql-study-notes/
categories:
  - 数据库
tags:
  - MySQL
  - 学习笔记
description: "把零散的 MySQL 笔记重组为体系化速查手册：体系结构、索引、事务、锁、日志、优化六大块，每块给出核心要点清单。"
---

学 MySQL 最容易陷入"命令记不住、原理串不起"的困境。本文把常用笔记重组为六块知识地图：体系结构、索引、事务、锁、日志、优化。每块只列核心要点，用来查漏补缺，而不是替代深入阅读。

<!-- more -->

## 体系结构

- **分层**：连接层负责认证与线程管理；服务层做解析、优化、执行（连接器、分析器、优化器、执行器）；存储引擎层负责数据存取，InnoDB 是默认引擎。
- **一条查询的路径**：连接 → 解析 SQL → 优化器选执行计划 → 执行器调引擎接口逐行取数。MySQL 8.0 已移除查询缓存，别再依赖它。
- **InnoDB 的内存核心**：Buffer Pool 缓存数据页与索引页，读先查池、写先改池（配合 redo 保证持久）；Change Buffer 合并二级索引的随机写。
- **常用入口命令**：

```sql
SHOW PROCESSLIST;              -- 当前连接与正在执行的语句
SHOW ENGINE INNODB STATUS\G    -- 锁等待、事务、缓冲池详情
SHOW VARIABLES LIKE 'innodb%'; -- 引擎参数
```

## 索引

- **B+ 树**：所有数据在叶子节点且叶子间链表相连，树高通常 3~4 层，千万行数据定位只需几次 IO。
- **聚簇索引 vs 二级索引**：聚簇索引叶子存整行；二级索引叶子存主键值，查非索引列要回表。
- **最左前缀**：联合索引 (a,b,c) 可服务 a、(a,b)、(a,b,c) 三种条件，跳过 a 就用不上。
- **覆盖索引**：SELECT 列全在索引中，无需回表，EXPLAIN 的 Extra 出现 `Using index`。
- **索引下推（ICP）**：把 WHERE 中能用索引列判断的部分下推到引擎层过滤，减少回表次数。
- **失效场景**：对列做函数或运算、隐式类型转换、前导通配符 LIKE、优化器估算全表更快。

## 事务

- **ACID 的实现分工**：原子性靠 undo log（回滚），持久性靠 redo log（崩溃恢复），隔离性靠锁 + MVCC，一致性是前三者共同保障的目标。
- **四种隔离级别**：读未提交（脏读）→ 读已提交（RC，解决脏读）→ 可重复读（RR，MySQL 默认，解决不可重复读）→ 串行化。
- **MVCC**：每行有隐藏的事务 ID 与回滚指针，undo log 串成版本链；快照读按 ReadView 判断可见性，写不阻塞读、读不阻塞写。
- **RR 下的幻读**：快照读看不到新插入的行；当前读（`SELECT ... FOR UPDATE`）靠临键锁（Next-Key Lock）把间隙也锁住来防幻读。
- **好习惯**：事务尽量短，只包含必要的写操作；按固定顺序访问多张表，降低死锁概率。

## 锁

- **粒度**：全局锁（`FLUSH TABLES WITH READ LOCK`）→ 表级锁（表锁、元数据锁 MDL、意向锁）→ 行锁（记录锁、间隙锁、临键锁、插入意向锁）。
- **MDL 的坑**：DDL 需要 MDL 写锁，长事务持有 MDL 读锁不释放，DDL 排队后会堵住后续所有请求——改表前先看有没有长事务。
- **两阶段加锁**：InnoDB 在事务中按需加锁、提交时统一释放，所以大事务的锁影响会持续到 commit。
- **死锁**：循环等待时 InnoDB 自动回滚undo 量较小的事务；排查用 `SHOW ENGINE INNODB STATUS` 的 LATEST DETECTED DEADLOCK 段。

## 日志

- **redo log（物理日志）**：记录"页上做了什么修改"，WAL 机制先写日志再刷脏页，崩溃后重放恢复；`innodb_flush_log_at_trx_commit=1` 保证提交即落盘。
- **undo log（逻辑日志）**：记录如何撤销修改，服务回滚与 MVCC 版本链。
- **binlog（Server 层归档日志）**：记录所有变更语句或行镜像，用于主从复制与时间点恢复；`sync_binlog=1` 每次提交刷盘。
- **两阶段提交**：redo prepare → 写 binlog → redo commit，保证崩溃后 redo 与 binlog 不丢不错。
- **慢查询日志**：`long_query_time` 设阈值，配合 `mysqldumpslow` 或 pt-query-digest 做 TOP 分析。

## 优化

- **方法论**：先慢日志定位 SQL，再 EXPLAIN 看执行计划（重点看 type、key、rows、Extra），最后决定加索引还是改写 SQL。
- **EXPLAIN 红线**：type 出现 ALL（全表扫描）、rows 估算巨大、Extra 出现 `Using filesort`/`Using temporary` 都需要介入。
- **改写套路**：`SELECT *` 改列清单；深分页改游标或延迟关联；大 IN 列表分批；避免对索引列做函数运算。
- **表结构层面**：合适的最小类型、NOT NULL、控制单表索引数量、冷热字段拆分。
- **架构层面**：读多写少上只读副本与缓存；单表过大先归档再考虑分库分表。

## 小结

- 体系结构回答"SQL 是怎么被执行的"，索引回答"数据是怎么被找到的"。
- 事务与锁是一体两面：MVCC 解决读写并发，行锁与间隙锁解决写写并发。
- redo、undo、binlog 三套日志分别对应崩溃恢复、回滚/MVCC、复制与 PITR。
- 优化按"慢日志 → EXPLAIN → 索引/改写"的固定流程走，不凭感觉。
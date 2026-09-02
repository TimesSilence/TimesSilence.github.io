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
description: "MySQL 常用命令、数据类型与运维操作的系统化复习笔记。"
---

长篇笔记的价值在于「可检索的操作清单」。本文按连接、DDL/DML、权限与状态查看重组，方便日常查阅。

<!-- more -->

## 连接与基础操作

```sql
mysql -h127.0.0.1 -P3306 -uroot -p
SHOW DATABASES;
USE app;
SHOW TABLES;
DESC users;
```

## DDL 与 DML 要点

建表时明确字符集、主键策略与必要索引；更新删除务必带 WHERE 并先 SELECT 验证影响行数。批量变更大表用 pt-online-schema-change 或 gh-ost，避免长时间锁表。

## 用户与权限

最小权限原则：应用账号仅授予所需库的 SELECT/INSERT/UPDATE/DELETE；DDL 与 SUPER 权限隔离给运维账号。

## 状态诊断入口

```sql
SHOW PROCESSLIST;
SHOW ENGINE INNODB STATUS\G
SHOW VARIABLES LIKE 'innodb%';
```

## 常用信息_schema 查询

查表大小、索引Cardinality、未使用索引等可从 information_schema 与 sys 视图获取。定期 review 表碎片 OPTIMIZE（InnoDB 在线 DDL 替代）。

## 复制与高可用初览

主从异步复制延迟是常态；半同步降低丢数概率；MGR/InnoDB Cluster 提供组复制一致性。

## 实践复习清单

熟记 SHOW PROCESSLIST、INNODB STATUS、EXPLAIN；mysqldump 参数 --single-transaction；用户权限最小化；慢日志 long_query_time 调优；information_schema 查表大小；禁止生产无 WHERE 更新。

## 常见坑

- 生产直接用 root 连接应用。
- `SELECT *` 习惯导致覆盖索引失效与网络传输浪费。
- 不看 `Rows_examined` 就判断 SQL 快慢。

## 总结与自测

能否不看文档写出登录、建表、授权、备份命令？能否从 PROCESSLIST 找阻塞会话？能否解释 single-transaction dump 适用 InnoDB 的原因？日常运维命令应形成肌肉记忆，而不是临时搜索。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
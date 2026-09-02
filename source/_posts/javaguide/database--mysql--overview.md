---
title: "MySQL 专题：索引、事务、日志、备份恢复、MVCC 与性能优化"
date: 2019-12-27 12:08:00
updated: 2019-12-27 12:08:00
permalink: knowledge/database/mysql/overview/
categories:
  - 数据库
tags:
  - MySQL
  - InnoDB
  - 索引
description: "MySQL 专题学习路线：索引、事务、日志、MVCC 与性能优化如何串联。"
---

MySQL 是后端核心考点。把索引、执行计划、事务隔离、三大日志连成一条链，慢 SQL 与并发问题才看得懂。

<!-- more -->

## 推荐学习顺序

索引结构 → EXPLAIN 执行计划 → SQL 执行链路 → 隔离级别与 MVCC → redo/undo/binlog → 备份恢复与规范优化。

## 核心主题地图

- **索引**：B+ 树、最左前缀、覆盖索引、回表、索引下推。
- **事务**：ACID、四种隔离级别、幻读与间隙锁。
- **日志**：redo 保证崩溃恢复，undo 支撑回滚与 MVCC，binlog 服务复制与 PITR。
- **性能**：慢查询、连接池、规范建表、避免隐式转换。

## 实践方法

每学一章做一个小实验：故意写错索引看 type 变化；开两个事务验证 repeatable read；用 binlog 做一次时间点恢复演练。

## 常见误区

只背八股不做 EXPLAIN；忽略 buffer pool 与磁盘 IO；把分库分表当性能万能药而不先优化 SQL。

## 工具链配套

慢日志、slow_query_log、performance_schema、sys schema、PMM/Grafana 形成闭环。Schema 变更用 gh-ost；备份用 XtraBackup；复制延迟看 Seconds_Behind_Master 与并行复制。

## 面试串联话术

从一条 UPDATE 语句切入：优化器选索引 → InnoDB 加行锁 → 写 undo/redo → 提交写 binlog → 主从复制。

## 实践复习清单

索引-事务-日志-执行计划四线合练；一条 UPDATE 全链路口述；慢 SQL 三板斧：explain、索引、改写；备份恢复演练年度执行。

## 总结与自测

MySQL 学习主线五节点；一条 UPDATE 链路；慢 SQL 三步；备份恢复是否演练。能白板画出索引-事务-日志关系，说明真的入门了。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
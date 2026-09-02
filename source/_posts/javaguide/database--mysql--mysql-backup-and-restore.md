---
title: "MySQL备份与恢复详解：mysqldump、XtraBackup、binlog和PITR"
date: 2020-02-10 17:43:00
updated: 2020-02-10 17:43:00
permalink: knowledge/database/mysql/mysql-backup-and-restore/
categories:
  - 数据库
tags:
  - MySQL
  - 备份
  - binlog
description: "对比 mysqldump、物理备份与 binlog，构建可恢复的数据保护策略。"
---

备份的目标是可恢复，不是「有个 dump 文件」。逻辑备份、物理备份与 binlog 各管一层。

<!-- more -->

## 三类手段

- **mysqldump**：逻辑备份，便携、慢，适合小库或表级迁移。
- **XtraBackup**：热物理备份，适合大库；配合 binlog 做 PITR。
- **binlog**：增量变更日志，按时间点/位点恢复误删数据。

## PITR 基本流程

1. 恢复最近全量备份到临时实例。
2. `mysqlbinlog --start-datetime=... --stop-datetime=...` 重放增量。
3. 验证后切换或回灌生产。

```bash
mysqldump -uroot -p --single-transaction --master-data=2 app > full.sql
mysqlbinlog --start-position=154 mysql-bin.000012 | mysql -uroot -p app
```

## 实践建议

定期做恢复演练；备份文件加密与异地存储；监控 binlog 保留天数与磁盘。

## 权限与脱敏

备份文件含全量数据，存储加密、访问审计、定期销毁策略必备。恢复环境应与生产网络隔离。

## 跨版本恢复

大版本升级前先在副本验证 backup 可恢复性。

## 实践复习清单

全量+binlog PITR 流程演练；备份加密存储；恢复 RTO/RPO 目标；xtrabackup 热备窗口；mysqlbinlog 位点管理；误删应急：只读、留 binlog、影子恢复。

## 常见坑

- 只有全量无 binlog，无法恢复到误操作前一刻。
- 备份从不恢复测试，真故障才发现文件损坏。
- 大库用 mysqldump 峰值拖垮生产 IO。

## 总结与自测

逻辑备份与物理备份适用场景？PITR 需要哪两类文件？误删表第一个动作是什么？备份文件如何保管？半年内是否做过恢复演练？无演练的备份等于没备份。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
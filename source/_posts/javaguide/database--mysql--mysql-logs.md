---
title: "MySQL三大日志(binlog、redo log和undo log)详解"
date: 2020-03-08 10:04:00
updated: 2020-03-08 10:04:00
permalink: knowledge/database/mysql/mysql-logs/
categories:
  - 数据库
tags:
  - MySQL
  - binlog
  - redo log
description: "MySQL redo log、undo log 与 binlog 的职责分工与两阶段提交。"
---

三大日志回答三个问题：崩溃如何恢复、事务如何回滚与 MVCC、主从与 PITR 如何做到。

<!-- more -->

## 各 log 职责

| 日志 | 层级 | 作用 |
|------|------|------|
| redo | InnoDB | 崩溃恢复，保证已提交事务持久 |
| undo | InnoDB | 回滚、MVCC 旧版本 |
| binlog | Server | 复制、审计、时间点恢复 |

## 两阶段提交

事务提交时 redo prepare → 写 binlog → redo commit，保证引擎与 server 层一致，避免主从数据分叉。

## 配置关注点

```ini
innodb_flush_log_at_trx_commit = 1   # 每次提交刷盘，最安全
sync_binlog = 1                       # binlog 同步刷盘
binlog_format = ROW                   # 主从一致性与闪回友好
```

## 实践建议

误删恢复：先停写入，保留 binlog，全量+增量回放。监控 redo 日志等待与 checkpoint。

## flashback 思路

ROW binlog 可解析为反向 SQL，需工具（binlog2sql）与完整 binlog 链。误删表优先 stop slave / 只读封网再恢复。

## 组提交

binlog group commit 与 redo 组提交提升吞吐，sync_binlog=1 仍有 batch 优化。

## 实践复习清单

口述 redo/undo/binlog 分工；两阶段提交顺序；sync_binlog 与 flush 参数含义；ROW binlog 闪回概念；主从不一致排查从 binlog 位点入手。

## 常见坑

- 以为 binlog 可以替代 redo——引擎崩溃恢复仍靠 redo。
- ROW 格式下仍用 statement 思维做闪回解析。

## 总结与自测

redo undo binlog 各回答一句；两阶段提交顺序；sync_binlog=1 含义；ROW 格式优势；闪回概念。主从延迟与 binlog 位点要能对应排查。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。
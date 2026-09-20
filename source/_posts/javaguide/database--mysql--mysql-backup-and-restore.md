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
description: "对比 mysqldump 逻辑备份与 XtraBackup 物理备份的适用边界，讲清 binlog 时间点恢复流程、全量加增量的备份节奏，以及为什么恢复演练比备份本身更重要。"
---

主从复制解决的是可用性，解决不了误删数据——`DROP TABLE` 会毫秒级同步到所有从库。备份的意义在于保留一个独立的历史状态，配合 binlog 让你回到事故发生前的任意时刻。本文讲清三件事：逻辑备份与物理备份怎么选、PITR（Point-in-Time Recovery，时间点恢复）怎么做、备份策略怎么定。

<!-- more -->

## 先想清楚：备份解决什么问题

MySQL 的故障分三类，对应三套机制：

- **崩溃恢复**：进程宕机后 InnoDB 靠 redo/undo log 自愈，不需要人工干预。
- **高可用切换**：主库不可用就切从库，但错误写入会一起被复制过去。
- **备份恢复**：从独立副本恢复数据，应对误删、误改、磁盘损坏、审计留存。

所以"我有主从"不等于"我有备份"，这是最常见的认知误区。

## 逻辑备份 vs 物理备份

| 维度 | mysqldump（逻辑） | XtraBackup（物理） |
| --- | --- | --- |
| 备份产物 | SQL 文本 | 数据文件副本 |
| 备份速度 | 慢，逐行导出 | 快，接近文件拷贝 |
| 恢复速度 | 很慢，重放 SQL 重建索引 | 快，拷回后做日志前滚 |
| 对线上影响 | 一致性读快照，短锁对齐位点 | 热备，不阻塞读写 |
| 粒度 | 可精确到单表 | 通常整实例 |
| 适用 | 小库、单表迁移、跨版本导出 | 大库、生产全量备份 |

mysqldump 的关键参数：

```bash
mysqldump --single-transaction --routines --events \
  --source-data=2 -u backup_user -p app > app_full.sql
```

`--single-transaction` 用一个一致性读事务包住 InnoDB 表的导出，期间不长期阻塞写入；`--source-data=2`（旧名 `--master-data`）把当时的 binlog 文件名和位点以注释形式写进 dump 头部，这个位点就是后续增量恢复的起点。注意它只保证 InnoDB 表一致，混有 MyISAM 表时那些表仍可能变化。

XtraBackup 的思路是"拷贝数据文件 + 持续追踪 redo log"：先复制 InnoDB 数据文件（拷贝期间文件一直在变），同时记录拷贝起点以来的 redo，最后用 redo 把数据文件前滚到一致时刻，因此可以做到真正的热备。恢复时先 `--prepare` 完成前滚，再拷回数据目录即可。

## binlog 与 PITR 时间点恢复

binlog 记录所有数据变更，是增量恢复的唯一依据。误删表后的标准流程：

1. **止血**：立即停止写入或把应用切只读，防止新数据覆盖现场；确认 binlog 文件链完整、没有被清理。
2. **恢复全量**：把最近一次全量备份恢复到临时实例。
3. **重放增量**：用 mysqlbinlog 从备份位点播放到误操作前一刻：

```bash
mysqlbinlog --start-position=154 --stop-datetime="2026-09-01 10:30:00" \
  mysql-bin.000012 mysql-bin.000013 | mysql -u root -p
```

4. **校验回灌**：在临时实例确认数据正确后，按需把误删的表导回生产，或整体切换。

`--stop-datetime` 不够精确时可以先用 `mysqlbinlog` 输出文本，搜索 `DROP TABLE` 找到它的位点，再用 `--stop-position` 停在它前面。

## 备份策略：全量 + 增量的节奏

节奏由两个目标倒推：RPO（最多接受丢多久数据）和 RTO（最多接受多久恢复服务）。常见落法：

- **全量**：大库每周 1 次 XtraBackup 加每日增量（XtraBackup 也支持基于 LSN 的增量备份）；小库每日 mysqldump。
- **binlog 保留**：至少覆盖两个全量备份周期，常见 7~30 天；要求分钟级 RPO 的系统还要把 binlog 实时归档到独立存储，而不是只留在本机磁盘。
- **故障域隔离**：备份文件、binlog 归档、生产库三者不能共享同一块磁盘或同一机房。
- **加密与权限**：备份文件是全量明文数据，存储要加密、访问要审计，恢复环境应与生产网络隔离。

`sync_binlog=1` 与 `innodb_flush_log_at_trx_commit=1` 是 RPO 的底线；为性能调低它们，就要把"丢最近几秒事务"算进可接受范围。

## 恢复演练：没演练过的备份等于没有备份

备份脚本每天跑成功，不代表恢复能成功：dump 文件可能损坏、binlog 链可能断档、恢复耗时可能远超预期。演练要形成固定节奏：

- 定期（季度或半年）把最新备份恢复到一台新机器，记录实际耗时，用它校准 RTO 承诺。
- 校验恢复结果：行数抽查、关键业务表对账、应用冒烟测试。
- 大版本升级前，先在副本上验证备份可恢复。

## 小结

- 主从不等于备份；备份解决数据丢失，复制解决服务可用。
- 小库、单表迁移用 mysqldump 逻辑备份；大库全量用 XtraBackup 物理热备。
- PITR = 全量备份 + binlog 从备份位点重放到误操作前一刻，`--source-data=2` 记录的位点是衔接点。
- 全量周期与 binlog 保留时长由 RPO/RTO 倒推；备份、binlog、生产库必须分故障域。
- 恢复演练是唯一验证 RTO 的手段，没演练过的备份策略只是愿望。
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
description: "讲透 redo log、undo log、binlog 三大日志的分工、刷盘策略与两阶段提交，附一条 UPDATE 的日志写入时序与主从恢复实践。"
---

redo log 管崩溃恢复，undo log 管回滚与 MVCC，binlog 管复制与归档——三者分属不同层级、解决不同问题，却常被混为一谈。理清它们的分工与写入时机，是理解 InnoDB 事务机制与主从架构的前提。

<!-- more -->

## 它解决什么问题

数据库必须在三类灾难面前自保：进程或机器突然宕机、事务执行到一半需要反悔、主库的数据要同步给从库。内存中的数据页无法回答其中任何一个问题，于是 MySQL 用三种日志各管一段：redo log 保证「提交了就丢不掉」，undo log 保证「错了能退回去、旧版本还找得到」，binlog 保证「另一台机器能重演这一切」。

## 核心原理：一张分工表与 WAL

| 日志 | 所属层 | 记录内容 | 解决的问题 | 消费方 |
| --- | --- | --- | --- | --- |
| redo log | InnoDB 引擎 | 物理日志：某数据页某偏移的修改 | 崩溃恢复，事务持久性 | 崩溃恢复流程 |
| undo log | InnoDB 引擎 | 逻辑日志：反向操作与旧版本 | 事务回滚、MVCC | 回滚、快照读 |
| binlog | Server 层 | 逻辑日志：语句或行级变更 | 主从复制、时间点恢复 | 从库、备份工具 |

三者背后共同的思想是 WAL（Write-Ahead Logging）：先写日志，再刷数据页。数据页 16KB，刷盘是随机写；而一条日志记录只有几十字节且是顺序追加。把「改数据」转换成「记日志」，提交时只需保证日志落盘即可返回，数据页由后台线程慢慢刷——这正是 InnoDB 高写吞吐的来源。

## 深入机制

### redo log：环形缓冲区与崩溃恢复

事务执行过程中，每次对页的修改先记入内存的 redo log buffer，再按策略刷到磁盘上的 redo log 文件组。文件组按环形组织：`write pos` 是当前写入位置，`checkpoint` 之前的记录所对应的脏页已经刷盘、空间可被覆盖。一旦 `write pos` 追上 `checkpoint`，说明日志空间耗尽，必须先刷脏页、推进 checkpoint 才能继续写入。

刷盘节奏由 `innodb_flush_log_at_trx_commit` 控制：

- **1（默认）**：每次提交都 write 并 fsync，提交成功即落盘，最安全；
- **0**：提交时不刷，靠后台线程每秒落盘一次，宕机可能丢失最近约 1 秒的事务；
- **2**：提交时只写入操作系统的 page cache，MySQL 进程挂了不丢，整台机器宕机才会丢。

除了提交时刷盘，还有几个容易忽略的落盘时机：log buffer 用量过半时后台线程会主动刷；后台线程大约每秒还会固定刷一次——这意味着未提交事务的 redo 也可能已经落盘，崩溃恢复时结合事务状态决定忽略还是回滚。另外从 8.0.30 起，日志文件组改用 `innodb_redo_log_capacity` 一个参数统管容量（默认 100MB，上限 128GB），旧的 `innodb_log_file_size` 与 `innodb_log_files_in_group` 被废弃，仅用于换算新参数。

崩溃恢复时，InnoDB 从最近的 checkpoint 开始扫描 redo log，把已提交事务的页修改重放回去——哪怕数据页从未刷过盘，只要 redo 还在，数据就还在。

### undo log：回滚与 MVCC 的基石

每次修改前，旧值会被写入 undo log：INSERT 对应生成一条 DELETE 回滚记录，UPDATE 与 DELETE 则把旧版本完整保留。它有两类消费者：

1. **回滚**：事务失败或执行 ROLLBACK 时，沿着 undo 记录把数据倒回事务开始前的状态；
2. **MVCC**：每行记录带隐藏字段事务 ID（DB_TRX_ID）与回滚指针（DB_ROLL_PTR），后者指向 undo 中的上一个版本，形成版本链。快照读拿着 Read View 沿链找到可见的那个版本，读写因此互不阻塞。

一个容易忽略的细节：undo 页的修改同样会写 redo log，因为 undo 本身也需要崩溃后的持久性保护——回滚依赖的正是这些记录。

undo 的清理由 purge 线程负责：INSERT 产生的 undo 在提交后即可丢弃；UPDATE/DELETE 的 undo 要挂入 history list，等到没有任何活跃事务的 Read View 还引用它时才能清除。长事务会卡住 purge，让版本链无限膨胀，这是生产环境常见的隐患。

### binlog：Server 层的变更流水

binlog 记录所有引起数据变更的事件，无论使用哪种存储引擎都会产生；文件写满自动切换，属于追加写流水。三种记录格式：

- **statement**：记 SQL 原文，体积最小，但 `NOW()`、`UUID()` 这类不确定函数在从库重放时会算出不同结果；
- **row**：记每行变更前后的具体值，主从严格一致，还能解析成反向 SQL 用于闪回，代价是体积大、IO 高；
- **mixed**：默认走 statement，识别到可能不一致的语句自动切换为 row。

事务执行期间 binlog 先写入线程私有的 binlog cache（保证一个事务的事件不被拆开），提交时一次性 write 进文件；`sync_binlog=1` 表示每次提交都 fsync，设置为 N 则攒够 N 个事务刷一次，代价是宕机会丢最近 N 个事务的 binlog。为了摊薄 fsync 成本，MySQL 还引入了组提交：把队列中多个事务的 binlog 合并成一次刷盘，即便 sync_binlog=1 也能保住可观的吞吐。

### 一条 UPDATE 的日志写入时序

```text
1. 引擎读入目标页，先写 undo log（旧值进入版本链）
2. 修改内存中的数据页，生成 redo log 记入 log buffer
3. 事务提交阶段：
   a. redo log 刷盘，状态置为 prepare
   b. binlog cache 整体写入 binlog 文件并 fsync
   c. redo log 标记为 commit
```

a/b/c 三步就是两阶段提交。redo 随事务执行不断写入，binlog 只在提交时一次写入，两者时机天然不同；借 prepare 状态与事务 XID 对齐后，崩溃恢复时才能裁定：binlog 完整则补提交，缺失则回滚，杜绝两份日志一个成功一个失败导致的主从分叉。

## 工程实践

```ini
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
binlog_format = ROW
```

「双 1 + ROW」是对数据安全有硬要求场景的标配；吞吐敏感且能容忍极少量丢失的业务，才把 flush 调到 0/2、sync_binlog 调到 N。误删数据的恢复套路是：停写封网 → 取最近的全量备份 → 用 binlog 回放到误删前一个位点；ROW 格式下还可以借助 binlog2sql 之类的工具直接生成反向 SQL 做定点闪回。监控上重点关注 redo 写入等待与 checkpoint 推进速度，以及 binlog 位点与从库应用位点的差距。

## 面试视角

**redo log 与 binlog 的区别是什么？** 层级不同：redo 属 InnoDB 引擎，binlog 属 Server 层；内容不同：redo 记页的物理修改，binlog 记逻辑变更；用途不同：redo 服务崩溃恢复，binlog 服务复制与归档；写入方式不同：redo 是环形空间循环覆盖写，binlog 是追加写。

**为什么写 redo 比直接刷数据页快？** 数据页 16KB 且是随机写；redo 单条记录只有几十字节且是顺序追加。提交时只需保证 redo 落盘即可返回，脏页交给后台异步刷。

**undo log 什么时候能被清理？** INSERT 的 undo 提交后即可删除；UPDATE/DELETE 的 undo 进入 history list，要等没有任何活跃 Read View 引用该版本后才由 purge 线程清除，长事务会阻塞这一过程。

**statement 格式的 binlog 有什么问题？** 包含不确定函数的语句在从库重放结果可能与主库不同，导致主从不一致；ROW 格式记录行级前后值，天然规避此问题。

**既然有 redo，为什么还需要 undo？** redo 是前滚日志，只记录「改成了什么样」，无法回答「改之前是什么样」，自然撑不起回滚与 MVCC 的旧版本读取；undo 保存的正是修改前的镜像，二者职责互补，缺一不可。

## 小结

- redo log 保持久性（引擎层、WAL、环形文件组）；undo log 支撑回滚与 MVCC 版本链；binlog 负责复制与归档（Server 层、三种格式）。
- 三者协作的枢纽是两阶段提交：redo prepare → binlog → redo commit。
- 安全配置记一组参数：双 1 加 ROW；恢复动作记一条链路：全量备份加 binlog 位点回放。
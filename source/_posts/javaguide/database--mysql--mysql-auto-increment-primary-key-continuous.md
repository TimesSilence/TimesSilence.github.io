---
title: "MySQL自增主键一定是连续的吗？"
date: 2020-02-01 16:36:00
updated: 2020-02-01 16:36:00
permalink: knowledge/database/mysql/mysql-auto-increment-primary-key-continuous/
categories:
  - 数据库
tags:
  - MySQL
  - 自增主键
description: "解释 MySQL 自增主键为何不保证连续，以及 gap 产生的常见原因。"
---

自增 ID「跳号」在 InnoDB 中是常态，不等于数据丢失。弄清机制可避免误报与错误设计。

<!-- more -->

## 为什么不连续

1. **回滚**：插入成功又 rollback，已分配的 ID 不会回收。
2. **失败重试**：唯一键冲突等导致插入失败，自增值可能已递增。
3. **批量插入**：`innodb_autoinc_lock_mode` 影响分配策略，并发下可能交错。
4. **手动指定**：插入显式 id 会推进计数器到更大值。
5. **重启**：计数器按表中 MAX(id)+1 重新初始化（8.0 行为需结合持久化配置）。

## 设计启示

自增主键适合聚簇索引与插入局部性，但**不应作为业务编号**（发票号、订单号需独立序列或号段服务）。

```sql
SHOW VARIABLES LIKE 'innodb_autoinc_lock_mode';
-- 0/1/2  trade-off  между 并发与连续性
```

## 实践建议

业务展示用雪花 ID/UUID/号段；数据库自增仅作内部 surrogate key。

## 插入模式与页分裂

随机主键（UUID）导致页分裂多、缓冲池利用率差；自增主键顺序插入友好。UUID v7 等时间有序 ID 是折中。

## 监控 auto_increment

`SHOW TABLE STATUS` 看 Auto_increment 预估；分表后各表独立计数。

## 实践复习清单

业务编号独立发号；分库分表用分布式 ID；理解 autoinc lock mode；插入失败也会消耗 id；重启后 counter 行为；不要用 id  gaps 做审计唯一依据。

## 常见坑

- 用自增 ID 推断「每天注册量」忽略跳号。
- 分库分表后仍依赖单表 auto_increment 而不引入分布式 ID。

## 总结与自测

列举四种 id 跳号原因；业务为何不应依赖连续 id；分布式 id 方案有哪些；autoinc lock mode 差异；随机 uuid 对页分裂影响。订单号与主键 id 应分离是架构基本功。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
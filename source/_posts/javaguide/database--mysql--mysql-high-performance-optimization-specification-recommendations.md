---
title: "MySQL高性能优化规范建议总结"
date: 2020-05-01 16:46:00
updated: 2020-05-01 16:46:00
permalink: knowledge/database/mysql/mysql-high-performance-optimization-specification-recommendations/
categories:
  - 数据库
tags:
  - MySQL
  - 性能优化
  - 规范
description: "MySQL 高性能开发的建表、索引、SQL 与运维规范要点汇总。"
---

性能优化先靠规范预防，再靠监控定位。本文把团队常踩的雷区整理成可执行的 checklist。

<!-- more -->

## 建表规范

统一 utf8mb4；主键尽量短且单调；字段 NOT NULL + 默认值；大字段拆表；金额用 DECIMAL。

## 索引规范

WHERE/ORDER/JOIN 列建合适联合索引；控制索引数量；避免冗余索引；定期用 sys/performance_schema 查未使用索引。

## SQL 规范

禁止 SELECT *；分页深翻页改游标或延迟关联；批量操作分批 commit；避免大事务。

```sql
-- 深分页优化示例
SELECT * FROM orders o
JOIN (SELECT id FROM orders WHERE user_id=1 ORDER BY id DESC LIMIT 10000, 20) t
ON o.id = t.id;
```

## 连接与缓存

合理设置 max_connections 与连接池；8.0 后别指望 query cache；热点读走 Redis 但要有穿透保护。

## 连接池参数

池大小不是越大越好，常设 CPU*2 左右并压测。wait_timeout 与池 idle 回收协调，避免「MySQL has gone away」。

## 只读实例

报表/analytics 走只读副本，避免拖主库。

## 实践复习清单

建表规范 checklist；索引 review 季度执行；慢 SQL 治理流程；连接池大小压测；深分页改写；批处理 commit 大小；监控 buffer pool hit、锁等待。

## 常见坑

- 在应用层循环单条 INSERT 代替 batch。
- 监控只看 QPS 不看慢查询与锁等待。
- 上线前不做影子流量或 explain 评审。

## 总结与自测

建表五条规范；索引 review 查什么；深分页两种改写；连接池如何定大小；慢 SQL 治理流程有几步？把规范写成团队 PR checklist 比个人记忆更可靠。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
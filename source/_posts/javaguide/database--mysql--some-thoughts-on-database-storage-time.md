---
title: "MySQL日期类型选择建议"
date: 2020-04-13 14:32:00
updated: 2020-04-13 14:32:00
permalink: knowledge/database/mysql/some-thoughts-on-database-storage-time/
categories:
  - 数据库
tags:
  - MySQL
  - 日期类型
description: "MySQL 日期时间类型选型：DATETIME、TIMESTAMP 与 BIGINT 的权衡。"
---

存时间看起来 trivial，却影响时区、范围、索引与跨系统交换。类型选对，后面少很多 bug。

<!-- more -->

## 类型对比

- **DATETIME**：8 字节，范围 1000-9999，与时区无关存字面量，推荐业务时间戳。
- **TIMESTAMP**：4 字节，2038 上限，受 session time_zone 影响，自动 ON UPDATE 方便。
- **BIGINT**：存 Unix 毫秒，跨语言一致，展示需应用层格式化。

```sql
CREATE TABLE event (
  id BIGINT PRIMARY KEY,
  occurred_at DATETIME(3) NOT NULL COMMENT '业务发生时间 UTC+8 存字面量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 选型建议

金融/订单用 DATETIME(3) 或 BIGINT 毫秒；日志归档可用 BIGINT 节省比较成本；全球化产品统一 UTC 存储、本地化展示。

## 跨时区团队规范

存储 UTC、展示 local 是通用做法。数据库 server time_zone 与应用 JVM timezone 分离配置，集成测试覆盖 DST 切换日。

## ORM 映射

JPA @Temporal 已过时；Java 8 time API 映射 DATETIME(3) 或 BIGINT 需统一。

## 实践复习清单

新表 DATETIME(3) 默认；UTC 存储规范；ORM 时区集成测试；2038 TIMESTAMP 排查；禁止字符串存时间；跨区 DST 用例。

## 常见坑

- TIMESTAMP 2038 问题在旧系统遗留。
- 混用字符串存时间导致索引与比较错误。
- 夏令时切换用 TIMESTAMP 未考虑 session 时区。

## 总结与自测

DATETIME 与 TIMESTAMP 差异；2038 问题；UTC 规范；ORM 映射注意；为何忌字符串存时间。新表 DDL 评审必须含时间列类型一项。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。
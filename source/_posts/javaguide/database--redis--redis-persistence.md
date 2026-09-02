---
title: "Redis持久化机制详解"
date: 2021-04-17 14:12:00
updated: 2021-04-17 14:12:00
permalink: knowledge/database/redis/redis-persistence/
categories:
  - 数据库
tags:
  - Redis
  - RDB
  - AOF
description: "Redis RDB 与 AOF 持久化机制及混合持久化配置建议。"
---

持久化是在性能与数据安全之间做选择。缓存场景可以弱持久，Redis 作主存储则必须严肃配置。

<!-- more -->

## RDB

周期性 fork 子进程写快照；恢复快、文件紧凑；可能丢失最后一次快照后的数据。save 规则如 `save 900 1`。

## AOF

记录写命令，everysec/always/no 三档 fsync。rewrite 压缩体积；恢复慢于 RDB。

## 混合持久化（4.0+）

AOF 重写时嵌入 RDB 前缀，兼顾恢复速度与增量完整度，生产推荐开启 `aof-use-rdb-preamble yes`。

```conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
```

## 实践建议

主从+哨兵/集群保证高可用；备份 RDB 到对象存储；演练 restore。

## 磁盘与 AOF

AOF 文件过大触发 rewrite；rewrite 期间积压 buffer。SSD 与 noatime 挂载推荐。

## 灾备 RPO/RTO

everysec 可能丢 1 秒；always 最安全但慢。

## 实践复习清单

AOF everysec 配置；混合持久化开启；RPO 文档；备份 RDB 到 OSS；restore 演练；磁盘 fsync 能力评估。

## 常见坑

- AOF always 在 HDD 上拖垮写性能。
- 禁用持久化却把 Redis 当唯一数据源。
- rewrite 期间磁盘满导致写入失败。

## 总结与自测

RDB AOF 丢失窗口；混合持久化；everysec 含义；备份演练。把 Redis 当主存就必须 everysec 以上并验收 restore。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
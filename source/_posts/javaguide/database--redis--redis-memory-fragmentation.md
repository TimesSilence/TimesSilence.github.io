---
title: "Redis内存碎片详解"
date: 2021-04-08 13:05:00
updated: 2021-04-08 13:05:00
permalink: knowledge/database/redis/redis-memory-fragmentation/
categories:
  - 数据库
tags:
  - Redis
  - 内存碎片
description: "Redis 内存碎片产生原因与 activedefrag 等治理手段。"
---

used_memory 不高却触发 maxmemory，可能是碎片率在作怪。理解分配器行为才能对症调参。

<!-- more -->

## 碎片从哪来

频繁更新不同大小 value、大量过期删除留下「瑞士奶酪」式空闲块；jemalloc 不一定会立刻归还 OS。

## 如何观察

```bash
INFO memory
# mem_fragmentation_ratio = used_memory_rss / used_memory
```

比例持续 >1.5 且 RSS 明显高于 logical 需关注。

## 治理手段

- 4.0+ `activedefrag yes` 在线整理（CPU 开销）。
- 重启实例（维护窗口）。
- 避免大量小对象频繁变长；大 value 压缩或拆分。

## 实践建议

设置合理 maxmemory-policy；监控 fragmentation；版本升级关注 listpack 等内存优化。

## 复制与内存

主从全量同步时副本也会 fork；碎片高时同步更慢。尽量低峰 restart 或 active defrag。

## 大 key 迁移

DUMP/RESTORE 或 双写切换，避免 BLOCK 线上。

## 实践复习清单

mem_fragmentation_ratio 告警；activedefrag 开关评估；大 key 拆分；定期 restart 窗口；RSS 监控；复制 fork 叠加评估。

## 常见坑

- 只看 used_memory 忽略 RSS 导致 OOM killer。
- 盲目重启无副本的高可用主节点。

## 总结与自测

碎片率如何看；activedefrag 代价；大 key 与碎片关系；RSS OOM 场景。内存告警同时看 used 与 rss 两条曲线。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
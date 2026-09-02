---
title: "Redis 3 种特殊数据类型详解"
date: 2021-03-20 11:51:00
updated: 2021-03-20 11:51:00
permalink: knowledge/database/redis/redis-data-structures-02/
categories:
  - 数据库
tags:
  - Redis
  - Bitmap
  - HyperLogLog
description: "Redis Bitmap、HyperLogLog、GEO 等特殊类型的应用场景笔记。"
---

三种特殊类型在签到、UV 统计与 LBS 场景非常省内存，但语义与误差要事先接受。

<!-- more -->

## Bitmap

位数组，SETBIT/GETBIT/BITCOUNT。适合日活签到、布尔特征压缩。注意偏移过大稀疏时仍占上限内存。

```bash
SETBIT sign:202609:uid1001 2 1
BITCOUNT sign:202609:uid1001
```

## HyperLogLog

基数估计，标准误差约 0.81%，PFADD/PFCOUNT 极省内存。不适合需要精确去重或单成员查询。

## GEO

基于 Sorted Set 的经纬度，GEORADIUS 查附近。地球半径计算有固定误差，高精度地图仍用专业引擎。

## Stream（补充）

消息流+XGROUP 消费组，可替代简单 List 队列，支持 ACK 与 pending 列表。

## Bloom 模块

RedisBloom 模块提供 scalable bloom；与纯 Bitmap 方案对比内存与误判率。

## 时序数据

TS 模块或直接用 ZSet/TStream 自建；注意 retention。

## 实践复习清单

Bitmap 签到键设计；HyperLogLog UV 误差接受；GEO 附近的人参数；Stream vs List；模块 Bloom/TS 了解即可。

## 常见坑

- 用 HyperLogLog 做黑名单精确判断。
- Bitmap 键设计无 uid 压缩导致 key 爆炸。
- GEO 与业务距离单位混淆（m vs km）。

## 总结与自测

Bitmap HyperLogLog GEO 适用边界；误差能否接受；Stream 与 List 差异。特殊类型用对能省一个数量级内存。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
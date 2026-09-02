---
title: "Redis 5 种基本数据类型详解"
date: 2021-03-10 10:44:00
updated: 2021-03-10 10:44:00
permalink: knowledge/database/redis/redis-data-structures-01/
categories:
  - 数据库
tags:
  - Redis
  - 数据结构
description: "Redis 五种基础数据类型 String、List、Hash、Set、Sorted Set 的选型笔记。"
---

选对数据结构等于选对时间复杂度。五种基础类型覆盖大部分业务缓存与计数场景。

<!-- more -->

## String

二进制安全字符串，可存 JSON、计数、分布式锁（SET NX EX）。INCR 原子计数；GETSET 可用于简单轮换。

## List

双端链表，LPUSH/RPOP 做队列；注意中间查找 O(n)，长列表慎用。

## Hash

字段级更新，适合对象缓存（用户 profile）。小 hash 用 ziplist/listpack 省内存。

## Set

去重集合，SADD/SISMEMBER O(1)；交集可用于共同好友。

## Sorted Set

带 score 有序集合，排行榜、延迟队列（score=时间戳）。底层跳表+哈希表。

```bash
ZADD rank 980 user:1001
ZRANGE rank 0 9 WITHSCORES REV
```

## 编码转换阈值

ziplist/listpack 与 hashtable 转换阈值由配置项控制；升级版本阈值变化可能导致内存突增。

## 管道 pipeline

批量命令减少 RTT；注意非事务场景下部分失败的处理。

## 实践复习清单

五类型各写一业务场景；ZSet 排行榜命令；Hash 对象缓存字段设计；List 队列局限；Set 交集好友；String 分布式锁 NX EX。

## 常见坑

- 大 List 做消息队列却不 ACK，重复消费难处理（应用 Stream）。
- Hash 字段过多不拆分，单 key 过大。

## 总结与自测

五类型各一句场景；ZSet 底层；List 为何不适合作可靠队列；Hash 适合对象缓存。选型错误比命令不熟更常导致性能问题。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。
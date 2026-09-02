---
title: "3种常用的缓存读写策略详解"
date: 2021-02-10 17:23:00
updated: 2021-02-10 17:23:00
permalink: knowledge/database/redis/3-commonly-used-cache-read-and-write-strategies/
categories:
  - 数据库
tags:
  - Redis
  - 缓存
  - Cache Aside
description: "Cache Aside、Read/Write Through、Write Behind 三种缓存读写策略对比。"
---

缓存与 DB 谁为准、何时写缓存，决定了一致性与复杂度。三种经典模式各有适用边界。

<!-- more -->

## Cache Aside（旁路缓存，最常用）

读：先读缓存，miss 则读 DB 并回填。写：先更新 DB，再删缓存（或延迟双删）。实现简单，但需防击穿与短暂不一致。

## Read/Write Through

读写都经缓存层代理，缓存负责同步 DB。应用代码干净，但缓存组件要承担写穿逻辑，多用于集成缓存产品。

## Write Behind（写回）

写先落缓存，异步批量刷 DB。写性能高，但丢电/宕机可能丢未刷盘数据，适合可容忍丢失的计数场景。

```text
Cache Aside 写路径：update DB → delete cache
读路径：cache hit return / miss → load DB → set cache
```

## 实践建议

高一致场景写后删缓存+短 TTL；热点 key 用互斥锁或逻辑过期防击穿。

## 延迟双删时间窗

第二次删除延迟通常取主从同步时间 + 几百毫秒。可用 canal 订阅 binlog 精确删缓存。

## 多级缓存

本地 Caffeine + Redis 注意广播失效或 TTL 对齐。

## 实践复习清单

画三种策略时序图；Cache Aside 写顺序；延迟双删参数；Write Behind 丢数窗口评估；canal 删缓存；一致性 SLA 文档化。

## 常见坑

- 先删缓存再写 DB 并发下仍可能脏读。
- Write Behind 用于订单状态等强一致业务。

## 总结与自测

三种策略读写路径；Cache Aside 写顺序；Write Behind 丢数窗口；延迟双删目的。画时序图比背定义更能发现并发漏洞。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。
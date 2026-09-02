---
title: "缓存基础常见面试题总结"
date: 2021-02-20 08:30:00
updated: 2021-02-20 08:30:00
permalink: knowledge/database/redis/cache-basics/
categories:
  - 数据库
tags:
  - Redis
  - 缓存
  - 穿透
description: "缓存使用场景与穿透、击穿、雪崩、一致性问题的应对思路。"
---

引入缓存的第一课不是性能提升多少，而是故障模式下系统还能不能扛住。

<!-- more -->

## 三大经典问题

- **穿透**：查不存在的数据，缓存与 DB 都被打穿 → 布隆过滤器/空值缓存/参数校验。
- **击穿**：热点 key 过期瞬间并发打 DB → 互斥重建/逻辑过期/永不过期+异步刷新。
- **雪崩**：大量 key 同时过期或 Redis 宕机 → 过期时间加随机、集群高可用、限流降级。

## 一致性问题

双写顺序、删缓存时机、延迟双删、订阅 binlog 异步删缓存。以 DB 为准，接受短暂 stale。

```python
# 伪代码：互斥重建
if cache_miss:
    if lock.acquire(key):
        load_from_db()
        set_cache()
        lock.release()
```

## 实践建议

监控 cache hit ratio、慢查询与 Redis CPU；核心链路压测验证击穿策略。

## 热点 key 探测

Redis 4.0+ hotkeys 或客户端采样；大促前预热。限流降级模板：sentinel/hystrix 风格返回兜底数据。

## TTL 策略

基础 TTL + 随机 jitter；永不过期 key 要有主动更新任务。

## 实践复习清单

穿透/击穿/雪崩各写一个方案；布隆+空值 TTL；热点 key 互斥重建；限流降级；hit ratio 告警；本地二级缓存失效广播。

## 常见坑

- 布隆过滤器无删除能力却当黑名单唯一手段。
- 缓存空值 TTL 过长占用内存。
- 忽略本地缓存与 Redis 二级一致。

## 总结与自测

穿透击穿雪崩各一句方案；一致性常见做法；布隆与空值缓存局限；热点 key 治理。压测验证缓存失效时 DB 是否扛得住。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。
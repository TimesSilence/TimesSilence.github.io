---
title: "Redis 专题：缓存、数据结构、持久化、集群、阻塞与工程实践"
date: 2021-02-01 16:16:00
updated: 2021-02-01 16:16:00
permalink: knowledge/database/redis/overview/
categories:
  - 数据库
tags:
  - Redis
  - 缓存
  - 数据结构
description: "Redis 专题学习路线：数据结构、持久化、集群与工程实践要点。"
---

Redis 既是缓存也是多功能数据结构服务器。学习路径建议从单线程模型与数据结构选型开始，再到持久化与高可用。

<!-- more -->

## 学习模块

1. 缓存问题：穿透、击穿、雪崩、一致性。
2. 数据结构：String/Hash/List/Set/ZSet + Bitmap/HyperLogLog/GEO/Stream。
3. 持久化：RDB 快照与 AOF 日志及混合模式。
4. 高可用：主从、Sentinel、Cluster 分片。
5. 工程：阻塞排查、内存碎片、延迟任务与 Stream MQ。

## 为什么快

内存操作、IO 多路复用单线程避免锁、高效数据结构（跳表、压缩列表/intset 等演进）。

## 实践建议

键名规范 `biz:entity:id`；设置 maxmemory 与淘汰策略；慢日志与 latency doctor 常态化。

## 版本与模块

Redis 7/8 新特性关注 function、ACL 细粒度、多 part AOF。TLS、ACL 默认账号禁用是安全基线。

## 与 Memcached 对比

Redis 富数据结构、持久化、复制；Memcached 纯内存多线程简单缓存。

## 实践复习清单

数据结构选型表；持久化 RDB+AOF 配置；主从+哨兵架构图；慢日志与 bigkeys 巡检；maxmemory-policy；TLS/ACL 基线。

## 常见坑

- 把 Redis 当无限内存数据库。
- 大 key/热 key 无治理导致单节点瓶颈。
- 忽略持久化配置，重启数据全丢。

## 总结与自测

Redis 快的原因；五结构+三种特殊；RDB AOF 选型；集群 vs 哨兵；阻塞排查入口。Redis 学习以「命令+场景+故障」三角推进。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。
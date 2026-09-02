---
title: "Redis常见面试题总结(上)"
date: 2021-04-26 15:19:00
updated: 2021-04-26 15:19:00
permalink: knowledge/database/redis/redis-questions-01/
categories:
  - 数据库
tags:
  - Redis
  - 面试
  - 单线程
description: "Redis 单线程模型、线程模型演进与常见面试题学习笔记（上）。"
---

Redis「单线程」是经典考点，但 4.0 后已有 IO 线程与 6.0 多线程 IO。准确表述比背口号更重要。

<!-- more -->

## 为何说单线程也快

纯内存、高效数据结构、IO 多路复用（epoll/kqueue）、避免上下文切换与锁竞争。命令执行仍主线程串行，保证简单性。

## 6.0+ 多线程 IO

网络读写可线程池并行，命令执行仍在主线程。适合大 value 高带宽场景，需 `io-threads` 调优。

## 常见面试点

- 持久化方式与选型
- 过期删除：惰性+定期
- 内存淘汰策略 LRU/LFU/TTL
- 主从复制：全量+增量 PSYNC

## 实践建议

用 `redis-benchmark` 只作相对参考；真实压测带业务 payload 与 pipeline。

## 事件循环细节

aeEventLoop 处理 readable/writable；beforeSleep 做 fast expire、异步关闭。了解即可，面试点到为止。

## 事务与 Lua

MULTI/EXEC 非 rollback 语义；Lua 脚本原子执行，注意脚本时长。

## 实践复习清单

单线程+IO 线程表述；过期策略；淘汰策略 LRU/LFU；主从 PSYNC；持久化对比；事务非 rollback；Lua 原子性。

## 常见坑

- 说 Redis 完全单线程忽略 IO threads。
- 把 memcached 多线程模型直接类比 Redis。

## 总结与自测

单线程为何快；6.0 IO 线程；过期策略；淘汰策略；主从复制过程。表述要区分「命令执行线程」与「网络 IO 线程」。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。
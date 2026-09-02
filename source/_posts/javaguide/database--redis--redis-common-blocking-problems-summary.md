---
title: "Redis常见阻塞原因总结"
date: 2021-03-01 09:37:00
updated: 2021-03-01 09:37:00
permalink: knowledge/database/redis/redis-common-blocking-problems-summary/
categories:
  - 数据库
tags:
  - Redis
  - 阻塞
  - 慢查询
description: "Redis 阻塞与 latency 飙高的常见根因与排查清单。"
---

Redis 单线程执行命令，一条慢操作会拖住全局。阻塞排查要同时看命令、持久化、复制与 big key。

<!-- more -->

## 常见阻塞源

1. **慢命令**：KEYS、FLUSHALL、大集合 SUNION、无 LIMIT 的 LRANGE。
2. **持久化**：RDB fork 导致 COW 内存压力；AOF rewrite 子进程 IO。
3. **主从全量同步**：生成 RDB 期间 buffer 堆积。
4. **big key 删除/过期**：4.0+ 可用 UNLINK 异步释放。
5. **集群/网络**：阻塞在 IO 多路复用之外的系统调用较少，但磁盘 AOF 同步写会放大延迟。

## 排查工具

```bash
redis-cli SLOWLOG GET 10
redis-cli --latency
redis-cli --bigkeys
INFO persistence
```

## 实践建议

生产禁用 KEYS；用 SCAN 迭代；AOF 用 everysec；监控 latest_fork_usec。

## 内核透明大页 THP

Redis 官方建议 disable THP，否则 latency 尖刺。sysctl vm.overcommit_memory=1 避免 fork 失败。

## 容器环境

K8s memory limit 不含 fork COW 峰值，易 OOMKill。

## 实践复习清单

禁用 KEYS；SCAN 替代；UNLINK 大 key；AOF rewrite 窗口；fork latency 监控；disable THP；容器 memory limit 评估。

## 常见坑

- 在线上用 DEBUG 类命令。
- 单 key 存 MB 级 JSON 导致读写与序列化都慢。
- 忽略 swap——内存超卖会灾难性降速。

## 总结与自测

五类阻塞源；SLOWLOG bigkeys latency；fork 影响；UNLINK 用途；THP 建议。线上 latency 尖刺优先查 slowlog 与 persistence 指标。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
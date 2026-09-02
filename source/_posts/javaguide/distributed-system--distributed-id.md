---
title: "分布式 ID 生成方案详解：UUID、Snowflake、号段模式、Leaf 与 Tinyid 对比"
date: 2023-04-09 09:57:00
updated: 2023-04-09 09:57:00
permalink: knowledge/distributed-system/distributed-id/
categories:
  - 分布式系统
tags:
  - 分布式ID
  - Snowflake
  - Leaf
description: "全局唯一 ID 的需求维度与 UUID、数据库、Redis、Snowflake、号段等方案权衡。"
---

订单号、消息 ID、分库分表主键都需要"全局唯一且可用"。本文对比常见生成方案及选型维度，帮助在性能、有序性和运维复杂度之间做理性取舍。

<!-- more -->

## 要解决什么问题

多节点并发生成 ID 时，数据库单表自增成为瓶颈且暴露业务量；UUID 虽唯一但无序，B+ 树索引插入性能差，也不利于按时间范围排查。业务还可能要求趋势递增、固定长度、不含敏感信息或便于客服口述，单一技术方案往往无法同时满足所有维度。

## 核心原理

评估维度包括：唯一性、吞吐、趋势递增、信息安全、高可用与运维成本。UUID 本地生成无中心瓶颈但无序；Snowflake 用时间戳+机器号+序列号，趋势递增但依赖时钟与 workerId 分配；号段模式从 DB 批量取号，降低 DB 压力；Leaf、Tinyid 等在 Snowflake 或号段思路上做双 buffer、缓存优化等工程增强。

## 方案权衡

UUID 适合日志 traceId 等无排序场景；Snowflake 适合高并发订单号；号段适合可容忍预分配、希望减少 DB 访问的场景；Redis INCR 实现简单但需考虑持久化、主从切换时的重复风险。不要用一种方案套所有业务——对外订单号与内部审计 ID 的需求往往不同。

## 落地要点

Snowflake 必须处理时钟回拨：等待、借用未来时间或报警降级；workerId 通过 ZK/DB 注册避免冲突；号段模式设置双 buffer 避免取号中断。压测峰值 QPS 与 failover 行为，监控 ID 生成延迟和重复检测。分库分表时让 ID 高位携带分片信息可简化路由，但要预留扩容位。

## 常见误区

误区：UUID 一定适合做主键；Snowflake 机器 ID 冲突导致静默重复；忽视 ID 长度对索引和存储的影响；把"趋势递增"等同于"严格连续"。Redis 自增在 cluster failover 窗口若未校验可能重复，需结合业务幂等或 fencing。
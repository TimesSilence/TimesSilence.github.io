---
title: "CAP 定理与 BASE 理论详解：一致性、可用性、分区容错与最终一致性"
date: 2023-06-07 15:39:00
updated: 2023-06-07 15:39:00
permalink: knowledge/distributed-system/protocol/cap-and-base-theorem/
categories:
  - 分布式系统
tags:
  - CAP
  - BASE
  - 最终一致性
description: "正确理解 CAP 在分区下的 C/A 权衡，以及 BASE 对工程最终一致的指导。"
---

CAP 被误读为"三选二"太久了。本文按分区场景重新解释 C、A、P 及 BASE 实践含义，并引入 PACELC 补充无分区时的延迟权衡。

<!-- more -->

## 要解决什么问题

分布式系统网络分区不可避免。分区发生时，系统要么拒绝部分请求保线性一致，要么继续服务但允许读到旧值——这是架构选型的根本分歧。业务方常问"能不能既要又要"，需要工程师用 CAP/PACELC 语言解释物理约束而非简单拒绝。

## 核心原理

CAP 中 C 指 linearizability，A 指非故障节点必须响应，P 指网络分区容忍。分区时只能在 C 与 A 间取舍；CA 仅单机无分区模型可行。BASE：基本可用、软状态、最终一致，是 AP 方向的工程化落地。PACELC：无分区时在 Latency 与 Consistency 间权衡，如 MySQL 异步复制 vs 半同步。

## 方案权衡

ZK/etcd 偏 CP，选举期间可能拒绝写；Eureka/Cassandra 偏 AP，允许注册信息短暂不一致。同一系统不同操作可能 CP 或 AP——读 Follower 可能是 AP，写 Leader 是 CP。贴标签不如分析具体操作路径。

## 落地要点

设计时写清分区策略：读 stale 是否可接受、多久对账；最终一致需要 version、幂等和补偿 job。监控 replication lag 和 unavailable 比例。与产品定义 RPO/RTO 和业务可见中间态。演练机房隔离观察注册中心和缓存行为。

## 常见误区

误区：CAP 三选二；把 99.9% SLA 当 CAP-A；忽略 Brewer 后来对表述的修正；BASE 当作"不要一致"。把 Eureka 下线实例延迟完全等同于"CAP 理论"而不谈 self-preservation 机制也不准确。

## 小结

CAP 学习的终点，不是背定义，而是能在架构评审里说明"分区时我们选什么、用户看到什么、如何对账"。把 PACELC 一并纳入讨论，能避免团队在无分区阶段忽视延迟与一致性的权衡。每次引入新存储或注册中心，都应重新评估其读写路径的一致性语义。
---
title: "分布式理论、算法与协议：CAP、BASE、中心化与去中心化、Paxos、Raft 与一致性哈希"
date: 2023-03-01 15:29:00
updated: 2023-03-01 15:29:00
permalink: knowledge/distributed-system/protocol/overview/
categories:
  - 分布式系统
tags:
  - 分布式理论
  - CAP
  - Raft
  - 一致性哈希
description: "分布式理论与共识算法专题导读：从 CAP/BASE 到 Paxos、Raft、ZAB 与一致性哈希。"
---

理论专题是分布式底层的"为什么"。本文梳理协议类文章的学习顺序与内在联系，避免把共识算法和一致性哈希混为一谈。

<!-- more -->

## 要解决什么问题

CAP、Paxos、Raft 等名词堆叠，初学者难见全貌。实际上它们分别回答：分区时如何取舍、如何在故障下对日志达成一致、如何把 key 均匀映射到节点。缺少导读容易只背结论而不懂问题域。

## 核心原理

建议路径：CAP/BASE 建立取舍观→协调模式（Leader/Quorum/Gossip）→拜占庭拓展故障模型→Paxos/Raft/ZAB 共识→一致性哈希做数据分片。Raft 易Teaching，Paxos 经典，ZAB 贴近 ZK。Gossip 是 epidemic 传播，不是严格共识，常用于成员与 Cassandra 反熵。

## 方案权衡

不必三类共识全精通到证明，但需知道 etcd/Raft、ZK/ZAB、Chubby/Paxos 映射。一致性哈希解决扩缩容迁移量，与共识解决 log 顺序是不同层。时间投入应匹配目标：后端开发重 CAP/锁/事务，基础架构重 Raft/Paxos 细节。

## 落地要点

用 30 分钟向同事解释 CAP 非三选二；画 Raft 选举时间线；说明 Redis Cluster slot 与 hash ring 关系。建立"问题→算法→产品"三联表：例如选主→Raft→etcd。复习时闭卷画出 PACELC 分支。

## 常见误区

误区：Gossip 当共识；CAP 的 C 与 ACID C 混淆；学完理论不联系 ZK/Redis/Kafka 实例；认为 Paxos 和 Raft 完全无关（目标相近实现不同）。

## 小结

理论专题宜分两轮阅读：第一轮建立 CAP→协调→共识→分片的地图；第二轮按工作领域深挖。共识三件套（Paxos/Raft/ZAB）不必同等深度，但应知道各自服务的代表产品。把每个算法写进"问题—方案—产品"三联表，复习效率最高。 复习时可自制一张 A3 思维导图，把 CAP、Raft、一致性哈希分别标在"取舍""共识""分片"三列。面试前用这张图表快速唤醒记忆，比临时翻文章高效。若时间只够精读一篇，优先 CAP，其次 Raft，再次一致性哈希，与大多数后端岗位考点匹配度最高。
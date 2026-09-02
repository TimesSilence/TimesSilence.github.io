---
title: "Paxos 算法详解：Basic Paxos、Multi-Paxos、角色流程与 Raft 对比"
date: 2023-08-15 12:28:00
updated: 2023-08-15 12:28:00
permalink: knowledge/distributed-system/protocol/paxos-algorithm/
categories:
  - 分布式系统
tags:
  - Paxos
  - 共识算法
  - Multi-Paxos
description: "Basic Paxos 与 Multi-Paxos 的角色、两阶段流程及与 Raft 的差异。"
---

Paxos 是共识算法的理论基石，术语密集但思想精炼。本文用 Proposer/Acceptor/Learner 流程视角重新组织，便于与 Raft 对照。

<!-- more -->

## 要解决什么问题

多节点对同一槽位提案，在异步网络、丢包、节点故障下仍要达成一致，且已 chosen 的值不可被覆盖。无共识则 replicated log 顺序分裂，状态机应用 diverge。Paxos 给出在 crash 模型下的可行性，但工程落地曾长期被认为困难。

## 核心原理

Basic Paxos：Prepare 阶段 Acceptor 承诺不接受更小 proposal number；Accept 阶段多数派 accept 则 value chosen。Learner 学习结果。Multi-Paxos 选 stable Leader 串行 propose，减少活锁。角色可合并；实际系统常用简化 Multi-Paxos。与 Raft 相比，Paxos 更泛化，Raft 用 strong Leader 约束换取可理解性。

## 方案权衡

Paxos 论文 elegant 但 corner case 多，工程实现历史上少；Raft 为 teaching 设计，etcd/Consul 广泛采用。面试讲清两阶段和 proposal number 单调即可；生产勿自研。Chubby/Google 内部大量 Paxos 变体，一般开发者了解定位足够。

## 落地要点

配合可视化动画理解；对比 Raft log matching；阅读 etcd 为何选 Raft 的设计 doc。若读论文，先 Multi-Paxos 再看 Basic。用"值一旦 chosen 不可变"解释为何需要 highest proposal 规则。

## 常见误区

误区：Paxos=Paxos Made Simple 全文背诵；忽略 livelock 可能；把 ZAB 叫 Paxos；认为任一节点随时 propose 无代价。混淆 instance 和 sequence 也会答非所问。

## 小结

Paxos 学习的合理目标是理解 proposal number 与 quorum 如何保证 safety，而非手写实现。与 Raft 对比时，强调 Paxos 更泛化、Raft 更利于工程 teaching。面试中用两阶段 prepare/accept 举例即可，深入 liveness 证明留给专项研究。 若感到 Paxos 抽象，可先完整学完 Raft 再回来看 Paxos 的 prepare/accept，会有"原来是在解决同一类 safety"的顿悟。论文阅读不必一次通关，分三次：动机、safety、liveness。工程上记住 Chubby/etcd 的分工即可指导绝大多数技术选型讨论。

最后记住：Paxos 的价值在 safety 证明，Raft 的价值在 teachability，二者指向同一工程目标——复制日志一致。
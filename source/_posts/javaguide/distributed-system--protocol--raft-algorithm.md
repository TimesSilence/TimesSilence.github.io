---
title: "Raft 算法详解：Leader 选举、日志复制、安全性与成员变更"
date: 2023-08-25 13:35:00
updated: 2023-08-25 13:35:00
permalink: knowledge/distributed-system/protocol/raft-algorithm/
categories:
  - 分布式系统
tags:
  - Raft
  - 共识算法
  - Leader选举
description: "Raft 的 Leader 选举、日志复制、安全性约束与成员变更（Joint Consensus）。"
---

Raft 把共识拆成选举、复制、安全三块，是理解 etcd、Consul 的钥匙。本文整理 term、commit index 与 joint consensus 等面试高频点。

<!-- more -->

## 要解决什么问题

复制状态机需要所有存活节点按相同顺序应用命令。Leader 宕机要快速 failover；网络分区不能选出双 Leader 写入；已提交 entry 不能在新区 term 被覆盖。成员变更若一步到位，可能同时存在两个多数派。

## 核心原理

Follower 超时变 Candidate，term 递增拉票，过半成 Leader。Leader 复制 log，matchIndex 过半 commit。Election restriction：只投给 log 至少和自己一样新的 Candidate。成员变更用 joint consensus：先 C_old,new 双 majority，再 C_new，避免 split brain。Snapshot 压缩历史 log。

## 方案权衡

Raft 写吞吐受 Leader 限制；读可用 lease read 或 Follower read（需 stale 语义）。与 Paxos 等价性有形式化证明，但工程 etcd 选 Raft 因实现清晰。ZAB 与之类似，术语 map：term≈epoch，log≈zxid 序列。

## 落地要点

调 election/heartbeat timeout 为 RTT 10 倍量级；监控 leader changes；应用幂等因 at-least-once；升级走 joint 配置。client 通过 serializable read 或 read index 平衡一致与性能。演练 Leader 隔离后集群行为。

## 常见误区

误区：Follower 可写；不比较 log 长度选举；成员变更一步完成；用 wall clock 排序 log。忽略 pre-vote 优化导致 unnecessary election 也是常见运维抱怨点。

## 小结

Raft 是 etcd 时代的通用语言：term、log index、commit、joint consensus 五个词应能脱口而出。实验环境推荐 minikube+etcd 或 play with raft 动画。成员变更务必走 joint 配置，这是生产集群升级最常踩的 safety 坑之一。 建议配合 etcdctl 观察 member list 与 endpoint health，在本地集群执行 member add/remove 体验 joint consensus 的必要性。日志复制延迟是常见性能瓶颈，监控 committed index 与 apply index 差值，比单纯 ping Leader 更能发现慢 Follower。应用层务必幂等，因为 Raft 只保证 at-least-once 语义的复制。

一句话总结：Raft 用强 Leader 和清晰 term 规则，把分布式复制日志变成可运维的工程问题。

日常运维把 majority 可用性与 Leader 健康监控结合起来，是避免"集群看似活着却无法写入"的关键。
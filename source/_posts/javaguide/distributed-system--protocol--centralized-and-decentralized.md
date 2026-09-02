---
title: "分布式协调详解：Leader、Quorum、Lease、Fencing Token 与 Gossip"
date: 2023-06-17 16:46:00
updated: 2023-06-17 16:46:00
permalink: knowledge/distributed-system/protocol/centralized-and-decentralized/
categories:
  - 分布式系统
tags:
  - 分布式协调
  - Leader
  - Quorum
  - Gossip
description: "中心化与去中心化协调模式：Leader 选举、法定人数、租约、栅栏令牌与 Gossip 传播。"
---

分布式协调回答两件事：谁做决定，状态怎么同步。本文对比 Leader+Quorum 与 Gossip 等模式，并说明 Lease 和 Fencing 如何防止旧主捣乱。

<!-- more -->

## 要解决什么问题

多节点需选主写元数据、抢锁、避免脑裂。无协调则各自为政；协调不当则单点或分裂。Lease 过期后旧 Leader 仍可能写存储；没有 fencing 的锁在 TTL 场景下无法阻止迟到写覆盖新主的数据。

## 核心原理

中心化：Leader 串行化写，Follower 复制；Quorum (N/2+1) 决定 commit。Lease 授予带时限的权威，过期需重新获取。Fencing Token 单调递增，存储层拒绝旧 token。去中心化：Gossip  pairwise 传播，最终一致，适合 membership 和 Cassandra 反熵，不保证即时一致写。

## 方案权衡

中心化一致性强、路径清晰（ZK/Raft）；Gossip 扩展性好但冲突解决复杂、收敛有时间。脑裂防护需 Quorum 或 fencing，不能仅靠"我觉得我还是主"。选模式看一致延迟要求、节点规模和网络拓扑。

## 落地要点

生产选成熟选主（etcd/ZK）；Lease 长度 > RTT 且 < 故障切换目标；下游 MVCC 或 token check；Gossip 监控 convergence。文档化 failover 步骤和 expected downtime。演练旧主隔离后是否仍接受写入。

## 常见误区

误区：Lease 等于万能锁；无 Quorum 的 master-slave；用 Gossip 做银行余额强一致写；忽视 fencing 导致 Redis 锁过期双写。把 heartbeat 当成共识本身也不足。

## 小结

协调模式的选择，取决于一致延迟、规模与运维能力这三者的平衡。Leader 模式适合强一致元数据；Gossip 适合大规模成员传播。Lease 与 Fencing 是生产级锁和选主不可缺的配套机制，缺少它们，很多"理论正确"的协调方案仍会在 TTL 场景下翻车。 建议结合一次真实的 Redis 主从切换或 ZK Leader 选举日志，对照本文中的 Quorum、Lease、Fencing 概念复盘。只有看到旧主尝试写入被拒绝，才能体会 fencing 不是论文概念而是生产刚需。团队规范里应写明：任何分布式锁方案必须评估 TTL 过期后的写路径保护。
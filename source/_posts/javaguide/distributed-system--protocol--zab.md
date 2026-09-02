---
title: "ZAB 协议详解：ZooKeeper 原子广播、消息广播、崩溃恢复与 Leader 选举"
date: 2023-09-04 14:42:00
updated: 2023-09-04 14:42:00
permalink: knowledge/distributed-system/protocol/zab/
categories:
  - 分布式系统
tags:
  - ZAB
  - ZooKeeper
  - 原子广播
description: "ZAB 协议的两阶段模式、epoch 与 zxid 及崩溃恢复与广播流程。"
---

ZAB 是 ZooKeeper 的共识内核，与 Raft 目标相近但用 epoch+zxid 描述进度。理解 ZAB 有助于读懂 ZK 运维指标和客户端 sync 语义。

<!-- more -->

## 要解决什么问题

ZK 需全序广播写请求，Leader 切换后已提交事务不丢，Follower 必须追平到一致点才能对外服务读（若要求 strong read）。崩溃恢复与广播两阶段切换若理解错误，会误判"ZK 挂了"其实是 election。

## 核心原理

崩溃恢复：选举 max(zxid) 的 Leader，Follower DIFF/TRUNC/SNAP 同步。广播：Leader 提案，Follower ACK 过半 commit。zxid 高 32 epoch 低 32 counter。与 Raft 类似，ZK 4.x 文档也强调与 Raft 的对比阅读。写必须经 Leader；顺序保证来自 ZAB quorum commit。

## 方案权衡

ZAB 面向协调小数据，不适合 Kafka 级吞吐 log。与 Multi-Paxos 目标相近实现不同。读 sync() 可绑 strong consistency，默认 read 可能 lag。Observer 扩展读但不投票。

## 落地要点

监控 fsync latency 和 outstanding requests；客户端写后读关键路径 sync；对比阅读 Raft §5.4 safety。升级 ZK 版本阅读 release note 中 ZAB 变更。避免超大 transaction 阻塞 pipeline。

## 常见误区

误区：ZAB=Paxos 完全等同；忽视 DIFF vs SNAP 选择；Follower 未同步完对外写；把 zxid 当业务序列号使用导致误解进度。

## 小结

ZAB 与 Raft 对照学习效率最高：epoch≈term，quorum commit 思路一致。运维 ZK 时关注 election 次数、fsync 延迟和 outstanding requests，比死记协议阶段更能解决实际问题。客户端强读需求应显式 sync，而不是假设所有读都 linearizable。 阅读 ZK 源码或 admin 文档时，把 zxid 解析成 epoch+counter 的习惯能加速故障定位。建议在测试环境模拟 Leader 进程 hang 而非 kill，观察会话与选举的差异。与业务团队对齐：哪些读路径必须 sync，哪些允许 stale，避免把 ZK 一致性能力用错场景。

一句话总结：ZAB 为协调场景优化，小事务、强顺序、快选举，是 ZooKeeper 稳定运行的根基。

运维 ZK 时把 election 告警与客户端重试策略联动配置，可以显著缩短感知故障到恢复服务的时间窗口。
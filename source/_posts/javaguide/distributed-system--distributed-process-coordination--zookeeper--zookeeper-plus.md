---
title: "ZooKeeper 进阶详解：ZAB 协议、Leader 选举、集群部署与会话机制"
date: 2023-05-08 12:18:00
updated: 2023-05-08 12:18:00
permalink: knowledge/distributed-system/distributed-process-coordination/zookeeper/zookeeper-plus/
categories:
  - 分布式系统
tags:
  - ZooKeeper
  - ZAB
  - Leader选举
description: "ZAB 原子广播、崩溃恢复、Leader 选举流程与 ZK 集群部署及会话机制。"
---

理解 ZK 内部，关键是 ZAB 如何在崩溃后恢复一致并选出 Leader。本文整理广播、恢复两阶段与 session 机制，便于与 Raft 对照学习。

<!-- more -->

## 要解决什么问题

协调服务自身必须高可用。节点宕机、网络分区时，谁有权写入、如何保证已提交事务不丢，是 ZAB 要解决的问题。运维还需面对 epoch 变更期间的服务短暂不可用、Follower 落后过多时的同步耗时等现实问题。

## 核心原理

ZAB 分崩溃恢复（选举+同步）和消息广播（类似 quorum ack）。Epoch 标识 Leader 任期；zxid 高 32 位 epoch 低 32 位计数。选举比较 zxid 和 myid，最大者胜出。Follower 收到提案 ACK 过半 Leader 即可 commit。Session 心跳维持临时节点；超时则认为客户端死亡并删除临时 ZNode。

## 方案权衡

写必须走 Leader，读可从 Follower 但可能 stale；选举期间不服务写。与 Raft 相似度 high 但术语和实现细节不同，面试常要求对比。Observer 节点扩展读不参与投票，适合跨机房读扩展但写路径仍受 Leader 限制。

## 落地要点

部署独立 SSD journal；tickTime/initLimit/syncLimit 按 RTT 调；监控 fsync 和 election time；客户端设置合理 retry。跨机房部署要评估 Leader 所在机房网络质量，避免频繁 epoch 跳变。升级版本先在 staging 验证 zxid 兼容性。

## 常见误区

误区：Follower 直接写入；不了解 epoch 跳变时客户端该做什么；Quorum 偶数节点；JVM 堆过大导致 STW 误杀 session。将 ZAB 简单等同于 2PC 而忽略 crash recovery 细节也会误导故障排查。

## 小结

进阶 ZAB 不必追求推导每个细节，但要能解释 epoch 变化时客户端该重连、Follower 为何要 DIFF/SNAP 同步。部署层面，session 超时与 GC、网络抖动强相关，调参必须结合真实 RTT 分布。把 ZAB 与 Raft 对照阅读，可以形成对共识类组件的统一心智模型。
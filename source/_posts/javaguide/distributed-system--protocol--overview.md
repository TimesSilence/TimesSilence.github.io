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
description: "分布式协议模块学习地图：CAP/BASE 建立取舍观，协调机制回答谁做决定，Paxos/Raft/ZAB 解决共识，Gossip 负责状态传播，一致性哈希负责数据分布；附推荐顺序与问题—算法—产品对照表。"
---

分布式理论模块名词密集：CAP、BASE、Paxos、Raft、ZAB、Gossip、一致性哈希……初学者很容易背成一锅粥。其实这些概念各管一段：取舍、协调、共识、传播、分片，互不替代。本文给出学习地图：每类问题对应什么协议、建议阅读顺序，以及一张"问题—算法—产品"对照表。

<!-- more -->

## 这个模块在回答什么问题

把名词按问题域归堆，地图就清晰了：

1. **取舍**：分区必然发生，一致性与可用性怎么权衡？——CAP 定理与 BASE 理论。
2. **协调**：谁拍板？旧主捣乱怎么办？——Leader、Quorum、Lease、Fencing Token，以及集中式与去中心化之争。
3. **共识**：节点会故障时，如何对同一个值达成一致？——Paxos、Raft、ZAB。
4. **传播**：大规模集群里状态如何扩散收敛？——Gossip。
5. **分片**：数据如何映射到节点，且扩缩容代价可控？——一致性哈希。

共识和分片最易混淆：Raft 管"多副本日志怎么一致"，一致性哈希管"key 放哪台机器"，是两层问题。

## 推荐阅读顺序

1. **CAP 定理与 BASE 理论**：先建立取舍观，理解分区容错为何不能放弃。
2. **分布式协调（集中式 vs 去中心化）**：把 Leader、Quorum、脑裂、Lease、Fencing Token 串到一条主线，看清协调的成本。
3. **拜占庭将军问题**：拓展故障模型，明白 Paxos/Raft 只防宕机不防撒谎，何时才值得上 BFT。
4. **Raft → Paxos → ZAB**：共识主线。Raft 易懂，先建立直觉；Paxos 补理论视角；ZAB 落到 ZooKeeper 的原子广播。
5. **Gossip 与一致性哈希**：最后看传播与分片，顺带澄清"Gossip 不是共识""一致性哈希不解决一致性"两个误会。

## 问题—算法—产品对照表

| 问题 | 算法 / 协议 | 代表产品 |
| --- | --- | --- |
| 取舍 | CAP / BASE | 所有分布式系统的设计前提 |
| 协调与选主 | Leader + Quorum、Lease、Fencing | ZooKeeper、etcd、Redis 哨兵 |
| 共识 | Raft | etcd、Consul、TiKV、Kafka KRaft |
| 共识 | ZAB | ZooKeeper |
| 共识 | Paxos | Chubby 及各类理论原型 |
| 状态传播 | Gossip | Cassandra、Redis Cluster 总线 |
| 数据分片 | 一致性哈希 | Dynamo、Memcached 客户端、分库分表中间件 |

复习时闭卷默出这张表，逐个追问"解决什么、不解决什么"，效率最高。

## 常见误区

- **把 Gossip、一致性哈希当共识**：前者管传播收敛，后者管数据放哪，都不保证多副本的一致写入。
- **混淆两个 C**：CAP 的 C 是跨副本一致性，ACID 的 C 是约束不被破坏，两回事。
- **认为 Paxos 与 Raft 毫不相干**：目标相同、表达不同，多数派与任期思想一脉相承。
- **CAP 即"三选二"**：分区必然存在，取舍只发生在分区期间的 C 与 A 之间。

## 小结

- 主线五条：取舍（CAP/BASE）、协调（Leader/Quorum/Lease/Fencing）、共识（Paxos/Raft/ZAB）、传播（Gossip）、分片（一致性哈希）。
- 按"CAP → 协调 → 拜占庭 → Raft/Paxos/ZAB → Gossip 与一致性哈希"的顺序读，层层递进。
- 每个算法用"解决什么、不解决什么、服务哪个产品"三问收尾，比背结论扎实。
---
title: "ZooKeeper 专题：核心概念、ZNode、Watcher、ZAB、集群部署、Curator 与分布式锁"
date: 2023-01-20 11:01:00
updated: 2023-01-20 11:01:00
permalink: knowledge/distributed-system/distributed-process-coordination/zookeeper/overview/
categories:
  - 分布式系统
tags:
  - ZooKeeper
  - 协调服务
  - ZAB
description: "ZooKeeper 模块学习地图：三篇文章分别覆盖概念模型、集群机制与动手实战，给出推荐学习顺序与自检问题清单。"
---

ZooKeeper 是分布式协调领域的经典组件，Dubbo、HBase、HDFS、旧版 Kafka 都建立在它之上。本模块用三篇文章把它拆成"模型—机制—实战"三步，本文说明每篇的定位、推荐学习顺序，以及学完后应当能回答的问题。

<!-- more -->

## 模块构成

- [ZooKeeper 入门指南](/knowledge/distributed-system/distributed-process-coordination/zookeeper/zookeeper-intro/)：数据模型（znode 树与四种节点类型）、Watcher 的一次性语义、会话与心跳、ZAB 提供的顺序一致性，以及配置中心、注册中心、分布式锁、选主四类典型应用。这是整个模块的地基。
- [ZooKeeper 进阶详解](/knowledge/distributed-system/distributed-process-coordination/zookeeper/zookeeper-plus/)：集群角色（Leader/Follower/Observer）、写走 Leader 读走本地的请求流程、会话管理细节，以及"ZK 不适合做什么"——重点讨论注册中心场景下的 CP 之争，与 Eureka、Nacos 对比。
- [ZooKeeper 实战教程](/knowledge/distributed-system/distributed-process-coordination/zookeeper/zookeeper-in-action/)：Docker 起环境，用 Curator 写出三个可运行示例——临时顺序节点分布式锁、NodeCache 配置管理、LeaderLatch 选主，并给出运行与观察方法。

## 推荐学习顺序

1. **先读入门篇，建立模型直觉**。重点是理解三件事：znode 为什么分成持久/临时/顺序；Watcher 触发一次即失效意味着什么；会话为什么是临时节点和一切活性判断的载体。读到能徒手画出"服务注册—下线—消费者感知"的完整时序，才算过关。
2. **再读进阶篇，理解集群机制**。带着"写为什么要过半确认""读为什么可能偏旧"两个问题去读，顺带想清楚 ZK 作为 CP 系统在选举期间的不可用窗口对上层业务意味着什么。
3. **最后动手实战**。把三个示例跑起来只是起点，关键是做故障演练：kill 持锁进程、停掉 Leader 节点、制造网络抖动，观察临时节点回收和重新选举的实际时序。只看不动手，面试和排障都会卡壳。

## 自检问题清单

学完后应能顺畅回答：

- 临时节点和临时顺序节点分别解决了什么问题？为什么不能给临时节点挂子节点？
- Watcher 为什么设计成一次性？两次注册窗口之间丢了变更怎么办？
- ZK 的一致性到底保证到哪一步？为什么刚写完读另一台机器可能是旧值？`sync` 做了什么？
- 集群为什么推荐奇数台？加 Observer 为什么不影响写性能？
- 分布式锁里"只监听前驱节点"如何避免惊群？持锁进程崩溃会发生什么？
- 为什么越来越多的注册中心选型绕开 ZK？Eureka 的 AP 路线放弃了什么、换来了什么？

答不上的条目，就是回读对应篇章的路标。

## 实践建议

- 学习期间用 Docker 单节点即可，验证选举行为再起三节点集群；生产部署记住"奇数台、独立磁盘、堆别太大"三条底线。
- 编码统一用 Curator，裸 ZK 客户端的 Watcher 重注册和异常处理极易写错。
- 把"会话过期后业务如何重建状态"写成一条明确的测试用例，这是 ZK 类应用线上事故的高发区。

## 小结

- 三篇文章对应"模型 → 机制 → 实战"，按顺序读收益最大。
- 入门篇是词汇表，进阶篇回答"集群内部发生了什么"，实战篇把概念变成可复现的实验。
- 自检问题清单答不顺的，回到对应篇章补上缺口。
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
description: "ZooKeeper 专题导读：从 ZNode、Watcher 到 ZAB、集群部署与 Curator 实战路径。"
---

ZooKeeper 是经典分布式协调组件，Dubbo、Kafka 早期版本都重度依赖它。本文梳理专题结构及推荐学习顺序，便于分阶段掌握概念、协议与实战。

<!-- more -->

## 要解决什么问题

分布式系统需要选主、配置同步、命名服务和分布式锁，自研协调逻辑成本高且易错。ZK 提供类文件系统的数据模型和顺序一致写入，但 Watcher、session、ZAB 等概念叠加，初学者容易在 API 层面会用却不理解失效行为。

## 核心原理

ZK 核心是层次化 ZNode、一次性 Watcher 通知、ACL 和 ZAB 协议。典型用途：服务注册（临时节点）、配置（持久节点+watch）、Leader 选举（顺序临时节点）、分布式锁。专题分三篇：intro 讲模型与场景，plus 讲 ZAB 与选举，in-action 讲部署与 Curator。Curator Recipes 封装了常见协调模式，生产应优先使用。

## 方案权衡

ZK 偏 CP，写吞吐有限，单节点数据应 KB 级，不适合当业务数据库。etcd 在 K8s 生态更主流，但 ZK 面试与 legacy 系统仍多。与 Redis 协调比，ZK 强在顺序和 ephemeral 语义，弱在 OPS 复杂度和写性能。学习成本高于直接用 Nacos，但理解 ZK 有助于理解共识类组件共性。

## 落地要点

生产集群奇数节点 3/5，独立磁盘，JVM 堆适中防长 GC；路径命名规范 /app/service/instance；用 Curator 管理连接与重试；监控 zxid lag、election 次数、latency。升级滚动时观察 session 迁移对临时节点的影响。与 Dubbo/Kafka 版本矩阵对照，避免客户端协议不兼容。

## 常见误区

误区：用 ZK 存业务大对象；Watcher 风暴不做合并；单节点开发环境行为与集群不一致；忽视 sessionTimeout 导致临时节点误删引发错误 failover 感知。

## 小结

ZooKeeper 专题的价值在于把协调问题拆成"模型—协议—实战"三步。先建立 ZNode/Watcher 直觉，再理解 ZAB 如何保证写入顺序，最后用 Curator 验证锁和选举。掌握这条线之后，再读 etcd 或 Nacos 协调功能会轻松很多，因为底层问题域高度相似。
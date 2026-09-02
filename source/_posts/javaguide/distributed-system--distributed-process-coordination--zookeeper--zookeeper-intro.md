---
title: "ZooKeeper 入门指南：核心概念、ZNode、Watcher、ACL 与典型应用场景"
date: 2023-01-30 12:08:00
updated: 2023-01-30 12:08:00
permalink: knowledge/distributed-system/distributed-process-coordination/zookeeper/zookeeper-intro/
categories:
  - 分布式系统
tags:
  - ZooKeeper
  - ZNode
  - Watcher
description: "ZooKeeper 数据模型、节点类型、Watcher 机制、ACL 与典型协调场景入门。"
---

入门 ZK 先搞懂"树形命名空间 + 事件通知"这套模型，再谈选举和锁。本文用场景驱动方式整理 ZNode 类型与 Watcher 语义。

<!-- more -->

## 要解决什么问题

多进程需要共享配置、感知成员上下线、竞争独占资源。轮询数据库效率低且延迟大；ZK 提供层次化协调原语和推送式 Watcher，但 API 一次性触发、session 绑定等语义若不理解，容易出现"丢事件"或"惊群"问题。

## 核心原理

ZNode 分持久、临时、顺序及其组合。临时节点随 session 消失，适合服务注册；顺序临时节点用于公平锁和 Leader 选举（序号最小者胜出）。Watcher 一次性，触发后需重新注册；getData/exists/getChildren 均可设 watch。ACL 控制 per-node 读写管理权限。读默认可能略旧，强一致读可在写后 sync。

## 方案权衡

ZK 写路径线性一致，读从 local 可能滞后；Watcher 轻量但不保证中间每一变更都送达若客户端处理慢。数据量应小、变更频率适中；高频大 payload 不适合。与 etcd watch 相比，ZK Watcher 模型更老但生态 Recipe 丰富。

## 落地要点

路径设计 /{business}/{service}/{id}；选举监听前序节点删除；配置变更用 NodeCache/TreeCache（Curator）代替裸 Watcher；sessionTimeout 大于网络抖动 P99。Watcher 回调里只做轻量逻辑，重活投递业务线程池。集成测试覆盖 session 断开重连后临时节点重建行为。

## 常见误区

误区：Watcher 当持久订阅；在 Watcher 回调阻塞 IO 线程；路径无规范导致运维误删；忽视 session 过期导致"假死"节点未及时清理。另一个坑是 exists watch 与 getData watch 触发条件不同，排查事件丢失时要读清文档。

## 小结

ZooKeeper 入门的关键，是把"目录树+事件"当成协调原语，而不是另一个 KV 数据库。写服务注册代码前先画路径结构和 Watcher 重新注册流程，能避免大部分线上惊群和假存活问题。与注册中心产品相比，ZK 更偏底层，理解它有助于看清 Nacos/Eureka 部分能力的实现边界。
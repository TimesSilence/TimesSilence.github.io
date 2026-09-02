---
title: "MongoDB常见面试题总结（上）"
date: 2021-06-03 09:47:00
updated: 2021-06-03 09:47:00
permalink: knowledge/database/mongodb/mongodb-questions-01/
categories:
  - 数据库
tags:
  - MongoDB
  - 面试
  - 副本集
description: "MongoDB 架构、存储引擎与副本集相关高频面试点的学习笔记。"
---

MongoDB 面试上半部分常考架构分层、WiredTiger 与副本集行为。把「写入如何持久、故障如何切换」讲清楚是关键。

<!-- more -->

## 架构分层

驱动 → mongos（分片路由）→ shard/replica set → 存储引擎。单机开发用 standalone；生产至少三节点副本集。

## WiredTiger 要点

默认存储引擎，支持文档级并发控制、压缩与 checkpoint。缓存（Cache）命中决定读性能；脏页刷盘与 journal 保证崩溃恢复。

## 副本集选举

心跳检测主节点；不可达触发选举，多数派选新主。`priority`、`votes`、`arbiterOnly` 影响角色。写操作默认要求主确认，可调 `w: majority` 防 rollback 窗口丢写。

## oplog 作用

固定大小 capped collection，记录幂等操作，供从节点重放与变更流（Change Streams）消费。

## 实践建议

三节点跨可用区部署；备份用 `mongodump`+ oplog 或云快照；升级前读 release notes 看存储格式变化。

## 存储与 journal

写操作先写 journal 再 checkpoint 到数据文件，类似 MySQL redo。journal 同步策略（journalCommitInterval）影响 durability 与性能。复制延迟监控：optime lag、replSetGetStatus。

## 备份策略

逻辑 mongodump 适合小库；物理拷贝需 fsync 锁或 cloud snapshot；恢复后必须 replay oplog 到指定点。

## 实践复习清单

画出副本集拓扑与选举条件；能口述一次写请求从 driver 到 journal 的路径；会用 rs.status() 看 lag；知道 rollback 发生条件；备份恢复演练写进值班手册；监控 opcounters、connections、queues。

## 常见坑

- 两节点无仲裁，无法形成多数派。
- 读从节点却要求强一致，未设置 `readConcern: majority`。
- 忽略 writeConcern，主宕机可能丢最近写入。

## 总结与自测

副本集最少几节点？写关注 majority 解决什么问题？oplog 作用是什么？WiredTiger cache 未命中会怎样？能否用 rs.status 判断 lag？把这些串成「写入到持久化到复制」故事，Mongo 上半部分面试就稳了。

## 原理延伸

MongoDB 把文档原子性、副本集复制与可选分片组合成横向扩展方案。schema 灵活不等于无需设计：嵌入与引用、索引与 working set、writeConcern 与 readPreference 共同决定延迟与一致性。聚合管道是分析利器，但 $lookup 与无索引 $match 容易把负载放大到集群级。生产环境必须启用 auth、TLS 与 least-privilege 角色，并把备份恢复与 failover 演练写进 runbook。
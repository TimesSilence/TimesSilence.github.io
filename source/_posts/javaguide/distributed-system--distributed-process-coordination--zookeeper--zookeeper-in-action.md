---
title: "ZooKeeper 实战教程：Docker 部署、zkCli 命令、四字命令与 Curator 客户端"
date: 2023-09-24 16:56:00
updated: 2023-09-24 16:56:00
permalink: knowledge/distributed-system/distributed-process-coordination/zookeeper/zookeeper-in-action/
categories:
  - 分布式系统
tags:
  - ZooKeeper
  - Curator
  - Docker
description: "ZooKeeper Docker 部署、zkCli 常用命令、四字命令监控与 Curator 客户端实践。"
---

纸上 ZAB 不如动手起集群。本文整理 ZK 本地/容器部署、运维命令与 Curator 编码要点，帮助把概念验证落到可复现实验。

<!-- more -->

## 要解决什么问题

概念学完需要可复现环境验证 Watcher、选举和锁行为。裸机安装繁琐，命令和监控接口不熟则故障排查只能重启试试。团队新人若只会 Curator 封装而不懂 zkCli，线上紧急排障会吃力。

## 核心原理

Docker Compose 可快速起 ZK ensemble，注意 myid 与端口映射。zkCli 支持 create/get/set/watch/ls/delete；四字命令 ruok/stat/mntr/srvr 用于健康与指标。Curator 提供 ConnectionStateListener、PathChildrenCache、InterProcessMutex 等。连接串格式 host:port,chroot 可选。

## 方案权衡

Docker 适合 dev/test，生产建议 StatefulSet 或裸机并持久化 dataDir/logDir。Curator 比原生 API 安全但增加依赖版本对齐成本。四字命令需 admin.serverAddress 且应 ACL/防火墙限制，避免信息泄露。

## 落地要点

myid 与 server.N 一一对应；dataLogDir 独立盘；Curator retryPolicy 与 sessionTimeout 匹配业务；集成测试用 TestingServer。生产禁用公网四字命令；备份 dataDir 前理解事务日志一致性要求。日志级别调优区分正常 session 过期与异常断连。

## 常见误区

误区：容器无 volume 丢数据；zkCli 路径漏写 leading /；Curator 未 close 泄漏；用 ruok  alone 判断集群健康而不看 mode/latency/zxid。Docker 单节点 pretending ensemble 无法验证选举行为。

## 小结

实战阶段的目标不是背命令，而是能在本地复现 session 过期、Watcher 触发和锁竞争。建议用 Docker 起三节点集群，分别演练 kill Leader 与 pause Follower，观察 zxid 与 election 日志。Curator 示例代码应纳入项目的集成测试，防止升级客户端版本后静默行为变化。 动手实验时建议记录每次 session 过期前后临时节点的变化，以及 Curator 重连策略如何影响你的业务回调。把这些观察写进团队 runbook，比单纯保存 Docker Compose 文件更有长期价值。遇到四字命令无法使用时，先检查 admin.enableServer 与防火墙，而不是直接重启集群。
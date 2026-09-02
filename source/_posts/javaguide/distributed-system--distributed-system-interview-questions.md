---
title: "2026 最新分布式系统面试题总结：CAP、Raft、RPC、分布式锁、事务与 ID"
date: 2023-07-26 10:14:00
updated: 2023-07-26 10:14:00
permalink: knowledge/distributed-system/distributed-system-interview-questions/
categories:
  - 分布式系统
tags:
  - 分布式系统
  - 面试题
  - CAP
description: "分布式系统高频面试题梳理：理论、RPC、锁、事务、ID 与协调组件考点。"
---

面试复习需要"问题清单 + 答题结构"。本文归纳分布式方向的高频考点与回答框架，帮助把分散知识点串成面试官听得懂的两分钟叙述。

<!-- more -->

## 要解决什么问题

分布式面试覆盖面广，从 CAP 到 Redis 锁到 Seata，考生易答散、缺场景、缺对比。面试官常追问"你们线上怎么选的、出过什么问题"，只背定义缺少项目映射会被认为没落地经验。

## 核心原理

高频块：CAP/BASE 与 PACELC；Paxos/Raft/ZAB 定位；RPC vs HTTP；ID 方案对比；Redis 锁 owner/TTL/Redlock 争议；2PC/TCC/Saga/事务消息；ZK/etcd 协调语义。答题模板：一句话定义→核心流程→业务场景→方案对比→踩坑经验。每题准备 60 秒版和 3 分钟版。

## 方案权衡

面试不必手推 Paxos 全程，但要讲清 Leader 选举和日志复制直觉。事务题强调业务可接受的一致性级别，而非罗列名词。微服务题要体现"拆分边界"和"数据归属"，避免只谈 Spring Cloud 组件名单。

## 落地要点

自测清单：画下单链路；解释一次锁超时事故；对比 AT 与 TCC 适用订单场景；说明注册中心 CP/AP 选型理由。刷题后回归专题文章补深度，用费曼技巧讲给同事听。记录自己项目中的 traceId、幂等键、补偿任务实例，面试时主动引用。

## 常见误区

误区：CAP 说三选二；Redis 锁不提 Lua 释放；分布式事务只说 2PC；Raft 与 Paxos 说"一样"。把 Eureka 完全等同 AP 而忽略 self-preservation 等特殊行为也会露怯。

## 小结

分布式面试的高分答案，一定是"概念+场景+取舍+踩坑"四段式。建议把本文清单打印成 Checklist，每周挑五题录音自答，再对照专题文章补盲区。真正拉开差距的，往往是你能讲清楚团队线上一次 failover 或一次锁超时是如何定位与修复的。
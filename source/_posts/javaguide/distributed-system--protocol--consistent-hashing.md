---
title: "一致性哈希算法详解：哈希环、虚拟节点、数据倾斜与分布式缓存应用"
date: 2023-06-27 17:53:00
updated: 2023-06-27 17:53:00
permalink: knowledge/distributed-system/protocol/consistent-hashing/
categories:
  - 分布式系统
tags:
  - 一致性哈希
  - 分布式缓存
  - 虚拟节点
description: "一致性哈希环原理、虚拟节点缓解倾斜及在缓存与负载均衡中的应用。"
---

普通取模扩缩容会大规模迁移 key。一致性哈希把变动控制在相邻节点，是 Memcached、Redis Cluster 等方案的常用思路之一。

<!-- more -->

## 要解决什么问题

分布式缓存或分片集群增删节点时，hash(key)%N 会导致几乎所有 key 重映射，引发缓存击穿和迁移风暴。大促前扩容若未预估迁移量，可能拖垮后台 DB。需要扩缩容只影响环上局部区间。

## 核心原理

哈希值映射到环，key 顺时针找第一个节点负责。新增节点只接管一部分 key；删除节点将其 interval 交给后继。虚拟节点：每物理机多个环上点，改善负载均衡。Jump Hash、Maglev 等是替代方案，实现和倾斜特性不同。

## 方案权衡

一致性哈希不保证绝对均匀，虚拟节点数需调优（常见 100~200/物理节点）。Redis Cluster 16384 slot 是固定槽位变体，迁移按 slot 进行。范围分片利于范围查询但易热点；取模简单但扩缩容代价高。按访问模式选型。

## 落地要点

监控各节点 key 数与 QPS；扩缩容前预热；结合副本提高可用；客户端缓存拓扑视图并处理 moved/ask。测试 skew 场景下单节点 CPU。对于极热点 key，还需 local cache 或 singleflight，不能指望哈希 alone。

## 常见误区

误区：不加虚拟节点严重倾斜；环上物理节点太少；忽视节点性能差异；把一致性哈希当共识算法。另一个坑是 hash 函数变更导致全体 remapping，应固定 hash 算法版本。

## 小结

一致性哈希解决的是"扩缩容迁移量"问题，不是热点问题。上线前务必压测虚拟节点数和 skew 情况，并为极端热 key 设计 local cache 或独立分片。Redis Cluster 的 slot 模型是工程化变体，理解 hash ring 有助于读懂 slot 迁移与 MOVED/ASK 语义。
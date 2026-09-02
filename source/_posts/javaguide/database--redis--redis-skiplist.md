---
title: "Redis为什么用跳表实现有序集合"
date: 2021-05-06 16:26:00
updated: 2021-05-06 16:26:00
permalink: knowledge/database/redis/redis-skiplist/
categories:
  - 数据库
tags:
  - Redis
  - 跳表
  - ZSet
description: "Redis 有序集合跳表实现的原因与基本原理笔记。"
---

Sorted Set 需要有序+范围查询+动态更新，跳表在实现复杂度与性能之间取得了平衡。

<!-- more -->

## 为什么不用红黑树

跳表实现更简单，范围查询更直观（链表层级），并发扩展友好；与哈希表组合实现 O(logN) 插入与 O(1) 单 member 查找。

## 结构直觉

多层索引链表，查找时从顶层开始「跳跃」，平均 O(logN)。Redis 实现带 span 便于 rank 查询。

## 与 ziplist/listpack

小集合仍可用紧凑编码省内存；超过阈值转跳表+dict。

## 对比其他结构

| 结构 | 范围查询 | 实现难度 |
|------|----------|----------|
| 跳表 | 优秀 | 中 |
| 红黑树 | 中 | 高 |
| 数组 | 差 | 低 |

## 随机层概率

Redis 跳表层高 p=0.25；期望层数 O(logN)。手写跳表是很好算法练习。

## 范围查询复杂度

ZRANGEBYSCORE O(logN+M)，M 为结果数；大数据量分页用 LIMIT 游标。

## 实践复习清单

跳表期望复杂度；与红黑树对比；ZSet 底层双结构；score 相同 tie-break；ZRANGE 分页；手写跳表练习。

## 常见坑

- 面试只背「ZSet 用跳表」说不出与 dict 的配合。
- 误以为 score 相同时无序——实际按 member 字典序 tie-break。

## 总结与自测

跳表复杂度；为何 ZSet 用跳表；与红黑树对比；score 相同排序规则。能手画三层跳表查找路径即可。

## 原理延伸

Redis 的工程价值在于用内存数据结构换取极低延迟，但单线程命令执行模型决定了任何 O(N) 大 key 操作都会放大为全局延迟。持久化、主从复制与 Cluster 分片分别解决数据安全、读扩展与写扩展，没有银弹。使用 Redis 时要先定义数据丢失窗口与一致性 SLA，再选 RDB/AOF 组合；缓存层必须设计穿透、击穿、雪崩与双写不一致的预案。监控应覆盖内存、碎片率、连接数、blocked clients、repl lag 与 slowlog，而不是只看 QPS。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。
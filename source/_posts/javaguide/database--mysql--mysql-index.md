---
title: "MySQL索引详解"
date: 2020-02-19 08:50:00
updated: 2020-02-19 08:50:00
permalink: knowledge/database/mysql/mysql-index/
categories:
  - 数据库
tags:
  - MySQL
  - B+树
  - 索引
description: "MySQL InnoDB 索引结构、最左前缀与覆盖索引等核心知识笔记。"
---

索引是 InnoDB 性能的第一杠杆。理解 B+ 树与聚簇/二级索引差异，设计才不会拍脑袋。

<!-- more -->

## B+ 树为何适合磁盘

多路平衡、叶子链表便于范围扫；非叶只存键减少 IO。InnoDB 聚簇索引叶子存整行，二级索引叶子存主键值需回表。

## 最左前缀与覆盖索引

联合索引 (a,b,c) 可支持 a、a+b、a+b+c 前缀查询；覆盖索引指 SELECT 列全在索引内，Extra 出现 Using index。

```sql
CREATE INDEX idx_user_status ON orders(user_id, status, created_at);
-- 覆盖列尽量放进索引
SELECT user_id, status, created_at FROM orders WHERE user_id=1 AND status=1;
```

## 索引下推 ICP

5.6+ 在存储引擎层先过滤二级索引条件，减少回表次数。

## 设计原则

高选择性列在前；控制宽度；避免重复索引；监控 duplicate index。

## 前缀索引与区分度

`INDEX(name(10))` 要算 distinct prefix 选择性。过长前缀接近全列索引浪费空间。

## 聚簇索引二级效应

非单调主键插入中间位置引发页分裂；自增或时间序 ID 更友好。

## 实践复习清单

手绘 B+ 树与聚簇索引；设计三个联合索引案例；覆盖索引 EXPLAIN 验证；前缀索引选择性计算；ICP 观察 Extra；duplicate index 查询。

## 常见坑

- 每个列单独建索引以为等于联合索引。
- varchar 索引过长未指定前缀长度导致区分度不足。

## 总结与自测

B+ 树为何多路；聚簇与二级索引存储差异；最左前缀举例；覆盖索引好处；ICP 是什么？设计订单表索引并 explain 三条核心查询，是实战检验。

## 原理延伸

InnoDB 的核心竞争力在于把 B+ 树索引、缓冲池、redo/undo 与 MVCC 组合成可预测的 OLTP 引擎。读路径尽量走缓冲池与覆盖索引，写路径则要在行锁、日志刷盘与复制延迟之间取平衡。排查问题时不要只盯单条 SQL，还要看事务边界、锁等待、buffer pool 命中率与磁盘 fsync 延迟。性能优化永远遵循「先正确、再可测、后优化」：用慢日志和 EXPLAIN 定位瓶颈，用规范设计减少回表与锁竞争，用架构手段（读写分离、缓存、分片）承接流量，而不是在未测量前堆参数。
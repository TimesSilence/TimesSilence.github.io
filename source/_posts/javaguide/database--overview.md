---
title: "数据库知识体系：SQL、MySQL、Redis、MongoDB 与 Elasticsearch"
date: 2019-10-08 13:05:00
updated: 2019-10-08 13:05:00
permalink: knowledge/database/overview/
categories:
  - 数据库
tags:
  - 数据库
  - MySQL
  - Redis
  - MongoDB
description: "数据库模块学习地图：基础概念、SQL、MySQL、Redis、NoSQL 五组主题的依赖关系与推荐学习顺序。"
---

后端工程师的数据库能力往往决定系统上限。本文是数据库模块的学习地图：五组主题如何划分、彼此依赖关系是什么、按什么顺序学最省力。

<!-- more -->

## 主题分组

数据库模块可以分成五组：

- **基础概念**：关系模型、范式、ER 图、事务、字符集、NoSQL 版图。这是所有后续内容的词汇表。
- **SQL**：查询、聚合、连接、子查询与语法基本功。会写不等于会优化，语义要能对应到执行过程。
- **MySQL**：索引、事务隔离、MVCC、三大日志（redo/undo/binlog）、执行计划、性能优化。后端面试与生产排障的核心区。
- **Redis**：数据结构与选型、缓存读写策略、穿透/击穿/雪崩、持久化、阻塞排查、集群。缓存层的工程化问题集中在这里。
- **NoSQL 与搜索**：MongoDB 的文档模型、索引、副本集、分片；Elasticsearch 的倒排索引与分片。按岗位需求补充。

## 依赖关系

```text
基础概念
   ├──> SQL 语法 ──> MySQL 内核（索引/事务/MVCC/日志/执行计划）
   └──> NoSQL 版图 ──> MongoDB / Elasticsearch
Redis 相对独立，但「缓存一致性」依赖对 MySQL 主从与 binlog 的理解
```

基础概念提供共同语言：不理解事务 ACID，就学不动隔离级别；不理解键与范式，就设计不好表。SQL 是进入 MySQL 内核的前提——看不懂执行计划，索引优化就是玄学。MySQL 的三大日志反过来支撑 Redis 的缓存一致性方案：旁路缓存、CDC 同步都建立在 binlog 之上。NoSQL 各产品相对独立，但选型判断依赖第一组里建立的模型与 CAP 认知。

## 推荐学习顺序

1. **基础概念先行**：读[数据库基础](/knowledge/database/basis/)、[字符集](/knowledge/database/character-set/)、[NoSQL 基础](/knowledge/database/nosql/)，建立词汇表与选型直觉。
2. **SQL 基本功**：过一遍 SQL 语法总结，重点是把 WHERE、GROUP BY、HAVING、ORDER BY 的逻辑执行顺序想清楚。
3. **MySQL 主线**：按「索引 → 执行计划 → 事务与隔离级别 → MVCC → 三大日志」推进，这条线能串起绝大多数面试题与慢查询排查。
4. **Redis 专题**：数据结构与缓存策略先行，再深入持久化与集群；学习时不要背命令，要理解「为什么这么设计」。
5. **NoSQL 按需补充**：先看 [MongoDB 概览](/knowledge/database/mongodb/overview/)建立定位，再深入面试题上下两篇；ES 同理。

## 学完之后怎么巩固

每个主题配一个小实验：建表加索引看 EXPLAIN；开两个会话验证隔离级别；给缓存故意制造一次击穿；用 `rs.status()` 观察一次副本集切换。只看不动手，面试和排障都会卡壳。每学完一块，把「问题现象 → 底层机制 → 排查命令」连成一张图，复习效率会高得多。

还有一条容易被忽视的路径：故障复盘。慢查询、连接打满、主从延迟、缓存雪崩——每遇到一次线上问题，事后把它归到对应的知识组里，写明根因与处置命令。数据库能力由原理、工具、故障经验三部分构成，前两者可以自学，第三者只能靠积累。

## 小结

- 五组主题：基础概念、SQL、MySQL、Redis、NoSQL 与搜索。
- 顺序是「概念 → SQL → MySQL 内核 → Redis → NoSQL」，Redis 与 NoSQL 可视岗位调整先后。
- 理论配实验，是这个模块唯一有效的学法。
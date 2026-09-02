---
title: "SQL常见面试题总结（1）"
date: 2019-11-03 16:26:00
updated: 2019-11-03 16:26:00
permalink: knowledge/database/sql/sql-questions-01/
categories:
  - 数据库
tags:
  - SQL
  - 面试
description: "SQL 面试题学习笔记（1）：基础查询、过滤与排序。"
---

第一部分面试题聚焦「会不会写基础查询」。关键是理解 NULL、DISTINCT 与 LIMIT 的语义边界。

<!-- more -->

## 高频基础点

- **DISTINCT** 去重全行组合，不是单列魔法。
- **ORDER BY** 可对别名排序；NULL 默认放最前/最后因 DB 而异。
- **LIMIT offset, count** 大 offset 性能差，改 keyset pagination。

```sql
SELECT DISTINCT user_id FROM login_log WHERE dt = '2026-09-01';
SELECT * FROM product ORDER BY price DESC, id ASC LIMIT 10;
```

## NULL 处理

`IS NULL` / `IS NOT NULL`；`COALESCE(col, 0)` 给默认值；注意 `NULL = NULL` 为 UNKNOWN。

## 实践建议

手写 10 道基础题不看答案；对照 EXPLAIN 看是否走索引。

## 分页模式

Keyset: `WHERE id > ? ORDER BY id LIMIT 20` 利用索引；offset 分页仅适合前几页。

## 别名与 ORDER BY

SELECT 列表别名在同一层 ORDER BY 可用；GROUP BY 层不可用别名过滤。

## 实践复习清单

DISTINCT 语义；NULL 判断；LIMIT 深分页改写；ORDER BY 多列；COALESCE 使用；基础题十道计时练习。

## 常见坑

- 用 `= NULL` 判断空值。
- DISTINCT 与 JOIN 连用不知行扩张导致去重结果意外。

## 总结与自测

DISTINCT 语义；NULL 判断；分页优化；ORDER BY 与 NULL。基础题速度反映 SQL 肌肉记忆。

## 原理延伸

SQL 的价值在于声明式表达「要什么数据」，优化器负责「怎么取」。同样的语义可以写成子查询、连接或窗口函数，性能却可能差一个数量级，关键在于能否利用索引与减少中间结果集。NULL 的三值逻辑、GROUP BY 与 HAVING 的分工、外连接的过滤位置，是日常 bug 高发区。学习 SQL 要与具体数据库实现对照：MySQL 8 的 CTE、窗口函数、hash join 与 optimizer hint 都会改变写法选择。养成 EXPLAIN 习惯，比 memorizing 语法更重要。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。

动手在 MySQL 客户端完整跑通文中示例，并刻意改错一种写法观察报错或计划变化。
---
title: "SQL常见面试题总结（5）"
date: 2019-12-18 11:01:00
updated: 2019-12-18 11:01:00
permalink: knowledge/database/sql/sql-questions-05/
categories:
  - 数据库
tags:
  - SQL
  - 窗口函数
description: "SQL 面试题学习笔记（5）：窗口函数与高级查询技巧。"
---

窗口函数在不折叠行的前提下做排名与累计，是报表与分析 SQL 的利器。MySQL 8.0 起支持完整窗口语法。

<!-- more -->

## 窗口函数结构

`函数 OVER (PARTITION BY ... ORDER BY ...)`

```sql
SELECT
  user_id,
  amount,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn,
  SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_amt
FROM payments;
```

## 常见函数

ROW_NUMBER/RANK/DENSE_RANK；LAG/LEAD 取上下行；FIRST_VALUE/NTH_VALUE。

## 与 GROUP BY 区别

GROUP BY 聚合成更少行；窗口函数保留明细行并附加计算列。

## 实践建议

Top-N per group 用 ROW_NUMBER 包一层过滤 `WHERE rn <= 3`。

## 帧 clause

ROWS vs RANGE 帧定义影响移动平均。RANGE 遇 peer 相同 ORDER BY 值行为需读文档。

## 性能

窗口函数常需 filesort；索引列匹配 PARTITION BY/ORDER BY 可优化。

## 实践复习清单

ROW_NUMBER Top-N；累计 SUM 窗口帧；RANK 并列；LAG/LEAD 环比；PARTITION BY 必选意识；8.0 窗口索引优化。

## 常见坑

- 8.0 以下 MySQL 无窗口函数却照搬语法。
- PARTITION BY 遗漏导致全表排名错误。

## 总结与自测

窗口函数框架；Top-N 写法；ROWS RANGE 差异；8.0 支持。报表 SQL 优先窗口函数而非自连接 hack。

## 原理延伸

SQL 的价值在于声明式表达「要什么数据」，优化器负责「怎么取」。同样的语义可以写成子查询、连接或窗口函数，性能却可能差一个数量级，关键在于能否利用索引与减少中间结果集。NULL 的三值逻辑、GROUP BY 与 HAVING 的分工、外连接的过滤位置，是日常 bug 高发区。学习 SQL 要与具体数据库实现对照：MySQL 8 的 CTE、窗口函数、hash join 与 optimizer hint 都会改变写法选择。养成 EXPLAIN 习惯，比 memorizing 语法更重要。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。

动手在 MySQL 客户端完整跑通文中示例，并刻意改错一种写法观察报错或计划变化。
---
title: "SQL常见面试题总结（3）"
date: 2019-11-30 09:47:00
updated: 2019-11-30 09:47:00
permalink: knowledge/database/sql/sql-questions-03/
categories:
  - 数据库
tags:
  - SQL
  - JOIN
description: "SQL 面试题学习笔记（3）：多表连接与集合运算。"
---

连接是关系型威力所在。理解笛卡尔积、内连接与外连接的差异，避免「连完行数爆炸」。

<!-- more -->

## JOIN 本质

先产生行组合再过滤。无 ON 条件的 JOIN 即笛卡尔积，行数 = 各表行数乘积。

```sql
SELECT o.id, u.name
FROM orders o
INNER JOIN users u ON o.user_id = u.id
WHERE o.created_at >= '2026-01-01';
```

## 外连接

LEFT JOIN 保留左表无法匹配的行（右列 NULL）；用于「查所有用户及其 optional 订单」。

## UNION vs UNION ALL

UNION 去重合并；UNION ALL 保留重复行，性能更好。

## 实践建议

连接列建索引；小表驱动大表是优化器工作，写法上保证 ON 条件 selective。

## SEMI/ANTI JOIN

EXISTS 是 semi join；NOT EXISTS 是 anti join。优化器可能转为 hash join。

## 自连接

树形结构 employee-manager 用自连接或递归 CTE（8.0+ WITH RECURSIVE）。

## 实践复习清单

INNER/LEFT 场景各三例；避免笛卡尔积；UNION ALL 优先；外连接 WHERE 陷阱；连接列索引；semi/anti 概念。

## 常见坑

- 多表 JOIN 无选择性条件。
- 把 OUTER JOIN 当 INNER 用 WHERE 过滤右表列导致外连接失效。

## 总结与自测

JOIN 笛卡尔积；外连接保留侧；UNION ALL；外连接 WHERE 陷阱。连接列必须有索引意识。

## 原理延伸

SQL 的价值在于声明式表达「要什么数据」，优化器负责「怎么取」。同样的语义可以写成子查询、连接或窗口函数，性能却可能差一个数量级，关键在于能否利用索引与减少中间结果集。NULL 的三值逻辑、GROUP BY 与 HAVING 的分工、外连接的过滤位置，是日常 bug 高发区。学习 SQL 要与具体数据库实现对照：MySQL 8 的 CTE、窗口函数、hash join 与 optimizer hint 都会改变写法选择。养成 EXPLAIN 习惯，比 memorizing 语法更重要。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
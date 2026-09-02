---
title: "SQL语法基础知识总结"
date: 2019-11-12 17:33:00
updated: 2019-11-12 17:33:00
permalink: knowledge/database/sql/sql-syntax-summary/
categories:
  - 数据库
tags:
  - SQL
  - 语法
description: "SQL 语法基础：查询、聚合、连接与数据修改的结构化复习笔记。"
---

语法是表达查询意图的骨架。把 SELECT-FROM-WHERE-GROUP-HAVING-ORDER 链条练熟，复杂 SQL 才能拆解。

<!-- more -->

## 查询骨架

```sql
SELECT col1, COUNT(*) AS cnt
FROM orders
WHERE status = 'PAID'
GROUP BY col1
HAVING cnt > 10
ORDER BY cnt DESC
LIMIT 20;
```

## 连接类型

INNER JOIN 取交集；LEFT JOIN 保左表全部行；注意 JOIN 条件与过滤条件放 WHERE 还是 ON 的语义差异。

## 聚合与 NULL

COUNT(*) 计行；COUNT(col) 不计 NULL；AVG 忽略 NULL。GROUP BY 列需与 SELECT 非聚合列一致（ONLY_FULL_GROUP_BY）。

## DML 安全

UPDATE/DELETE 必带 WHERE；先用 SELECT 验证；事务包裹批量变更。

## 约束与完整性

PRIMARY KEY、UNIQUE、NOT NULL、CHECK、FOREIGN KEY 在 DDL 声明；CHECK 8.0.16+ enforce 更严。

## 视图与 CTE

视图简化权限与查询；可更新视图有限制。

## 实践复习清单

手写 SELECT 骨架；JOIN 三种；GROUP BY/HAVING 练习；NULL 三值逻辑；UPDATE 带 WHERE 习惯；ONLY_FULL_GROUP_BY 理解。

## 常见坑

- SELECT 列不在 GROUP BY 导致 MySQL 宽松模式返回随机行。
- 隐式逗号连接与显式 JOIN 混用可读性差。
- 字符串与日期比较未显式 cast。

## 总结与自测

SELECT 子句顺序；JOIN 类型；GROUP BY 规则；NULL 行为；安全 UPDATE。手写十条基础 SQL 不看答案，是入门门槛。

## 原理延伸

SQL 的价值在于声明式表达「要什么数据」，优化器负责「怎么取」。同样的语义可以写成子查询、连接或窗口函数，性能却可能差一个数量级，关键在于能否利用索引与减少中间结果集。NULL 的三值逻辑、GROUP BY 与 HAVING 的分工、外连接的过滤位置，是日常 bug 高发区。学习 SQL 要与具体数据库实现对照：MySQL 8 的 CTE、窗口函数、hash join 与 optimizer hint 都会改变写法选择。养成 EXPLAIN 习惯，比 memorizing 语法更重要。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。

动手在 MySQL 客户端完整跑通文中示例，并刻意改错一种写法观察报错或计划变化。
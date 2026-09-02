---
title: "SQL 专题：语法基础、查询、聚合、连接、子查询与常见面试题"
date: 2019-10-17 14:12:00
updated: 2019-10-17 14:12:00
permalink: knowledge/database/sql/overview/
categories:
  - 数据库
tags:
  - SQL
  - 查询
description: "SQL 专题学习路线：语法、连接、聚合与子查询等核心能力。"
---

SQL 是关系型世界的通用语言。掌握声明式查询思维，比记忆方言细节更能迁移到不同数据库。

<!-- more -->

## 学习路径

1. DDL/DML 基础与约束
2. 过滤、排序、聚合、分组
3. 多表连接（INNER/LEFT/RIGHT）
4. 子查询与 EXISTS
5. 窗口函数与常见面试题

## 与 MySQL 的关系

SQL 是标准语言，MySQL 是具体实现。执行计划、索引、锁在 MySQL 层展开，但查询语义先按 SQL 理解。

## 实践建议

用 small dataset 手写查询再 EXPLAIN；复杂报表优先 CTE（8.0+）提升可读性。

## 方言差异

LIMIT/OFFSET、窗口函数、CTE 在不同数据库支持度不同。写 portable SQL 避免专有 hint。

## 安全

参数化查询防注入；最小权限 DB 账号。

## 实践复习清单

DDL/DML/查询/连接/窗口函数模块自检； portable SQL 意识；注入防护；复杂 SQL 先 CTE 拆解；对照 MySQL 8 特性。

## 常见坑

- 只会 ORM 不会写 JOIN。
- 把 HAVING 当 WHERE 过滤未聚合列。
- 忽视 NULL 在三值逻辑中的行为。

## 总结与自测

SQL 学习模块清单；声明式思维；方言差异意识；注入防护。复杂查询先写 CTE 再优化，可读性第一。

## 原理延伸

SQL 的价值在于声明式表达「要什么数据」，优化器负责「怎么取」。同样的语义可以写成子查询、连接或窗口函数，性能却可能差一个数量级，关键在于能否利用索引与减少中间结果集。NULL 的三值逻辑、GROUP BY 与 HAVING 的分工、外连接的过滤位置，是日常 bug 高发区。学习 SQL 要与具体数据库实现对照：MySQL 8 的 CTE、窗口函数、hash join 与 optimizer hint 都会改变写法选择。养成 EXPLAIN 习惯，比 memorizing 语法更重要。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。
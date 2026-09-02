---
title: "SQL常见面试题总结（4）"
date: 2019-12-09 10:54:00
updated: 2019-12-09 10:54:00
permalink: knowledge/database/sql/sql-questions-04/
categories:
  - 数据库
tags:
  - SQL
  - 子查询
description: "SQL 面试题学习笔记（4）：子查询、EXISTS 与 CTE。"
---

子查询可读性高但可能被优化成 JOIN。掌握 EXISTS 与 IN 的差异，避免 correlated subquery 性能陷阱。

<!-- more -->

## 子查询分类

标量、列、表、相关子查询。相关子查询每行外层执行一次，数据量大时极慢。

## EXISTS vs IN

```sql
-- EXISTS 找到即停，常优于大 IN 列表
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- NOT IN 注意 NULL：子查询含 NULL 可能全 false
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned WHERE user_id IS NOT NULL);
```

## CTE（8.0+）

```sql
WITH recent AS (
  SELECT * FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
)
SELECT user_id, COUNT(*) FROM recent GROUP BY user_id;
```

## 关联子查询优化

MySQL 8 子查询 decorrelation 改进；仍建议改写 JOIN + DISTINCT 验证计划。

## DML 子查询

UPDATE/DELETE 带子查询注意 MySQL 同表更新限制，需派生表包裹。

## 实践复习清单

EXISTS vs IN 改写；相关子查询改 JOIN；NOT IN NULL 陷阱；CTE 可读性；DML 子查询派生表包裹。

## 常见坑

- 深嵌套子查询不可维护也不利于优化器。
- IN 子查询无索引列导致 nested loop 灾难。

## 总结与自测

EXISTS IN 选型；相关子查询优化；NOT IN NULL；CTE 可读性。子查询深嵌套是技术债信号。

## 原理延伸

SQL 的价值在于声明式表达「要什么数据」，优化器负责「怎么取」。同样的语义可以写成子查询、连接或窗口函数，性能却可能差一个数量级，关键在于能否利用索引与减少中间结果集。NULL 的三值逻辑、GROUP BY 与 HAVING 的分工、外连接的过滤位置，是日常 bug 高发区。学习 SQL 要与具体数据库实现对照：MySQL 8 的 CTE、窗口函数、hash join 与 optimizer hint 都会改变写法选择。养成 EXPLAIN 习惯，比 memorizing 语法更重要。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。

动手在 MySQL 客户端完整跑通文中示例，并刻意改错一种写法观察报错或计划变化。
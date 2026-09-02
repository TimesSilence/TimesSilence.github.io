---
title: "SQL常见面试题总结（2）"
date: 2019-11-21 08:40:00
updated: 2019-11-21 08:40:00
permalink: knowledge/database/sql/sql-questions-02/
categories:
  - 数据库
tags:
  - SQL
  - 聚合
  - GROUP BY
description: "SQL 面试题学习笔记（2）：聚合函数与 GROUP BY 机制。"
---

聚合题考的是「一行变多行统计」的分组边界。HAVING 与 WHERE 的分工必须讲清楚。

<!-- more -->

## 聚合函数

SUM/AVG/MAX/MIN/COUNT 对一组行归约；与 GROUP BY 联用；无 GROUP BY 时全表一行聚合。

## WHERE vs HAVING

WHERE 在分组前过滤行；HAVING 在分组后过滤组。想过滤聚合结果必须用 HAVING。

```sql
SELECT dept_id, AVG(salary) AS avg_sal
FROM employee
WHERE status = 'ACTIVE'
GROUP BY dept_id
HAVING AVG(salary) > 15000;
```

## WITH ROLLUP

生成小计/总计行，报表场景有用，注意 NULL 与 super-aggregate 标识。

## FILTER 子句

标准 SQL FILTER (WHERE ...) 部分库支持；MySQL 用 SUM(CASE WHEN...) 模拟条件聚合。

## 空组

GROUP BY 无匹配行时不返回行；需要零行报表用 LEFT JOIN 维度表。

## 实践复习清单

WHERE vs HAVING 五例；ROLLUP 报表；条件聚合 CASE；空组处理；GROUP BY 列对齐；聚合函数 NULL 行为。

## 常见坑

- SELECT 出现非聚合列却不在 GROUP BY（非 ONLY_FULL_GROUP_BY 模式埋雷）。
- 对大数据集 DISTINCT COUNT 不用近似或预聚合。

## 总结与自测

WHERE HAVING 分工；条件聚合写法；空组报表；ONLY_FULL_GROUP_BY。聚合题画「分组前后」示意图不易错。

## 原理延伸

SQL 的价值在于声明式表达「要什么数据」，优化器负责「怎么取」。同样的语义可以写成子查询、连接或窗口函数，性能却可能差一个数量级，关键在于能否利用索引与减少中间结果集。NULL 的三值逻辑、GROUP BY 与 HAVING 的分工、外连接的过滤位置，是日常 bug 高发区。学习 SQL 要与具体数据库实现对照：MySQL 8 的 CTE、窗口函数、hash join 与 optimizer hint 都会改变写法选择。养成 EXPLAIN 习惯，比 memorizing 语法更重要。

## 一句话带走

把本文要点写进你的排查 checklist，下次遇到类似问题先对照机制再动手，比临时搜索命令高效得多。

## 复习建议

隔周回顾本文小标题，合上文档用自己的话复述每个机制，并各写一条你在项目里见过的真实案例或模拟场景，记忆会牢固很多。

动手在 MySQL 客户端完整跑通文中示例，并刻意改错一种写法观察报错或计划变化。
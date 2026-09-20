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
description: "SQL 语法速查地图：查询骨架与执行顺序、连接、聚合分组、子查询、窗口函数与 DDL 约束，每类配一个典型示例。"
---

SQL 语法点零散，但骨架清晰。本文按「查询骨架、连接、聚合、子查询、窗口函数、DDL」六块组织成一张速查地图，每块讲最常用的结构和一个典型示例，供随查随用。示例以 MySQL 8.0 为准，其他数据库方言细节请对照各自文档。

<!-- more -->

## 查询骨架与执行顺序

一条完整查询的子句书写顺序是固定的，但**逻辑执行顺序**是另一套：`FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`。理解它才能解释两个经典现象：`WHERE` 里不能用聚合函数（聚合还没发生）、`WHERE` 里引用不了 `SELECT` 起的别名（列名还没诞生），而 `ORDER BY` 可以引用别名（它是最后才执行的）。

```sql
SELECT status, COUNT(*) AS cnt
FROM orders
WHERE created_at >= '2024-01-01'
GROUP BY status
HAVING COUNT(*) > 10
ORDER BY cnt DESC
LIMIT 5;
```

记忆口诀：先找表、再筛行、再分组、再筛组、定列、排序、截断。补充三个高频细节：`DISTINCT` 作用于整行（所有列都相同才去重）；`LIMIT 5, 10` 表示跳过 5 行取 10 行，offset 从 0 起；`AND` 优先级高于 `OR`，混合条件务必加括号。排查一条「结果不对」的查询时，也建议按这个顺序自顶向下走一遍：先确认 `FROM` 和 `JOIN` 拼出的行集对不对，再逐段叠加过滤、分组、排序，每一步用 `SELECT *` 小范围验证，比盯着整条 SQL 干瞪眼高效得多。

## 连接

`INNER JOIN` 只保留两表匹配的行；`LEFT JOIN` 保留左表全部行，右表无匹配则补 NULL；`RIGHT JOIN` 反之；`CROSS JOIN` 是笛卡尔积。关键语义差异在过滤条件的位置：**`ON` 决定临时表怎么拼，`WHERE` 在拼完之后过滤**。把右表条件写进 `WHERE`，左连接会悄悄退化成内连接：

```sql
-- 保留所有用户，只看 2024 年的订单（条件放 ON）
SELECT u.id, o.order_no
FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.created_at >= '2024-01-01';
```

两表关联列同名时可用 `USING(user_id)` 代替 `ON`。逗号分隔的隐式内连接写法已不推荐，条件混在 `WHERE` 里可读性差、容易漏写。表与自身比较（如员工与上级同表）用自连接，起两个别名即可。另外注意连接本身不去重：一对多关联时行数会膨胀，一个用户有十个订单，JOIN 后就变成十行，聚合前先想清楚粒度，必要时先对右表预聚合再连接。外连接补出的 NULL 行参与后续判断时遵循三值逻辑，`o.xxx = '某值'` 对这些行结果不是 TRUE 而是 NULL，同样会被过滤掉——这也是「左连接退化」的另一种隐蔽形式。

## 聚合与分组

`GROUP BY` 把多行折叠成一行，配合 `COUNT/SUM/AVG/MAX/MIN` 做汇总。两个必须记住的 NULL 语义：`COUNT(*)` 数行数，`COUNT(col)` 只数该列非 NULL 的行；`AVG(col)` 忽略 NULL（分母变小，结果可能虚高）。开启 `ONLY_FULL_GROUP_BY` 后（MySQL 5.7+ 默认），`SELECT` 里的非聚合列必须出现在 `GROUP BY` 中，否则报错——这是好事，杜绝了「每组随机取一行」的歧义结果。

```sql
-- 每个客户的订单数与消费总额，只看复购客户
SELECT cust_id, COUNT(*) AS order_cnt, SUM(amount) AS total
FROM orders
GROUP BY cust_id
HAVING COUNT(*) > 1;
```

`HAVING` 与 `WHERE` 的分工：`WHERE` 筛原始行（分组前），`HAVING` 筛聚合结果（分组后），同一条查询里可以都出现。聚合内嵌 `DISTINCT`（如 `COUNT(DISTINCT user_id)`）用于去重计数；`SUM(条件表达式)` 利用布尔转 0/1 实现条件计数，是算完成率、占比的惯用招。

## 子查询

子查询把一个 `SELECT` 的结果当作另一个语句的输入，常见两个位置。`WHERE` 中做条件来源，常配 `IN/EXISTS`：

```sql
-- 找出下过单的用户
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders);
```

`FROM` 中做派生表，相当于临时结果集，必须起别名：

```sql
-- 先按用户聚合，再筛选高消费用户
SELECT t.user_id, t.total
FROM (SELECT user_id, SUM(amount) AS total
      FROM orders GROUP BY user_id) t
WHERE t.total > 1000;
```

两个高频坑：`NOT IN` 的子查询结果若含 NULL，整个条件恒不为真，要么先过滤 NULL 要么改写 `NOT EXISTS`；相关子查询（内层引用外层列）每行都执行一次，数据量大时通常应改写为 JOIN 再对比执行计划。

## 窗口函数

窗口函数（MySQL 8.0+）在不折叠行的前提下，给每行附加一个「组内计算结果」，语法骨架是 `函数 OVER (PARTITION BY ... ORDER BY ...)`。最经典的应用是组内 Top-N：

```sql
-- 每个分类下价格最高的两件商品
SELECT category, name, price
FROM (
  SELECT category, name, price,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn
  FROM products
) t
WHERE rn <= 2;
```

排名三兄弟：`ROW_NUMBER` 强制唯一编号，`RANK` 并列同名次后跳号，`DENSE_RANK` 并列不跳号；`LAG/LEAD` 取前后行的值，做环比很方便；`SUM() OVER (ORDER BY ...)` 做滚动累计。注意窗口函数不能直接写进 `WHERE`（它在过滤之后才求值），需包一层派生表再过滤。

## DDL 与约束

DDL 负责定义结构，核心是 `CREATE/ALTER/DROP`。建表时把约束一次声明到位，比事后补救省事得多：

```sql
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  username VARCHAR(64) NOT NULL UNIQUE COMMENT '用户名',
  email VARCHAR(128) NOT NULL DEFAULT '' COMMENT '邮箱',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

常用约束：`PRIMARY KEY`（唯一且非空）、`UNIQUE`、`NOT NULL`、`DEFAULT`、`FOREIGN KEY`（参照完整性）、`CHECK`（值域检查，MySQL 8.0.16 起才真正强制）。结构变更用 `ALTER TABLE`：`ADD` 加列、`MODIFY` 改类型、`ADD INDEX` 加索引。清空全表用 `TRUNCATE TABLE`（属 DDL，不可回滚、自增归零），与带 `WHERE` 的 `DELETE`（DML，可回滚）是两回事。视图（`CREATE VIEW`）是保存下来的查询语句而非数据副本，适合固化复杂 JOIN、按列做权限隔离，但它不存数据也就无法加索引。DML 侧的 `UPDATE/DELETE` 务必带 `WHERE`，上线前先跑同条件 `SELECT` 确认影响行数。
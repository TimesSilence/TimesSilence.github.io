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
description: "SQL 面试题（1）：检索去重、排序、条件过滤、聚合分组、子查询、组合查询与深分页优化的核心考点，附可运行示例。"
---

本篇覆盖 SQL 面试的基础盘：检索与去重、排序、条件过滤、聚合分组、子查询与组合查询，外加一道深分页性能题。题目本身不难，但 NULL 语义、WHERE 与 HAVING 的分工、GROUP BY 列对齐这些细节最容易被连环追问。

<!-- more -->

## 考察地图

- **检索与排序**：DISTINCT 的作用范围、ORDER BY 多列规则与别名。
- **条件过滤**：LIKE 通配符、NULL 判断——手写题出错率最高的两个点。
- **聚合与分组**：WHERE vs HAVING、GROUP BY 列对齐、COUNT 家族辨析。
- **子查询与组合查询**：子查询的两种位置、UNION 系列的取舍。
- **性能**：LIMIT 深分页的代价与 keyset 改写。
- 建议自行查阅：基础比较运算符清单、字符串与日期函数全表（CONCAT、SUBSTRING、UPPER、DATE_FORMAT 等）——纯手册记忆内容，面试中多作为铺垫而非考点本身。

## 检索与排序

### DISTINCT 是对单列去重还是整行去重？

**结论**：对 SELECT 列表里所有列的组合整体去重，而不是只作用于紧跟其后的那一列。

**原理**：DISTINCT 的语义是「结果集行级唯一」，多列时只要组合不同就全部保留：

```sql
-- 去重的单位是 (prod_id, quantity) 这个组合
SELECT DISTINCT prod_id, quantity FROM order_items;
-- 只要 prod_id 的去重清单
SELECT DISTINCT prod_id FROM order_items;
```

常见误读是以为 `SELECT DISTINCT a, b` 只对 a 去重、顺手带上 b，执行后会发现同一个 a 配着多个 b 出现。实现上优化器通常借助临时表或排序做唯一化，行数大时成本不可忽略。

**延伸**：MySQL 里 `GROUP BY a, b` 不加聚合也能达到同样的去重效果，且有时可走索引的松散扫描；但在表达意图上，只去重就写 DISTINCT，语义更直白。DISTINCT 与多表 JOIN 连用时，若连接本身产生行扩张（一对多），先按业务键收缩再去重，通常比连接完直接 DISTINCT 全列更可控——后者的去重键会被迫放大。

> 追问：DISTINCT 和不带聚合的 GROUP BY 执行计划有何异同？提示：MySQL 8.0 之前 GROUP BY 隐式排序，之后不再保证顺序。

### ORDER BY 多列排序的规则是什么？别名能用在哪？

**结论**：多列按书写顺序逐层生效，前一列相同才比较后一列，每列可独立指定 ASC/DESC；SELECT 列别名可以在 ORDER BY 中直接使用。

**原理**：

```sql
SELECT cust_id, order_num
FROM orders
ORDER BY cust_id ASC, order_date DESC;
```

别名可用是因为逻辑执行顺序里 ORDER BY 位于 SELECT 之后。NULL 的落点容易被忽略：MySQL 升序时 NULL 排最前、降序排最后，想显式控制可以写 `ORDER BY col IS NULL, col DESC`。

**延伸**：排序键若有匹配的联合索引（如 `(cust_id, order_date)`），可以省掉 filesort；ORDER BY 加 LIMIT n 时优化器用优先队列只维护前 n 行，不必排序全量。

> 追问：`ORDER BY 1` 按列位置写和写列名有何差别？提示：可维护性，以及动态拼接时的注入风险差异。

## 条件过滤

### LIKE 的 % 和 _ 有什么区别？怎么表达「先后出现」？

**结论**：`%` 匹配任意长度（含零个）字符，`_` 恰好匹配一个字符；「两个词按顺序出现」用一个 LIKE 串表达。

**原理**：

```sql
-- 描述中含 toy
WHERE prod_desc LIKE '%toy%'
-- toy 必须先于 carrots 出现
WHERE prod_desc LIKE '%toy%carrots%'
```

`'%toy%carrots%'` 隐含顺序约束；若写成两个 LIKE 用 AND 连接，只保证两者都存在、不保证先后。注意 MySQL 不支持 SQL Server 风格的 `[charlist]` 字符集合，类似需求用 `REGEXP`；匹配字面量 `%`、`_` 时用 ESCAPE 子句转义。

**延伸**：前导 `%` 破坏最左前缀原则，普通 B+Tree 索引失效、退化为全表扫；左固定的 `LIKE 'abc%'` 等价于一个闭开区间，可以走索引范围扫描。长文本关键词检索应交给全文索引（MySQL 8 中文配 ngram 解析器）或外部搜索引擎，而不是在千万行上跑 `%keyword%`。

> 追问：`LIKE '%abc'` 这类后缀匹配还有救吗？提示：额外存储反转后的字符串并建函数索引（生成列），把后缀匹配转回前缀匹配。

### 判断空值为什么必须用 IS NULL？

**结论**：NULL 是「未知」而非空字符串或零，任何 `= NULL` 的比较结果都是 UNKNOWN，WHERE 只放行 TRUE，所以必须用 `IS NULL` / `IS NOT NULL`。

**原理**：

```sql
-- 找出未交卷的记录
SELECT * FROM exam_record WHERE submit_time IS NULL;
-- 给 NULL 一个兜底值
SELECT COALESCE(score, 0) FROM exam_record;
```

三值逻辑下连 `NULL = NULL` 都为 UNKNOWN，这就是 `WHERE col = NULL` 永远一行都查不到的原因。

**延伸**：三值逻辑还会在别处咬人：`NOT IN (子查询)` 的结果集中只要混进一个 NULL，整个条件恒不为 TRUE，直接查空——改写 `NOT EXISTS` 可规避。聚合函数普遍忽略 NULL（COUNT(列)、SUM、AVG），唯独 COUNT(*) 把 NULL 行也数进去。

> 追问：`NULL NOT IN (1, 2)` 的结果是什么？提示：UNKNOWN，行照样被过滤掉。

## 聚合与分组

### WHERE 和 HAVING 的区别是什么？

**结论**：WHERE 在分组前过滤行，HAVING 在分组后过滤组；凡是按聚合结果筛选的条件必须放进 HAVING。

**原理**：逻辑执行顺序是 FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY。WHERE 阶段聚合值尚未算出，所以 WHERE 里不允许出现聚合函数：

```sql
-- 留下总数量不小于 100 的订单
SELECT order_num
FROM order_items
GROUP BY order_num
HAVING SUM(quantity) >= 100;
```

能在 WHERE 完成的过滤尽量前置：先砍行再分组，中间结果集更小，整体更快。

**延伸**：MySQL 扩展允许 HAVING 直接引用 SELECT 别名（`HAVING total >= 100`），标准 SQL 不允许；没有 GROUP BY 时 HAVING 把全部结果当一组，语法合法但少见。实务中常见的反面教材是把普通列条件也塞进 HAVING——能写 WHERE 就写 WHERE，分组之前砍掉的每一行都是白赚的。

> 追问：`HAVING` 过滤和「先子查询聚合再 WHERE」两种写法，优化器会一视同仁吗？提示：派生表合并（derived merge）与物化的边界。

### SELECT 里的非聚合列为什么必须写进 GROUP BY？

**结论**：分组后每组只剩一行，非分组列在组内可能有多个值、无法决定取哪个；MySQL 5.7 起默认开启 ONLY_FULL_GROUP_BY，不对齐直接报错。

**原理**：

```sql
-- 报错：order_num 既不是分组键也没被聚合
SELECT c.cust_name, o.order_num, SUM(oi.quantity * oi.item_price) AS total
FROM customers c
JOIN orders o USING(cust_id)
JOIN order_items oi USING(order_num)
GROUP BY c.cust_name;
-- 正确：输出列要么聚合、要么分组
GROUP BY c.cust_name, o.order_num;
```

口诀：SELECT 中的列，要么被聚合函数包住，要么出现在 GROUP BY 里。老版本 MySQL 不报错但会「随机」取组内某行的值，结果不可复现，是隐蔽的 bug 温床。

**延伸**：按主键分组时，同表其他列由函数依赖保证唯一，标准 SQL 与 MySQL 8 都允许省略；确实不在乎取哪行时可用 `ANY_VALUE(col)` 显式声明。

> 追问：为什么按主键分组可以豁免其他列？提示：函数依赖——分组键确定则整行确定。

### COUNT(*)、COUNT(列)、COUNT(DISTINCT 列) 差在哪？

**结论**：COUNT(*) 统计全部行数（含全 NULL 行），COUNT(列) 只数该列非 NULL 的行，COUNT(DISTINCT 列) 去重后再数非 NULL 值。

**原理**：

```sql
SELECT COUNT(*) AS total_rows,
       COUNT(submit_time) AS completed,
       COUNT(DISTINCT exam_id) AS exam_kinds
FROM exam_record;
```

`submit_time` 为 NULL 表示未交卷，`COUNT(submit_time)` 利用「聚合忽略 NULL」天然数出完成次数。MySQL 还支持 `COUNT(DISTINCT a, b)` 把多列组合当整体判重，适合「活跃人天」这类口径。

**延伸**：InnoDB 没有行数缓存，COUNT(*) 要扫索引（优化器会挑最小的二级索引）；超大盘的近似计数可用 EXPLAIN 的 rows 或 information_schema 统计。条件计数另有惯用写法 `SUM(score >= 60)`。

> 追问：`COUNT(1)` 和 `COUNT(*)` 在 MySQL 里性能有差别吗？提示：优化器同等对待，纯写法之争。

## 子查询与组合查询

### WHERE 子查询和 FROM 子查询有什么不同？

**结论**：WHERE 里的子查询产出「条件值」（单列单行，或单列多行配 IN/EXISTS）；FROM 里的子查询产出「临时表」，必须起别名才能被外层引用。

**原理**：

```sql
-- WHERE 子查询：返回一组订单号作为筛选条件
SELECT cust_id FROM orders
WHERE order_num IN (
    SELECT order_num FROM order_items WHERE prod_id = 'BR01'
);

-- FROM 子查询：先按订单聚合，再回连订单表
SELECT o.cust_id, SUM(t.total) AS total_ordered
FROM orders o
JOIN (
    SELECT order_num, SUM(item_price * quantity) AS total
    FROM order_items GROUP BY order_num
) t USING(order_num)
GROUP BY o.cust_id;
```

IN 子查询在 MySQL 中常被改写成 semi-join；FROM 里的派生表默认尝试合并进外层查询，合不进去才物化成临时表。

**延伸**：相关子查询（内层引用外层列）对外层每行求值一次，行数大时是性能黑洞，优先考虑改写成 JOIN 或窗口函数。MySQL 8 起可用 CTE 把多层嵌套拉平成线性结构，配合 JOIN 语义往往一举两得：既清晰又给了优化器更多改写空间。

> 追问：EXISTS 和 IN 在子查询含 NULL、内外表体量悬殊时表现有何差异？提示：EXISTS 的短路语义与 NULL 安全性。

### UNION 和 UNION ALL 怎么选？ORDER BY 写在哪？

**结论**：UNION 合并后去重，UNION ALL 原样拼接；确定无重复或允许重复时一律 UNION ALL。ORDER BY 只能写在最后、作用于整个合并结果。

**原理**：UNION 要对合并结果建临时表做唯一化，代价随行数增长；UNION ALL 是纯追加。规则上各分支列数必须一致、类型兼容，列名取第一个 SELECT：

```sql
SELECT prod_id, quantity FROM order_items WHERE quantity = 100
UNION ALL
SELECT prod_id, quantity FROM order_items WHERE prod_id LIKE 'BNBG%'
ORDER BY prod_id;
```

同一张表的两个条件，多数情况一条 `WHERE a OR b` 就能解决，不必动用 UNION。

**延伸**：OR 两侧命中不同索引时，拆成 UNION ALL 两次索引扫描有时比一次全表更快——MySQL 自身的 index merge union 优化也在做类似的事，但是否生效要看 EXPLAIN。

> 追问：想让每个分支各自取 Top-N 再合并怎么办？提示：分支包成派生表并配 LIMIT，或改用窗口函数。

## 性能

### LIMIT 深分页为什么慢？怎么优化？

**结论**：`LIMIT 1000000, 20` 要扫出一百万零二十行再丢弃前一百万，offset 越大越慢；改用 keyset（游标）分页把代价压回与页大小同阶。

**原理**：

```sql
-- 反例：深分页
SELECT * FROM product ORDER BY id LIMIT 1000000, 20;
-- keyset：记住上一页末尾的 id，直接从它之后取
SELECT * FROM product WHERE id > :last_id ORDER BY id LIMIT 20;
```

keyset 利用索引有序性直接定位起点，耗时与页码无关。代价是只能「下一页」、不能跳页，且排序键必须唯一——不唯一时追加主键做 tiebreaker。

**延伸**：折中方案是「延迟关联」：先用覆盖索引取出本页 20 个主键，再回表捞整行，把昂贵的回表只施加在最终 20 行上，而不是被丢弃的一百万行。产品层面「跳到第 500 页」多是伪需求，改成「加载更多」往往两全；必须跳页时，也可以限制最大页码或走搜索引擎。

> 追问：排序键是 create_time 且大量同值时，keyset 条件怎么写才不漏不重？提示：`(create_time, id) > (?, ?)` 元组比较。
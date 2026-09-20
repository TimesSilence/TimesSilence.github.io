---
title: "MySQL索引失效场景总结"
date: 2020-02-28 09:57:00
updated: 2020-02-28 09:57:00
permalink: knowledge/database/mysql/mysql-index-invalidation/
categories:
  - 数据库
tags:
  - MySQL
  - 索引失效
description: "从 B+ 树有序性出发，逐类拆解函数运算、隐式转换、前导模糊、OR 条件、范围后列与 IS NULL 误区的失效原理、反例 SQL 与正确写法。"
---

索引失效并不玄学，绝大多数场景都能归结到一个判断：查询条件还能不能利用 B+ 树的有序性做定位。本文按"反例 SQL、失效原理、正确写法"拆解六类高频场景。

<!-- more -->

## 索引为什么会失效：一切从 B+ 树有序性说起

B+ 树索引能加速查询，靠的是"键值有序"：叶子节点按键从左到右排好，查找时二分定位起点，再顺链表做范围扫描。一旦 SQL 写法让"索引里存的有序值"和"查询要比较的值"对不上号，优化器只能放弃索引。拿到一条慢 SQL，先问：这个条件还能借索引的有序性定位吗？

## 场景一：对索引列做函数或运算

反例：

```sql
SELECT * FROM orders WHERE DATE(create_time) = '2026-01-01';
SELECT * FROM user WHERE age + 1 = 30;
```

失效原理：索引里存的是 `create_time` 的原始值，按时间有序排列。`DATE(create_time)` 要把每一行的原始值算一遍，计算结果在索引树中根本不存在，更谈不上有序，二分查找无从下手。这等价于给索引列套了一层函数，而优化器无法把函数结果反推回原始值所在的区间。

正确写法：把计算挪到常量一侧，把函数改写成范围条件。

```sql
SELECT * FROM orders WHERE create_time >= '2026-01-01' AND create_time < '2026-01-02';
SELECT * FROM user WHERE age = 29;
```

## 场景二：隐式类型转换

反例（`phone` 是 VARCHAR 类型）：

```sql
SELECT * FROM user WHERE phone = 13800138000;
```

失效原理：字符串和数字比较时，MySQL 会把字符串转成浮点数再比，实际执行的是 `CAST(phone AS DOUBLE) = 13800138000`，转换落在列上，本质与场景一相同。而且 `'13800138000'`、`'013800138000'` 转换后结果相同，索引里的字符串顺序对转换后的数字毫无意义。

正确写法：让条件类型与列类型严格一致。

```sql
SELECT * FROM user WHERE phone = '13800138000';
```

## 场景三：LIKE 前导通配符

反例：

```sql
SELECT * FROM user WHERE name LIKE '%三';
```

失效原理：字符串索引按从左到右的字典序排列，`'张%'` 能用索引是因为前缀固定、起点可二分；`'%三'` 的开头不确定，匹配项可能散布在整棵树的任何位置，有序性完全帮不上忙。

正确写法：能前缀匹配就前缀匹配；必须全模糊时，让查询列被索引覆盖（此时是 index 级别的全索引扫描，至少不回表），核心搜索业务交给 Elasticsearch 这类搜索引擎。

```sql
SELECT * FROM user WHERE name LIKE '张%';
```

## 场景四：OR 条件一侧无索引

反例（`address` 列没有索引）：

```sql
SELECT * FROM user WHERE name = '张三' OR address = '上海';
```

失效原理：OR 的语义是"两侧满足其一即可"。`name` 走索引只能捞出满足左条件的行，右条件没有索引就得逐行验证，整体仍绕不开全表扫描。即使两侧都有索引，也只是可能走 index merge 取并集，当两侧命中比例都很高、合并成本超过全表扫描时，索引同样被放弃。

正确写法：确保 OR 两侧条件列都有索引，或改写为 UNION ALL 让每段独立走索引。

```sql
SELECT * FROM user WHERE name = '张三'
UNION ALL
SELECT * FROM user WHERE address = '上海';
```

## 场景五：范围查询之后的列用不上

反例（联合索引为 `(a, b, c)`）：

```sql
SELECT * FROM t WHERE a = 1 AND b > 10 AND c = 100;
```

失效原理：联合索引先按 a、再按 b、最后按 c 排序——c 有序的前提是"在同一组 a、b 值之内"。b 变成范围后，命中区间里 b 值各不相同，c 便无序，无法再精确定位。但 c 并未完全作废：5.6 起可作为索引下推（ICP）条件在扫描中提前过滤，减少回表。

正确写法：设计联合索引时把等值列放前、范围列放后，例如针对这条 SQL 建 `(a, c, b)`，让三列都能参与定位。

## 场景六：IS NULL 的误解

"IS NULL 不走索引"是流传很广的误说法：

```sql
SELECT * FROM user WHERE name IS NULL;
```

B+ 树把 NULL 视为最小值，照常参与排序，`IS NULL` 完全可能走 ref 类型的索引访问。真正左右结果的是数据分布：如果表中大部分行的 `name` 都是 NULL，优化器估算"索引扫描加回表"的成本高于全表扫描时，会主动放弃索引——这是成本决策，不是 IS NULL 本身让索引失效。`IS NOT NULL`、`!=`、`NOT IN` 在命中占比过大时被放弃，同属此逻辑。

## 实践建议

- 写完 SQL 必看 EXPLAIN：重点看 type、key、rows、Extra。key 非空只代表用了某个索引，rows 与 Extra 里的 Using where、Using filesort 才暴露真实成本。
- 失效先归类再动手：写法破坏有序性（函数、隐式转换、前导通配），还是优化器主动放弃（回表成本高、统计信息过期）？后者可先 ANALYZE TABLE 再观察。
- 联合索引遵循"等值在前、范围在后"；高频 OR 查询优先改写为 UNION ALL。

## 小结

索引失效可归为两大类：一类是 SQL 写法破坏了 B+ 树有序性——函数运算、隐式转换、前导通配、范围后的列，索引"用不了"；另一类是优化器基于成本主动放弃——OR 一侧无索引、命中比例过高，索引"不想用"。前者改写 SQL 即可解决，后者要从索引设计与统计信息入手。

**面试追问**：

1. `LIKE 'abc%'` 和 `= 'abc'` 走索引的方式有何不同？（前者是 range 范围扫描，后者是 ref/const 精确查找）
2. 联合索引 `(a,b,c)` 下 `WHERE a=1 AND b>2 AND c=3`，c 列完全没用了吗？（不能用于定位，但 5.6+ 可通过 ICP 在扫描中过滤）
3. EXPLAIN 中 key 有值为什么查询还是慢？（key 只说明用了索引，还要看 rows 扫描量级与 Extra 是否有 filesort、临时表）
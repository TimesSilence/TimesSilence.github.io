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
description: "SQL 面试题学习笔记（5）：NULL 空值处理、CASE WHEN 条件统计、正则筛选、分页与文本函数的综合实战。"
---

本篇围绕四个实战高频主题展开：NULL 的统计语义、`CASE WHEN` 条件表达式、精确模式匹配与分页、文本拆分与归一化。它们单看都是小知识点，组合起来就是业务 SQL 的日常。

<!-- more -->

## 考察地图

- **空值处理**：未完成数与完成率的多种写法、平均值统计中的 NULL 兜底。考察对 `COUNT` 不计 NULL、三值逻辑的理解。
- **条件统计与筛选**：得分等级占比、跨表最近活跃筛选、正则匹配。考察 `CASE WHEN` 与 `LIKE/REGEXP` 的选型。
- **分页**：`LIMIT offset, size` 取第 N 页。考察深分页意识。
- **文本函数**：串列字段拆分、大小写归并。考察 `SUBSTRING_INDEX`、`UPPER` 配合自连接。
- 建议自行查阅：「根据指定记录是否存在输出不同结果」（CTE 加 `UNION ALL` 做分支输出，属困难题）——掌握本篇后可自行推演。

## 空值处理

### 统计未完成数和未完成率有哪几种写法？

**结论**：三种等价思路——`COUNT(*)` 减 `COUNT(列)`、`COUNT(CASE WHEN ... THEN 1 END)`、`SUM(条件表达式)`，核心都是利用「聚合函数忽略 NULL」或「布尔表达式转 0/1」。

**原理**：`COUNT(*)` 数行数，`COUNT(submit_time)` 只数该列非 NULL 的行，差值即未完成数，这是最简洁的写法。`CASE WHEN` 写法显式构造「满足条件为 1、否则为 NULL」再计数，语义最直白、可移植性最好。`SUM(submit_time IS NULL)` 则利用 MySQL 把布尔结果当 1/0 处理的特性：

```sql
SELECT exam_id,
       SUM(submit_time IS NULL) AS incomplete_cnt,
       ROUND(SUM(submit_time IS NULL) / COUNT(*), 3) AS incomplete_rate
FROM exam_record
GROUP BY exam_id
HAVING incomplete_cnt > 0;
```

**延伸**：「有未完成记录才输出」用 `HAVING` 在聚合后过滤。这套「条件计数」组合拳——`SUM(条件)`、`COUNT(IF(条件,1,NULL))`——是计算完成率、转化率、占比类指标的通用模板，务必练到肌肉记忆。

> 追问：`COUNT(1)` 和 `COUNT(*)` 有性能差别吗？提示：InnoDB 下语义和优化后执行基本一致，`COUNT(列)` 才因 NULL 判断而不同。

### 平均值统计时如何给 NULL 兜底？

**结论**：先在外层查询前用 `IF` 或 `IFNULL` 把 NULL 替换成业务默认值（未交卷按试卷时长、按 0 分），再做 `AVG`。

**原理**：`AVG` 会跳过 NULL 行，导致分母变小、结果虚高——「平均用时」如果把未完成的记录直接丢掉，剩下的全是认真答完的人，指标失真。正确做法是在明细层完成替换，让每条记录都参与平均：

```sql
SELECT er.uid,
       ROUND(AVG(new_score), 0) AS avg_score,
       ROUND(AVG(time_took), 1) AS avg_time_took
FROM (
  SELECT er.uid,
         IF(er.submit_time IS NOT NULL, er.score, 0) AS new_score,
         IF(er.submit_time IS NOT NULL,
            TIMESTAMPDIFF(MINUTE, er.start_time, er.submit_time),
            ef.duration) AS time_took
  FROM exam_record er
  JOIN user_info uf ON er.uid = uf.uid
  JOIN examination_info ef ON er.exam_id = ef.exam_id
  WHERE uf.level = 0 AND ef.difficulty = 'hard'
) t
GROUP BY er.uid;
```

**延伸**：`IFNULL(col, 0)` 是 `IF(col IS NOT NULL, col, 0)` 的简写；多列依次兜底用 `COALESCE(a, b, 0)`。选哪个取决于是否要区分「NULL」与「条件不满足」。

> 追问：`NULL + 1`、 `NULL = NULL` 各返回什么？提示：都是 NULL，比较 NULL 要用 `IS NULL` 或空值安全等于 `<=>`。

## 条件统计与筛选

### 如何用 CASE WHEN 做分级占比统计？

**结论**：`CASE WHEN` 把分数映射成等级标签，按「用户等级 + 分数等级」分组计数，再除以该用户等级的总数得到占比。

**原理**：`CASE WHEN` 按顺序匹配、命中即返回，所以分界点写法 `[90,75,60]` 从大到小判断即可，无需写双边区间。占比的分母是「同一 level 的完成总数」，单独用一个派生表算再 JOIN 回来：

```sql
SELECT g.level, g.score_grade,
       ROUND(g.cnt / t.total, 3) AS ratio
FROM (
  SELECT b.level,
         CASE WHEN a.score >= 90 THEN '优'
              WHEN a.score >= 75 THEN '良'
              WHEN a.score >= 60 THEN '中'
              ELSE '差' END AS score_grade,
         COUNT(*) AS cnt
  FROM exam_record a
  JOIN user_info b ON a.uid = b.uid
  WHERE a.submit_time IS NOT NULL
  GROUP BY b.level, score_grade
) g
JOIN (
  SELECT b.level, COUNT(*) AS total
  FROM exam_record a
  JOIN user_info b ON a.uid = b.uid
  WHERE a.submit_time IS NOT NULL
  GROUP BY b.level
) t ON g.level = t.level
ORDER BY g.level DESC, ratio DESC;
```

**延伸**：MySQL 8.0 可以把分母写成 `SUM(COUNT(*)) OVER (PARTITION BY level)`，省掉一次自 JOIN。行转列（每个等级一列）则用 `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` 透视。

> 追问：`CASE` 的两种形态（简单式 `CASE col WHEN v` 与搜索式 `CASE WHEN cond`）能混用吗？提示：不能，简单式只能做等值比较。

### 跨表「最近一次活跃」怎么筛选？

**结论**：用户表 LEFT JOIN 两类活跃记录表，条件用 `OR` 合并两个表的月份判断，命中即保留。

**原理**：「试卷区或题目区任一在 9 月活跃」是跨表 OR 条件。用 LEFT JOIN 而非 INNER JOIN 是为了不漏掉「只在一个区活跃」的用户；两表一对多会造成用户行膨胀，最后 `DISTINCT` 去重。昵称前缀加后缀的模式 `LIKE '牛客%号'`、数值区间 `BETWEEN 1200 AND 2500` 直接放在 `WHERE`：

```sql
SELECT DISTINCT u.uid, u.nick_name, u.achievement
FROM user_info u
LEFT JOIN exam_record er ON er.uid = u.uid
LEFT JOIN practice_record pr ON pr.uid = u.uid
WHERE u.nick_name LIKE '牛客%号'
  AND u.achievement BETWEEN 1200 AND 2500
  AND (DATE_FORMAT(er.submit_time, '%Y%m') = '202109'
       OR DATE_FORMAT(pr.submit_time, '%Y%m') = '202109');
```

**延伸**：LEFT JOIN 后把右表条件写进 `WHERE`（如 `er.submit_time IS NOT NULL`）会把左连接退化回内连接，这是高频 bug。要让条件不破坏左表完整性，应写进 `ON` 子句。

> 追问：这里的 `DATE_FORMAT(列)` 会让索引失效吗？提示：对列套函数通常无法走索引，数据量大时改用范围比较。

### 精确模式匹配为什么用 REGEXP 而不是 LIKE？

**结论**：`LIKE` 只有 `%` 和 `_` 两个通配符，表达不了「纯数字」「数字串」这类字符类约束；`REGEXP`（别名 `RLIKE`）用正则精确描述模式。

**原理**：「昵称是牛客+纯数字+号，或纯数字」用 `LIKE '牛客%号'` 会把「牛客 H 号」也放进来——`%` 匹配任意字符。正则 `^牛客[0-9]+号$` 用 `[0-9]+` 限定数字段，`^`/`$` 锚定首尾；「c 开头的类别（兼容大小写）」写 `^[cC]`：

```sql
SELECT er.uid, er.exam_id, ROUND(AVG(er.score), 0) AS avg_score
FROM exam_record er
WHERE er.score IS NOT NULL
  AND er.uid IN (
    SELECT uid FROM user_info
    WHERE nick_name REGEXP '^牛客[0-9]+号$'
       OR nick_name REGEXP '^[0-9]+$'
  )
  AND er.exam_id IN (
    SELECT exam_id FROM examination_info
    WHERE tag REGEXP '^[cC]'
  )
GROUP BY er.uid, er.exam_id
ORDER BY er.uid, avg_score;
```

**延伸**：MySQL 8.0 正则引擎换成了 ICU，支持 `REGEXP_LIKE` 等函数和更完整的语法；`LIKE` 的优势是简单模式可走索引（前缀匹配），`REGEXP` 则一律全扫，性能敏感场景权衡使用。

> 追问：`LIKE 'c%'` 在默认 utf8mb4  collation 下能匹配 'C++' 吗？提示：默认 `ci` 结尾排序规则不区分大小写，能匹配——这正是题目改用正则的原因。

## 分页

### 取第 N 页数据怎么写？

**结论**：`LIMIT offset, size`——第 3 页、每页 3 条即 `LIMIT 6, 3`，offset 从 0 起算，公式是 `(页码 - 1) * 每页条数`。

**原理**：先按业务口径筛人（求职方向为算法、注册当天完成算法类试卷），按最高分排序后再截页。排序键有并列时结果不稳定，最好追加唯一键做决胜：

```sql
SELECT u.uid, u.level, u.register_time, MAX(t.score) AS max_score
FROM exam_record t
JOIN examination_info ei ON t.exam_id = ei.exam_id
JOIN user_info u ON t.uid = u.uid
    AND DATE(t.submit_time) = DATE(u.register_time)
WHERE u.job = '算法' AND ei.tag = '算法'
GROUP BY u.uid, u.level, u.register_time
ORDER BY max_score DESC, u.uid
LIMIT 6, 3;
```

**延伸**：`LIMIT 100000, 20` 这类深分页会扫描并丢弃前十万行，线上常见优化是「游标分页」——记住上一页最后一条的排序键，下一页用 `WHERE id > 上次值 LIMIT 20`，把偏移扫描变成索引定位。

> 追问：为什么深分页慢？提示：offset 不是跳过而是「取出来再扔掉」，代价随页码线性增长。

## 文本函数

### 串列的字段怎么拆分修复？

**结论**：`SUBSTRING_INDEX(str, ',', n)` 按分隔符截取，正数从左数、负数从右数；取中间段用两次嵌套。

**原理**：录错的行把 `tag,difficulty,duration` 三个值挤进了 tag 列。第一段是 `SUBSTRING_INDEX(tag, ',', 1)`；最后一段是 `SUBSTRING_INDEX(tag, ',', -1)`；中间那段先取「前两段」再从中取「最后一段」：

```sql
SELECT exam_id,
       SUBSTRING_INDEX(tag, ',', 1) AS tag,
       SUBSTRING_INDEX(SUBSTRING_INDEX(tag, ',', 2), ',', -1) AS difficulty,
       SUBSTRING_INDEX(tag, ',', -1) AS duration
FROM examination_info
WHERE difficulty = '';
```

**延伸**：识别脏数据用 `difficulty = ''` 这个特征。更通用的按位置取第 N 段可以写成 `SUBSTRING_INDEX(SUBSTRING_INDEX(col, ',', N), ',', -1)`。这类「一列存多值」本身就是反范式设计，修复后应改表结构，而不是长期依赖字符串函数兜底。

> 追问：拆分出的 duration 是字符串类型，比较大小时会怎样？提示：按字典序而非数值序，需要 `CAST(... AS UNSIGNED)`。

### 大小写混乱的维度怎么归并统计？

**结论**：`UPPER()`/`LOWER()` 统一大小写；要把「小写形式的作答数」挂到「已存在的大写形式」上，用同一张聚合结果表自连接。

**原理**：先按原始 tag 分组算出每个形态的作答数（CTE `a`），再让 `a` 与自身连接：连接条件是 `UPPER(a.tag) = b.tag AND a.tag <> b.tag`，即「a 是小写形态、b 是它对应的大写形态」。配上「作答数小于 3」的筛选，就实现了「冷门的小写形态归并到大写形态的口径下展示」：

```sql
WITH a AS (
  SELECT ei.tag, COUNT(er.start_time) AS answer_cnt
  FROM exam_record er
  JOIN examination_info ei ON er.exam_id = ei.exam_id
  GROUP BY ei.tag
)
SELECT a.tag, b.answer_cnt
FROM a
JOIN a AS b ON UPPER(a.tag) = b.tag AND a.tag <> b.tag
WHERE a.answer_cnt < 3;
```

**延伸**：注意默认 collation 不区分大小写，`a.tag = b.tag` 判断「形态不同」时可能误判，所以用 `UPPER()` 转换后的等值加原始值不等来锁定「同词不同形」。根治方案是入库前统一规范化，或在列上显式指定 `COLLATE utf8mb4_bin` 让大小写敏感。

> 追问：自连接里如果同一词存在三种形态（c++、C++、C++ 带空格）会发生什么？提示：会产生多对多匹配，需先用 `TRIM`/`UPPER` 规范化再聚合。

### 超长昵称怎么截断展示（LENGTH 与 CHAR_LENGTH 的区别）？

**结论**：`CHAR_LENGTH` 数字符数、`LENGTH` 数字节数；多字节字符集下判断「昵称长度」必须用 `CHAR_LENGTH`，截取用 `SUBSTR` 加 `CONCAT` 补省略号。

**原理**：utf8mb4 编码下一个汉字占 3 字节、emoji 占 4 字节，`LENGTH('你好')` 返回 6 而 `CHAR_LENGTH('你好')` 返回 2——用错函数，中文昵称的长度判断直接偏三倍。需求「字符数大于 10 输出、大于 13 截前 10 字符加省略号」用 `CASE WHEN` 分层处理：

```sql
SELECT uid,
       CASE WHEN CHAR_LENGTH(nick_name) > 13
            THEN CONCAT(SUBSTR(nick_name, 1, 10), '...')
            ELSE nick_name END AS nick_name
FROM user_info
WHERE CHAR_LENGTH(nick_name) > 10;
```

**延伸**：`SUBSTR` 按字符取子串，与 `CHAR_LENGTH` 口径一致，不会出现截断半个汉字产生乱码的问题。展示层的截断更推荐放在应用代码里做，SQL 只做取数；不得不在 SQL 做时，注意截断后的列不要再参与 `WHERE` 或 `JOIN`。

> 追问：什么场景反而必须关心字节长度？提示：索引最大长度限制（InnoDB 767/3072 字节）、协议报文字段上限、存储成本估算。
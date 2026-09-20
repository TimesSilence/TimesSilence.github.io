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
description: "SQL 面试题学习笔记（4）：窗口函数专场——分组 Top-N、相邻行偏移、累计聚合与排名变化的高频考题拆解。"
---

本篇是窗口函数专场。MySQL 8.0 起支持的 `ROW_NUMBER`、`LEAD`、`SUM() OVER` 等函数，把「组内排名、相邻行比较、累计汇总」这三类曾经要靠自连接硬凑的需求变成了常规操作，也是 SQL 面试中区分度最高的一组题。以下七道题均可在 MySQL 8.0 环境直接运行，建议先自己动手写一遍再对照解析。

<!-- more -->

## 考察地图

- **分组排名**：每类试卷得分前三名、完成次数的同比增长率与排名变化。考察 `PARTITION BY` 分区排序和 `RANK` 并列语义。
- **相邻行偏移**：连续两次作答的最大时间窗。考察用 `LEAD` 把「下一行」搬到当前行做差值的建模思路。
- **聚合窗口**：min-max 归一化、每月作答数与截止当月累计。考察在保留明细行的前提下叠加汇总值。
- **月份口径排名**：近三个有作答记录的月份中无未完成试卷的用户。考察 `DENSE_RANK` 按月份去重排名。
- 建议自行查阅：「未完成率较高 50% 用户的月度统计」（`PERCENT_RANK` 划水位加双派生表拼接）——属困难题，吃透下面七道后可独立攻克。

## 分组排名

### 如何取每个分组的前 N 名（每类试卷得分前三名）？

**结论**：先 `GROUP BY` 算出每个用户在每类试卷上的成绩指标，再用 `ROW_NUMBER() OVER (PARTITION BY 分组)` 编号，外层过滤编号小于等于 N 的行。

**原理**：这是 Top-N per group 的标准套路，关键在于窗口函数不能直接出现在 `WHERE` 里——它在逻辑执行顺序上晚于过滤阶段，所以必须包一层派生表或 CTE，把编号物化成普通列再筛。排序规则有并列处理要求时（最大分相同比最小分，再相同比 uid），全部写进 `OVER` 的 `ORDER BY` 即可：

```sql
SELECT tag, uid, ranking
FROM (
  SELECT b.tag,
         a.uid,
         ROW_NUMBER() OVER (
           PARTITION BY b.tag
           ORDER BY MAX(a.score) DESC, MIN(a.score) DESC, a.uid DESC
         ) AS ranking
  FROM exam_record a
  JOIN examination_info b ON a.exam_id = b.exam_id
  WHERE a.score IS NOT NULL
  GROUP BY b.tag, a.uid
) t
WHERE ranking <= 3;
```

**延伸**：注意未交卷（score 为 NULL）的记录要先过滤，否则 `MAX(score)` 会把它们排除在外但行仍参与分组，语义就偏了。MySQL 5.7 没有窗口函数时只能用用户变量模拟行号，又脆又慢，这也是升级 8.0 的实打实收益。性能上，窗口计算通常伴随一次排序，`PARTITION BY` 和 `ORDER BY` 的列若能命中索引顺序，可以显著减少 filesort 的代价，大表上写完记得 `EXPLAIN` 确认。

> 追问：`ROW_NUMBER` 换成 `RANK` 结果会有什么变化？提示：并列时 `RANK` 给同名次并跳号，`ROW_NUMBER` 强制唯一，取前三名的语义完全不同。

### 如何计算同比增长率和排名变化？

**结论**：用条件聚合（`COUNT(IF(条件, 1, NULL))`）在一张表里同时算出两年同期的量，再用两个 `RANK() OVER` 分别对两年排名，排名差即变化量。

**原理**：窗口函数的 `ORDER BY` 里可以直接放聚合表达式，`RANK() OVER (ORDER BY COUNT(...) DESC)` 等价于「按聚合结果排名」。增长率拼接百分比字符串时注意除零，所以外层加 `cnt_20 <> 0 AND cnt_21 <> 0` 只保留两年都有数据的维度；排名差可能出现负数，窗口函数返回值是无符号语义，需要 `CAST(... AS SIGNED)` 再相减：

```sql
SELECT tag, cnt_20, cnt_21,
       CONCAT(ROUND(100 * (cnt_21 - cnt_20) / cnt_20, 1), '%') AS growth_rate,
       rank_20, rank_21,
       CAST(rank_21 AS SIGNED) - CAST(rank_20 AS SIGNED) AS rank_delta
FROM (
  SELECT b.tag,
         COUNT(IF(YEAR(a.start_time) = 2020 AND MONTH(a.start_time) <= 6, 1, NULL)) AS cnt_20,
         COUNT(IF(YEAR(a.start_time) = 2021 AND MONTH(a.start_time) <= 6, 1, NULL)) AS cnt_21,
         RANK() OVER (ORDER BY COUNT(IF(YEAR(a.start_time) = 2020 AND MONTH(a.start_time) <= 6, 1, NULL)) DESC) AS rank_20,
         RANK() OVER (ORDER BY COUNT(IF(YEAR(a.start_time) = 2021 AND MONTH(a.start_time) <= 6, 1, NULL)) DESC) AS rank_21
  FROM examination_info b
  JOIN exam_record a ON a.exam_id = b.exam_id
  WHERE a.submit_time IS NOT NULL
  GROUP BY b.tag
) main
WHERE cnt_20 <> 0 AND cnt_21 <> 0
ORDER BY growth_rate DESC, rank_21 DESC;
```

**延伸**：`COUNT(IF(...))` 利用了 `IF` 不满足时返回 NULL、`COUNT` 不计 NULL 的组合拳，是 MySQL 里「一行算多个口径」的惯用写法，比两次扫描再 JOIN 干净得多。

> 追问：如果要算「环比上个月」而不是「同比去年」，窗口函数层面有更直接的工具吗？提示：`LAG(cnt) OVER (ORDER BY month)` 拿上一期值。

### 如何取出「第二名」做比较（第二快与第二慢用时之差）？

**结论**：同一张表上开两个 `ROW_NUMBER`——一个按用时升序、一个按降序——再用 `MAX(IF(rn = 2, 值, 0))` 把第二名捞到组内一行，最后 `HAVING` 比较。

**原理**：单次排名只能定义一种顺序，「第二快」和「第二慢」是两个独立口径，所以各开一个窗口。捞取时不能用 `WHERE rn = 2`（会把另一口径的行过滤掉），而是按试卷分组后用条件聚合「压平」：

```sql
SELECT a.exam_id, b.duration, b.release_time
FROM (
  SELECT exam_id,
         ROW_NUMBER() OVER (PARTITION BY exam_id
                            ORDER BY TIMESTAMPDIFF(SECOND, start_time, submit_time) DESC) AS rn_slow,
         ROW_NUMBER() OVER (PARTITION BY exam_id
                            ORDER BY TIMESTAMPDIFF(SECOND, start_time, submit_time) ASC)  AS rn_fast,
         TIMESTAMPDIFF(SECOND, start_time, submit_time) AS cost_sec
  FROM exam_record
  WHERE submit_time IS NOT NULL
) a
JOIN examination_info b ON a.exam_id = b.exam_id
GROUP BY a.exam_id, b.duration, b.release_time
HAVING (MAX(IF(rn_slow = 2, cost_sec, 0)) - MAX(IF(rn_fast = 2, cost_sec, 0))) / 60 > b.duration / 2
ORDER BY a.exam_id DESC;
```

**延伸**：「组内第 K 名的值」这类需求都可以套「窗口编号 + 条件聚合压平」的模子，例如求每个部门第二高薪资。它也解释了为什么窗口函数常和 `GROUP BY` 同层出现：一个负责行内定位，一个负责汇总裁决。

> 追问：为什么这里过滤条件写在 `HAVING` 而不是 `WHERE`？提示：`MAX(IF(...))` 是聚合结果，逻辑上在分组之后才可求值。

## 相邻行偏移

### 如何比较当前行与相邻行（连续两次作答的最大时间窗）？

**结论**：`LEAD(start_time) OVER (PARTITION BY uid ORDER BY start_time)` 把下一次作答时间拉到当前行，`DATEDIFF` 求间隔，再按用户聚合取最大值。

**原理**：「连续两次」本质是相邻行的差值。没有 `LAG/LEAD` 时只能自连接「id 大 1 的行」，在乱序、有缺失的真实表里极其痛苦。拿到 `next_time` 后，最大时间窗是 `MAX(DATEDIFF(next_time, start_time)) + 1`（天数含头含尾所以加一）；平均做题密度则用总次数除以首末作答跨度，再乘上最大窗口天数：

```sql
SELECT uid,
       MAX(DATEDIFF(next_time, start_time)) + 1 AS days_window,
       ROUND(COUNT(start_time) / (DATEDIFF(MAX(start_time), MIN(start_time)) + 1)
             * (MAX(DATEDIFF(next_time, start_time)) + 1), 2) AS avg_exam_cnt
FROM (
  SELECT uid, start_time,
         LEAD(start_time, 1) OVER (PARTITION BY uid ORDER BY start_time) AS next_time
  FROM exam_record
  WHERE YEAR(start_time) = 2021
) t
GROUP BY uid
HAVING COUNT(DISTINCT DATE(start_time)) > 1
ORDER BY days_window DESC, avg_exam_cnt DESC;
```

**延伸**：最后一行的 `next_time` 是 NULL，`DATEDIFF` 得 NULL，`MAX` 聚合时自动忽略，无需特判。`LEAD(expr, n, default)` 的第三参数可以给越界行指定默认值，做「距离下一次还有几天」类报表时很好用。

> 追问：把 `LEAD` 换成 `LAG` 改写同一需求，`ORDER BY` 方向要怎么调？提示：方向反转，差值取负或调头。

## 聚合窗口

### 如何在不折叠行的前提下做 min-max 归一化？

**结论**：`MAX(score) OVER (PARTITION BY exam_id)` 与 `MIN` 同理，给每条明细行附上组内最大最小值，再按 `(score - min) / (max - min)` 线性映射。

**原理**：归一化需要「每行的分」和「整组的极值」同时可见，`GROUP BY` 会丢掉明细行，聚合窗口正好补上。边界情况是组内只有一个分数时 `max = min`，分母为零，必须用 `IF` 短路，按约定直接保留原分：

```sql
SELECT uid, exam_id,
       ROUND(SUM(new_score) / COUNT(score), 0) AS avg_new_score
FROM (
  SELECT uid, exam_id, score,
         IF(max_score = min_score, score,
            (score - min_score) / (max_score - min_score) * 100) AS new_score
  FROM (
    SELECT a.uid, a.exam_id, a.score,
           MAX(a.score) OVER (PARTITION BY a.exam_id) AS max_score,
           MIN(a.score) OVER (PARTITION BY a.exam_id) AS min_score
    FROM exam_record a
    JOIN examination_info b ON a.exam_id = b.exam_id
    WHERE b.difficulty = 'hard' AND a.score IS NOT NULL
  ) t
) t1
GROUP BY uid, exam_id
ORDER BY exam_id, avg_new_score DESC;
```

**延伸**：三层派生表看着深，其实每层职责单一——贴极值、算新分、按人聚合。这类「窗口 + 再聚合」的嵌套是报表 SQL 的常态，用 CTE 改写可读性会更好。

> 追问：归一化换成「组内排名百分位」该用哪个窗口函数？提示：`PERCENT_RANK()` 或 `CUME_DIST()`，语义不同注意区分。

### 如何求每月数量和截止当月的累计值？

**结论**：先按月分组得到 `month_cnt`，再对这个计数开 `SUM() OVER (ORDER BY 月份)` 做滚动累加。

**原理**：`SUM(COUNT(*)) OVER (...)` 里嵌套聚合是合法且常用的写法——`COUNT(*)` 是分组聚合的结果，`SUM() OVER` 再按月份顺序把各行累加。默认帧是从分组起点到当前行，正好是「截止当月」的语义：

```sql
SELECT exam_id,
       DATE_FORMAT(start_time, '%Y%m') AS start_month,
       COUNT(*) AS month_cnt,
       SUM(COUNT(*)) OVER (PARTITION BY exam_id
                           ORDER BY DATE_FORMAT(start_time, '%Y%m')) AS cum_exam_cnt
FROM exam_record
GROUP BY exam_id, DATE_FORMAT(start_time, '%Y%m');
```

**延伸**：帧（frame）子句决定累计范围：`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` 是默认行为；要算「近三个月移动平均」则改成 `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`。`RANGE` 帧会把排序值相同的行（peer）一起纳入，月份有并列时结果与 `ROWS` 不同，写之前想清楚业务要哪种。

> 追问：为什么累计列的 `ORDER BY` 直接用了 `DATE_FORMAT` 的字符串？提示：`%Y%m` 格式字典序与时间序一致，换 `%Y-%m` 也成立，但 `%d-%m` 就错了。

## 月份口径排名

### 如何圈定「最近 N 个有记录的月份」再统计？

**结论**：`DENSE_RANK() OVER (PARTITION BY uid ORDER BY 月份 DESC)` 给每个用户的活跃月份编组内名次（同月共享名次），外层取名次不超过 N 的行再聚合。

**原理**：「近三个有作答记录的月份」是按月份去重后的排名，不是按行排名。`ROW_NUMBER` 会让同月多条记录各占一个号，三个月份可能只覆盖一个月的记录；`DENSE_RANK` 并列不跳号，正好让同一月份共享一个名次。圈定范围后再用「`COUNT(月份名次列) = COUNT(score)`」判断这三个月里没有未完成记录——前者数全部作答，后者不计 score 为 NULL 的行：

```sql
SELECT uid, COUNT(score) AS exam_complete_cnt
FROM (
  SELECT er.*,
         DENSE_RANK() OVER (PARTITION BY uid
                            ORDER BY DATE_FORMAT(start_time, '%Y%m') DESC) AS dr
  FROM exam_record er
) t
WHERE dr <= 3
GROUP BY uid
HAVING COUNT(dr) = COUNT(score)
ORDER BY exam_complete_cnt DESC, uid DESC;
```

**延伸**：这里的「最近三个月」是相对每个用户自己的活跃轨迹而言的；如果需求改成「相对今天的自然月近三个月」，就必须按日期范围过滤，排名方案整体作废——审题时先确认「最近」的锚点是谁。同理，凡是题目里出现「最近 N 次」「每个分组前 N 名」的字眼，第一反应都该落到「分区 + 排序 + 编号」这个窗口函数套路上。

> 追问：`DENSE_RANK` 换成 `RANK` 会发生什么？提示：同月并列后跳号，可能导致三个月份实际只取到两个月的数据。
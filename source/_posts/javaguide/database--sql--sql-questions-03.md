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
description: "SQL 面试题（3）：截断平均值、COUNT 的 NULL 细节、月活统计、条件聚合、外连接过滤陷阱、UNION 排序与 CTE 实战。"
---

第三篇进入进阶实战：截断平均值的两种算法、COUNT 在 NULL 面前的细节、月活与日活的统计口径、条件聚合拼接用户画像，以及外连接过滤位置、UNION 排序、CTE 这些容易翻车的工程写法。

<!-- more -->

## 考察地图

- **聚合进阶**：截断平均值、COUNT 家族与 NULL 的交互、「聚合结果当阈值」的嵌套子查询拆解。
- **分组统计**：月活/人均活跃天数口径、「明细 + 汇总」报表。
- **条件聚合**：SUM(CASE WHEN) 计数、GROUP_CONCAT 行转串。
- **连接进阶**：LEFT JOIN 的 ON vs WHERE、连接膨胀导致的计数虚高。
- **合并查询与 CTE**：UNION 分支排序规则、WITH 抽取公共逻辑。
- 建议自行查阅：窗口函数体系（ROW_NUMBER / RANK / NTILE / 累计帧）——本篇题目未覆盖，但已是当前面试必考，需另行补课。

## 聚合进阶

### 截断平均值（去掉一个最高分一个最低分）怎么写？

**结论**：两种主流写法——算术法 `(SUM - MAX - MIN) / (COUNT - 2)`，或先剔除极值行再 AVG；前者精确去掉「一个」最大最小，后者会把并列极值全部剔除，口径不同。

**原理**：

```sql
-- 算术法：恰好各去一个
SELECT ROUND((SUM(score) - MAX(score) - MIN(score)) / (COUNT(score) - 2), 1) AS clip_avg
FROM exam_record
WHERE exam_id = 9001;

-- 剔除法：并列极值会全部消失
SELECT ROUND(AVG(score), 1)
FROM exam_record
WHERE exam_id = 9001
  AND score NOT IN (
      SELECT MAX(score) FROM exam_record WHERE exam_id = 9001
      UNION ALL
      SELECT MIN(score) FROM exam_record WHERE exam_id = 9001
  );
```

题目口径是「去掉一个最大值和一个最小值」，算术法严格匹配。剔除法还有两个暗坑：NOT IN 遇 NULL 恒不为 TRUE；最大最小并列时删多了，样本量对不上。

**延伸**：算术法注意样本恰好 2 条时除零，工程上加 `NULLIF(COUNT(score) - 2, 0)` 兜底；要求「每组各去一个」的分组截断平均，用窗口函数按正逆序各编号一次再过滤更通用。

> 追问：样本不足 3 条时两种写法各自产出什么？提示：除零 NULL 与空结果集。

### COUNT 在 NULL 面前有哪些细节？

**结论**：COUNT(*) 数行，COUNT(列) 只数非 NULL；条件计数惯用 `COUNT(条件 OR NULL)` 或 `SUM(条件)`，写错真假分支会全部计入。

**原理**：

```sql
SELECT COUNT(*) AS total_pv,          -- 全部作答记录
       COUNT(submit_time) AS complete_pv,  -- 交卷时间非 NULL 即完成
       COUNT(DISTINCT exam_id) AS exam_cnt -- 去重后的试卷数
FROM exam_record;
```

核心依据是「聚合函数忽略 NULL」：条件成立得 1 被计入，不成立时用 `OR NULL` 把 FALSE 变 NULL 被跳过；若写成 `COUNT(score >= 60)`，布尔结果 0/1 都不是 NULL，真假全被数进去。多列组合判重用 `COUNT(DISTINCT uid, DATE_FORMAT(submit_time, '%Y%m%d'))`（MySQL 扩展），一次算出「活跃人天」。

**延伸**：COUNT 对空集返回 0 而非 NULL，这点与 SUM/AVG 相反；拿 COUNT 做分母前不必兜 NULL，拿 SUM 做分母必须 NULLIF。

> 追问：`COUNT(DISTINCT col)` 中 col 出现 NULL 算几个？提示：NULL 不参与去重计数，直接忽略。

### 「不低于平均分的最低分」这类嵌套聚合怎么拆？

**结论**：拆成两步——内层子查询算出平均分得一个标量，外层用 `score >= 平均值` 过滤后再取 MIN；关键是先抓主干条件、再理分支。

**原理**：

```sql
SELECT MIN(score) AS min_score_over_avg
FROM examination_info i
JOIN exam_record r ON i.exam_id = r.exam_id
WHERE i.tag = 'SQL'
  AND r.score >= (
      SELECT AVG(r2.score)
      FROM examination_info i2
      JOIN exam_record r2 ON i2.exam_id = r2.exam_id
      WHERE i2.tag = 'SQL'
  );
```

这类「拿聚合结果当筛选阈值」的题目有一个通用骨架：子查询产出标量（AVG、MAX、MIN），外层比较后二次聚合。把自然语言拆成「谁的分」「和什么比」「比完再取什么」三步，SQL 结构就自然浮现。

**延伸**：MySQL 8 可以改用窗口函数一轮扫描完成：`AVG(score) OVER ()` 把平均值贴到每行上，外层再过滤取 MIN，避免两次扫描同一份数据。

> 追问：若要求「不低于本试卷各自平均分的最低分」（分组阈值）呢？提示：`AVG(score) OVER (PARTITION BY exam_id)` 或按组关联子查询。

## 分组统计

### 月活人数与人均活跃天数怎么统计？

**结论**：月活是 `COUNT(DISTINCT uid)`，人均活跃天数是「人天组合去重数 ÷ 去重人数」，月份口径用 `DATE_FORMAT` 截断。

**原理**：

```sql
SELECT DATE_FORMAT(submit_time, '%Y%m') AS month,
       COUNT(DISTINCT uid) AS mau,
       ROUND(
           COUNT(DISTINCT uid, DATE_FORMAT(submit_time, '%Y%m%d'))
           / COUNT(DISTINCT uid), 2
       ) AS avg_active_days
FROM exam_record
WHERE submit_time IS NOT NULL
  AND submit_time >= '2021-01-01' AND submit_time < '2022-01-01'
GROUP BY month;
```

三个要点：活跃定义必须落在可判空的列上（以交卷为准）；同一用户同一天多次作答靠「uid + 日期」组合去重摊平；过滤年份写范围条件而非 `YEAR(submit_time) = 2021`，保住索引。

**延伸**：MySQL 中整数除整数结果是小数（与多数语言不同），仍建议显式 `* 1.0` 或 CAST 表明意图。周口径注意 WEEK() 的跨年陷阱，YEARWEEK() 更稳。

> 追问：要求输出「当月天数」作日均分母呢？提示：`DAY(LAST_DAY(d))` 取当月最后一天的天数部分。

### 「每月明细 + 全年汇总」的报表怎么出？

**结论**：明细段按月份 GROUP BY，汇总段整年聚合成一行，两段用 UNION ALL 拼接后统一排序。

**原理**：

```sql
SELECT DATE_FORMAT(submit_time, '%Y%m') AS submit_month,
       COUNT(question_id) AS month_q_cnt,
       ROUND(COUNT(question_id) / DAY(LAST_DAY(submit_time)), 3) AS avg_day_q_cnt
FROM practice_record
WHERE submit_time >= '2021-01-01' AND submit_time < '2022-01-01'
GROUP BY submit_month
UNION ALL
SELECT '2021汇总', COUNT(question_id), ROUND(COUNT(question_id) / 365, 3)
FROM practice_record
WHERE submit_time >= '2021-01-01' AND submit_time < '2022-01-01'
ORDER BY submit_month;
```

两段结果结构上不可能重复，所以用 UNION ALL 省掉无谓的去重排序；排序键混排时「2021汇总」按字典序落在年末，恰好符合展示直觉。

**延伸**：同类需求也可用 `GROUP BY ... WITH ROLLUP` 让分组键为 NULL 的行充当汇总行，再用 `GROUPING()` 区分「真实的 NULL 组」和「超级汇总行」；不过 ROLLUP 与 ORDER BY 同用在老版本受限，UNION ALL 写法兼容性更好。

> 追问：ROLLUP 汇总行的排序位置如何显式控制？提示：NULL 的排序规则加 GROUPING() 参与排序键。

## 条件聚合

### 如何一次扫描产出用户的完成数、未完成数和明细串？

**结论**：`SUM(CASE WHEN ... THEN 1 END)` 做条件计数，`GROUP_CONCAT` 把组内多行拼成串，二者配合 GROUP BY 一次扫描产出画像式报表。

**原理**：

```sql
SELECT a.uid,
       SUM(CASE WHEN a.submit_time IS NULL THEN 1 END) AS incomplete_cnt,
       SUM(CASE WHEN a.submit_time IS NOT NULL THEN 1 END) AS complete_cnt,
       GROUP_CONCAT(
           DISTINCT CONCAT(DATE_FORMAT(a.start_time, '%Y-%m-%d'), ':', b.tag)
           ORDER BY a.start_time SEPARATOR ';'
       ) AS detail
FROM exam_record a
LEFT JOIN examination_info b ON a.exam_id = b.exam_id
WHERE a.start_time >= '2021-01-01' AND a.start_time < '2022-01-01'
GROUP BY a.uid
HAVING incomplete_cnt > 1 AND complete_cnt >= 1 AND incomplete_cnt < 5
ORDER BY incomplete_cnt DESC;
```

CASE 只写 THEN 1、不写 ELSE，未命中得 NULL，SUM 自然忽略——与 `COUNT(条件 OR NULL)` 异曲同工。GROUP_CONCAT 支持 DISTINCT、组内排序和自定义分隔符；HAVING 里直接引用别名做组合过滤是 MySQL 扩展。

**延伸**：GROUP_CONCAT 默认上限 group_concat_max_len = 1024 字节，超长会被静默截断，是生产事故的常客，拼接前先评估长度。同类「行转列」在标准 SQL 里对应 FILTER 子句与 STRING_AGG。

> 追问：CASE 里 ELSE 0 与省略 ELSE，对 SUM 和 AVG 的影响有何不同？提示：NULL 被聚合忽略，0 会参与计算。

## 连接进阶

### LEFT JOIN 的过滤条件写 ON 还是 WHERE？

**结论**：对右表列的过滤写进 WHERE，会把 LEFT JOIN 退化成 INNER JOIN；想保住左表全量行，右表条件必须写进 ON。

**原理**：执行顺序是先按 ON 拼出带 NULL 补齐行的连接结果，再由 WHERE 过滤。右表条件若在 WHERE，匹配失败产生的「右表全 NULL」行会因条件不成立被剔除，左连接形同虚设：

```sql
-- 统计每个用户 2021 年的练习数；没练过的用户也要出现、计 0
SELECT er.uid, COUNT(pr.id) AS question_cnt
FROM exam_record er
LEFT JOIN practice_record pr
       ON er.uid = pr.uid
      AND pr.submit_time >= '2021-01-01' AND pr.submit_time < '2022-01-01'
WHERE er.submit_time >= '2021-01-01' AND er.submit_time < '2022-01-01'
GROUP BY er.uid;
```

把 `pr.submit_time` 的年份条件挪进 WHERE，「考过试但没刷题」的用户整行消失，结果立刻缩水。

**延伸**：想让右表条件存在又不退化，可以写 `WHERE pr.col = ? OR pr.uid IS NULL`，但可读性差，不如放 ON。INNER JOIN 里条件写 ON 还是 WHERE 则完全等价，纯风格选择。

> 追问：优化器什么情况下会把外连接自动转成内连接？提示：WHERE 中出现对右表的「拒绝 NULL」条件时。

### 多表连接后计数为什么会虚高？

**结论**：一对多连接让左表行按右表行数膨胀，聚合计数若不加 DISTINCT，会把同一实体重复计入。

**原理**：用户 — 订单 — 订单明细三层连接后，一个用户的行数变成「订单数 × 每单明细数」，此时 `COUNT(exam_id)`、`COUNT(practice_id)` 都被放大：

```sql
SELECT er.uid,
       COUNT(DISTINCT er.exam_id) AS exam_cnt,   -- 去重后才是真实试卷数
       COUNT(DISTINCT pr.id) AS question_cnt     -- 同理
FROM exam_record er
LEFT JOIN practice_record pr ON er.uid = pr.uid
GROUP BY er.uid;
```

口诀：连接之后凡「数个数」，先确认数的是哪个实体的唯一标识，再 COUNT(DISTINCT 标识)。

**延伸**：更稳的工程写法是先各自按 uid 预聚合再连接，把「先膨胀后去重」变成「先收缩后拼接」，中间结果集小一个量级，还省掉 DISTINCT 开销。

> 追问：什么场景下连接膨胀反而是目的本身？提示：需要明细级交叉输出时，如每个订单逐行列出商品。

## 合并查询与 CTE

### UNION 各分支能各自 ORDER BY 吗？

**结论**：裸露的 UNION 只允许末尾一个 ORDER BY，作用于整体；分支想各自排序必须包成派生表，且不带 LIMIT 时分支排序可能被优化器丢弃。

**原理**：

```sql
SELECT * FROM (
    SELECT exam_id AS tid, COUNT(DISTINCT uid) AS uv, COUNT(*) AS pv
    FROM exam_record GROUP BY exam_id ORDER BY uv DESC, pv DESC
) t1
UNION
SELECT * FROM (
    SELECT question_id AS tid, COUNT(DISTINCT uid) AS uv, COUNT(*) AS pv
    FROM practice_record GROUP BY question_id ORDER BY uv DESC, pv DESC
) t2;
```

两个 ORDER BY 直接写在 UNION 各段是语法错误；包成子查询后语法放行。但从关系代数语义讲，外层结果是无序集合，分支排序只有搭配 LIMIT（各组取 Top-N）才有实际保证。

**延伸**：合并异构数据（如试卷与题目）时给每段加一列 `'exam' AS source` 标明出处，后续分页、去重、前端展示都好处理。

> 追问：「每类各取前 3 再合并」最稳的写法是什么？提示：分支内 ORDER BY + LIMIT，或用窗口函数按分区编号。

### WITH（CTE）解决了什么问题？

**结论**：CTE 把子查询提升为命名的临时结果集，一处定义、多处引用，消灭重复子查询，把嵌套层次拉平；MySQL 8.0 起支持。

**原理**：以截断平均值为例，不用 CTE 时「SQL 高难度试卷的得分集合」要在主查询、MAX 子查询、MIN 子查询里重复三遍；用 CTE 抽取公共部分：

```sql
WITH t1 AS (
    SELECT r.score, i.tag, i.difficulty
    FROM exam_record r
    JOIN examination_info i ON r.exam_id = i.exam_id
    WHERE i.tag = 'SQL' AND i.difficulty = 'hard'
)
SELECT tag, difficulty, ROUND(AVG(score), 1) AS clip_avg
FROM t1
WHERE score NOT IN (
    SELECT MAX(score) FROM t1
    UNION ALL
    SELECT MIN(score) FROM t1
);
```

三层嵌套的「套娃」变成线性结构，可读性和可测试性都上台阶。被引用多次的 CTE 在 MySQL 中会物化一次供复用，往往比重复执行子查询划算；`WITH RECURSIVE` 还能处理树形层级数据（组织架构、评论楼）。

**延伸**：CTE 不是性能银弹——早期 8.0 版本对 CTE 的谓词下推有限制，复杂场景要对照 EXPLAIN 确认是合并进外层还是物化。

> 追问：递归 CTE 必须由哪两部分构成、靠什么终止？提示：锚点成员 + 递归成员，递归成员不再产生新行时停止。
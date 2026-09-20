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
description: "SQL 面试题（2）：批量插入与冲突处理、条件更新删除、DELETE/TRUNCATE/DROP 辨析、建表改表与索引管理。"
---

第二篇转向「写」的一侧：插入的三种形态、带条件的更新与删除、DELETE/TRUNCATE/DROP 的经典辨析，以及建表、改表、索引的创建与删除。这类题在笔试里以手写 DML/DDL 为主，细节全部在约束、NULL 和副作用上。

<!-- more -->

## 考察地图

- **插入**：多行 VALUES、INSERT ... SELECT 迁移、主键冲突处理（REPLACE INTO vs ON DUPLICATE KEY UPDATE）。
- **更新**：时间比较与 NULL 判断、列内字符串替换。
- **删除**：DELETE 配 ORDER BY/LIMIT 的限量删除、三种「清空」的辨析。
- **表结构**：CREATE TABLE 的约束与默认值、ALTER TABLE 子操作速查。
- **索引**：四类常见索引的定位、创建与删除语法。
- 建议自行查阅：字段类型选型细节、字符集与排序规则——记忆型内容，面试中多为铺垫。

## 插入

### 批量插入和 INSERT ... SELECT 怎么写？

**结论**：多行合并成一条 `INSERT ... VALUES (...), (...)` 远快于逐条执行；跨表迁移用 `INSERT INTO t SELECT ...`，查询结果直接灌入目标表。

**原理**：

```sql
-- 一条语句插入两行；自增主键 id 不出现在列清单中
INSERT INTO exam_record (uid, exam_id, start_time, submit_time, score) VALUES
(1001, 9001, '2021-09-01 22:11:12', '2021-09-01 23:01:12', 90),
(1002, 9002, '2021-09-04 07:01:02', NULL, NULL);

-- 把 2021 年前的记录搬进备份表
INSERT INTO exam_record_before_2021 (uid, exam_id, start_time, submit_time, score)
SELECT uid, exam_id, start_time, submit_time, score
FROM exam_record
WHERE start_time < '2021-01-01';
```

逐条插入每条都有一次解析、事务与 binlog 开销，合并后这些成本被摊薄。INSERT ... SELECT 要求列按位置对齐、类型兼容；SELECT 端的条件要写索引友好的范围形式，`YEAR(start_time) < 2021` 这种包函数的写法会让索引失效。

**延伸**：超大批量迁移建议按主键或时间范围分批提交，避免单个巨型事务撑大 undo、拉长锁持有时间；SELECT 端默认是一致性读，不会长时间锁源表。应用层批量插入时配合 rewriteBatchedStatements=true，JDBC 驱动才会把多条 INSERT 真正合并成一条多值语句，否则「批处理」只是逐条发送的假象。

> 追问：INSERT ... SELECT 在什么情况下会对源表加锁？提示：binlog 格式为 STATEMENT 且隔离级别较低时的一致性读行为差异。

### 「有则更新、无则插入」用 REPLACE INTO 还是 ON DUPLICATE KEY UPDATE？

**结论**：优先 `INSERT ... ON DUPLICATE KEY UPDATE`——它是原地更新；`REPLACE INTO` 是先删原行再插新行，副作用明显更大。

**原理**：

```sql
INSERT INTO examination_info (exam_id, tag, difficulty, duration, release_time)
VALUES (9003, 'SQL', 'hard', 90, '2021-01-01')
ON DUPLICATE KEY UPDATE tag = VALUES(tag), duration = VALUES(duration);
```

REPLACE 命中主键或唯一键冲突时执行的是 DELETE + INSERT：自增值会涨、删除与插入两类触发器各触发一次、外键级联可能误伤关联数据；ON DUPLICATE KEY UPDATE 只触发更新语义。两者的「冲突判定」都完全依赖表上的主键或唯一索引，没有唯一约束就无从谈起。

**延伸**：MySQL 8.0.20 起 `VALUES(col)` 写法被标记废弃，推荐行别名：`... AS new ON DUPLICATE KEY UPDATE tag = new.tag`。高并发冲突路径下两条语句都可能卷入死锁，压测需覆盖。

> 追问：没有唯一索引的表上执行这两条会发生什么？提示：永远不冲突，退化为普通插入，重复数据越攒越多。

## 更新与删除

### 带时间与 NULL 条件的 UPDATE 有哪些坑？

**结论**：难点不在语法，而在把自然语言精确翻译成时间比较和 `IS NULL`——两个高频失分点。

**原理**：以「把 2021-09-01 之前开始且未完成的记录置为被动完成」为例：

```sql
UPDATE exam_record
SET submit_time = '2099-01-01 00:00:00', score = 0
WHERE start_time < '2021-09-01'
  AND submit_time IS NULL;
```

「未完成」是 `submit_time IS NULL`，写 `= NULL` 永远匹配不到行；时间比较让列直接对常量，能走索引，包一层 `DATE(start_time)` 就把索引废了。列内局部替换可用函数写法：`SET tag = REPLACE(tag, 'PYTHON', 'Python')`，适合「改字符串的一部分」的场景。

**延伸**：大表 UPDATE 先用同条件 SELECT 确认影响行数；MySQL 的 safe-update 模式会拒绝无键条件的 UPDATE/DELETE。大批量更新应分批 + 主键范围推进，控制单事务锁规模。

> 追问：`UPDATE` 不带 WHERE 会撞上什么保护？提示：sql_safe_updates 与会话级开关。

### DELETE 能配 ORDER BY 和 LIMIT 吗？

**结论**：MySQL 单表 DELETE 支持 `ORDER BY ... LIMIT n`，是「删最早/最差的 N 条」的标准写法；多表 DELETE 不支持。

**原理**：

```sql
-- 删除「未完成 或 用时不足 5 分钟」中最早开始的 3 条
DELETE FROM exam_record
WHERE submit_time IS NULL
   OR TIMESTAMPDIFF(MINUTE, start_time, submit_time) < 5
ORDER BY start_time
LIMIT 3;
```

语义是先按 start_time 升序排队，只删前 3 条命中行。时间差用 `TIMESTAMPDIFF(MINUTE, a, b)`（b − a，按分钟）最直观；`MINUTE(TIMEDIFF(b, a))` 也能算，但 TIMEDIFF 的结果本质是时间间隔，跨度超过 838 小时会被截断，通用性更差。

**延伸**：分批清理大表的经典模式就是循环执行 `DELETE ... LIMIT 5000` 直到 affected rows 为 0，每批之间留间隔，把 undo 压力和主从延迟摊平。

> 追问：分批删除的批大小怎么定？提示：单批锁持有时间、redo 生成速率与复制延迟之间的权衡。

### DELETE、TRUNCATE、DROP 有什么区别？

**结论**：DELETE 逐行删数据（DML，可回滚，自增不重置）；TRUNCATE 清空整表并重置自增（DDL，隐式提交）；DROP 连表结构带数据一起删。

**原理**：

```sql
TRUNCATE TABLE exam_record;  -- 清空数据，AUTO_INCREMENT 归位
```

DELETE 每行都写 undo/redo，事务内可 ROLLBACK；删完自增计数器不动，要重置得再执行 `ALTER TABLE t AUTO_INCREMENT = 1`。TRUNCATE 本质是重建表，页直接回收，速度远超全量 DELETE，但不能带 WHERE，且在 MySQL 里会隐式提交当前事务。「删除全部记录并重置自增主键」正是 TRUNCATE 的招牌场景。DROP 则把定义与数据一并移除，空间归还给操作系统。

**延伸**：有外键引用的父表不能直接 TRUNCATE，需先清空子表或临时关闭 foreign_key_checks。主从架构下，全量 DELETE 会在从库逐行重放造成明显延迟，TRUNCATE 作为 DDL 则只传一条语句——这也是「清大表宁 TRUNCATE 不 DELETE」的运维共识。MySQL 8 的 DDL 原子性保证了 DROP/TRUNCATE 崩溃后不留半成品状态。

> 追问：TRUNCATE 为什么快？提示：绕过逐行 undo/redo，直接释放数据页、重建段。

## 表结构与索引

### 手写 CREATE TABLE 要交代哪些要素？

**结论**：主键、唯一约束、NOT NULL、默认值、自增、列注释与字符集，是手写建表题的主要采分点。

**原理**：

```sql
CREATE TABLE IF NOT EXISTS user_info_vip (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '自增ID',
    uid INT UNIQUE NOT NULL COMMENT '用户ID',
    nick_name VARCHAR(64) COMMENT '昵称',
    achievement INT DEFAULT 0 COMMENT '成就值',
    `level` INT COMMENT '用户等级',
    register_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间'
) CHARACTER SET utf8mb4;
```

要点：自增列必须是键；NOT NULL 需显式声明；`DEFAULT CURRENT_TIMESTAMP` 让插入时省略该列；`IF NOT EXISTS` 防止重复执行报错；字符集用 utf8mb4 才算真正的 UTF-8（MySQL 的 utf8 仅 3 字节，存不下 emoji）；`level` 这类与保留字重名的列要加反引号。

**延伸**：生产环境还会显式写 `ENGINE=InnoDB`（5.5 起默认）。VARCHAR(64) 的 64 按字符计而非字节，是常见口误点。

> 追问：utf8 和 utf8mb4 的索引长度限制差在哪？提示：每字符最大字节数影响前缀索引的最大列长。

### ALTER TABLE 的常用子操作有哪些？

**结论**：ADD 加列（可指定位置）、CHANGE 改名并可改类型、MODIFY 只改类型与约束、DROP 删列、RENAME 改表名；多个子操作逗号连写、一次执行。

**原理**：

```sql
ALTER TABLE user_info
    ADD school VARCHAR(15) AFTER `level`,
    CHANGE job profession VARCHAR(10),
    MODIFY achievement INT DEFAULT 0;
```

CHANGE 必须写全新旧两个列名（不改名也得写两遍），MODIFY 不能改名；COLUMN 关键字可省略。连写成一条的实益是表只重建一次，逐条执行每条都可能触发整表拷贝。

**延伸**：MySQL 8 的 INSTANT ADD COLUMN（末尾加列、只改元数据）让加列秒级完成；改类型仍是 INPLACE 或 COPY 算法。生产大表结构变更通常交给 gh-ost / pt-osc 做无锁在线变更。

> 追问：ALGORITHM=INSTANT / INPLACE / COPY 三档差别在哪？提示：是否重建表、是否需回放增量 DML。

### 如何快速复制一张已有表？

**结论**：只要结构用 `CREATE TABLE t LIKE s`；结构加数据用 `CREATE TABLE t AS SELECT ...`，但后者会丢索引、约束与默认值。

**原理**：

```sql
CREATE TABLE user_info_vip LIKE user_info;           -- 完整复制结构与索引，不带数据
CREATE TABLE user_info_vip AS SELECT * FROM user_info; -- 连数据一起拷，索引约束不继承
```

LIKE 走元数据层面的整结构复制，主键、索引、列注释都保留，适合做空表拆分；AS SELECT 本质是把查询结果物化成新表，列类型按表达式推导，自增、默认值、索引全部丢失，只适合做临时分析表。两者都可以再叠加 `INSERT INTO ... SELECT` 补数据。

**延伸**：备份某时间窗口的历史数据时，常见组合就是「LIKE 建空表 + INSERT ... SELECT 带范围条件灌数据」。跨库复制时带上库名前缀即可，注意字符集要显式对齐。

> 追问：`AS SELECT` 拷过来的表自增列会变成什么？提示：退化为普通 INT 列，需要再 ALTER 补 AUTO_INCREMENT。

### 常见索引类型有哪些？怎么创建和删除？

**结论**：常用四类——B-Tree 普通索引、唯一索引、主键索引、全文索引；创建用 CREATE INDEX 或 ALTER TABLE ADD，删除一次只能删一个。

**原理**：

```sql
ALTER TABLE examination_info
    ADD INDEX idx_duration(duration),
    ADD UNIQUE INDEX uniq_idx_exam_id(exam_id),
    ADD FULLTEXT INDEX full_idx_tag(tag);

-- MySQL 不支持一条语句删多个索引
DROP INDEX uniq_idx_exam_id ON examination_info;
DROP INDEX full_idx_tag ON examination_info;
```

B-Tree 索引支撑等值、范围与排序；唯一索引额外约束列值唯一（NULL 不参与唯一性冲突，可有多行 NULL）；主键索引即 InnoDB 的聚簇索引，每张表一个；全文索引面向关键词检索，MySQL 8 处理中文需配 ngram 解析器。

**延伸**：二级索引叶子节点存的是主键值，「回表」由此而来；查询列全部落在索引内即覆盖索引，可省回表。建索引前先看基数（SHOW INDEX 的 Cardinality），低基数列单独建索引收益甚微。

> 追问：为什么性别这类列通常不建索引？提示：选择度过低，优化器宁走全表扫描。
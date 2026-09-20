---
title: "MySQL执行计划分析"
date: 2020-03-26 12:18:00
updated: 2020-03-26 12:18:00
permalink: knowledge/database/mysql/mysql-query-execution-plan/
categories:
  - 数据库
tags:
  - MySQL
  - EXPLAIN
  - 慢SQL
description: "逐列解读 EXPLAIN 执行计划：type 从 ALL 到 const 的档次、key/rows/Extra 的关键取值，用真实建表与查询示例演示读计划方法，并给出慢查询优化的一般套路。"
---

EXPLAIN 是优化器交出来的「作战计划」：它告诉你表按什么方式访问、实际走哪条索引、估算要扫多少行、是否需要额外排序或临时表。读懂这份计划，慢 SQL 优化才有方向，而不是靠猜着加索引。

<!-- more -->

## 它解决什么问题

「SQL 慢」只是一个症状，根因可能是根本没走索引、扫描行数远超返回行数，也可能是排序与分组用不上索引顺序。EXPLAIN 把优化器的决策过程摊开在桌面上：在不真正执行（标准模式）的前提下，先回答「这条 SQL 打算怎么跑」。它是慢查询优化链路里成本最低、信息量最大的一步，也是上线前评审 SQL 的标准动作。

## 核心原理：输出列总览

```sql
EXPLAIN SELECT * FROM users WHERE age = 25;
```

输出共 12 列，排查时重点看五列：`type`（访问方式）、`key`（实际使用的索引）、`rows`（估算扫描行数）、`filtered`（条件过滤后的留存百分比）、`Extra`（附加动作）。其余列也别陌生：`id` 决定多表与子查询的执行顺序（id 相同自上而下，id 不同则大的先执行，NULL 常出现在 UNION 结果行）；`select_type` 区分简单查询、PRIMARY、SUBQUERY、UNION、DERIVED；`possible_keys` 是候选索引集合；`key_len` 反映用到了联合索引的前多少字节，可反推用了前几列。

标准 EXPLAIN 只估算、不执行；`EXPLAIN FORMAT=JSON` 会额外给出成本模型数据（query_cost），适合多表 JOIN 调优时对比各方案代价。EXPLAIN 对 SELECT、UPDATE、DELETE、INSERT、REPLACE 都生效，更新语句上线前同样值得跑一遍。

## 深入机制

### type：从 const 到 ALL 的档次

访问方式由好到差大致是：

```text
system > const > eq_ref > ref > range > index > ALL
```

- **const**：主键或唯一索引等值命中，最多匹配一行；
- **eq_ref**：JOIN 时被驱动表用主键或唯一非空索引做一对一匹配，是连表的最佳形态；
- **ref**：普通索引等值查询，可能匹配多行；
- **range**：索引范围扫描，常见于 `>`、`<`、`BETWEEN`、`IN`；
- **index**：全索引扫描，比 ALL 强在索引记录更窄、且可能靠覆盖索引避免回表，但大表上同样代价可观；
- **ALL**：全表扫描，大表上出现必须消灭。

经验线：至少达到 `range`；看到 `index` 或 `ALL` 就要追问为什么。

### Extra：三个最值钱的信号

- **Using index**：覆盖索引生效，查询所需列都在索引里，无需回表，是最希望看到的结果；
- **Using filesort**：排序无法利用索引顺序，需要单独排一遍——结果集能放进 `sort_buffer_size` 就在内存排，放不下则借助磁盘临时文件；
- **Using temporary**：创建了临时表承接中间结果，常见于 GROUP BY 与索引不匹配。

后两者不一定致命，但出现在大结果集上时，基本就是慢查询的元凶。Extra 里还有几个值得认识的常客：`Using index condition` 表示启用了索引条件下推（ICP），把原本在 Server 层做的过滤压到引擎层完成；`Using join buffer (hash join)` 说明被驱动表无索引可用，8.0.20 起默认走 Hash Join 而不是老的 Block Nested Loop。

### 其余值得会读的列

- `possible_keys` 有值而 `key` 为 NULL 很常见：候选索引存在，但优化器评估后认为全表扫更划算。
- `key_len` 是索引实际用到的字节数，结合字段定义可反推联合索引用到第几列。例如 `idx(a INT, b INT)` 上 key_len 为 5 说明只用了 a（INT 4 字节加 1 字节 NULL 标记），为 10 说明两列都命中。
- `ref` 展示等值比较的对手：是常量（const）还是驱动表传来的列。
- `filtered` 在 JOIN 中尤其关键：优化器用 `rows × filtered/100` 估算传给下一张表的行数（扇出），扇出越大，被驱动表被反复匹配的次数就越多。

### 一个完整示例

先建一张带两个二级索引的订单表：

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_user_status (user_id, status),
  KEY idx_created (created_at)
) ENGINE=InnoDB;
```

再看这条典型的「我的已支付订单按时间倒序」查询：

```sql
EXPLAIN SELECT id, status FROM orders
WHERE user_id = 100 AND status = 'PAID'
ORDER BY created_at DESC LIMIT 20;
```

可能得到如下计划（示意）：

```text
type: ref | key: idx_user_status | rows: 380 | Extra: Using where; Using filesort
```

逐列解读：等值条件命中联合索引，`type=ref` 不差；但 `created_at` 不在该索引中，索引取出的 380 行无序，只能额外 filesort——`LIMIT 20` 挡不住先排完全量的事实。改进方向是把排序键并入索引：

```sql
ALTER TABLE orders ADD KEY idx_user_created (user_id, created_at);
```

新计划里 `rows` 明显变小，filesort 消失，因为 `(user_id, created_at)` 的存储顺序天然满足 `ORDER BY created_at DESC`；若查询列全部落在索引内，Extra 还会出现 `Using index`，连回表都省掉。

再看一个反例，单独按状态过滤：

```sql
EXPLAIN SELECT * FROM orders WHERE status = 'PAID';
```

联合索引 `idx_user_status` 的最左列是 `user_id`，这条查询跳过了它，最左前缀规则失效，计划里 `type: ALL`、`key: NULL`——候选索引存在却用不上。这类「索引在却不用」的 SQL，正是慢日志里最常见的面孔。

## 工程实践：慢查询优化的一般套路

1. **找目标**：开启慢日志，用 pt-query-digest 聚合，按总耗时排序锁定 TOP SQL；
2. **读计划**：EXPLAIN 三问——走了预期索引吗？`rows` 是否远大于实际返回行数？Extra 有没有 filesort/temporary？
3. **对症处理**：缺索引就按最左前缀补联合索引；filesort 把排序键并入索引；深分页把 `LIMIT 1000000, 20` 改成 `WHERE id > ?` 的游标语义；
4. **刷新统计**：表数据剧烈变动后统计信息失真，执行 `ANALYZE TABLE` 重新采样再复核计划；8.0 还可对低区分度列建直方图辅助优化器；
5. **终审**：仍不理解优化器为何弃用索引，打开 optimizer trace 看成本推导，或用 `EXPLAIN ANALYZE`（8.0.18+）真实执行一遍，拿到每步的实际行数与耗时。

另外建议给核心接口的 SQL 留一份执行计划归档：数据量每增长一个量级就重新评审一次，避免统计信息漂移导致计划悄悄退化。

## 对比与权衡

| 手段 | 成本 | 适用场景 |
| --- | --- | --- |
| EXPLAIN | 零执行成本，只有估算值 | 日常评审、上线前检查 |
| EXPLAIN ANALYZE | 真实执行一遍 | 测试环境深挖计划与实际的偏差 |
| optimizer trace | 开销大、输出繁琐 | 优化器选错计划的根因分析 |
| 慢日志 + digest | 线上常开、开销可控 | 发现问题的入口 |

四种手段构成一条由轻到重的排查链：先用最便宜的方式圈定嫌疑 SQL，再逐级上更贵的工具确认根因，避免一上来就全量开 trace 拖慢线上。

## 面试视角

**type 各档怎么记？** 从好到差：const/eq_ref（唯一等值与一对一连表）、ref（普通索引等值）、range（索引范围）、index（全索引扫描）、ALL（全表扫描），优化目标至少到 range。

**rows 是准确值吗？** 不是，它基于索引采样统计估算，数据剧烈变动后偏差可能很大；估算明显离谱时先 `ANALYZE TABLE` 再复核计划。

**Using filesort 一定慢吗？** 不一定，结果集能放进 sort_buffer 时在内存排序很快；真正危险的是大结果集触发磁盘临时文件。只有排序列与方向能被索引顺序覆盖时才能彻底消除。

**possible_keys 有值但 key 为 NULL 说明什么？** 优化器评估后放弃了索引：常见于表太小、条件选择率太低（要扫的行占比过大），或对索引列用了函数、发生了隐式类型转换导致索引失效。

**为什么测试环境的计划和生产不一样？** 执行计划依赖表统计信息，开发库数据量小、分布均匀，优化器可能干脆全表扫；生产库数据量大且分布倾斜，计划完全不同。评估 SQL 必须在接近真实的数据规模上做，必要时用 EXPLAIN ANALYZE 验证。

## 小结

- EXPLAIN 五列定乾坤：type、key、rows、filtered、Extra。
- type 至少达到 range；Extra 中 filesort 与 temporary 是重点整治对象，Using index 是理想状态。
- 优化套路：慢日志找 SQL → EXPLAIN 定位 → 补索引或改写 → ANALYZE 复核。
- 估算不等于现实，拿不准时用 EXPLAIN ANALYZE 真实跑一遍。
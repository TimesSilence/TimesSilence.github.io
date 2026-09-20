---
title: "MySQL日期类型选择建议"
date: 2020-04-13 14:32:00
updated: 2020-04-13 14:32:00
permalink: knowledge/database/mysql/some-thoughts-on-database-storage-time/
categories:
  - 数据库
tags:
  - MySQL
  - 日期类型
description: "对比 DATETIME、TIMESTAMP、BIGINT 三种时间存储方案在时区处理、取值范围、存储空间上的差异，以及排序索引与分布式环境下的选型建议。"
---

存时间看起来是小事，选错类型却会在时区切换、跨年范围、跨系统对接时连环爆雷。MySQL 里主流的三种选择是 DATETIME、TIMESTAMP 和 BIGINT 时间戳，它们的差异不只在存储大小，更在于"存的是字面量还是绝对时刻"。

<!-- more -->

## 三种类型的原理差异

**DATETIME**：存的就是你写入的那个字面量，不带任何时区概念。插入 `'2026-09-01 10:00:00'`，无论会话时区怎么改，读出来都是这个值。取值范围 `1000-01-01` 到 `9999-12-31`，5.6.4 之后占 5~8 字节（取决于小数秒精度）。

**TIMESTAMP**：存的是绝对时刻。写入时 MySQL 把当前会话时区的时间换算成 UTC 存储，读出时再换算回当前会话时区。同一行数据，`SET time_zone = '+8:00'` 前后查到的显示值会不同，但指向同一时刻。它只占 4~7 字节，代价是范围只有 `1970-01-01` 到 `2038-01-19`——这就是著名的 2038 问题。另一个特性是支持 `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`，行更新时自动刷新，做"最后修改时间"很方便。

**BIGINT**：存 Unix 时间戳（秒或毫秒），数据库完全不参与解释，时区换算全在应用层。跨语言、跨系统对接时语义最明确——所有系统对同一个整数的理解一致。

## 排序与索引考量

三种类型按时间排序都没问题，坑在查询写法上：

- 用 VARCHAR 存时间是首先要排除的方案：字典序不等于时间序（`'2024-1-10'` 会排在 `'2024-05-01'` 前面），日期函数用不了，索引范围扫描也低效。
- 对时间列做范围查询时，不要在列上套函数。`WHERE DATE(create_time) = '2026-09-01'` 会让索引失效；应改成 `WHERE create_time >= '2026-09-01' AND create_time < '2026-09-02'`，让索引列保持"干净"才能走范围扫描。
- BIGINT 毫秒值是 19 位整数，比较和索引效率略好于 DATETIME 的字节比较，但这点差距在 B+ 树定位面前通常不是决定性因素，别为这点性能牺牲可读性。

```sql
CREATE TABLE event (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  occurred_at DATETIME(3) NOT NULL COMMENT '业务发生时间，字面量',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_occurred (occurred_at)
);
```

## 时区问题的根源

多数时间 bug 不是类型选错，而是各环节时区不一致：JDBC URL 的 `serverTimezone`、JVM 默认时区、MySQL 全局/会话 `time_zone`、容器系统时区，任何一处漂移都会让 TIMESTAMP 读出"差 8 小时"的值。DATETIME 看起来免疫，实际上是把换算责任推给了应用——应用层一旦假设错了时区，错得更隐蔽。

全球化部署的通行做法是：**存储统一 UTC，展示按用户时区本地化**。应用连库时会话时区固定为 UTC，ORM 层统一转换，集成测试覆盖夏令时切换日（某些时刻一天会出现两次或零次）。

## 分布式环境的建议

- **跨服务交换一律用 Unix 毫秒或 ISO 8601 带时区格式**（如 `2026-09-01T02:00:00Z`），避免"裸"的 `yyyy-MM-dd HH:mm:ss` 字符串在上下游被按不同时区解读。
- **ID 与时间混排的场景**（如按时间分库分表），BIGINT 时间戳做运算最顺手。
- **主从复制**：TIMESTAMP 在 binlog 中按 UTC 记录，从库回放时按从库会话时区换算，主从时区不一致会导致显示偏差，这也是统一 UTC 的另一个理由。

## 选型结论

| 场景 | 建议 |
| --- | --- |
| 业务时间（下单、出行、生日等） | DATETIME(3)，语义直观、范围无忧 |
| 记录创建/更新时间 | TIMESTAMP，自动维护省心（注意 2038 上限） |
| 跨系统对接、日志归档、分布式链路 | BIGINT 毫秒，语义零歧义 |
| 任何场景 | 不要用 VARCHAR 存时间 |

## 小结

- DATETIME 存字面量、范围大、与时区无关；TIMESTAMP 存 UTC 绝对时刻、随会话时区显示、2038 年到期。
- BIGINT 把时区责任完全交给应用，跨系统最不容易出歧义。
- 范围查询别对时间列套函数，保持索引列干净。
- 全局统一"存 UTC、展示本地化"，并让 JDBC、JVM、MySQL、容器四处时区对齐。
---
title: "字符集详解：字符集是什么？怎么用？"
date: 2019-10-25 15:19:00
updated: 2019-10-25 15:19:00
permalink: knowledge/database/character-set/
categories:
  - 数据库
tags:
  - 字符集
  - UTF-8
  - MySQL
description: "理解字符集与编码区别，以及 MySQL 中 utf8 与 utf8mb4 的选型要点。"
---

乱码和 emoji 存不进去，根因往往在字符集链路某一段不一致。搞清「字符集 vs 编码」比背命令更重要。

<!-- more -->

## 核心概念

**字符集**是字符集合；**编码**是字符与字节的映射规则。计算机只认字节，显示什么取决于解码规则是否一致。ASCII 用 7 位有效位；中文体系经历 GB2312/GBK/GB18030；Unicode 统一码点，UTF-8/UTF-16 是常见编码实现。

## MySQL 里的 utf8 陷阱

MySQL 的 `utf8` 实际是阉割版 UTF-8，最多三字节，**无法存 emoji 与部分生僻字**。生产应默认 `utf8mb4`，并在表、列、连接层保持一致。

```sql
CREATE DATABASE app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SET NAMES utf8mb4;
```

## 全链路一致

客户端、连接、服务器、库、表、列六级字符集任一不一致都可能乱码。排查时从 `SHOW VARIABLES LIKE 'character%'` 与 `SHOW CREATE TABLE` 入手，对照应用 JDBC URL 参数。

## 实践建议

新项目统一 utf8mb4 + `utf8mb4_unicode_ci` 或 `utf8mb4_0900_ai_ci`（8.0+）。历史库迁移先评估索引长度变化（varchar 索引字节上限 767/3072）。

## 排序规则 collation 影响

同样 utf8mb4，`utf8mb4_general_ci` 与 `utf8mb4_unicode_ci` 比较规则不同，影响索引匹配与 ORDER BY。大小写不敏感比较来自 collation，不是 charset 本身。变更 collation 可能改变唯一约束语义，迁移前要在影子表验证。

## 排查乱码步骤

抓包或 general log 看字节流 → 确认连接 charset → 确认列定义 → 确认应用解码。Java 常见坑是 new String(bytes) 未指定 Charset；Go 需显式 utf8 或 transform。

## 实践复习清单

新建库表统一 utf8mb4；JDBC URL 加 characterEncoding=utf8；服务端 character_set_server 与 collation_server 写入 runbook。上线前用 emoji 测试用例写入读出；CI 增加 charset 回归。迁移旧表时评估索引长度与 JOIN 行为变化，先在从库演练。

## 常见坑

- 只改表不改连接，应用仍按 latin1 写入。
- 把「乱码」当传输问题，实际是错误解码。
- 混用 `utf8` 与 `utf8mb4` 导致 join 隐式转换拖慢查询。

## 总结与自测

能否解释 charset 与 collation 区别？能否写出 utf8mb4 建库语句？能否说明 emoji 存失败的根因？能否列出排查乱码的五步？能否说明迁移 utf8 到 utf8mb4 对索引的影响？这五问过关，字符集问题基本能在一线独立处理。
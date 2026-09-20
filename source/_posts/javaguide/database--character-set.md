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
description: "字符集演进线：从 ASCII、GBK 到 Unicode 与 UTF-8；MySQL 的 utf8 为何是三字节残废，emoji 存不进去的真实原因与 utf8mb4 落地要点。"
---

乱码和 emoji 存不进去，根因都能在字符集的演进史里找到。这篇把 ASCII、GBK、Unicode、UTF-8 这条线串起来，然后回答一个 MySQL 特有的坑：为什么 `utf8` 不是 UTF-8。

<!-- more -->

## 先分清两个概念：字符集与编码

**字符集**是字符的集合，回答「有哪些字符」；**编码**是字符到字节序列的映射规则，回答「每个字符存成什么字节」。计算机只存字节，屏幕上看到什么，取决于用哪套规则解码——编码用 UTF-8、解码用 GBK，得到的必然是乱码。乱码的本质就一句话：**编码与解码用了不同或不兼容的规则**。

## 演进线：ASCII → GBK → Unicode/UTF-8

**ASCII**：上世纪六十年代的美国标准，只用每个字节的低 7 位，定义了 128 个字符（含 33 个不可显示的控制字符）。英文字母、数字、常用符号够用，但完全没有考虑其他语言——那时计算机还没走出美国。

**GB2312 / GBK / GB18030**：中文世界自己的答案。GB2312 收录 6700 多个常用汉字，英文字符保持与 ASCII 兼容的单字节，汉字用双字节；GBK 是它的扩展，汉字到 2 万多；GB18030 进一步纳入少数民族文字与日韩汉字，收录超 7 万，且完全兼容前两者。问题是：每个国家各搞一套，同一个字节序列在不同字符集里解释出不同字符，跨语言文本必然乱码。

**Unicode**：终结割据的方案——给世界上几乎所有字符分配唯一编号（码点，Code Point），从 U+0000 一路排到 U+10FFFF。但 Unicode 只定义编号，不规定怎么存。

**UTF-8 / UTF-16 / UTF-32**：Unicode 的具体编码实现。UTF-32 每字符固定 4 字节，简单但浪费；UTF-16 用 2 或 4 字节；**UTF-8 用 1~4 字节变长编码**——一句话原理：码点越小用的字节越少，ASCII 范围内的字符仍占 1 字节（与 ASCII 完全兼容），常用汉字占 3 字节，emoji 与罕用字符占 4 字节，每个字节的高位前缀标记了它在多字节序列中的位置，解码端由此判断序列边界。英文省空间、兼容 ASCII、无字节序问题，让 UTF-8 成为互联网的事实标准。

## MySQL 的 utf8 是三字节残废

MySQL 里有两个「UTF-8」：

- **`utf8`（即 utf8mb3）**：每个字符最多只支持 **3 字节**。这是早期为节省索引空间做的妥协实现——当年定下来后就再也改不动了。
- **`utf8mb4`**：真正的 UTF-8，每字符最多 4 字节，MySQL 5.5.3 引入，MySQL 8.0 起成为默认字符集。

所以生产环境的正确姿势只有一条：**一律用 utf8mb4**，并且在库、表、列、连接各层保持一致。

```sql
CREATE DATABASE app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET NAMES utf8mb4;
```

## emoji 存不进去的真实原因

emoji 的码点在 U+1F300 以上，UTF-8 编码需要 **4 字节**。写进 `utf8`（三字节上限）的列时，MySQL 无法编码，直接报错：

```text
Incorrect string value: '\xF0\x9F\x98\x98...' for column 'name' at row 1
```

报错信息里的 `\xF0\x9F...` 正是那个 emoji 的 UTF-8 四字节序列——字节是对的，是列的字符集装不下它。同理，部分生僻汉字、繁体字也在三字节范围之外，同样会失败。

排查与修复顺序：先确认列与表的字符集（`SHOW CREATE TABLE`），再确认连接层——`character_set_client`、`character_set_connection`、`character_set_results` 这三个变量决定客户端与服务器之间怎么翻译字节，Java 应用对应 JDBC URL 里的 `characterEncoding` 参数。任何一环是 latin1 或 utf8mb3，链路就断了。一个常见迷思是「数据库存进去正常、客户端显示问号」：那多半是客户端或驱动的连接字符集问题，而非数据本身坏了。

迁移存量表到 utf8mb4 时注意索引长度：InnoDB 索引前缀有字节上限（旧格式 767 字节、新格式 3072 字节），utf8mb4 每字符按 4 字节计，`VARCHAR(255)` 的索引在 utf8mb3 下没事、utf8mb4 下可能超限，需要缩短长度或启用 `innodb_large_prefix`。

## 小结

- 字符集管「有哪些字符」，编码管「怎么存成字节」；乱码=编解码规则不一致。
- 演进主线：ASCII（7 位）→ 各国自定义（GBK 等）→ Unicode 统一码点 → UTF-8 变长实现。
- MySQL 的 `utf8` 最多 3 字节，存不了 4 字节的 emoji；生产一律 `utf8mb4`，库表列连接四层对齐。
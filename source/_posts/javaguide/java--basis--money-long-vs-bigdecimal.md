---
title: "Java 金额用 long 还是 BigDecimal？"
date: 2017-10-15 13:35:00
updated: 2017-10-15 13:35:00
permalink: knowledge/java/basis/money-long-vs-bigdecimal/
categories:
  - Java
tags:
  - Java基础
  - BigDecimal
  - 金额
description: "对比 long 分存储与 BigDecimal 在金额场景下的取舍、舍入与数据库设计要点。"
---

金额类型选型没有银弹：高并发记账常用「long 存最小货币单位」，复杂费率与多币种换算则倾向 `BigDecimal`；关键是**存储单位、舍入规则、溢出**三者一致。

<!-- more -->

## 核心概念

**long 分/厘**：整数运算快、无浮点误差，适合订单、余额等高频加减；需约定 scale（如分），展示层再 `/100`。**BigDecimal**：适合利率、汇率、税务等多步除法与不同舍入策略；对象开销更大。数据库字段应与应用层单位一致（`BIGINT` 分 或 `DECIMAL(p,s)`）。

## 关键机制与实践

阿里规约类实践：运算用整数、展示用格式化；除法统一 `RoundingMode`（如 HALF_UP）并在 PRD 写清。long 注意 `Long.MAX_VALUE` 溢出，可预留更大类型或拆账户。跨币种先定「记账币种」与「展示币种」，避免混用 double。

```java
long priceCents = 1999L; // 19.99 元
long taxCents = (priceCents * 6 + 50) / 100; // 6% 税，四舍五入到分
```

## 常见误区与小结

- 数据库存 double 做金额（绝对禁止）。
- long 与 BigDecimal 在同一链路混算未转换单位。
- 舍入发生在展示层与结算层不一致导致对账差一分。

原则：**先定最小单位与舍入规则，再选 long 或 BigDecimal**；性能敏感且规则简单优先 long。
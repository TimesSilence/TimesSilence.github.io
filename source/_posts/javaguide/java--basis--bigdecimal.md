---
title: "BigDecimal 详解"
date: 2017-09-27 10:14:00
updated: 2017-09-27 10:14:00
permalink: knowledge/java/basis/bigdecimal/
categories:
  - Java
tags:
  - Java基础
  - BigDecimal
  - 精度计算
description: "学习 BigDecimal 解决浮点精度问题，掌握构造、运算、舍入与比较的正确用法。"
---

金额与计量场景里，`float`/`double` 的二进制表示无法精确覆盖多数十进制小数，直接做加减比较会踩坑；`BigDecimal` 用十进制语义做运算，是金融类业务的常规选择。

<!-- more -->

## 核心概念

浮点误差来自「十进制 → 二进制 → 有限位存储」的舍入链。`BigDecimal` 内部用整数标度（unscaled value + scale）表示小数，运算时可显式指定精度与 `RoundingMode`，避免 `0.1 + 0.2 != 0.3` 这类问题。

## 关键机制与实践

**构造**：优先 `new BigDecimal("0.1")` 或 `BigDecimal.valueOf(0.1d)`，避免 `new BigDecimal(0.1)` 已带入 double 误差。**运算**：加减乘除都返回新对象，除法必须带 scale 与舍入模式。**比较**：用 `compareTo`，不要用 `equals`（`1.0` 与 `1.00` 标度不同则不相等）。

```java
BigDecimal a = new BigDecimal("1.0");
BigDecimal b = new BigDecimal("0.9");
BigDecimal c = new BigDecimal("0.8");
System.out.println(a.subtract(b).compareTo(b.subtract(c))); // 0
```

## 常见误区与小结

- 用 `==` 或 `equals` 比较金额大小。
- 除法不写 `RoundingMode` 抛 `ArithmeticException`。
- 大量创建临时 `BigDecimal` 却不考虑性能（热点路径可评估 long 分存储）。

记住：**存字符串构造、算时定舍入、比用 compareTo**。
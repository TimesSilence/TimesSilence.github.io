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
description: "从定点整数与十进制任意精度两种表示模型出发，多维度对比 long 存分与 BigDecimal 存元，给出金额存储与计算的选型框架。"
---

金额该用 `long` 存分还是 `BigDecimal` 存元，是后台系统设计里的高频争论。两者并非互斥的替代品，而是「定点整数」与「十进制任意精度」两种表示模型，分别适配「已定局的金额存储」与「进行中的精确计算」。本文从表示原理出发，给出可落地的选型框架。

<!-- more -->

## 它解决什么问题

金额处理有三个硬要求：不能丢精度、舍入规则明确、存储与计算口径一致。`double` 因为二进制浮点的近似表示直接出局后，剩下两条路：

- `long` 存最小货币单位（如分），回答的是「金额怎么存」；
- `BigDecimal` 做带舍入规则的十进制运算，回答的是「金额怎么算」。

很多争论源于把这两件事混为一谈。实际系统中两者常常共存：记账与存储用整数，费率与换算用 `BigDecimal`，边界处做严格换算。

## 核心原理

### long 存分：把小数点变成约定

人民币精确到分，则 `19.99` 元保存为整数 `1999`。小数点的位置不再由数据类型表达，而是固化为一项全系统一致的业务约定（scale = 2）。所有运算退化为纯整数运算，天然没有浮点误差，硬件级速度，定长 8 字节。

代价是约定本身成为新的风险源：单位必须随数据一起流动，任何一环把「分」误读成「元」就是百倍差错。

### BigDecimal：十进制语义的完整保留

`BigDecimal` 用 `BigInteger`（非标度值）加 `scale`（小数位数）表示十进制数，运算严格遵循十进制规则，配合 `RoundingMode` 显式控制舍入。折扣、利率、汇率这类产生超长小数位中间结果的计算，只有它能不丢信息地保留到业务规定的舍入点。

| 对比项 | long（存分） | BigDecimal |
| --- | --- | --- |
| 表示模型 | 定点整数，小数点位置靠约定 | 任意精度整数 + scale |
| 精度 | 固定，由最小单位决定 | 可扩展，中间过程不丢位 |
| 主要风险 | 单位混淆、静默溢出 | 构造误差、舍入规则不统一 |

## 深入机制

### long 的运算与溢出防线

加减法在整数域内封闭，误差为零：

```java
long priceCents = 1_999L;
long shippingCents = 500L;
long totalCents = Math.addExact(priceCents, shippingCents); // 2499
```

`long` 的取值上限约为 9.2×10¹⁸，存分约合 9×10¹⁶ 元，看似遥不可及，但普通 `+`、`*` 溢出时**不会报任何错**，数值静默回绕成负数，这是金额代码最危险的一类 bug。因此运算一律改用 `Math.addExact`、`subtractExact`、`multiplyExact`，溢出即抛 `ArithmeticException`。还要注意中间结果：最终金额没超上限，不代表「单价 × 数量 × 倍率」链路上的某一步不溢出，必要时应先转 `BigInteger` 或 `BigDecimal` 再回压。

### BigDecimal 的计算与舍入

```java
BigDecimal price = new BigDecimal("19.99");
BigDecimal rate = new BigDecimal("0.95");
BigDecimal discounted = price.multiply(rate); // 18.9905，中间值完整保留
BigDecimal payable = discounted.setScale(2, RoundingMode.HALF_UP); // 18.99
```

两个纪律：常量一律字符串构造（`new BigDecimal(0.1)` 会继承 double 的近似误差）；`divide` 除不尽时必须显式给出 scale 与 `RoundingMode`，否则抛 `ArithmeticException`。

### 两种模型的衔接换算

典型的混合链路：计算阶段全程 `BigDecimal`，结果落定后换算为以分为单位的 `long` 入库或记账。

```java
BigDecimal payable = new BigDecimal("56.97");
long cents = payable.movePointRight(2).longValueExact(); // 5697

BigDecimal restored = BigDecimal.valueOf(cents, 2);      // 56.97
```

`longValueExact()` 只接受 long 范围内的整数，残留任何非零小数位都会抛异常——这正是我们想要的严格性。切忌用 `longValue()`，它会静默丢弃小数部分，`19.99` 直接变成 `19`。若要把「最多两位小数」作为输入校验，可用 `RoundingMode.UNNECESSARY` 做断言式舍入，`19.9` 自动补成 `19.90`，`19.999` 直接抛异常，不会悄悄截断。

## 工程实践

- **字段名带单位**：数据库与代码中统一使用 `amount_cents` 这类命名。裸写的 `amount = 100` 无法分辨是 100 元还是 100 分，单位必须成为名字的一部分。
- **舍入收敛到一处**：展示层、结算层各自舍入是对账差一分的经典来源。全链路只在业务规定的唯一位置舍入，其余环节保留完整精度。
- **转换集中在适配层**：对外接口要分就传 `5697`，要元就传 `toPlainString()` 的字符串；转换代码只出现在接口与数据库适配层，业务内部不来回切换类型和单位。
- **多币种不能假设两位小数**：日元没有小数位，部分货币有三位小数。金额值必须与币种成对出现，最小单位由币种规则决定，无法从孤立的 long 值推断。
- **入库前先在 Java 侧舍入**：不要依赖数据库写入 `DECIMAL` 时的隐式舍入行为，程序先 `setScale` 再写，落库值才与计算结果严格一致。

## 对比与权衡

| 维度 | long（存分） | BigDecimal（存元） |
| --- | --- | --- |
| 精度 | 固定到最小单位，绝对精确 | 任意精度，中间过程不丢位 |
| 数值范围 | 有上限，溢出静默回绕，需 Exact 系列方法防御 | 几乎无上限，无需溢出防护 |
| 运算性能 | 寄存器级整数运算，极快 | 对象分配 + 十进制运算，慢一到两个数量级 |
| 内存与存储 | 8 字节定长，索引友好 | 数十字节起，长度可变 |
| 序列化/传输 | JSON 中即数字，跨语言无歧义 | 建议输出字符串，避免接收方按浮点解析丢精度 |
| 数据库映射 | `BIGINT` | `DECIMAL(p, s)`，p、s 按业务上限反推 |
| 典型场景 | 订单金额、账户余额、入账流水 | 折扣、税费、利率、汇率、按量计费 |

选型判断可以收敛为一句话：**值的精度边界已经固化、运算以加减为主时选 long；计算链条中出现除法、比率或多种舍入策略时选 BigDecimal；两者通过边界换算共存，是大多数交易系统的实际形态。**

## 面试视角

**金额为什么不能用 double？** double 是二进制浮点，多数十进制小数在其中只能取近似值，`0.1 + 0.2` 不等于 `0.3`。金额要求确定的十进制精度与舍入规则，近似表示无法满足，这与具体语言实现无关。

**long 存分有哪些坑？** 三个：单位混淆（分被当元读，差百倍）、静默溢出（普通运算符不回绕报错，要用 `Math.multiplyExact` 等防御）、精度被锁死（费率、利息等需要四位以上小数的中间结果无法表达）。

**两种方案如何在同一链路混用？** 计算阶段用 `BigDecimal` 保留完整精度，在业务规定的舍入点 `setScale` 后，用 `movePointRight(2).longValueExact()` 转为分入库；反向用 `BigDecimal.valueOf(cents, 2)` 还原。换算只发生在适配层。

**数据库选 BIGINT 还是 DECIMAL？** 跟随应用层模型：存分用 `BIGINT`，存元用 `DECIMAL(p, s)`，其中 p（总位数）按业务最大金额反推，s 对应小数位。`DECIMAL` 在 MySQL 中属于精确值类型，不会发生浮点式近似。

**BigDecimal 作 HashMap 键或入库前要注意什么？** `equals` 比较 scale，`1.0` 与 `1.00` 不相等，作键前必须统一 `setScale`；入库同理，先在 Java 侧舍入到目标精度，保证落库值与内存中的计算结果一致。

## 小结

- 选型的前提是分清「存」与「算」：long 存分解决存储与高频加减，BigDecimal 解决带舍入规则的精确计算。
- long 方案的三条纪律：命名带单位、运算用 Exact 方法、多币种绑定币种信息。
- BigDecimal 方案的三条纪律：字符串构造、除法显式舍入、比较用 `compareTo`。
- 混合使用时，类型与单位的转换集中在适配层，用 `longValueExact()` 保证换算不静默丢精度。
- 数据库类型跟随应用层模型，入库前在 Java 侧完成舍入，不依赖数据库的隐式行为。
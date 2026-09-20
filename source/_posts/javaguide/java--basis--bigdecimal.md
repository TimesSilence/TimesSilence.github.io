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
description: "从二进制浮点的表示极限讲起，说清 BigDecimal 的 unscaledValue + scale 模型、构造陷阱、equals 与 compareTo 的差异以及运算与舍入的正确姿势。"
---

`float`/`double` 遵循 IEEE 754 二进制浮点标准，像 0.1 这样的十进制小数在二进制下是无限循环的，只能截断存储，误差随之产生。`BigDecimal` 用「任意精度整数 + 小数位数」的十进制模型做运算，是金额、计量等对精度敏感场景的标配。本文从表示原理出发，讲清它的正确用法与常见陷阱。

<!-- more -->

## 它解决什么问题

先看一段几乎每个 Java 开发者都遇到过的代码：

```java
System.out.println(0.1 + 0.2);           // 0.30000000000000004
System.out.println(1.0 - 0.9);           // 0.09999999999999998
System.out.println(2.0f - 1.9f == 0.1f); // false
```

这不是 Java 的缺陷，而是二进制浮点数的固有性质，任何遵循 IEEE 754 的语言表现都相同。财务对账要求分毫不差，利率、汇率计算要求明确的舍入规则，浮点的近似表示在这些场景下不可接受。`BigDecimal` 存在的意义，就是把十进制小数的语义原样搬进 Java：每一位十进制数字都被精确保留，舍入规则由调用方显式指定。

## 核心原理

### 为什么 0.1 存不下

十进制小数转二进制的办法是「乘 2 取整」：

```text
0.1 × 2 = 0.2 → 0
0.2 × 2 = 0.4 → 0
0.4 × 2 = 0.8 → 0
0.8 × 2 = 1.6 → 1
0.6 × 2 = 1.2 → 1
0.2 × 2 = 0.4 → 0   （回到 0.2，开始循环）
```

0.1 的二进制是 `0.0001100110011...` 的无限循环小数，而 `double` 只有 52 位尾数，存不下就只能舍入到最接近的可表示值，误差从这一刻就产生了。只有分母是 2 的幂的十进制小数（0.5、0.25、0.75 等）能被二进制精确表示，这正是「为什么有的浮点计算看起来没问题」的原因。

### BigDecimal 的表示模型

`BigDecimal` 内部用两个字段描述一个数：

- **unscaledValue（非标度值）**：去掉小数点后的整数，用 `BigInteger` 存储，位数不限；
- **scale（标度）**：小数点右边的位数，`int` 类型。

例如 `19.99` 表示为 `unscaledValue = 1999, scale = 2`。运算全部在整数层面完成，再按 scale 对齐小数点，因此结果严格遵循十进制规则，不存在二进制舍入。理解了这两个字段，后文 `equals` 与 `compareTo` 的差异、`divide` 为什么必须指定舍入，就都顺理成章了。

## 深入机制

### 构造：字符串与 double 的天壤之别

```java
BigDecimal a = new BigDecimal(0.1);
System.out.println(a);
// 0.1000000000000000055511151231257827021181583404541015625

BigDecimal b = new BigDecimal("0.1");
System.out.println(b); // 0.1

BigDecimal c = BigDecimal.valueOf(0.1);
System.out.println(c); // 0.1
```

`new BigDecimal(double)` 会把 double 中那个已有误差的近似值**原封不动地完整展开**，误差被忠实继承。`new BigDecimal(String)` 按字面十进制解析，是精确构造的首选。`BigDecimal.valueOf(double)` 内部先经 `Double.toString()` 转成最短十进制表示再解析，结果与字符串构造一致，也能安全使用。结论：**金额对象永远不要从 double 直接构造**。

### 运算：不可变对象与除法的舍入契约

`BigDecimal` 是不可变类，`add`、`subtract`、`multiply`、`divide` 都返回新对象，不接收返回值等于白算：

```java
BigDecimal amount = new BigDecimal("10.00");
amount.add(new BigDecimal("2.00")); // 结果被丢弃
System.out.println(amount);         // 仍是 10.00

amount = amount.add(new BigDecimal("2.00"));
System.out.println(amount);         // 12.00
```

除法是最容易踩雷的运算。`10 / 3` 在十进制下也是无限小数，`BigDecimal` 拒绝替调用方猜精度，直接抛出 `ArithmeticException`：

```java
BigDecimal a = new BigDecimal("10");
BigDecimal b = new BigDecimal("3");
// a.divide(b);  // ArithmeticException: Non-terminating decimal expansion
BigDecimal r = a.divide(b, 2, RoundingMode.HALF_UP); // 3.33
```

`divide(divisor, scale, roundingMode)` 的三个参数就是一份契约：除不尽时保留几位、按什么规则舍入，全部由调用方负责。常用舍入模式（RoundingMode）如下：

| 模式 | 含义 | 2.4 舍入到个位 | 2.5 舍入到个位 |
| --- | --- | --- | --- |
| `UP` | 远离零方向进位 | 3 | 3 |
| `DOWN` | 靠近零方向截断 | 2 | 2 |
| `HALF_UP` | 四舍五入 | 2 | 3 |
| `HALF_EVEN` | 银行家舍入，等距时取偶数 | 2 | 2 |
| `UNNECESSARY` | 断言无需舍入，否则抛异常 | 异常 | 异常 |

金融业务常用 `HALF_UP`；需要减少大量舍入累积偏差的统计场景会选 `HALF_EVEN`；`UNNECESSARY` 则用于输入校验，让不合法的数据尽早暴露。

### 比较：equals 与 compareTo 的本质差异

```java
BigDecimal a = new BigDecimal("1.0");  // unscaledValue=10, scale=1
BigDecimal b = new BigDecimal("1.00"); // unscaledValue=100, scale=2
System.out.println(a.equals(b));       // false
System.out.println(a.compareTo(b));    // 0
```

`equals` 比较的是「表示」，要求 unscaledValue 和 scale 都相同；`compareTo` 比较的是「数值」，只做数学意义上的大小判断。**比较金额大小一律用 `compareTo`**。这个差异还会传导到集合：`HashMap`、`HashSet` 依赖 `equals` 与 `hashCode`，用 scale 不同的等值 `BigDecimal` 作键会插入两份，作键之前应先 `setScale` 统一精度。

另一个容易忽略的点在输出：`toString()` 在某些情况下（如 scale 为负或数值的有效位极小）会返回科学计数法形式的字符串；要得到纯数字字符串应使用 `toPlainString()`，对外接口输出金额时尤其要注意。

## 工程实践

- **入口即精确**：金额从 HTTP 参数、JSON 进来时通常是字符串，直接 `new BigDecimal(str)`；数据库 `DECIMAL` 字段直接映射为 `BigDecimal`，整条链路不经过 double。
- **除法三件套**：任何 `divide` 调用都显式给出 scale 和 `RoundingMode`，并把舍入规则写进业务约定，避免「代码里四舍五入、财务按别的口径对账」的规则分裂。
- **统一 scale 再入库**：写入前执行 `setScale(2, RoundingMode.HALF_UP)`，保证落库值与程序计算结果一致。
- **性能意识**：`BigDecimal` 的每次运算都伴随新对象分配与十进制对齐，开销比原生类型高一两个数量级。行情计算这类热点路径大量使用时需评估压力，常见做法是改用 long 存最小货币单位做整数运算，只在边界处转换。

## 对比与权衡

| 维度 | float / double | BigDecimal |
| --- | --- | --- |
| 表示模型 | 二进制浮点（IEEE 754） | 十进制：BigInteger + scale |
| 精度 | 有限，多数十进制小数带误差 | 精确，位数不受限 |
| 舍入控制 | 无 | 多种 RoundingMode 显式指定 |
| 运算性能 | 硬件指令，极快 | 对象分配 + 十进制运算，明显更慢 |
| 内存占用 | 4 / 8 字节 | 对象头 + BigInteger + scale，数十字节起 |
| 适用场景 | 科学计算、图形、统计 | 金额、计量、税率汇率 |

一句话：`double` 快而近似，`BigDecimal` 慢而精确，选型取决于业务能否容忍误差。

## 面试视角

**为什么 0.1 + 0.2 不等于 0.3？** 0.1 和 0.2 在二进制下都是无限循环小数，IEEE 754 只能保存最接近的近似值，两个近似值相加后误差叠加，结果与 0.3 的近似值不是同一个二进制数。这是所有遵循该标准的语言的共同行为，与 Java 实现无关。

**`new BigDecimal(0.1)` 与 `BigDecimal.valueOf(0.1)` 有什么区别？** 前者把 double 中已存在的近似值精确展开，构造出的对象带着长长的误差尾巴；后者先经 `Double.toString` 转成最短十进制表示再解析，得到的就是精确的 0.1。金额场景禁用 double 构造器。

**equals 和 compareTo 什么时候结果不一致？** `equals` 同时比较数值和 scale，`new BigDecimal("1.0")` 与 `new BigDecimal("1.00")` 不相等；`compareTo` 只比数值，返回 0。因此比较金额用 `compareTo`，放进 HashSet 或作 HashMap 键之前要统一 scale。

**divide 什么时候抛 ArithmeticException？** 商是无限循环小数、且调用的是不指定舍入模式的重载时。解法是使用 `divide(divisor, scale, roundingMode)`，或明确用 `RoundingMode.UNNECESSARY` 断言一定除得尽，让意外输入尽早失败。

**BigDecimal 为什么设计成不可变？** 不可变让对象天然线程安全、可以安全共享缓存（如 `BigDecimal.ZERO`），作为 HashMap 键的行为也稳定。代价是每次运算产生新对象，热点代码需要评估分配压力。

## 小结

- 精度丢失的根源是二进制浮点无法精确表示多数十进制小数，`BigDecimal` 用 `BigInteger + scale` 把十进制语义搬进 Java。
- 构造只用字符串或 `BigDecimal.valueOf`，`new BigDecimal(double)` 会继承 double 的误差。
- 运算返回新对象；除法必须显式指定 scale 与 RoundingMode。
- 比较大小用 `compareTo`；作集合键或入库前先统一 scale；对外输出用 `toPlainString()`。
- 精确有成本，极端性能场景可考虑 long 存最小单位，但金额链路内部绝不出现 double。
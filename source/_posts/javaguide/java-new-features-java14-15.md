---
title: "Java 14  & 15 新特性概览"
date: 2021-12-19 10:14:00
updated: 2021-12-19 10:14:00
permalink: knowledge/java/new-features/java14-15/
categories:
  - Java
tags:
  - Java新特性
  - Java14
  - Java15
description: "Java 14/15 承接预览特性：Records 亮相、instanceof 模式匹配登场、文本块转正、sealed 类预览，ZGC 与 Shenandoah 双双走出实验阶段。"
---

Java 14 与 15 承接前两个版本播下的预览种子：Records 首次亮相，instanceof 模式匹配开始预览，文本块在 15 转正，sealed 类登场，ZGC 与 Shenandoah 双双走出实验阶段。

<!-- more -->

## 版本定位

JDK 14 发布于 2020 年 3 月，JDK 15 发布于同年 9 月，依旧是非 LTS 版本，但分量不轻：switch 表达式在 14 率先转正，Records 开始两轮预览；15 把文本块转为正式特性、首次预览 sealed 类，并宣布 ZGC 和 Shenandoah 生产可用。语言层面"消灭样板代码"这条主线，在这两个版本变得非常清晰。

## Records（预览）

Java 里定义一个纯数据载体——DTO、坐标点、配置项——需要写字段、构造器、getter、equals/hashCode/toString，几十行代码里真正承载信息的往往只有两行字段声明。这类代码靠 IDE 生成不难，但读起来依然吵，后续加字段还得重新生成一遍。

Records 用一行声明解决：

```java
record Point(int x, int y) { }
```

编译器自动生成 private final 字段、规范构造器、与字段同名的访问器（`x()` 而不是 `getX()`），以及 equals、hashCode、toString。实例不可变，字段天然 final，类不能继承其他类（隐式继承 `java.lang.Record`），但可以实现接口。

使用注意：record 的定位是"透明的不可变数据载体"，不是实体类的替代品。需要可变状态、需要被框架代理的 JPA 实体，都不适合改成 record。它在 14 首次预览，15 二次预览时补充了局部 record 的支持，16 才转正。

## instanceof 模式匹配（预览）

老写法里，instanceof 判断通过后紧跟一次强制转换，类型信息写了两遍，既啰嗦又容易改错：

```java
if (obj instanceof String) {
    String s = (String) obj;
    System.out.println(s.trim());
}
```

14 预览的模式匹配让判断与绑定一步完成：

```java
if (obj instanceof String s) {
    System.out.println(s.trim());
}
```

模式变量 `s` 的作用域由编译器精确推导，只在能确定匹配成立的路径上可见；配合 `&&` 追加条件也很自然。这个特性 14 首次预览、15 二次预览、16 转正，是后续 switch 模式匹配的敲门砖，值得尽早熟悉。

## 文本块转正

Java 15 中文本块正式转正，不再需要 `--enable-preview`。此时规则已经完整：三引号定界、按结束引号位置剥离公共缩进、`\` 抑制换行、`\s` 表示空格。测试代码里内嵌 SQL、JSON 断言、HTML 片段的地方，可以放心大面积替换。配套的三个 String 方法——`formatted()`、`stripIndent()`、`translateEscapes()`——也随之一同转正。

## Sealed 类（预览）

过去想限制继承只有两档：`final` 彻底封死，或者完全放开。sealed 类提供了中间态——明确声明"只允许哪些子类继承我"：

```java
public abstract sealed class Shape permits Circle, Rectangle { }

public final class Circle extends Shape { }

public non-sealed class Rectangle extends Shape { }
```

每个被许可的子类必须三选一表态：`sealed`（继续密封）、`non-sealed`（重新开放）或 `final`（彻底封闭）。若许可的子类与父类在同一个源文件内，permits 子句可以省略，编译器会自动推导。这让"封闭类型层级"第一次有了语言表达力，也为后来模式匹配的穷尽性检查打下基础。它在 15 首次预览、16 二次预览，17 才转正，眼下了解思路即可。

## ZGC 与 Shenandoah 转正

Java 15 将 ZGC 与 Shenandoah 双双从实验转为正式特性：前者追求亚毫秒级停顿，后者强调停顿时长与堆大小解耦。至此低暂停收集器有了两个生产可用选项，分别用 `-XX:+UseZGC` 和 `-XX:+UseShenandoahGC` 启用。默认收集器仍是 G1——停顿目标能达成就不必换，换收集器要有压测数据支撑。

## 升级建议

两个版本都是短期支持，不适合生产长驻，但预览内容指向明确：Records 和 instanceof 模式匹配将在 16 转正，提前在分支上试写，等 17 LTS 到来即可直接享用。存量项目注意，15 彻底移除了 Nashorn JavaScript 引擎，依赖它执行脚本的服务需要提前迁移方案。

## 小结

- Records 预览：一行声明换来不可变数据载体全家桶，样板代码清零，但它不是实体替代。
- instanceof 模式匹配预览：判断即绑定，告别手动强转，作用域由编译器把控。
- 文本块 15 转正，转义与配套 API 全部定稿，可以放心使用。
- sealed 类预览：继承控制从"全开或全关"变为白名单制。
- ZGC、Shenandoah 15 转正，低暂停 GC 正式进入生产选型清单。
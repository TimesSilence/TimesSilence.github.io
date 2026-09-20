---
title: "《Java8 指南》中文翻译"
date: 2021-11-02 15:39:00
updated: 2021-11-02 15:39:00
permalink: knowledge/java/new-features/java8-tutorial-translate/
categories:
  - Java
tags:
  - Java新特性
  - Java8
description: "以循序渐进的顺序组织 Java 8 三大核心特性（Lambda、Stream、日期时间 API）的自学路径，每一步配可运行的小练习。"
---

Java 8 的特性清单不短，但主线只有三条：Lambda、Stream、新的日期时间 API。本篇不罗列知识点，而是给出一套循序渐进的自学路径：先铺语法地基，再上流水线，最后收尾工具类，每一步都配可运行的小练习。

<!-- more -->

## 第一阶段：接口的变化（地基）

Lambda 能够落地，前提是接口允许 `default` 和 `static` 方法。先弄清两件事：default 方法是可以被实现类继承和重写的实例方法，static 方法则只能通过接口名调用；当一个类实现的两个接口存在同名默认方法时，必须重写，并可用 `接口名.super.方法名()` 显式选择一方。接着理解函数式接口（SAM）：只有一个抽象方法的接口，`@FunctionalInterface` 只是编译期校验。这个阶段达标的标准，是能向别人解释清楚「为什么 `Comparator`、`Runnable` 可以直接写成 Lambda」。

## 第二阶段：Lambda 与方法引用

建议按下面的顺序练习：

1. 把匿名内部类改写成 Lambda：先 `Runnable`，再 `Comparator`，最后自定义一个 SAM 接口。
2. 掌握三种形态：`() -> 表达式`、`x -> 表达式`、`(x, y) -> { 语句块; }`。
3. 吃透四种方法引用：静态方法 `String::valueOf`、特定对象的实例方法 `System.out::println`、任意对象的实例方法 `String::length`、构造器引用 `ArrayList::new`。
4. 熟练 `java.util.function` 四件套：Predicate 做判断、Function 做转换、Consumer 做消费、Supplier 做供给。

```java
Comparator<String> byLength = Comparator.comparingInt(String::length);
```

两个易错点提前标记：Lambda 捕获的局部变量必须事实上 final；Lambda 里的 `this` 指向外围类，而不是匿名实现本身。

## 第三阶段：Stream 流水线

Stream 是这条路径的核心收益。先建立两类操作的直觉：中间操作（`filter`、`map`、`sorted`）是惰性的，只记账不执行；终止操作（`collect`、`forEach`、`reduce`）才会触发整条流水线。

```java
List<String> result = words.stream()
        .filter(w -> w.length() > 3)
        .map(String::toUpperCase)
        .distinct()
        .sorted()
        .collect(Collectors.toList());
```

练习顺序：先把 `filter`、`map`、`collect` 练熟，再碰 `sorted`、`distinct`、`limit`，最后理解 `reduce` 和常用 Collector（`groupingBy`、`partitioningBy`、`joining`）。并行流 `parallelStream()` 放到最后：知道它共享 `ForkJoinPool` 公共线程池、只在无状态且计算密集的大数据量场景有效即可，初学阶段默认不用。

## 第四阶段：Optional 收尾

Optional 不需要太多篇幅，记住一条纪律：它只作为方法的返回值，不当实体字段、不当方法参数。调用侧用 `map`、`flatMap`、`filter` 做链式变换，用 `orElse`、`orElseGet`、`orElseThrow` 收尾，永远不在未判断的情况下裸调 `get()`。

## 第五阶段：日期时间 API

`java.time` 的学习性价比极高，因为旧 `Date` 与 `Calendar` 的坑——可变、线程不安全、月份从 0 开始——几乎每个 Java 开发者都踩过。按场景记三件套：本地日期时间用 `LocalDateTime`，带时区用 `ZonedDateTime`，机器时间戳用 `Instant`；格式化统一用线程安全的 `DateTimeFormatter`，可以定义成 `static final` 常量。迁移旧代码时记住两座桥：`Date.toInstant()` 与 `Date.from(instant)`。

## 学习方法建议

- 每个主题写一个最小可运行 demo；JDK 9 以上的环境可以直接用 JShell 逐行验证 API 行为，比只看文档记得牢。
- 以「能给别人讲清楚」作为学会的标准：比如能不能解释 Stream 为什么可以少遍历、Optional 为什么不能做字段。
- 学完一轮后回到真实代码做对照改造：把一个匿名内部类、一段 for 循环聚合、一处 `SimpleDateFormat`，分别用新写法重写一遍，知识才算真正落地。

## 小结

这条路径的内在逻辑是：接口演进让 Lambda 成为可能，Lambda 让 Stream 值得存在，Stream 让集合处理完成换代，Optional 与 java.time 则是同一波工程思维对历史问题的清理。按这个顺序走，每一步都是下一步的铺垫。
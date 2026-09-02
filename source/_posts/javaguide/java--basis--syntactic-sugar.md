---
title: "Java 语法糖详解"
date: 2017-11-17 08:10:00
updated: 2017-11-17 08:10:00
permalink: knowledge/java/basis/syntactic-sugar/
categories:
  - Java
tags:
  - Java基础
  - 语法糖
description: "了解增强 for、自动装箱、泛型、Lambda 等语法糖在编译期的脱糖结果。"
---

语法糖不改变语义，只让代码更简洁；理解「编译后长什么样」有助于调试字节码、排查泛型擦除与性能问题。

<!-- more -->

## 核心概念

常见糖：**增强 for** → 迭代器循环；**自动装箱/拆箱** → `Integer.valueOf`/`intValue`；**泛型** → 擦除+桥方法；**枚举** → 合成类与静态数组；**try-with-resources** → finally 关闭；**Lambda** → `invokedynamic` + 函数式接口。Switch 字符串/模式（新 JDK）同样是编译期变换。

## 关键机制与实践

用 `javap -c` 或 IDE 反编译查看脱糖结果。自动装箱在循环里可能产生大量临时对象；`Integer` 缓存 -128~127 导致 `==` 与 `equals` 表现不一致。增强 for 遍历 `ConcurrentModificationException` 时在并发修改集合会 fail-fast（除非用并发容器或迭代器 remove 规则）。

```java
// 源码：for (String s : list) { ... }
// 近似：for (Iterator<String> it = list.iterator(); it.hasNext(); ) {
//           String s = it.next(); ... }
```

## 常见误区与小结

- 认为 Lambda「就是匿名内部类」（JDK 8 起实现机制不同）。
- 在 null 上自动拆箱 NPE。
- 枚举比较用 `==` 可以，但序列化/反射构造枚举需知单例保证。

读源码与调优时，**把糖还原成 JVM 看得懂的形式**，很多「玄学」行为就清楚了。
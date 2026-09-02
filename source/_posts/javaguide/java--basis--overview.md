---
title: "Java 基础专题：语法、面向对象、泛型、反射、代理与序列化"
date: 2017-09-22 09:07:00
updated: 2017-09-22 09:07:00
permalink: knowledge/java/basis/overview/
categories:
  - Java
tags:
  - Java基础
  - 学习路线
description: "梳理 Java 基础专题的学习路径，涵盖语法、OOP、泛型、反射、代理与序列化等核心能力。"
---

Java 基础不是背语法清单，而是理解对象模型、参数传递、泛型擦除、反射调用和框架扩展机制——这些是集合、并发、JVM 与 Spring 的共同前置。

<!-- more -->

## 核心概念

Java 基础可拆为四块：**语言语法与 OOP**（类、继承、多态、异常）、**类型与参数语义**（值传递、引用变量）、**编译期类型系统**（泛型、通配符、擦除）以及**运行时元编程**（反射、动态代理、SPI、序列化）。面试与工程里反复出现的，往往是后三块与日常写法的落差。

## 关键机制与实践

建议按「能写代码 → 能解释行为 → 能读框架」递进：先过语法与 OOP，再专门攻克值传递与 `equals`/`hashCode`；然后学泛型与通配符的 PECS 原则；最后补反射、JDK/CGLIB 代理、SPI 与序列化边界。读 Spring、MyBatis 源码前，至少应能说明 `@Autowired` 和 Mapper 接口为何离不开反射与代理。

## 常见误区与小结

- 把「对象引用当引用传递」与 Java 只有值传递混为一谈。
- 认为 `List<String>` 运行时仍带类型信息（擦除后都是 raw type）。
- 生产环境直接使用 JDK 原生序列化或随意使用 `Unsafe`。

基础扎实的标准：遇到框架魔法能追到 Class、Method、Proxy 或 `META-INF/services`，而不是只会调 API。
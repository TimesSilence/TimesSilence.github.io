---
title: "Java 关键字总结"
date: 2017-10-09 12:28:00
updated: 2017-10-09 12:28:00
permalink: knowledge/java/basis/java-keyword-summary/
categories:
  - Java
tags:
  - Java基础
  - 关键字
description: "系统梳理 final、static、this、super 等 Java 关键字的语义与使用场景。"
---

Java 关键字约五十个，面试与 Code Review 里高频的是修饰类/成员可见性与生命周期的几个：`final`、`static`、`this`、`super`、`volatile`、`transient` 等。

<!-- more -->

## 核心概念

**final**：类不可继承、方法不可重写（private 隐式 final）、变量引用不可改（基本类型值不可变）。**static**：属于类而非实例，静态块/方法无 `this`，常见单例与工具类。**this/super**：构造链调用、区分同名成员、访问父类被隐藏成员。**volatile**：保证可见性与有序性，不保证复合操作原子性。

## 关键机制与实践

静态方法不能被重写（可被隐藏）；实例方法通过虚表分派。`static` 字段在类加载初始化阶段赋值，注意与实例字段初始化顺序。接口中的 `default`/`static` 方法（Java 8+）改变了「接口纯抽象」的旧印象，但成员仍默认 `public static final`。

```java
class Parent { void greet() { System.out.println("parent"); } }
class Child extends Parent {
    @Override void greet() { super.greet(); System.out.println("child"); }
}
```

## 常见误区与小结

- 以为 `final` 修饰引用类型则对象内部字段也不可变（只是引用地址不变）。
- 在静态方法里访问非静态成员（编译错误）。
- 把 `volatile` 当锁用，对 `i++` 仍非原子。

关键字题要答到「编译器检查什么、JVM 运行时什么行为」，而不是只背定义。
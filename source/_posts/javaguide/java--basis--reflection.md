---
title: "Java 反射机制详解"
date: 2017-10-28 15:49:00
updated: 2017-10-28 15:49:00
permalink: knowledge/java/basis/reflection/
categories:
  - Java
tags:
  - Java基础
  - 反射
description: "理解 Class 对象、反射 API 与在 Spring、MyBatis 等框架中的典型用法及性能考量。"
---

反射让程序在运行时检查与调用类成员，是「框架能扫描注解、注入 Bean、映射 SQL 字段」的底层能力之一；日常业务应克制使用，读框架与写扩展点时则离不开它。

<!-- more -->

## 核心概念

**Class 对象**代表加载后的类型元数据。获取方式：`类名.class`、`对象.getClass()`、`Class.forName()`、类加载器 `loadClass()`（后两者触发时机略有不同）。核心 API：`getDeclaredFields/Methods/Constructors`、`newInstance`（已废弃路径）、`Field#setAccessible`、`Method#invoke`。

## 关键机制与实践

Spring 解析 `@Component` 扫描 classpath；MyBatis 将结果集映射到 POJO 字段；JUnit 跑 `@Test` 方法——都依赖反射。JDK 动态代理的 `invoke` 同样调用 `Method.invoke`。性能方面：首次反射有校验开销，可缓存 `Method`/`Constructor` 并配合 `setAccessible(true)`；极端场景可用 `MethodHandle` 或字节码生成。

```java
Class<?> clazz = Class.forName("com.example.User");
Object user = clazz.getDeclaredConstructor().newInstance();
Method m = clazz.getMethod("setName", String.class);
m.invoke(user, "demo");
```

## 常见误区与小结

- 混淆 `getMethods`（含继承 public）与 `getDeclaredMethods`（仅本类声明）。
- 每调用都 `forName` 且不缓存，放大性能问题。
- 反射绕过泛型检查导致 `ClassCastException` 延迟到运行时。

反射是双刃剑：**框架用它换灵活性，业务代码优先用编译期类型安全 API**。
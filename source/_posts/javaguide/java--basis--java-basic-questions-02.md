---
title: "Java基础常见面试题总结(中)"
date: 2017-12-07 11:31:00
updated: 2017-12-07 11:31:00
permalink: knowledge/java/basis/java-basic-questions-02/
categories:
  - Java
tags:
  - Java基础
  - 面试
description: "归纳 Java 基础面试中段主题：异常体系、泛型、反射、注解与常见易错点。"
---

「Java 基础面试（中）」通常承接语法与 OOP，转向异常处理、资源管理、泛型、反射与注解——这些题考察的是「异常会不会吞」「注解谁在解析」。

<!-- more -->

## 核心概念

**异常**：`Throwable` 分 `Error` 与 `Exception`；受检异常必须处理或声明，非受检（`RuntimeException`）可选。**try-with-resources** 自动关闭 `AutoCloseable`，比手动 finally 更安全。**反射**在运行时获取 `Class`、字段与方法；**注解**本身只是元数据，生效依赖编译器或运行时处理器（如 Spring 扫描 `@Component`）。

## 关键机制与实践

回答面试题时建议分层：先说语言规则，再说 JVM/框架怎么用。例如「反射为什么慢」——方法访问需校验与装箱，且难以内联；框架通过缓存 `Method`、使用 `MethodHandle` 或字节码生成优化。注解三要素：定义、保留策略（SOURCE/CLASS/RUNTIME）、处理方（编译期 APT 或运行时 Reflection）。

## 常见误区与小结

- `catch (Exception e) {}` 空块吞掉故障，线上难排查。
- 把反射性能问题当成「完全不能用」（框架已大量缓存与优化）。
- 以为加了 `@Transactional` 就一定有事务（需代理与 AOP 生效条件）。

本篇适合与「上/下」两文串联：形成语法 → 机制 → 细节的完整复习闭环。
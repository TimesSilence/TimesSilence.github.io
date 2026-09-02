---
title: "Java基础常见面试题总结(下)"
date: 2017-12-14 12:38:00
updated: 2017-12-14 12:38:00
permalink: knowledge/java/basis/java-basic-questions-03/
categories:
  - Java
tags:
  - Java基础
  - 面试
description: "梳理 Java 基础面试下篇：I/O、NIO 概览、深拷贝、对象创建与进阶易错细节。"
---

基础面试下篇往往更偏工程细节：对象怎么创建、拷贝是深是浅、I/O 模型差异、以及容易被忽略的语言边角。

<!-- more -->

## 核心概念

**对象创建路径**：new、反射、克隆、反序列化，以及 `Unsafe` 等非常规手段。**浅拷贝 vs 深拷贝**：`clone()` 默认浅拷贝，引用字段仍共享；深拷贝需递归复制或序列化（有代价）。**BIO/NIO/AIO**：阻塞 I/O、多路复用与非阻塞回调，Netty 等高性能网络库建立在其上。

## 关键机制与实践

面试答「创建对象几种方式」时，按使用频率与可读性排序，并补充单例、工厂、池化等设计层模式。谈 I/O 时区分「字节流/字符流」「缓冲」「NIO 的 Channel/Buffer/Selector」。涉及 `String` 常量池、`Integer` 缓存 (-128~127) 等，用简短代码验证比背结论更有说服力。

## 常见误区与小结

- 认为 `clone()` 一定是深拷贝。
- 把 NIO 等同于「一定比 BIO 快」（小连接、低并发场景未必）。
- 忽略 `transient`、`serialVersionUID` 与自定义 readObject 对序列化的影响。

下篇题零散但实战命中率高：每题最好能关联到一个真实 bug 或性能案例。
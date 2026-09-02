---
title: "Java 魔法类 Unsafe 详解"
date: 2017-11-24 09:17:00
updated: 2017-11-24 09:17:00
permalink: knowledge/java/basis/unsafe/
categories:
  - Java
tags:
  - Java基础
  - Unsafe
  - 并发
description: "了解 sun.misc.Unsafe 的内存、CAS 与对象操作能力及 JUC 中的底层用法。"
---

`Unsafe` 提供接近 C 指针的低层能力：直接内存、字段偏移、CAS、绕过构造器实例化对象。`Atomic*`、`ConcurrentHashMap` 等 JUC 组件在 JDK 8 及以前大量依赖它。

<!-- more -->

## 核心概念

位于 `sun.misc`/`jdk.internal.misc`，单例获取受类加载器限制（普通代码直接 `getUnsafe()` 会抛 `SecurityException`）。能力包括：`allocateMemory` 堆外内存、`compareAndSwap*` 原子更新、按偏移读写对象字段、`park/unpark` 线程阻塞唤醒。实现依赖 **native** 方法。

## 关键机制与实践

业务代码不应直接使用；读 JUC 源码时关注 CAS 循环与 `volatile` 语义。Java 9+ 模块系统进一步封装 Unsafe，官方倾向 `VarHandle` 与 `Foreign Memory API` 替代。若学习实验，可通过反射读取 `theUnsafe` 静态字段（仅限本地理解，勿用于生产）。

```java
// 概念示例：CAS 自增思想（实际用 AtomicInteger）
// while (!unsafe.compareAndSwapInt(obj, offset, expect, update)) { ... }
```

## 常见误区与小结

- 误用堆外内存不释放导致泄漏。
- 以为 CAS 一定比 synchronized 快（高竞争下 CAS 自旋更糟）。
- 在 JDK 17+ 仍依赖内部 API 导致模块反射警告。

**Unsafe 是并发与性能优化的幕后工具，不是应用层 API**；理解它有助于读源码，不等于鼓励手写。
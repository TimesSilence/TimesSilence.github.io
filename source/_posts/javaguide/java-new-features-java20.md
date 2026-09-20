---
title: "Java 20 新特性概览"
date: 2022-02-05 15:49:00
updated: 2022-02-05 15:49:00
permalink: knowledge/java/new-features/java20/
categories:
  - Java
tags:
  - Java新特性
  - Java20
description: "Java 20 新特性详解：虚拟线程第二次预览、Scoped Values 首次孵化、结构化并发第二次孵化，看并发新范式如何为 Java 21 铺路。"
---

Java 20 于 2023 年 3 月发布，是不提供长期支持的过渡版本，七项 JEP 全部处于预览或孵化状态。这个版本的看点不在「能直接上生产」，而在虚拟线程、作用域值、结构化并发这条并发新路线的持续打磨——它们都将在下一个版本 Java 21 迎来转正的关键节点。

<!-- more -->

## 版本定位

Java 20 是 Java 19 之后的短期版本，维护窗口只有六个月，生产环境一般不会直接部署。它的真正价值是作为 LTS 版本 Java 21 的最后一块试验田：虚拟线程第二次预览（JEP 436）、作用域值首次孵化（JEP 429）、结构化并发第二次孵化（JEP 437），同时 Record 模式、switch 模式匹配、外部函数与内存 API、Vector API 各自再迭代一轮。读这个版本，重点是把「并发三件套」的设计意图想明白，而不是背 API。

## 虚拟线程：第二次预览

虚拟线程是由 JVM 自行调度的轻量级线程：成千上万个虚拟线程复用少量平台线程（载体线程），一旦遇到阻塞操作就自动从载体上卸载，让载体转去执行其他虚拟线程。它让「一个请求一个线程」的朴素同步写法重新变得可行。Java 19 首次预览之后，Java 20 基本冻结了 API 形态，只做少量打磨，为转正铺路。

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 10_000; i++) {
        int id = i;
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return id;
        });
    }
} // try-with-resources 会等待全部任务结束
```

注意两点：预览阶段需要 `--enable-preview` 才能编译运行；虚拟线程廉价但不免费，CPU 密集型任务并不会因为它而变快。

## 作用域值：ThreadLocal 的现代替代

### 动机：ThreadLocal 的三块短板

ThreadLocal 的问题在虚拟线程时代被急剧放大。其一，生命周期依赖显式 `remove()`，线程池里忘记清理就是内存泄漏加脏数据串请求；其二，值可以随时 `set()` 改写，跨方法传递时很难追踪谁在何处动了它；其三，子线程继承依赖 `InheritableThreadLocal` 拷贝父线程数据，百万级虚拟线程下这份拷贝代价无法接受。

### 用法与示例

作用域值（ScopedValue，JEP 429 首次孵化）把模型改成「绑定一次、作用域内只读、离开自动回收」：

```java
static final ScopedValue<String> USER = ScopedValue.newInstance();

ScopedValue.where(USER, "alice").run(() -> {
    // 此作用域内任意调用深处都能读到
    handleRequest(); // 内部 USER.get() 返回 "alice"
});
// 离开 run 的作用域后自动失效，无需 remove
```

不可变、结构化生命周期、配合结构化并发时子线程零拷贝共享，恰好补齐 ThreadLocal 的三块短板。注意它在 Java 20 中还是 incubator API，位于 `jdk.incubator.concurrent` 模块，方法签名后续版本仍可能调整，生产使用要等它转正。

## 结构化并发：第二次孵化

痛点很日常：用 `ExecutorService` 手动 fan-out 多个子任务时，某个子任务一旦失败，其余任务的取消、异常聚合、线程泄漏都得自己处理，线程 dump 里也看不出任务的父子关系，排障全靠猜。

`StructuredTaskScope` 把一组并发子任务视为一个工作单元：任一子任务失败可以取消其余任务，主任务等待全部子任务结束后再继续，关闭作用域即回收其创建的所有线程：

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var user  = scope.fork(() -> fetchUser(id));
    var order = scope.fork(() -> fetchOrders(id));
    scope.join().throwIfFailed();
    return new Profile(user.get(), order.get());
} // 作用域关闭时线程自动回收
```

Java 20 这轮孵化的实质改动只有一处，但意义重大：作用域内创建的线程可以继承 Scoped Values。两个特性正式咬合，「结构化并发管任务、作用域值传上下文」的组合拳就此成型。

## 工程实践与升级建议

非 LTS 版本不建议上生产，但非常适合做技术预研：在测试环境跑一轮虚拟线程压测，摸清现有阻塞调用链的承载上限；把 ThreadLocal 传递上下文的关键路径改写成 ScopedValue 雏形；挑几处 fan-out 调用用结构化并发重写。这些积累在升 Java 21 时能直接复用。此阶段主流框架（Tomcat、Spring 等）刚开始提供虚拟线程相关选项，整体处于观望期，不必急于跟进。

## 小结

Java 20 的戏份集中在并发新范式：虚拟线程 API 定型、Scoped Values 首次登场、结构化并发补齐上下文继承。三者单看都只是预览或孵化，合起来却是 Java 21 那张 LTS 答卷的草稿。读懂这一版的设计动机，下一版的正式特性会顺理成章。
---
title: "CompletableFuture 详解"
date: 2020-09-06 10:24:00
updated: 2020-09-06 10:24:00
permalink: knowledge/java/concurrent/completablefuture-intro/
categories:
  - Java
tags:
  - Java并发
  - CompletableFuture
description: "从 Future 的阻塞 get 与不可编排谈起，梳理 CompletableFuture 的链式编排体系、异常处理机制与默认线程池的隐蔽陷阱。"
---

CompletableFuture 把「任务完成后的动作」注册为回调，用 thenApply、thenCompose、thenCombine、allOf 拼出异步流水线，解决了 Future 只能阻塞取结果、无法编排的老问题；但默认线程池与异常处理里的坑同样不少。本文按「为什么—怎么用—怎么避坑」展开。

<!-- more -->

## 它解决什么问题

JDK 5 的 Future 让任务可以异步提交，但拿结果只有 `get()` 一条路——阻塞当前线程直到完成。更致命的是 Future 之间无法表达关系：「A 完成后把结果交给 B」「A、B 都完成后合并」这类编排只能手写轮询加阻塞，写着写着就退回串行。CompletableFuture（JDK 8）同时实现 Future 与 CompletionStage：前者保留结果载体的语义，后者定义了一整套阶段组合操作，把回调注册进流水线，任务完成时自动触发后续阶段，主线程全程不必空等。

典型收益场景是聚合类接口：用户信息、订单列表、推荐位彼此无依赖，串行调用耗时相加；用 CompletableFuture 并行编排后，总耗时约等于最慢的一路。

## 核心原理

CompletionStage 的心智模型是「阶段 + 依赖」：每个阶段持有一个结果（正常值或异常），后续阶段通过组合方法声明「我依赖你，完成后请用约定的方式消费你的结果」。所有组合方法都有三个变体：不带 Async 的同步版本（由完成上一阶段的线程或当前调用线程就地执行）、带 Async 的默认池版本、带 Async + Executor 的指定池版本。这一区分决定了回调跑在哪个线程上，也是后文线程池陷阱的根源。

异常沿流水线向下传播：某阶段抛出异常后，其后的普通阶段全部被跳过，直到遇见 exceptionally 或 handle 这类「能消化异常」的阶段为止。这让错误处理可以集中在流水线尾部，语义上接近一段跨越异步边界的 try-catch。

## 深入机制

### 创建任务

```java
ExecutorService ioPool = new ThreadPoolExecutor(16, 32, 60L, TimeUnit.SECONDS,
        new LinkedBlockingQueue<>(1000));

// supplyAsync 有返回值，runAsync 无返回值；生产环境务必传入自定义池
CompletableFuture<User> userFuture =
        CompletableFuture.supplyAsync(() -> userService.getById(uid), ioPool);
```

### 编排四件套

```java
// 1. thenApply：同步变换结果，类似 map
CompletableFuture<String> nameFuture = userFuture.thenApply(User::getName);

// 2. thenCompose：上一步结果作为下一个异步任务的入参，拍平嵌套，类似 flatMap
CompletableFuture<List<Order>> ordersFuture = userFuture.thenCompose(user ->
        CompletableFuture.supplyAsync(() -> orderService.listByUser(user.getId()), ioPool));

// 3. thenCombine：两个独立阶段都完成后合并，类似 zip
CompletableFuture<Page> pageFuture = userFuture.thenCombine(ordersFuture,
        (user, orders) -> new Page(user, orders));

// 4. allOf：等待任意多个阶段全部完成；各任务结果仍需分别取回
CompletableFuture<Void> all = CompletableFuture.allOf(userFuture, ordersFuture, recFuture);
all.join();
```

thenCompose 与 thenCombine 的分野是最常被追问的点：前者表达「先后依赖」，把函数返回的新阶段展平成一级流水线；后者表达「并行独立」，两个阶段互不依赖、都完成后用 BiFunction 合并。要注意 thenCombine 自己不负责启动任务——是否真的并行，取决于两个 future 的创建方式与所用执行器。

### 异常处理与超时护栏

```java
CompletableFuture<String> safe = CompletableFuture
        .supplyAsync(() -> riskyCall(), ioPool)
        .exceptionally(ex -> {          // 仅异常时执行，返回兜底值，流水线恢复正常
            log.warn("fallback: {}", ex.toString());
            return "default";
        });

CompletableFuture<String> handled = CompletableFuture
        .supplyAsync(() -> riskyCall(), ioPool)
        .handle((res, ex) -> ex == null ? res : "default"); // 成败都会进入

// JDK 9+ 的超时护栏：到期自动以 TimeoutException 异常完成
CompletableFuture<String> guarded = safe.orTimeout(2, TimeUnit.SECONDS);
```

三者分工：exceptionally 只在异常时兜底；handle 无论成败都执行并可产出新值；whenComplete 只观察不转换，适合记录日志。orTimeout 给慢调用加上护栏，避免 join 时无限等待；若想超时给兜底值而非异常，用 completeOnTimeout。

## 工程实践

- **永远显式传线程池**。不带 Executor 的 Async 方法默认跑在 ForkJoinPool.commonPool——那是为并行流这类 CPU 任务设计的全局共享池，并行度通常只有「核数减一」。阻塞型 I/O 任务塞进去，很快把池占满，全应用共享它的代码一起挨饿。
- **按任务特性分池**：CPU 密集阶段可用 commonPool 或专用计算池；I/O 阶段用按下游容量估算的独立池，并为队列与拒绝策略设上限。
- **少用 get，join 也要限时**：两者都会阻塞当前线程。聚合后必须取结果时，组合 orTimeout 兜底；get 务必使用带超时的重载。
- **异常别丢在半路**：allOf 中任一阶段异常，整体立即异常完成，但其余任务仍在后台执行；需要逐任务成败明细时，应给各阶段先挂 handle 再聚合。回调会切换线程，日志里的 traceId 等 ThreadLocal 上下文需显式传递。
- **acceptEither/anyOf 不是可靠的「最快成功」选择器**：先异常完成的阶段可能让整个组合异常收场，多副本竞速场景需自行包装异常。

## 对比与权衡

| 维度 | Future + 线程池 | CompletableFuture | 反应式（Mono/Flux） |
| --- | --- | --- | --- |
| 取结果 | 阻塞 get | 回调驱动，可编排 | 订阅驱动 |
| 任务编排 | 手写阻塞等待 | thenCompose / thenCombine / allOf | 更丰富的操作符体系 |
| 异常处理 | try-catch 包住 get | exceptionally / handle 声明式 | onError 系列操作符 |
| 背压 | 无 | 无 | 原生支持 |
| 适用场景 | 简单异步提交 | 服务端聚合编排、并行调用 | 流式数据、长链路异步 |

## 面试视角

**CompletableFuture 相对 Future 解决了什么？** Future 只能阻塞 get 拿结果，且任务之间无法表达依赖。CompletableFuture 通过 CompletionStage 把任务抽象为可组合阶段，支持串行依赖、并行聚合与声明式异常处理，主线程不再被 get 拖住。

**thenCompose 与 thenCombine 的区别？** thenCompose 处理串行依赖：上一阶段结果作为下一阶段入参，并把嵌套的 future 展平，语义类似 flatMap；thenCombine 处理并行独立：两个阶段无依赖、各自执行，都完成后合并结果，语义类似 zip。

**默认线程池有什么坑？** 不显式指定 Executor 的异步方法默认使用 ForkJoinPool.commonPool。它全局共享、按核数设定并行度、为 CPU 任务设计；跑阻塞 I/O 会迅速耗尽线程，拖垮所有共享它的业务。生产环境必须为 I/O 任务配置独立线程池。

**exceptionally 与 handle 有何差异？** exceptionally 仅在异常完成时触发，返回兜底值让流水线恢复正常；handle 在正常与异常完成时都会触发，可同时基于结果和异常产出新值。只想观察不转换时用 whenComplete。

**allOf 中一个任务失败会怎样？** allOf 返回的 future 会以异常完成，join 抛出 CompletionException，但其余任务继续执行。若需要汇总每个任务的结果或异常，应对各阶段单独 handle 或 exceptionally 后再聚合。

## 小结

- CompletableFuture 的价值在于编排：thenApply 变换、thenCompose 串联依赖、thenCombine 并行合并、allOf/anyOf 聚合；异常沿流水线传播，由 exceptionally/handle 收口。
- 生产环境两条底线：Async 方法显式传独立线程池，所有 join/get 都有超时护栏。
- 阻塞 I/O 切勿丢进 commonPool；allOf 的失败语义是「快速失败、任务照跑」，按需为单任务补齐异常记录。
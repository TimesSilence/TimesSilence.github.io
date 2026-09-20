---
title: "Java 11 新特性概览（重要）"
date: 2021-11-30 08:00:00
updated: 2021-11-30 08:00:00
permalink: knowledge/java/new-features/java11/
categories:
  - Java
tags:
  - Java新特性
  - Java11
description: "Java 11 LTS 核心特性梳理：新 String 方法、标准 HttpClient、Lambda 参数支持 var、单文件源码运行与实验性 ZGC。"
---

Java 11 是 Java 8 之后第一个 LTS 版本，带来标准化的 HttpClient、一批顺手的 String 方法，以及实验性的 ZGC，是大量企业升级的共同落点。

<!-- more -->

## 版本定位

2018 年 9 月发布的 Java 11 承接了 9 和 10 的全部变化并进入长期支持，许多公司从 Java 8 直接跳到这里，使它成为事实上的一代基准。语言层面只是小修小补，但运行时的分量很重：HttpClient 转正、ZGC 登场，同时移除了 Java EE 相关模块，升级前需要认真盘点依赖。

## String 新方法

一批过去依赖 Apache Commons Lang 或手写工具类的字符串操作进入了标准库：

```java
" ".isBlank();             // true：空串或仅含空白字符
" Java ".strip();          // "Java"：去除首尾空白
"Java".repeat(2);          // "JavaJava"
"a\nb\nc".lines().count(); // 3：按行终止符拆成 Stream
```

注意 `strip()` 与老的 `trim()` 并不等价：`trim()` 只处理码点不超过空格的字符，`strip()` 按 Unicode 空白判断，覆盖范围更大，新代码应统一使用 `strip()`、`stripLeading()`、`stripTrailing()`。`lines()` 返回的是 Stream，天然衔接过滤、统计等后续操作。

## 标准 HttpClient

`HttpURLConnection` 的 API 陈旧、不支持 HTTP/2、异步写法别扭，社区长期靠 Apache HttpClient 和 OkHttp 补位。Java 9 开始孵化、Java 11 正式标准化的 `java.net.http` 终于给出了标准答案：

```java
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://example.com/api"))
        .build();

// 同步发送
HttpResponse<String> resp =
        client.send(request, HttpResponse.BodyHandlers.ofString());

// 异步发送，基于 CompletableFuture
client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
        .thenApply(HttpResponse::body)
        .thenAccept(System.out::println);
```

默认尝试 HTTP/2，服务器不支持时自动协商回落到 HTTP/1.1；异步模型建立在 `CompletableFuture` 之上，与现有并发代码组合顺畅。使用注意：默认超时策略偏保守，生产环境建议显式设置 `connectTimeout`、HTTP 版本偏好和自定义 Executor，避免突发流量下的意外行为。此外，这套 API 还内置了 WebSocket 支持（`HttpClient.newWebSocketBuilder()`），长连接场景同样不必再引入第三方库。

## var 用于 Lambda 参数

Java 10 引入的 var 不能用于 Lambda 形参，Java 11 补上了这个口子：

```java
BinaryOperator<Integer> add = (var a, var b) -> a + b;
```

看上去纯属多余——`(a, b) -> a + b` 本来就能编译。真正的动机是语法统一：只有写成 var 形式，才能给参数附加注解，例如 `(@NotNull var s) -> s.length()`。规则上要么所有参数都用 var，要么都不用，不允许与显式类型混搭。

## 单文件源码运行

以前跑一个 Java 小工具必须先 `javac` 再 `java`，Java 11 允许直接 `java Hello.java`：源码在内存中编译后立即执行，磁盘上不产生 .class 文件。约束是所有相关类必须定义在同一个文件里，且以文件中第一个类的 main 方法作为入口。这让 Java 勉强具备了脚本语言的手感，配合 JShell 进一步降低了教学和快速验证的成本。

## ZGC 实验性引入

ZGC 的目标相当激进：停顿时间控制在 10ms 量级，且停顿不随堆大小增长，堆可以从几百 MB 扩展到 TB 级。Java 11 中以实验特性提供，需要 `-XX:+UnlockExperimentalVMOptions -XX:+UseZGC` 显式开启，且当时仅支持 Linux/x64。这个阶段它更适合预研和压测，不建议直接用于生产；ZGC 到后续版本才转为正式特性。

## 其他值得关注的变化

- **Java Flight Recorder 开源**：此前属于商业版 JDK 的低开销诊断工具，从 11 起随 OpenJDK 免费提供，线上事件采样、问题复盘都可以直接用。
- **TLS 1.3 支持**：握手更短，并移除了 SHA-1、RC4、CBC 等过时算法，只保留更安全的现代套件，升级即受益。
- **Epsilon 无操作 GC**：一个只分配、不回收的实验性回收器，内存耗尽即退出，主要用来测出 JVM 自身的性能基线和承载极短生命周期的任务。
- **Nashorn 标记废弃**：这个 JavaScript 引擎自本版本起进入弃用流程，相关脚本能力应尽早规划替代方案。

## 升级建议

从 Java 8 升 11 最大的坑不在语法，而在被移除的 Java EE 模块：JAXB、JAX-WS、CORBA 等不再内置，用到就必须显式引入对应依赖。升级前建议用 `jdeps --jdk-internals` 扫描代码对 JDK 内部 API 的依赖，连同模块强封装问题一并处理。收益同样明确：免费获得 G1 默认化、var、标准 HttpClient 以及 TLS 1.3 支持。

## 小结

Java 11 的亮点不在语法而在生态位：String 与 HttpClient 消灭了最常见的第三方依赖场景，ZGC 开启了低延迟回收器的新路线，单文件运行降低了使用门槛。作为横跨多年的 LTS，它是理解后续所有版本的必要起点。
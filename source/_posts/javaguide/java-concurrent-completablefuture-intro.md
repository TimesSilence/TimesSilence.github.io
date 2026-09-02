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
description: "用 CompletableFuture 组织异步流水线，替代回调地狱。"
---

## 设计动机

Future.get 会阻塞调用线程；CompletableFuture 把「完成后的动作」注册为回调，天然支持 thenApply、thenCompose 链式组合，也提供 allOf/anyOf 聚合。

<!-- more -->

## 关键 API 心智

- supplyAsync / runAsync 选择线程池，**不要**默认 commonPool 跑阻塞 IO；
- exceptionally/handle 统一异常出口；
- orTimeout（Java 9+）给慢调用加护栏。

## 示例：并行拉取

```java
CompletableFuture<String> user = CompletableFuture.supplyAsync(() -> fetchUser());
CompletableFuture<List<Order>> orders = user.thenCompose(u ->
    CompletableFuture.supplyAsync(() -> fetchOrders(u.id())));
String summary = orders.thenApply(list -> "count=" + list.size()).join();
```

生产环境要为 join 设置超时，并记录链路日志，避免 silent failure。

## 课堂外的思考

学习「CompletableFuture 详解」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
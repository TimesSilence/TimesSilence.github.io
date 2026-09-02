---
title: "Java 线程池详解"
date: 2020-11-28 09:27:00
updated: 2020-11-28 09:27:00
permalink: knowledge/java/concurrent/java-thread-pool-summary/
categories:
  - Java
tags:
  - Java并发
  - 线程池
description: "ThreadPoolExecutor 工作原理与常见参数组合。"
---

## 提交流程

任务先来占 core 线程；core 满则入队；队满则扩到 max；仍满则触发拒绝策略。keepAlive 回收超出 core 的空闲线程。

<!-- more -->

## 队列选择

ArrayBlockingQueue 有界、数组实现；LinkedBlockingQueue 可选无界；SynchronousQueue 直接交接，适合 Cached 风格；PriorityBlockingQueue 按优先级。

## 示例

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    4, 8, 60, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(200),
    r -> { Thread t = new Thread(r); t.setName("biz-" + t.getId()); return t; },
    new ThreadPoolExecutor.CallerRunsPolicy());
```

CallerRuns 让提交线程执行溢出任务，形成天然背压。

## 课堂外的思考

学习「Java 线程池详解」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
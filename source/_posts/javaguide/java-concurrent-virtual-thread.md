---
title: "虚拟线程常见问题总结"
date: 2021-01-23 15:09:00
updated: 2021-01-23 15:09:00
permalink: knowledge/java/concurrent/virtual-thread/
categories:
  - Java
tags:
  - Java并发
  - 虚拟线程
description: "Java 21 虚拟线程：适用场景、载体线程与 pinning 注意点。"
---

## 平台线程 vs 虚拟线程

平台线程 1:1 映射 OS 线程，创建成本高；虚拟线程由 JVM 调度，阻塞 IO 时挂起让出载体线程（平台线程），适合高并发阻塞型任务。

<!-- more -->

## 创建方式

```java
Thread.startVirtualThread(() -> fetchRemote());
Executors.newVirtualThreadPerTaskExecutor();
```

## 不适合的场景

CPU 密集计算不会变快；在 synchronized 或 native 方法内阻塞可能导致 **pinning**，载体线程无法释放。优先用 ReentrantLock，或减少临界区。

## 观测

jcmd Thread.dump_to_file 可区分 virtual/carrier，排查 pinned 事件。

## 课堂外的思考

学习「虚拟线程常见问题总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
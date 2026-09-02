---
title: "Java并发常见面试题总结（下）"
date: 2021-01-13 14:02:00
updated: 2021-01-13 14:02:00
permalink: knowledge/java/concurrent/java-concurrent-questions-03/
categories:
  - Java
tags:
  - Java并发
  - 面试
description: "并发面试下篇：死锁、ThreadLocal 泄漏与并发工具综合题。"
---

## 死锁四要素

互斥、占有且等待、不可抢占、循环等待。排查用 jstack 看 Found one Java-level deadlock，预防则固定加锁顺序或使用 tryLock 超时。

<!-- more -->

## ThreadLocal 泄漏

线程池场景下线程复用，ThreadLocalMap 的 Entry 弱引用 key 可能被回收，但 value 仍被强引用直到 remove。务必 finally 中 remove。

## CountDownLatch vs CyclicBarrier

前者一次性倒数，典型主线程等多 worker；后者可重用，适合分阶段并行计算。Semaphore 控制并发度，不是「栅栏」。

## 综合设计题

设计一个限流 + 异步落库组件：Semaphore 控制并发写，BlockingQueue 缓冲，线程池消费，暴露 metrics 观察拒绝与堆积。

## 课堂外的思考

学习「Java并发常见面试题总结（下）」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
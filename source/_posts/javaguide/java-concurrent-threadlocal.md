---
title: "ThreadLocal 详解"
date: 2020-12-26 12:48:00
updated: 2020-12-26 12:48:00
permalink: knowledge/java/concurrent/threadlocal/
categories:
  - Java
tags:
  - Java并发
  - ThreadLocal
description: "ThreadLocal 原理、InheritableThreadLocal 与线程池泄漏风险。"
---

## 实现要点

每个 Thread 持有 ThreadLocalMap，key 是 ThreadLocal 弱引用，value 强引用。get/set 实际在当前线程 map 里读写，实现线程封闭。

<!-- more -->

## 典型用途

SimpleDateFormat 非线程安全，用 ThreadLocal 包装；MDC 日志 traceId；Sa-Token 等上下文传递。

## 泄漏场景

线程池 worker 长期存活，若未 remove，大对象 value 无法回收。**规范**：try/finally 中 threadLocal.remove()。

## 继承性

InheritableThreadLocal 在创建子线程时复制父值；线程池复用 worker 时不会自动传递，需要 TransmittableThreadLocal 等增强方案。

## 课堂外的思考

学习「ThreadLocal 详解」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
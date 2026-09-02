---
title: "Java 常见并发容器总结"
date: 2020-10-22 15:59:00
updated: 2020-10-22 15:59:00
permalink: knowledge/java/concurrent/java-concurrent-collections/
categories:
  - Java
tags:
  - Java并发
  - 并发容器
description: "ConcurrentHashMap、CopyOnWriteArrayList 等并发容器的选型要点。"
---

## 选型表（简版）

| 场景 | 候选 | 备注 |
|------|------|------|
| 高并发读写 Map | ConcurrentHashMap | JDK8+ 桶头 CAS + synchronized 协同 |
| 读多写少 List | CopyOnWriteArrayList | 写时复制，迭代弱一致 |
| 阻塞队列 | ArrayBlockingQueue / LinkedBlockingQueue | 有界 vs 可选无界 |
| 延迟任务 | DelayQueue | 依赖 Comparable/Delayed |

<!-- more -->

## 误区

HashMap 并发 put 可能死循环（JDK7）或丢数据；Collections.synchronizedXxx 只是方法级互斥，复合操作仍需外部同步。

## 练习

实现一个简易 LRU 缓存：ConcurrentHashMap 存 entry，LinkedHashMap 维护顺序，或用 Caffeine 对照理解 eviction 策略。

## 课堂外的思考

学习「Java 常见并发容器总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
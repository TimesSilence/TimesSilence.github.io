---
title: "Atomic 原子类总结"
date: 2020-10-03 13:45:00
updated: 2020-10-03 13:45:00
permalink: knowledge/java/concurrent/atomic-classes/
categories:
  - Java
tags:
  - Java并发
  - 原子类
description: "AtomicInteger、LongAdder 等原子类的适用场景与性能取舍。"
---

## 家族分工

java.util.concurrent.atomic 提供基于 CAS 的无锁计数与引用更新。AtomicInteger 适合低竞争计数；LongAdder 通过 Cell 分段累加，在高并发统计场景通常优于 AtomicLong。

<!-- more -->

## 使用注意

- compareAndSet 失败需要自旋或退避策略；
- AtomicReference 可配合不可变对象做无锁栈/队列；
- 字段更新器（FieldUpdater）适合已有类不便改继承结构时。

## 小实验

压测 8 线程各累加 100 万次，对比 AtomicLong 与 LongAdder 的耗时。通常会看到 LongAdder 在写多读少时更稳，但 sum() 不是严格原子快照，报表场景要留意。

## 课堂外的思考

学习「Atomic 原子类总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
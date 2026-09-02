---
title: "JVM垃圾回收详解（重点）"
date: 2021-09-05 09:57:00
updated: 2021-09-05 09:57:00
permalink: knowledge/java/jvm/jvm-garbage-collection/
categories:
  - Java
tags:
  - JVM
  - 垃圾回收
description: "GC 算法、分代收集与 G1/ZGC 选型思路。"
---

## 判定与算法

引用计数（Java 不用）、可达性分析；标记-清除、复制、标记-整理。分代假设：大部分对象朝生夕灭，老年代长寿命。

<!-- more -->

## 常见收集器

Serial/Parallel 关注吞吐；CMS 低停顿已过时；G1 分区 + 可预测停顿；ZGC/Shenandoah 超低延迟，适合大堆。

## 参数起点

-XX:+UseG1GC，-Xms=-Xmx 避免堆伸缩，-XX:MaxGCPauseMillis 设期望停顿。观察 GC 日志再调 InitiatingHeapOccupancyPercent。

## 记忆点

Minor GC 清理 Young；Full GC 通常整堆+方法区，频率过高是告警信号。

## 课堂外的思考

学习「JVM垃圾回收详解（重点）」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
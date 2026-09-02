---
title: "JDK监控和故障处理工具总结"
date: 2021-08-27 08:50:00
updated: 2021-08-27 08:50:00
permalink: knowledge/java/jvm/jdk-monitoring-and-troubleshooting-tools/
categories:
  - Java
tags:
  - JVM
  - 诊断工具
description: "jcmd、jstat、jmap、jstack 与可视化工具的组合使用。"
---

## 命令速查

- jps -l：列 JVM 进程
- jstat -gcutil pid 1s：GC 占比实时看
- jmap -dump:live,file=heap.hprof pid：堆转储
- jstack pid：线程栈与死锁

<!-- more -->

JDK9+ 推荐 jcmd 统一入口：jcmd pid VM.native_memory summary。

## 可视化

VisualVM、JMC 飞行录制分析 CPU 热点；Async-profiler 生成火焰图定位 native/Java 栈。

## 流程

CPU 高 → top -H + jstack 找热点线程；内存涨 → 对比两次 heap dump；GC 频繁 → 看 allocation rate 与 survivor 晋升。

## 课堂外的思考

学习「JDK监控和故障处理工具总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
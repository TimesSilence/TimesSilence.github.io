---
title: "最重要的JVM参数总结"
date: 2021-07-11 13:15:00
updated: 2021-07-11 13:15:00
permalink: knowledge/java/jvm/jvm-parameters-intro/
categories:
  - Java
tags:
  - JVM
  - 参数调优
description: "堆、元空间、GC 日志与 OOM 诊断的关键 JVM 参数。"
---

## 堆与栈

-Xms/-Xmx 堆初始/最大； -Xss 线程栈。生产常设 Xms=Xmx 稳定 GC。

<!-- more -->

## 元空间

-XX:MetaspaceSize/-XX:MaxMetaspaceSize 限制类元数据，防止动态代理/generate 类撑爆。

## GC 日志（JDK9+）

```text
-Xlog:gc*,gc+age=trace:file=gc.log:time,uptime,level,tags
```

## OOM 行动

-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heap.hprof 保留案发现场；配合 Error 文件 -XX:ErrorFile。

调参先测量后修改，避免迷信网上模板。

## 课堂外的思考

学习「最重要的JVM参数总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
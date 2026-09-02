---
title: "Java 21（JDK 21）新特性：虚拟线程、分代 ZGC 与有序集合"
date: 2022-02-15 16:56:00
updated: 2022-02-15 16:56:00
permalink: knowledge/java/new-features/java21/
categories:
  - Java
tags:
  - Java新特性
  - Java21
description: "Java 21 LTS：虚拟线程正式、分代 ZGC 与有序集合。"
---

## 虚拟线程正式

Executors.newVirtualThreadPerTaskExecutor() 可上生产（评估 pinning 与本地代码）。适合网关、RPC 客户端等阻塞调用链。

<!-- more -->

## 分代 ZGC

年轻/老年代分离，降低分配速率高的应用开销。 -XX:+UseZGC -XX:+ZGenerational

## Sequenced Collections

首尾元素、 reversed 视图统一 List/Set/Map 接口。API 语义更一致。

## 升级建议

21 是下一 LTS 热点，配合 Spring Boot 3.2+ 试点虚拟线程线程池。

## 课堂外的思考

学习「Java 21（JDK 21）新特性：虚拟线程、分代 ZGC 与有序集合」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
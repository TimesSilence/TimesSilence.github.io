---
title: "《Java8 指南》中文翻译"
date: 2021-11-02 15:39:00
updated: 2021-11-02 15:39:00
permalink: knowledge/java/new-features/java8-tutorial-translate/
categories:
  - Java
tags:
  - Java新特性
  - Java8
description: "围绕 Java 8 官方指南主题的自学笔记，非译文转载。"
---

## 学习定位

Oracle Java 8 教程系统讲了 Lambda、Stream、日期时间、Nashorn 等。本文只记录**自学脉络**，不搬运译文：把教程当索引，每个主题配合 JSR 与 JEP 原文验证。

<!-- more -->

## 日期时间迁移

java.time 取代 Date/Calendar：Instant 时间点、ZonedDateTime 带时区、Duration/Period 区分时间与日期差。旧 API 通过 atZone/ toInstant 互转。

## 接口演进

default/static 方法让接口可演进而不破坏实现类。Collector 接口与 Stream 终端操作紧密相关。

## 建议

读完教程章节后，用 JShell（Java 9+）快速验证 API，比只看文档记得牢。

## 课堂外的思考

学习「《Java8 指南》中文翻译」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
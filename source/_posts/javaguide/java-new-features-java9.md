---
title: "Java 9 新特性概览"
date: 2021-11-11 16:46:00
updated: 2021-11-11 16:46:00
permalink: knowledge/java/new-features/java9/
categories:
  - Java
tags:
  - Java新特性
  - Java9
description: "Java 9 模块系统、JShell 与 G1 默认化的要点笔记。"
---

## 模块系统 JPMS

module-info.java 声明 requires/exports，解决 JDK 9 起 classpath 上「什么都可见」的封装问题。迁移大型项目可先强封装 JDK 内部 API 使用，再逐步模块化。

<!-- more -->

## JShell

交互式 REPL，适合验证小片段。生产代码仍要正经测试，但学习 API 效率极高。

## 其他印象点

接口私有方法；集合工厂 of/ofEntries；G1 成为默认 GC；Process API 改进。HTTP/2 Client  incubating 到 11 正式。

## 实践

尝试把一个小库拆成 module，体会「exports 包」与反射 opens 的差异。

## 课堂外的思考

学习「Java 9 新特性概览」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
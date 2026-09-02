---
title: "Java 19 新特性概览"
date: 2022-01-27 14:42:00
updated: 2022-01-27 14:42:00
permalink: knowledge/java/new-features/java19/
categories:
  - Java
tags:
  - Java新特性
  - Java19
description: "虚拟线程预览、结构化并发 incubating 与 Record 模式预览。"
---

## 虚拟线程（预览）

Thread.ofVirtual().start(...)。阻塞 IO 密集服务可大幅减平台线程数。注意 synchronized pinning。

<!-- more -->

## 结构化并发（孵化）

StructuredTaskScope 把子任务生命周期绑定到作用域，取消与错误传播更清晰。

## Record 模式（预览）

解构 Record 组件，为 switch 模式匹配铺路。预览 API 需 --enable-preview，升级 JDK 要回归测试。

## 课堂外的思考

学习「Java 19 新特性概览」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
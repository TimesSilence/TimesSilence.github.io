---
title: "Java 16 新特性概览"
date: 2021-12-29 11:21:00
updated: 2021-12-29 11:21:00
permalink: knowledge/java/new-features/java16/
categories:
  - Java
tags:
  - Java新特性
  - Java16
description: "Records 正式、Stream.toList 与 Unix 域套接字。"
---

## Records 正式

可嵌套、可实现接口，仍不可继承类。紧凑构造器可校验参数。

<!-- more -->

## Stream.toList

返回不可变 List，比 collect(Collectors.toList()) 更简洁；需要可变列表仍用 toCollection。

## 其他

Vector API 孵化器；Unix domain socket Channel；从 JDK 内部迁移到 jpackage 打包工具增强。

## 迁移提示

检查 Lombok @Value 与 Record 重叠场景，团队统一风格。

## 课堂外的思考

学习「Java 16 新特性概览」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
---
title: "Java 17（JDK 17）新特性：密封类、switch 模式匹配与随机数 API"
date: 2022-01-07 12:28:00
updated: 2022-01-07 12:28:00
permalink: knowledge/java/new-features/java17/
categories:
  - Java
tags:
  - Java新特性
  - Java17
description: "Java 17 LTS：密封类、模式匹配 switch 与随机数生成器。"
---

## 密封类 sealed

限制子类集合，配合 permits 与 final/non-sealed。适合领域模型表达有限变体，与 switch 模式匹配联动。

<!-- more -->

## Switch 模式匹配（预览迭代）

对类型模式分支，编译器检查覆盖（取决于 sealed 层次）。

## 随机数

RandomGenerator 统一接口，L32X64MixRandom 等算法可插拔。密码学场景仍用 SecureRandom。

## LTS 升级

17 是当前主流 LTS 之一，Spring Boot 3 基线。评估反射、强封装与 native 依赖。

## 课堂外的思考

学习「Java 17（JDK 17）新特性：密封类、switch 模式匹配与随机数 API」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
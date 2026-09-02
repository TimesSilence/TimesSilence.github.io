---
title: "Java IO 设计模式总结"
date: 2020-06-06 10:14:00
updated: 2020-06-06 10:14:00
permalink: knowledge/java/io/io-design-patterns/
categories:
  - Java
tags:
  - Java IO
  - 设计模式
description: "Java IO 体系中的装饰器、适配器与工厂模式实例。"
---

## 装饰器模式

FilterInputStream 及其子类（BufferedInputStream、DataInputStream）在不改接口的前提下叠加行为，是教科书级装饰器。与继承爆炸相比，组合更灵活。

<!-- more -->

## 适配器

InputStreamReader 把字节流适配为字符 Reader；OutputStreamWriter 反向适配。Charset 在边界完成编解码。

## 工厂与单例

Charset.forName 缓存 Charset 实例；Files.newInputStream 隐藏底层实现。理解这些模式有助于读 JDK 源码时不被类海淹没。

## 练习

自己实现一个简单的 LineNumberInputStream 装饰器，在 read 时统计换行符，体会「委托 + 增强」结构。

## 课堂外的思考

学习「Java IO 设计模式总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
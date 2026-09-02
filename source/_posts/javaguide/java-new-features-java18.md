---
title: "Java 18 新特性概览"
date: 2022-01-17 13:35:00
updated: 2022-01-17 13:35:00
permalink: knowledge/java/new-features/java18/
categories:
  - Java
tags:
  - Java新特性
  - Java18
description: "UTF-8 默认 Charset 与简单 Web 服务器 jwebserver。"
---

## UTF-8 默认

file.encoding 与 default Charset 统一 UTF-8，减少 Windows 与 Linux 行为差异。遗留系统依赖 GBK 需显式指定。

<!-- more -->

## jwebserver

```bash
jwebserver -p 8080 -d ./public
```

仅静态文件，开发演示够用，非生产服务器。

## 其他

@snippet 标记（Javadoc 代码片段）；Internet-Address Resolution SPI。小版本，关注工具链即可。

## 课堂外的思考

学习「Java 18 新特性概览」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
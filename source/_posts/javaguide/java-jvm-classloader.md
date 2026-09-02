---
title: "类加载器详解（重点）"
date: 2021-08-18 17:43:00
updated: 2021-08-18 17:43:00
permalink: knowledge/java/jvm/classloader/
categories:
  - Java
tags:
  - JVM
  - 类加载器
description: "双亲委派、破坏委派与自定义 ClassLoader 场景。"
---

## 双亲委派

类加载请求先委派父加载器，父无法加载才由子尝试。保证 java.lang.String 等核心类统一，防止用户伪造核心 API。

<!-- more -->

## 三层加载器

Bootstrap（C++）→ Platform（Extension）→ Application。线程上下文类加载器（TCCL）常用于 SPI，如 JDBC 驱动加载。

## 何时破坏委派

Tomcat 隔离 Web 应用、OSGi 模块化、热部署需要平行或自定义委派。实现 loadClass 重写 findClass 加载字节码即可，注意 defineClass 安全边界。

## 排查

ClassNotFoundException 是加载阶段找不到；NoClassDefFoundError 是初始化或链接后运行时缺失，栈含义不同。

## 课堂外的思考

学习「类加载器详解（重点）」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
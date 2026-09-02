---
title: "Java IO 专题：BIO、NIO、AIO、IO 模型与设计模式"
date: 2020-05-19 08:00:00
updated: 2020-05-19 08:00:00
permalink: knowledge/java/io/overview/
categories:
  - Java
tags:
  - Java IO
  - 学习路线
description: "Java IO 学习路径：字节流、字符流、NIO 与 IO 模型。"
---

## 三条主线

经典 IO（java.io）面向流，易上手；NIO（java.nio）引入 Buffer、Channel、Selector，适合高并发网络；NIO.2（Path/Files）改善文件 API。IO 模型（BIO/NIO/AIO）则是操作系统视角的阻塞与多路复用。

<!-- more -->

## 学习顺序建议

先掌握 InputStream/OutputStream 与装饰器模式，再读 NIO 非阻塞服务端示例，最后对照 Netty 看 EventLoop 如何封装 epoll/kqueue。

## 自检

能否用 try-with-resources 正确关闭嵌套流？能否解释「缓冲流为何提升性能」——减少系统调用次数。

## 课堂外的思考

学习「Java IO 专题：BIO、NIO、AIO、IO 模型与设计模式」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
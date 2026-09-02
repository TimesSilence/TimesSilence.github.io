---
title: "Java NIO 核心知识总结"
date: 2020-06-24 12:28:00
updated: 2020-06-24 12:28:00
permalink: knowledge/java/io/nio-basis/
categories:
  - Java
tags:
  - Java IO
  - NIO
description: "Buffer、Channel、Selector 三大件与零拷贝初步。"
---

## 三大组件

Buffer 是数据容器，有 capacity/limit/position；Channel 双向连接文件或网络；Selector 把多个 Channel 的就绪事件聚合到单线程。

<!-- more -->

## 非阻塞读模板

注册 OP_READ → select 阻塞或超时 → 遍历 selectedKeys → read Buffer → flip 后处理 → compact 残留。

## 零拷贝

FileChannel.transferTo 利用 sendfile 减少用户态拷贝，适合静态文件服务器。与 mmap 对比：前者内核管道，后者映射页缓存。

## 注意

Buffer 不是线程安全的；clear/flip/rewind 语义要熟；直接缓冲区分配成本高但少一次拷贝。

## 课堂外的思考

学习「Java NIO 核心知识总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
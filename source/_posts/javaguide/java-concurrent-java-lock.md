---
title: "Java 锁详解：互斥锁、读写锁、自旋锁与 synchronized 锁优化"
date: 2020-11-09 17:13:00
updated: 2020-11-09 17:13:00
permalink: knowledge/java/concurrent/java-lock/
categories:
  - Java
tags:
  - Java并发
  - 锁
description: "互斥锁、读写锁、自旋锁与 synchronized 优化路径对比。"
---

## 锁的分类视角

按乐观/悲观：synchronized、ReentrantLock 属悲观；CAS 自旋属乐观。按共享性：读写锁读共享写独占。按可中断/超时：ReentrantLock 提供 tryLock、lockInterruptibly。

<!-- more -->

## synchronized 优化

偏向锁减少无竞争开销，轻量级锁用 CAS 抢 Mark Word，竞争激烈膨胀为重量级监视器。JDK15 起偏向锁默认关闭，了解历史即可。

## ReentrantLock 对比

需手动 unlock，支持公平锁、Condition 多队列。示例：

```java
Lock lock = new ReentrantLock();
lock.lock();
try { /* 临界区 */ } finally { lock.unlock(); }
```

读多写少优先考虑 ReadWriteLock 或 StampedLock（注意不可重入读写规则）。

## 课堂外的思考

学习「Java 锁详解：互斥锁、读写锁、自旋锁与 synchronized 锁优化」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
---
title: "AQS 详解"
date: 2020-09-24 12:38:00
updated: 2020-09-24 12:38:00
permalink: knowledge/java/concurrent/aqs/
categories:
  - Java
tags:
  - Java并发
  - AQS
description: "从队列同步器视角理解 AQS：state、CLH 变体队列与模板方法如何支撑 ReentrantLock。"
---

## 核心抽象

AQS（AbstractQueuedSynchronizer）像一套「排队取号机」：state 表示剩余许可或重入次数，获取失败就把当前线程封装成 Node 挂到双向队列，前驱释放时再唤醒后继。ReentrantLock、Semaphore、CountDownLatch 都只是覆写 tryAcquire/tryRelease 的不同策略。

<!-- more -->

## 为什么用 CLH 变体

纯自旋在竞争激烈时会烧 CPU；纯阻塞又增加上下文切换。AQS 先短暂自旋再 park，并在双向链表里维护 SIGNAL/CANCELLED 等状态，保证唤醒路径可控。

## 原创示例

```java
class OneShotGate {
  private final Sync sync = new Sync();
  void open() { sync.release(1); }
  void awaitOpen() throws InterruptedException {
    sync.acquireSharedInterruptibly(1);
  }
  private static final class Sync extends AbstractQueuedSynchronizer {
    protected int tryAcquireShared(int unused) {
      return getState() == 1 ? 1 : -1;
    }
    protected boolean tryReleaseShared(int unused) {
      setState(1);
      return true;
    }
  }
}
```

这段极简共享锁帮助理解「state + 模板方法」的组合方式。

## 课堂外的思考

学习「AQS 详解」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
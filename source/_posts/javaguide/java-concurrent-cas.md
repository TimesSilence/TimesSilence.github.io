---
title: "CAS 详解"
date: 2020-10-13 14:52:00
updated: 2020-10-13 14:52:00
permalink: knowledge/java/concurrent/cas/
categories:
  - Java
tags:
  - Java并发
  - CAS
description: "Compare-And-Swap 的语义、ABA 问题与 Java 中的落地方式。"
---

## 三要素

CAS 需要内存位置 V、旧值 A、新值 B：当且仅当 V 当前等于 A 时，才原子地写成 B。它提供了乐观并发的基础，但**不保证整体业务原子性**——多次 CAS 之间仍可能被其他线程插入。

<!-- more -->

## ABA 与解决思路

栈顶从 A→B→A，单纯值比较会误判「未变化」。AtomicStampedReference 用版本戳标记每次变更，或像 ConcurrentLinkedQueue 那样用唯一节点对象规避。

## 手写伪代码

```java
void increment(AtomicInteger counter) {
  for (;;) {
    int prev = counter.get();
    if (counter.compareAndSet(prev, prev + 1)) return;
  }
}
```

失败重试是常态，高竞争下 CAS 也会成为热点，需要降级为锁或分段。

## 课堂外的思考

学习「CAS 详解」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
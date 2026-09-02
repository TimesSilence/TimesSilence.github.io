---
title: "乐观锁和悲观锁详解"
date: 2020-12-16 11:41:00
updated: 2020-12-16 11:41:00
permalink: knowledge/java/concurrent/optimistic-lock-and-pessimistic-lock/
categories:
  - Java
tags:
  - Java并发
  - 锁
description: "乐观锁与悲观锁在数据库与 Java 内存中的对应关系。"
---

## 概念对照

悲观锁假设冲突常发生，先加锁再操作（synchronized、SELECT FOR UPDATE）。乐观锁假设冲突少，提交时检测版本（CAS、UPDATE ... WHERE version=?）。

<!-- more -->

## Java 侧例子

AtomicInteger 是典型乐观；ReentrantLock 是悲观。库存扣减：低竞争用 CAS 循环，高竞争乐观自旋浪费 CPU，应改悲观或分段锁。

## 数据库版本号模式

```sql
UPDATE account SET balance = balance - 100, version = version + 1
WHERE id = 1 AND version = 5;
```

影响行数为 0 表示冲突，业务层重试或返回失败。与 Java CAS 的「期望值不匹配则失败」同构。

## 课堂外的思考

学习「乐观锁和悲观锁详解」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
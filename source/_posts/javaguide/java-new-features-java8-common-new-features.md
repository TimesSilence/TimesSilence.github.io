---
title: "Java8 新特性实战"
date: 2021-10-23 14:32:00
updated: 2021-10-23 14:32:00
permalink: knowledge/java/new-features/java8-common-new-features/
categories:
  - Java
tags:
  - Java新特性
  - Java8
description: "Lambda、Stream、Optional 与接口默认方法的实战组合。"
---

## Lambda 本质

函数式接口 +  invokedynamic 生成 lambda 元工厂。方法引用是语法糖：String::length 等价 x -> x.length()。

<!-- more -->

## Stream 心智

中间操作惰性，终端操作触发流水线。parallelStream 仅在无共享可变状态、计算密集且数据量大时考虑。

## Optional 别滥用

用于返回值表达缺省，不要作为字段或参数链式堆砌。orElseGet 传 Supplier 避免无谓构造。

## 组合示例

```java
List<String> tops = orders.stream()
    .filter(o -> o.amount() > 100)
    .map(Order::customerName)
    .distinct()
    .sorted()
    .limit(10)
    .toList();
```

## 课堂外的思考

学习「Java8 新特性实战」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
---
title: "Java IO 基础知识总结"
date: 2020-05-28 09:07:00
updated: 2020-05-28 09:07:00
permalink: knowledge/java/io/io-basis/
categories:
  - Java
tags:
  - Java IO
  - 基础
description: "字节流、字符流、缓冲与 try-with-resources 要点。"
---

## 四大抽象

InputStream/OutputStream 处理字节；Reader/Writer 处理字符并依赖 Charset。文件复制优先 NIO Files.copy，经典写法则套 Buffered 减少 syscall。

<!-- more -->

## 装饰器组合

```java
try (BufferedReader br = new BufferedReader(new FileReader(path))) {
  String line;
  while ((line = br.readLine()) != null) {
    System.out.println(line.length());
  }
}
```

外层 BufferedReader 负责缓冲，内层 FileReader 负责解码。关闭最外层会自动关闭内层。

## 常见坑

byte 读取 -1 表 EOF；available() 不宜做协议长度；字符集未指定时用平台默认，跨环境易乱码。

## 课堂外的思考

学习「Java IO 基础知识总结」时，我把自己放在线上值班的情境里：如果告警与这一主题相关，我能否在较短时间内建立假设并用数据验证？这种提问方式逼迫我从「看过」变成「讲得清楚、做得到」，也避免笔记沦为标题摘抄。

## 与同事的讨论方式

我会用白板画出状态机、内存布局或调用链，请同事挑错。若被追问「更高并发或更老 JDK 版本会怎样」，答不上来就回到文首原文链接查 primary source，而不是凭记忆硬编。讨论后把新认识补进笔记末尾。

## 可复现实验

为每个主题保留最小复现：一段可运行的 Java 片段、一条 jcmd/jstack 命令，或一组压测对比。记录环境（JDK 小版本、CPU 核数、容器限制），结论才可靠。实验细节不必全部公开，但索引要能找到。

## 补充复习

把本篇三个关键词写入间隔重复卡片，并各关联一个真实项目场景；暂时用不到的概念标记「待实践」，避免笔记只增不用。
---
title: "Java IO 设计模式总结"
date: 2020-06-06 10:14:00
updated: 2020-06-06 10:14:00
permalink: knowledge/java/io/io-design-patterns/
categories:
  - Java
tags:
  - Java IO
  - 设计模式
description: "以 BufferedInputStream 包装链为例讲清装饰器模式的价值，用 InputStreamReader 说透适配器模式，并讨论装饰器与继承的取舍。"
---

Java IO 类库是设计模式的实战样本：FilterInputStream 一族用装饰器为流叠加缓冲、解压等能力，InputStreamReader 用适配器打通字节与字符两个世界。看懂它们，几十个类的关系就不再是乱麻。

<!-- more -->

## 装饰器模式：包装的价值

### 装饰前后的代码对比

```java
// 装饰前：每次 read 都可能触发系统调用
try (FileInputStream fis = new FileInputStream("data.txt")) {
    int b;
    while ((b = fis.read()) != -1) {
        // 处理字节
    }
}
```

包一层缓冲后：

```java
// 装饰后：接口不变，一次读 8KB 进缓冲区
try (BufferedInputStream bis =
        new BufferedInputStream(new FileInputStream("data.txt"))) {
    int b;
    while ((b = bis.read()) != -1) {
        // 处理逻辑原样
    }
}
```

之后大部分 `read()` 直接从内存返回，系统调用骤降。这就是装饰器的意义：不改接口，只靠组合叠加能力。

### 包装链怎么搭

`FilterInputStream` 内部持有 `InputStream` 引用，读操作先委托再增强；装饰器与被装饰者实现同一抽象，因此可以层层嵌套：

```java
// 先缓冲，再解压
ZipInputStream zis = new ZipInputStream(
        new BufferedInputStream(new FileInputStream("a.zip")));
```

不需要哪层就拆掉；字符流的 `BufferedReader` 是同一套路。

## 适配器模式：字节与字符之间的桥

字节流与字符流接口不兼容，`InputStreamReader` 充当适配器：对外暴露 `Reader` 字符接口，对内持有字节流，用 `StreamDecoder` 按字符集解码；`OutputStreamWriter` 反向用 `StreamEncoder` 编码。

```java
Reader reader = new InputStreamReader(
        new FileInputStream("data.txt"), StandardCharsets.UTF_8);
BufferedReader br = new BufferedReader(reader); // 先适配，再装饰
```

分工不同：适配解决"接口对不上"，装饰解决"能力不够"，两者常串在同一条链上。

## 装饰器与继承的取舍

为什么不直接写 `BufferedFileInputStream`？因为增强维度（缓冲、解压、加密）与数据源维度（文件、网络、内存数组）是正交的：继承需要 m×n 个子类，组合只需 m+n 个类在运行时自由拼装。

代价是调用链深、构造啰嗦、调试栈多几层。增强固定且单一时，直接继承一个专用子类反而更直白——装饰器是为"能力需要自由叠加"准备的，不是银弹。

## 小结

- 装饰器：同一抽象、持有引用、先委托后增强，`BufferedInputStream` 包装链即教科书案例。
- 适配器：`InputStreamReader`/`OutputStreamWriter` 做字节与字符的编解码转换，可被继续装饰。
- 取舍：正交能力需运行时拼装用组合；增强固定单一用继承。
---
title: "Java 18 新特性概览"
date: 2022-01-17 13:35:00
updated: 2022-01-17 13:35:00
permalink: knowledge/java/new-features/java18/
categories:
  - Java
tags:
  - Java新特性
  - Java18
description: "Java 18 新特性：UTF-8 成为默认字符集、内置 Simple Web Server 与 @snippet 文档标签，以及反射实现的底层重构。"
---

Java 18 于 2022 年 3 月发布，是个没有重量级语言特性的非 LTS 版本。但 UTF-8 默认字符集、`jwebserver` 和 `@snippet` 这三件"小事"，对日常开发体验的改善相当实在。

<!-- more -->

## 版本定位

作为 17 之后的第一个快速迭代版本，18 的支持周期只有六个月，语言层面没有新语法，重点落在平台一致性与工具链上。生产环境大多直接等下一个 LTS，但 UTF-8 默认化带来的影响会贯穿后续所有版本，值得单独理解透，相关改造早晚要做。

## UTF-8 成为默认字符集

在 17 及更早的版本里，默认字符集由操作系统和区域设置在 JVM 启动时决定：中文 Windows 上是 GBK，Linux 和 macOS 上通常是 UTF-8。同一段 `Files.readString(path)` 在开发机上正常、到 Windows 服务器上乱码，是跨平台团队协作的经典事故。

18 起（JEP 400），除控制台外默认字符集统一为 UTF-8，`Charset.defaultCharset()` 的结果不再随系统漂移，Java 程序在所有平台上行为一致。

迁移注意三点：

- 读写遗留的 GBK 文件必须显式指定编码，例如 `Files.readString(path, Charset.forName("GBK"))`，不能再依赖平台默认值"碰巧正确"。
- 升级反而可能暴露旧代码的编码缺陷：以前依赖默认值的隐式行为现在变成固定 UTF-8。稳妥做法是先在旧版本上以 `-Dfile.encoding=UTF-8` 启动预演，提前把问题逼出来。
- 控制台输出仍可能跟随终端编码，Windows 命令行的乱码问题不会因此自动消失。

## Simple Web Server

18 内置了一个极简静态文件服务器（JEP 408），基于 `com.sun.net.httpserver` 实现，命令行一键启动：

```bash
jwebserver -p 8080 -d ./public
```

默认绑定回环地址（127.0.0.1）、端口 8000，服务当前目录，`-b` 参数可改为监听全部网卡；只支持 GET/HEAD、静态文件与目录列表，没有 CGI 也没有 Servlet。定位类似 `python -m http.server`：原型演示、本地调试、临时分享文件。同时也提供 `SimpleFileServer.create()` 这样的编程入口，方便在集成测试里起一个临时的静态资源服务。明确一点：它不是生产级服务器，别往线上放。

## @snippet 文档标签

在 Javadoc 里写示例代码，过去的标准做法是 `<pre>{@code ...}</pre>`：HTML 转义繁琐、没有高亮、示例语法错了也没人发现。18 引入 `@snippet` 标签（JEP 413）专门解决这件事：

```java
/**
 * 判断值是否存在：
 * {@snippet :
 * if (v.isPresent()) {
 *     System.out.println("v: " + v.get());
 * }
 * }
 */
```

`@snippet` 支持内联与外部文件两种写法，可声明高亮区间、文本替换和 region 引用；通过 `file` 或 `class` 属性引用外部源码文件后，示例代码可以像普通代码一样参与编译检查，从根本上避免文档与实现脱节。生成的文档带语法高亮，IDE 也能对示例做基本的正确性检查。写公共 API 文档的团队值得尽快换用。

顺带一提，18 还把核心反射的底层实现换成了方法句柄（JEP 416），性能更好且代码路径统一，对业务代码完全透明；新的 Internet-Address 解析 SPI（JEP 418）允许给 `InetAddress` 接入自定义解析器，测试打桩更方便。Vector API 与外部函数内存 API 则继续孵化迭代。

## 工程实践/升级建议

非 LTS，不建议生产长期使用。它更适合作为编码债的演练场：全局搜索依赖默认字符集的调用点——`new String(byte[])`、`FileReader`、`Files.readAllLines` 这类 API——把该显式声明的编码补齐。这笔债在升级到任何新版本之前还清，都是稳赚不赔的。

## 小结

Java 18 是"小版本、大体验"的发布：UTF-8 统一消除了最大的平台差异来源，`jwebserver` 与 `@snippet` 分别改善了调试与文档体验。核心结论一句话：显式声明编码，永远不依赖默认值。
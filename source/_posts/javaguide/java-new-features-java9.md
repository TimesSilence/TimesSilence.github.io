---
title: "Java 9 新特性概览"
date: 2021-11-11 16:46:00
updated: 2021-11-11 16:46:00
permalink: knowledge/java/new-features/java9/
categories:
  - Java
tags:
  - Java新特性
  - Java9
description: "Java 9 核心特性梳理：模块系统 JPMS 的动机与 module-info 用法、集合工厂方法、接口私有方法、JShell 与 Stream 增强。"
---

Java 9 是 Java 8 之后沉寂三年半才到来的版本，最重磅的变化是模块系统 JPMS，顺带补上了 JShell、集合工厂方法等一批实用工具。

<!-- more -->

## 版本定位

Java 9 发布于 2017 年 9 月，不是 LTS 版本，但它奠定了此后所有版本的地基：JDK 自身被拆成九十多个模块，classpath 时代「一切 public 皆可见」的封装漏洞开始被堵上。对业务开发者而言，直接感知最强的反而是 JShell 和集合、Stream 的 API 增强；模块系统更多影响框架作者与大型工程的架构方式。

## 模块系统（JPMS）

模块系统要解决 classpath 的两个老毛病：一是任何 public 类都能被任意代码访问，jar 的内部实现想藏也藏不住；二是依赖关系只有运行期才暴露，缺了哪个 jar 要等 ClassNotFoundException 抛出才知道。

引入模块后，每个 jar 可以在根目录放一个 `module-info.java`，显式声明依赖谁、暴露谁：

```java
module com.example.order {
    requires java.sql;
    exports com.example.order.api;
}
```

`requires` 声明编译期和运行期都必须满足的依赖，`exports` 精确控制哪些包对外开放；未导出的包即便类是 public 的，外部模块也无法访问，强封装第一次有了语言级保障。

使用注意：迁移老项目不要一步到位。可以先把应用跑在 classpath 上（自动落入未命名模块），再借助 `--add-opens` 之类的参数逐个处理对 JDK 内部 API 的反射调用。反射访问非导出包需要模块方显式 `opens`，这正是大量框架升级时踩坑最多的地方。

模块化还给 JDK 自身带来两个直接收益：一是配合 jlink 工具可以裁剪出只包含所需模块的自定义运行时镜像，部署体积从完整 JRE 缩到几十 MB，对容器镜像非常友好；二是 JDK 内部 API 被强封装，过去随便引用的 `sun.misc.Unsafe` 之类内部类默认不再可访问，逼迫生态转向标准 API。

## 集合工厂方法

以前创建一个只有几个元素的只读列表，要么 `Arrays.asList` 再包一层 `Collections.unmodifiableList`，要么引入 Guava。Java 9 直接给 `List`、`Set`、`Map` 加了静态工厂方法：

```java
List<String> langs = List.of("Java", "Go", "Rust");
Map<String, Integer> scores = Map.of("Java", 95, "Go", 88);
Set<String> tags = Set.of("a", "b");
```

注意三点：`of` 创建的是真正的不可变集合，add、remove、排序都会抛 `UnsupportedOperationException`；不接受 null 元素；`Set`/`Map` 出现重复元素或键会直接抛异常。`Map` 超过 10 对条目时改用 `Map.ofEntries(Map.entry(...))`。

## 接口私有方法

Java 8 让接口能写 default 方法，但多个 default 方法之间的公共逻辑无处安放——抽成 default 方法会把它暴露给所有实现类。Java 9 允许接口定义 private 方法，专门用于内部复用：

```java
public interface Parser {
    default String parseLower(String raw) {
        return doParse(raw);
    }
    private String doParse(String raw) {
        return raw.toLowerCase();
    }
}
```

私有方法不能被实现类覆盖，职责仅限接口内部的代码复用，这让接口向「可带少量实现的抽象层」又近了一步。

## JShell

Java 终于有了官方 REPL：命令行输入 `jshell` 即可逐行执行表达式，不必先写 main 方法再走 javac/java 流程。学习新 API、验证正则或日期格式这类小问题时，效率远高于临时建工程。但它不取代单元测试——JShell 里变量可重复声明、语句末尾分号可省，这些宽松规则只适合探索场景。

## Stream 增强

日常最常用的三个新方法：

```java
// 取满足条件的前缀，遇到不满足即截断
Stream.of(1, 2, 9, 3).takeWhile(n -> n < 5).collect(Collectors.toList());   // [1, 2]
// 丢弃满足条件的前缀
Stream.of(1, 2, 9, 3).dropWhile(n -> n < 5).collect(Collectors.toList());   // [9, 3]
// 可空值转为 0 或 1 个元素的流
Stream.ofNullable(maybeNull).forEach(System.out::println);
```

关键陷阱：`takeWhile`/`dropWhile` 在有序流上语义才符合直觉，遇到第一个不满足条件的元素就停止判断，后续元素不再检查，不要把它们当成 filter 来用。

## 其他值得一提的变化

- **G1 成为默认垃圾回收器**：取代 Parallel 组合，低停顿取向正式成为默认策略，CMS 同版本被标记废弃。
- **Compact Strings**：`String` 底层从 `char[]` 改为 `byte[]`，纯 Latin-1 内容按单字节存储，堆中字符串占用明显下降，属于自动受益的优化。
- **try-with-resources 放宽**：可以直接引用已声明的 effectively final 变量，不必在 try 括号里重新声明，少一层包装。

## 升级建议

生产升级建议直接跳到 11 或更高的 LTS，Java 9 的支持周期早已结束；但学习模块系统时仍值得用 9 的语义去理解 `requires`、`exports`、`opens`，因为后续版本并未颠覆这套模型。新代码优先用 `List.of` 系列替代 Guava 的 `ImmutableList`，少一个第三方依赖就是一份收益。

## 小结

Java 9 用模块系统重构了平台自身的封装与依赖模型，同时带来 JShell、集合工厂方法、接口私有方法和 Stream 的 takeWhile/dropWhile/ofNullable。语法糖不多，但每一项都切中了 Java 8 时代的真实痛点。
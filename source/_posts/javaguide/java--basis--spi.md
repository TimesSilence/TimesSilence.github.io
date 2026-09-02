---
title: "Java SPI 机制详解"
date: 2017-11-10 17:03:00
updated: 2017-11-10 17:03:00
permalink: knowledge/java/basis/spi/
categories:
  - Java
tags:
  - Java基础
  - SPI
  - ServiceLoader
description: "理解 SPI 服务发现机制及其在 JDBC、SLF4J、Dubbo 中的插件化扩展模式。"
---

SPI（Service Provider Interface）把「接口定义」与「实现部署」解耦：核心库只依赖抽象，具体实现在 classpath 通过配置文件声明，由 `ServiceLoader` 在运行时加载。

<!-- more -->

## 核心概念

与 API 对比：**API** 是实现方提供接口+实现，调用方直接用；**SPI** 是调用方/框架定义接口，第三方 jar 提供实现。配置文件路径：`META-INF/services/<接口全限定名>`，每行一个实现类。`ServiceLoader.load(Interface.class)` 迭代得到全部实现（懒加载）。

## 关键机制与实践

经典案例：**JDBC 4+** 自动发现 `Driver`；**SLF4J** 绑定 Logback/Log4j2；**Dubbo** 扩展点（在其自有 SPI 上增强）。打破双亲委派：线程上下文类加载器（TCCL）常配合 SPI 让框架加载应用 classpath 中的实现。自定义 SPI 时保持实现类有无参构造，便于 ServiceLoader 实例化。

```java
ServiceLoader<Driver> drivers = ServiceLoader.load(Driver.class);
for (Driver d : drivers) {
    System.out.println(d.getClass().getName());
}
```

## 常见误区与小结

- 配置文件路径或包名写错，表现为「找不到实现」且无明确报错。
- 同一接口多个实现未约定选择策略（SLF4J 通过单一 binding 解决）。
- 与 Spring `@Autowired` 混淆（Spring 是 IoC 容器装配，SPI 是 JDK 级发现）。

SPI 体现**开闭原则**：扩展实现不必改框架源码，换 jar 即可。
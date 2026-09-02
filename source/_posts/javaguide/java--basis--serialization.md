---
title: "Java 序列化详解"
date: 2017-11-03 16:56:00
updated: 2017-11-03 16:56:00
permalink: knowledge/java/basis/serialization/
categories:
  - Java
tags:
  - Java基础
  - 序列化
description: "掌握 Serializable、serialVersionUID、transient 及 JSON/Protobuf 等替代方案的选择。"
---

序列化把对象变为可存储或传输的字节序列；反序列化是逆过程。RPC、缓存、Session 持久化都涉及，但 JDK 原生序列化在现代微服务里已很少作为首选。

<!-- more -->

## 核心概念

实现 `Serializable` 标记接口即可参与 JDK 默认序列化。**serialVersionUID** 用于版本兼容，类结构变更而不更新 UID 可能抛 `InvalidClassException`。**transient** 字段跳过默认序列化；敏感或派生字段可自定义 `writeObject`/`readObject`。

## 关键机制与实践

生产更常用 **JSON**（可读、跨语言）、**Protobuf/Kryo/Hessian**（二进制、体积小）。JDK 序列化缺点：体积大、速度慢、反序列化存在历史安全漏洞（gadget chain）。Redis 存对象常用 JSON 或专用序列化；RPC 框架自带 codec。若必须用 Java 序列化，避免反序列化不可信数据。

```java
public class User implements Serializable {
    private static final long serialVersionUID = 1L;
    private transient String sessionToken;
}
```

## 常见误区与小结

- 未定义 `serialVersionUID` 依赖 JVM 自动生成，发版易踩坑。
- 把不应持久化的线程池、Socket 一并序列化。
- 认为「实现了 Serializable 就安全」（仍需白名单与版本策略）。

选型口诀：**跨语言用 JSON/Protobuf，Java 内部高性能用 Kryo，遗留系统才评估 JDK 序列化**。
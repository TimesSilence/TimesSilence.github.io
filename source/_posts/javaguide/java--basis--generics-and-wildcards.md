---
title: "泛型&通配符详解"
date: 2017-10-03 11:21:00
updated: 2017-10-03 11:21:00
permalink: knowledge/java/basis/generics-and-wildcards/
categories:
  - Java
tags:
  - Java基础
  - 泛型
  - 通配符
description: "理解 Java 泛型擦除、上界下界通配符与 PECS 原则，提升 API 与集合设计的类型安全。"
---

泛型把类型检查前移到编译期，让集合与通用返回值在写代码时就能发现类型错误；通配符则在「保持灵活」与「保证读写安全」之间做权衡。

<!-- more -->

## 核心概念

泛型有三种形态：**泛型类**、**泛型接口**、**泛型方法**。Java 通过**类型擦除**实现兼容：编译后泛型参数变成上界类型（默认 `Object`），运行时无法做 `new T()` 或 `instanceof List<String>`。通配符 `? extends T`（上界，只读为主）与 `? super T`（下界，可写 T 及其子类）解决协变/逆变问题。

## 关键机制与实践

PECS 口诀：**Producer Extends, Consumer Super**——从集合读用 extends，往集合写用 super。框架里常见 `CommonResult<T>`、`Page<T>`、`Collections.sort(List<T>)` 都是泛型落地。反射可通过 `ParameterizedType` 读取部分泛型声明信息，弥补擦除带来的元数据缺失。

```java
void copy(List<? extends Number> src, List<? super Integer> dest) {
    for (Number n : src) {
        dest.add(n.intValue());
    }
}
```

## 常见误区与小结

- 认为运行时 `List<String>` 与 `List<Integer>` 类型不同（实际是同一 raw class）。
- 在 `? extends T` 列表里随意 `add`（编译器禁止，除 null）。
- 泛型数组 `new T[10]` 或 `(T) obj` 绕过检查，留到运行时才爆炸。

泛型的价值在编译期；理解擦除，才能读懂字节码、反射与框架里的类型转换。
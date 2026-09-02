---
title: "Java 值传递详解"
date: 2017-11-30 10:24:00
updated: 2017-11-30 10:24:00
permalink: knowledge/java/basis/why-there-only-value-passing-in-java/
categories:
  - Java
tags:
  - Java基础
  - 值传递
description: "澄清 Java 只有值传递：基本类型拷贝值，引用类型拷贝引用地址。"
---

「Java 是值传递还是引用传递」是经典争论。结论：**Java 只有值传递**——传的是实参值的拷贝；对引用类型而言，拷贝的是引用（地址），不是对象本身。

<!-- more -->

## 核心概念

**形参/实参**：调用时实参绑定到形参变量。**值传递**：形参得到副本，改形参不影响实参变量。**引用传递**（C++ 等）：形参与实参同一存储，改形参即改实参。Java 中引用变量保存的是对象的访问地址，传参时复制这份地址到形参。

## 关键机制与实践

案例 1：交换两个 int，方法内 swap 无效，因交换的是副本。案例 2：传入对象引用，在方法内 `obj.field = x` 会改堆上对象，因副本与实参指向同一对象。案例 3：方法内 `obj = new Object()` 只改形参指向，不影响外部引用。String 不可变，方法内 `s = "b"` 同样只改局部引用。

```java
static void change(User u) {
    u.setName("A");           // 外部可见
    u = new User("B");        // 外部仍指向原对象
}
```

## 常见误区与小结

- 把「能通过引用修改对象字段」说成「引用传递」。
- 与 C++ 引用参数 `void f(int& x)` 类比导致概念混乱。

面试标准答法：**Java 总是 pass-by-value；引用类型的 value 是引用的拷贝**。搞清这一点，Swapping、不可变对象、防御性拷贝都更好理解。
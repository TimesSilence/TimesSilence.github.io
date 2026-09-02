---
title: "Java 代理模式详解"
date: 2017-10-22 14:42:00
updated: 2017-10-22 14:42:00
permalink: knowledge/java/basis/proxy/
categories:
  - Java
tags:
  - Java基础
  - 代理模式
  - AOP
description: "掌握静态代理、JDK 动态代理与 CGLIB 的差异及在 Spring AOP 中的典型应用。"
---

代理在不改目标类的前提下织入横切逻辑（日志、事务、鉴权）。Java 里分编译期确定的静态代理与运行期生成字节码的动态代理，Spring AOP 与 RPC 客户端都建立在这套机制上。

<!-- more -->

## 核心概念

**静态代理**：手写代理类实现同一接口，委托目标对象；接口变更时代理也要改，维护成本高。**JDK 动态代理**：基于接口，`Proxy.newProxyInstance` + `InvocationHandler`，在 `invoke` 里前后增强。**CGLIB**：继承目标类生成子类，覆盖非 final 方法；无接口也可代理，但不能代理 final 类/方法。

## 关键机制与实践

JDK 代理要求目标实现接口；Spring 默认有接口用 JDK，无接口用 CGLIB（Boot 2.x 后 CGLIB 更常见）。`InvocationHandler.invoke` 里通过 `method.invoke(target, args)` 调用真实方法，此处即反射调用点。Self-invocation（类内部 `this.foo()`）不会走代理，是 `@Transactional` 失效经典原因之一。

```java
SmsService proxy = (SmsService) Proxy.newProxyInstance(
    loader, new Class[]{SmsService.class},
    (p, m, args) -> { /* before */ return m.invoke(target, args); });
```

## 常见误区与小结

- 认为 CGLIB 一定比 JDK 慢（现代版本差距已缩小，视场景而定）。
- 忽略 `equals`/`hashCode` 在代理对象上的行为差异。
- 在 handler 里忘记调用目标方法导致「空增强」。

读懂代理，就读懂了 Spring 事务、缓存、Feign 等「看起来魔法」的入口。
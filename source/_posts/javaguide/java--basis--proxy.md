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
description: "从静态代理讲到 JDK 动态代理与 CGLIB 字节码增强，解释 JDK 代理为何只能代理接口，并梳理 Spring AOP 的选型逻辑与常见失效场景。"
---

代理（Proxy）的核心思想是在不修改目标类的前提下，为其方法调用织入日志、事务、鉴权等横切逻辑。Java 中代理分两条路线：编译期就确定的静态代理，以及运行期动态生成字节码的动态代理；后者又分 JDK 动态代理与 CGLIB 两种实现，Spring AOP、RPC 客户端、ORM 框架都建立在这套机制之上。

<!-- more -->

## 它解决什么问题

业务代码里常常混着一些与核心逻辑无关却又到处都需要的功能：记录方法耗时、开启数据库事务、校验权限、远程调用。如果直接写进业务方法，同一个逻辑会在几十上百个类里重复出现，改一处就要改一片。

代理模式（Proxy Pattern）的解法是引入一个「替身」：调用方拿到的不是真实对象，而是它的代理。代理持有真实对象的引用，在转发调用前后插入额外动作。真实对象对此一无所知，横切逻辑被收拢到代理这一层。当代理类由程序员手写时叫静态代理；当代理类的字节码在运行期由 JVM 动态生成时，就是动态代理。

## 核心原理

三条路线的本质区别在于「代理类的字节码何时产生、以何种方式产生」：

- **静态代理**：代理类是开发者手写的 `.java` 文件，编译期就固定下来。代理类与目标类实现同一个接口，内部组合目标对象并委托调用。
- **JDK 动态代理**：运行期由 `java.lang.reflect.Proxy` 动态生成一个实现了指定接口的代理类。所有方法调用被统一转发到一个 `InvocationHandler.invoke` 方法，增强逻辑集中在这里。
- **CGLIB 动态代理**：运行期基于 ASM 字节码框架生成目标类的**子类**作为代理，通过方法覆盖实现拦截。不依赖接口，因此能代理没有实现接口的普通类。

## 深入机制

### 静态代理：委托模式的直观样例

```java
public interface SmsService {
    String send(String message);
}

public class SmsServiceImpl implements SmsService {
    @Override
    public String send(String message) {
        System.out.println("send message: " + message);
        return message;
    }
}

public class SmsProxy implements SmsService {
    private final SmsService target;

    public SmsProxy(SmsService target) {
        this.target = target;
    }

    @Override
    public String send(String message) {
        System.out.println("before send");
        String result = target.send(message);
        System.out.println("after send");
        return result;
    }
}
```

静态代理逻辑直白，但每代理一个类就要写一个代理类；接口每新增一个方法，目标类和所有代理类都要同步修改。它适合作为理解代理思想的入口，实战中很少直接使用。

### JDK 动态代理：InvocationHandler 与 Proxy

JDK 动态代理涉及两个核心类型。`Proxy.newProxyInstance` 负责生成代理对象，三个参数分别是类加载器、要实现的接口数组、以及调用处理器：

```java
public class DebugInvocationHandler implements InvocationHandler {
    private final Object target;

    public DebugInvocationHandler(Object target) {
        this.target = target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("before method " + method.getName());
        Object result = method.invoke(target, args);
        System.out.println("after method " + method.getName());
        return result;
    }
}

SmsService proxy = (SmsService) Proxy.newProxyInstance(
        SmsService.class.getClassLoader(),
        new Class<?>[]{SmsService.class},
        new DebugInvocationHandler(new SmsServiceImpl()));
proxy.send("java");
```

生成的代理类（命名形如 `com.sun.proxy.$Proxy0`）大致长这样：它继承 `Proxy`、实现所有指定接口，每个接口方法的方法体只有一件事——把 `Method` 对象和参数数组交给持有的 `InvocationHandler`，调用其 `invoke` 并返回结果。所以无论代理多少个接口、多少个方法，增强逻辑都收敛在 `invoke` 这一个入口。

**为什么只能代理接口？** 这是面试高频点。原因有两层：其一，生成代理类的代码模板就是「实现这组接口」，JDK 没有为「继承某个具体类」提供生成入口；其二，Java 是单继承，代理类必须继承 `Proxy` 来复用 `InvocationHandler` 等基础设施，唯一的继承名额被占掉后，扩展目标行为只能靠实现接口这条多重实现的路径。设计上的取舍换来了生成逻辑的极度简洁。

### CGLIB：生成子类的字节码增强

CGLIB（Code Generation Library）基于 ASM 直接操作字节码，在运行期生成目标类的子类。使用入口是 `Enhancer` 与 `MethodInterceptor`：

```java
public class DebugMethodInterceptor implements MethodInterceptor {
    @Override
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
        System.out.println("before method " + method.getName());
        // invokeSuper 调用父类（即目标类）的原始实现，避免反射，也避免无限递归
        Object result = proxy.invokeSuper(obj, args);
        System.out.println("after method " + method.getName());
        return result;
    }
}

Enhancer enhancer = new Enhancer();
enhancer.setSuperclass(AliSmsService.class);
enhancer.setCallback(new DebugMethodInterceptor());
AliSmsService proxy = (AliSmsService) enhancer.create();
proxy.send("java");
```

有两个细节值得注意。一是 `intercept` 的第一个参数 `obj` 是代理子类实例，若用 `method.invoke(obj, args)` 会再次进入拦截器造成死循环，正确姿势是 `proxy.invokeSuper(obj, args)`——`MethodProxy` 内部用生成好的 FastClass 索引做分发，绕开了反射开销。二是既然靠继承实现，`final` 类无法被继承、`final`/`private` 方法无法被覆盖，这些方法在 CGLIB 下天然不可代理，调用时会静默执行原始逻辑，这是隐蔽的坑。

## 工程实践

- **Spring AOP 的选型逻辑**：Spring 默认策略是目标类实现了接口就用 JDK 动态代理，否则用 CGLIB；Spring Boot 2.x 起默认改为统一使用 CGLIB（`proxyTargetClass = true`），因为早期版本里「按接口注入代理 Bean」与「按实现类注入」的类型不一致问题引发了大量困扰，一刀切走 CGLIB 更省心。可通过 `spring.aop.proxy-target-class=false` 改回默认策略。
- **自调用失效**：类内部 `this.foo()` 调用不经过代理对象，增强不会生效。这是 `@Transactional`、`@Cacheable` 失效最经典的原因——同类中一个没有事务注解的方法调用带注解的方法，事务不会开启。解法是拆分到不同 Bean，或通过 `AopContext.currentProxy()` 拿到代理再调用。
- **构造期与初始化期的坑**：CGLIB 代理是子类，构造代理实例时会走父类构造器；如果构造器里调用了可被覆盖的方法，可能提前触到未初始化完成的子类状态。另外代理对象与目标对象是两个实例，`equals`/`hashCode`、按实现类做强转（`(SmsServiceImpl) proxy`）都可能踩雷。
- **性能认知**：早期 CGLIB 的方法分发比 JDK 代理的反射调用快，但现代 JDK 对反射做了大量优化（达到调用阈值后切换为本地代码生成），两者差距已经不大；代理的创建成本才是大头，两种方案都靠缓存生成的代理类摊薄，选型时性能基本不构成决定因素。

## 对比与权衡

| 维度 | 静态代理 | JDK 动态代理 | CGLIB |
| --- | --- | --- | --- |
| 代理类产生时机 | 编译期手写 | 运行期动态生成字节码 | 运行期基于 ASM 生成字节码 |
| 实现方式 | 实现同一接口并委托 | 实现接口，转发到 `InvocationHandler` | 继承目标类，覆盖方法 |
| 是否需要接口 | 通常需要 | 必须 | 不需要 |
| 不能代理的目标 | —— | 未实现接口的类 | `final` 类、`final`/`private` 方法 |
| 方法调用开销 | 直接调用 | 反射调用（有 JIT 优化） | FastClass 索引分发 |
| 典型应用 | 演示、简单装饰 | Spring AOP（有接口）、RPC 客户端 | Spring AOP（无接口）、Hibernate 懒加载 |

## 面试视角

**JDK 动态代理为什么只能代理接口？** 生成的代理类固定继承 `Proxy` 以复用 `InvocationHandler` 基础设施，Java 单继承机制下无法再继承目标类；同时 `Proxy` 的生成模板就是「实现给定接口数组」，天然面向接口。两层原因叠加，决定了它只能代理接口。

**CGLIB 为什么不能代理 final 方法？** CGLIB 通过生成目标类的子类、覆盖父类方法来插入拦截逻辑。`final` 方法禁止覆盖，子类中不存在对应的代理入口，调用直接走父类原始实现，增强逻辑静默失效。

**Spring 事务失效的常见原因有哪些？** 自调用（`this` 直接调用本类方法）绕过代理；方法非 `public`（CGLIB 无法有效拦截）；方法或类被 `final` 修饰；异常被捕获吃掉或未满足回滚规则；Bean 未被 Spring 容器管理。

**JDK 动态代理一定比 CGLIB 快吗？** 不一定。调用阶段 CGLIB 的 FastClass 省去了反射分发，JDK 反射经现代 JVM 优化后差距很小；创建阶段 CGLIB 生成子类字节码的成本更高。工程上两者都缓存代理类，性能差异通常可以忽略，选型应看「有没有接口」和框架默认策略。

## 小结

- 代理模式的价值是把横切逻辑从业务代码中剥离，集中到代理层；静态代理是思想样板，动态代理才是工业实践。
- JDK 动态代理用 `Proxy` + `InvocationHandler` 在运行期生成接口实现类，所有方法调用收敛到 `invoke` 一个入口；受单继承和生成模板限制，只能代理接口。
- CGLIB 生成目标类子类做字节码增强，不依赖接口，但 `final` 类与 `final`/`private` 方法是能力盲区。
- Spring AOP 有接口走 JDK、无接口走 CGLIB，Boot 2.x 起默认统一 CGLIB；记住自调用会绕过代理，这是事务与缓存注解失效的头号原因。
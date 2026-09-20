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
description: "理解 SPI 服务发现机制与 ServiceLoader 懒加载原理，掌握线程上下文类加载器对双亲委派的补充，以及 Dubbo SPI 的按需加载与 AOP/IOC 增强。"
---

SPI（Service Provider Interface，服务提供者接口）是 JDK 内置的服务发现机制：接口由调用方定义，实现由第三方 jar 提供，`ServiceLoader` 在运行时按 classpath 上的配置文件找到并加载这些实现。它把「用哪个实现」的决定权从代码挪到部署，是 JDBC、SLF4J、Dubbo 等框架插件化能力的共同基石。

<!-- more -->

## 它解决什么问题

面向接口编程能降低模块耦合，但接口调用方总要面对一个问题：实例从哪来？如果调用方直接 `new` 一个实现类，就又把抽象绑死在了具体实现上，换实现就得改代码，违背开闭原则。SPI 给出的答案是「控制反转」的朴素版本——把实现类的名单写进配置文件放进 jar 包，框架在运行时扫描加载，换实现只需要换 jar 包，调用方一行代码不动。

它还顺手解决了类加载层面的一个结构性矛盾。双亲委派模型下，由启动类加载器（Bootstrap ClassLoader）加载的核心库看不见应用 classpath 上的类，可 JDBC 这类场景恰恰是核心库（`DriverManager` 在 JDK 内部）要去加载厂商提供的驱动实现（在应用 classpath）。SPI 借助线程上下文类加载器（Thread Context ClassLoader，TCCL）绕开了这个限制，后文展开。

## 核心原理

SPI 与 API 常被放在一起对比：**API** 是实现方同时提供接口和实现，调用方拿来就用；**SPI** 是接口定义在调用方（框架）一侧，实现由第三方按约定提供并部署。一个直觉的例子是芯片代工：设计公司定好接口标准，各家代工厂按标准交付各自实现，设计公司不需要关心产线细节。

JDK SPI 的约定非常简单：

1. 在 jar 包的 `META-INF/services/` 目录下放一个以接口全限定名命名的文件；
2. 文件内容每行写一个实现类的全限定名，允许写多行；
3. 调用方通过 `ServiceLoader.load(接口.class)` 拿到加载器，迭代它即得到全部实现的实例。

`ServiceLoader` 是 final 类并实现了 `Iterable`，迭代过程是懒加载（Lazy Loading）的：内部维护一个 `providers` 缓存和一个 `LazyIterator`。迭代时先消费缓存，缓存耗尽才由 `LazyIterator` 逐个解析配置文件里的类名，用 `Class.forName(cn, false, loader)` 加载（注意不触发初始化），再反射调无参构造实例化并放入缓存。配置写错、类不存在、构造失败都会在迭代到对应条目时才以 `ServiceConfigurationError` 的形式暴露。

## 深入机制

一个最小可用的 SPI 示例。接口定义在框架侧：

```java
public interface Logger {
    void info(String msg);
}
```

实现放在独立的 jar 中：

```java
public class Logback implements Logger {
    @Override
    public void info(String msg) {
        System.out.println("Logback: " + msg);
    }
}
```

配置文件路径为 `META-INF/services/com.example.Logger`，内容一行：`com.example.impl.Logback`。调用方代码：

```java
ServiceLoader<Logger> loader = ServiceLoader.load(Logger.class);
for (Logger logger : loader) {
    logger.info("hello spi");
}
```

真正的机关在 `load` 方法的第一行：

```java
public static <S> ServiceLoader<S> load(Class<S> service) {
    ClassLoader cl = Thread.currentThread().getContextClassLoader();
    return ServiceLoader.load(service, cl);
}
```

它取的是当前线程的上下文类加载器。TCCL 默认是应用类加载器（Application ClassLoader），负责加载 classpath 上的类。核心库代码虽然由启动类加载器加载，但执行到 `ServiceLoader.load` 时可以通过 TCCL「反向」看到应用 classpath 上的实现类——这不是推翻双亲委派，而是在委派体系上开的一个人工旁路。JDBC 4（JDK 6）之后不再需要手写 `Class.forName("com.mysql.cj.jdbc.Driver")`，正是 `DriverManager` 初始化时通过 ServiceLoader 扫描 `META-INF/services/java.sql.Driver` 自动注册的。

对同一接口存在多个实现时，`ServiceLoader` 不提供任何选择策略，全部实例都会迭代出来，挑哪个由调用方自己决定——SLF4J 的答案是干脆约定 classpath 上只放一个 binding。另外单个 `ServiceLoader` 实例不是线程安全的，跨线程共享需要调用方自行同步。Java 9 之后的模块体系里还可以用模块描述符的 `uses` 与 `provides ... with ...` 声明服务关系，替代配置文件。

## 工程实践

JDK SPI 的短板在真实框架需求面前很明显：迭代时会把配置的全部实现都实例化，无法按需加载；没有依赖注入，实现类之间的协作要自己拼；没有 AOP 能力，无法给实现套统一增强。这些正是 Dubbo 自研一套 SPI 的原因。

Dubbo SPI 沿用「配置文件声明实现」的思路但做了全面升级：配置文件放在 `META-INF/dubbo/` 下，内容采用 `name=实现类全限定名` 的键值对形式；接口上用 `@SPI("默认名")` 标注默认实现；通过 `ExtensionLoader.getExtension("name")` 按名字精确加载单个实现，实现按需加载；`@Adaptive` 注解支持在运行时根据 URL 参数动态选择适配实现；实现类若存在以接口为参数的构造器（Wrapper 类），Dubbo 会自动层层包装，获得 AOP 效果；实现类中的 setter 方法会被自动注入其他扩展或 Spring Bean，形成简易 IOC。这一整套机制支撑了 Dubbo 协议、注册中心、序列化等几乎所有核心组件的可插拔。

实践中写 SPI 实现还要注意：实现类必须提供 public 无参构造器，否则 ServiceLoader 实例化失败；配置文件文件名必须是接口全限定名，包名写错不会报错，只会表现为「一个实现都找不到」，排查时先核对这个路径。

## 对比与权衡

| 维度 | JDK SPI | Dubbo SPI | Spring IoC |
| --- | --- | --- | --- |
| 配置位置 | META-INF/services/接口全限定名 | META-INF/dubbo/ 等，键值对 | 注解 / XML / spring.factories |
| 加载方式 | 迭代时全部懒加载 | 按名称精确加载，可延迟 | 容器启动时统一装配 |
| 按需加载 | 不支持 | 支持（含 @Adaptive 动态适配） | 支持 |
| IOC/AOP | 无 | 有（自动注入 + Wrapper 包装） | 完整容器能力 |
| 默认实现指定 | 无 | @SPI("name") | @Primary 等 |
| 适用场景 | JDK 及轻量框架的服务发现 | 扩展点极多的 RPC 框架 | 全功能应用开发 |

Spring Boot 的自动配置走的是 `spring.factories`（新版本改为 `META-INF/spring/...imports`）这套文件扫描思路，与 SPI 一脉相承，但由 Spring 自己的加载器实现，同样说明「配置声明 + 运行时加载」这一模式的通用价值。

## 面试视角

**SPI 和 API 的区别是什么？** 看接口定义在哪一侧：API 的接口和实现都在提供方，调用方直接依赖使用；SPI 的接口由调用方（框架）定义，实现由第三方按约定部署在 classpath，框架运行时通过 ServiceLoader 发现。SPI 实现的是调用方对实现的反向控制。

**ServiceLoader 的实现原理？** 按约定读取 `META-INF/services/接口全限定名` 配置文件获得实现类名列表，迭代时用 Class.forName 加载类、反射调无参构造实例化，已实例化的实现放入缓存。整个过程是懒加载的，加载错误推迟到迭代到对应条目时才抛出。

**为什么 SPI 要用线程上下文类加载器？** 核心库（如 DriverManager）由启动类加载器加载，双亲委派模型下无法看到应用 classpath 上的实现类。TCCL 默认是应用类加载器，ServiceLoader 通过它完成加载，相当于在委派体系上开了一个旁路，让核心库代码能加载第三方实现。

**JDK SPI 有什么缺点，Dubbo 怎么增强？** 缺点：一次迭代会实例化全部实现，不能按需获取；没有 IOC 和 AOP；无法指定默认实现。Dubbo SPI 用键值对配置支持按名加载，@Adaptive 支持运行时动态选择，Wrapper 构造器实现 AOP，setter 自动注入实现 IOC。

**JDBC 4 之后为什么不用 Class.forName 加载驱动了？** DriverManager 初始化时通过 ServiceLoader 扫描所有 jar 中 `META-INF/services/java.sql.Driver` 声明的实现并自动注册，驱动 jar 放进 classpath 即完成加载，显式 Class.forName 只是兼容旧习惯的遗留写法。

## 小结

- SPI 是「接口归调用方、实现归第三方、装配靠配置」的服务发现机制，让换实现变成换 jar 包的部署动作。
- ServiceLoader 的核心是 `META-INF/services` 约定 + TCCL 加载 + 懒加载迭代，TCCL 是核心库看见应用实现类的关键。
- JDK SPI 简单但能力有限：全部实例化、无选择策略、无 IOC/AOP、非线程安全。
- Dubbo SPI 在同思路基础上补齐了按需加载、自适应选择、Wrapper 增强和自动注入，是框架级扩展点的成熟范式。
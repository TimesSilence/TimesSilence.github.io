---
title: "Java 反射机制详解"
date: 2017-10-28 15:49:00
updated: 2017-10-28 15:49:00
permalink: knowledge/java/basis/reflection/
categories:
  - Java
tags:
  - Java基础
  - 反射
description: "梳理 Class 对象的四种获取途径与 Field/Method/Constructor 操作，讲清反射性能开销的真相与优化手段，并给出框架场景与滥用风险的边界。"
---

反射（Reflection）让程序在运行时检查类的结构、读写字段、调用方法，而不需要在编译期知道具体类型。它是 Spring 扫描注解、MyBatis 映射结果集、JDK 动态代理转发调用的底层能力；日常业务代码应当克制使用，但读框架源码、写扩展点时离不开它。

<!-- more -->

## 它解决什么问题

普通 Java 代码是「编译期绑定」的：调用一个方法，编译器必须能在编译期看到类和方法签名。但框架面对的恰恰是编译期未知的类——Spring 不知道用户会写出什么 `@Component`，MyBatis 不知道结果集要装进哪个 POJO，JUnit 不知道哪些方法标了 `@Test`。

反射把绑定时机推迟到运行期：给框架一个类名或一个 `Class` 对象，它就能查出这个类有哪些字段、哪些方法、带着什么注解，并完成实例化和调用。可以说，没有反射就没有今天 Java 生态的「约定优于配置」；反射是框架向用户代码反向伸手的那只手。

## 核心原理

JVM 加载一个类后，会在方法区（JDK 8 起为元空间）保存它的类型元数据，并在堆中创建一个对应的 `java.lang.Class` 对象作为访问入口。反射 API 就是围绕 `Class` 展开的一组查询与操作能力：`Field` 对应字段，`Method` 对应方法，`Constructor` 对应构造器，三者都继承自 `AccessibleObject`，统一提供 `setAccessible` 来关闭访问检查。

获取 `Class` 对象有四种途径，它们在「是否触发类初始化」上有细微差别：

```java
// 1. 类字面量：编译期已知类型时使用，不触发类初始化
Class<?> c1 = User.class;

// 2. Class.forName：传入全限定名，默认会触发类初始化（静态块执行）
Class<?> c2 = Class.forName("com.example.User");

// 3. getClass：已有实例时获取，必然已完成初始化
Class<?> c3 = new User().getClass();

// 4. ClassLoader.loadClass：只加载不初始化，静态块不执行
Class<?> c4 = Thread.currentThread().getContextClassLoader()
        .loadClass("com.example.User");
```

JDBC 里 `Class.forName("com.mysql.cj.jdbc.Driver")` 就是利用第 2 种方式的初始化副作用——驱动类的静态块里完成了向 `DriverManager` 的注册。

## 深入机制

### Field / Method / Constructor 的基本操作

```java
public class User {
    private String name = "default";

    public String greet(String prefix) {
        return prefix + " " + name;
    }
}

Class<?> clazz = Class.forName("com.example.User");
// 反射实例化：优先拿到具体构造器再 newInstance
Object user = clazz.getDeclaredConstructor().newInstance();

// getDeclaredXxx：只看本类声明的成员（含 private），不含继承来的
// getXxx：含继承的 public 成员
Method greet = clazz.getDeclaredMethod("greet", String.class);
Object result = greet.invoke(user, "hello");

// 访问 private 成员前必须关闭访问检查
Field name = clazz.getDeclaredField("name");
name.setAccessible(true);
name.set(user, "reflection");
System.out.println(greet.invoke(user, "hi")); // hi reflection
```

两组 API 的区别是高频考点：`getMethods()` 返回本类及父类所有 public 方法，`getDeclaredMethods()` 只返回本类声明的方法（不限访问级别），`Field`/`Constructor` 同理。找私有成员必须用 `Declared` 系列并配合 `setAccessible(true)`。

### 性能开销的真相

「反射慢」流传很广，但慢在哪、慢多少，需要拆开看：

1. **方法查找开销**：`getMethod("xxx")` 每次都要在类的方法列表中遍历匹配并做访问校验。这笔开销完全可以通过缓存 `Method`/`Field`/`Constructor` 对象消除，框架无一例外都这么做。
2. **调用开销**：`Method.invoke` 早期走 JVM 本地方法（native 路径），无法被 JIT 内联，参数还要装箱成 `Object[]`，确实比直接调用慢一个数量级以上。但 JVM 有 **Inflation 机制**：同一个 `Method` 被反射调用达到一定次数（默认 15 次左右，由 `sun.reflect.inflationThreshold` 控制）后，会动态生成一个字节码调用器（GeneratedMethodAccessor），后续的反射调用接近普通调用。所以热路径上的反射并没有传闻中那么慢。
3. **访问检查开销**：`setAccessible(true)` 关闭每次调用前的 Java 语言访问检查，能进一步降低成本。JDK 9 模块化之后，对 JDK 内部类的私有成员 `setAccessible` 可能被模块系统拒绝（`InaccessibleObjectException`），需要 `--add-opens` 放行，但对自己的应用代码不受影响。

真正的性能结论：**反射调用的固定成本已被 JIT 与 Inflation 大幅摊薄，可变的查找成本靠缓存消除**。瓶颈更多在代码可读性、类型安全和重构友好度上，而不是运行速度。极端性能场景（如序列化框架）会进一步选用 `MethodHandle` 或直接生成字节码。

### 反射与泛型、注解的联动

泛型在运行期被擦除，但类文件 `Signature` 属性中仍保留泛型声明信息，反射通过 `ParameterizedType` 可以读回部分内容——例如字段声明 `List<String>` 的实参类型、方法返回值的泛型签名。Jackson 的 `TypeReference<List<User>>` 就是利用父类中保留的泛型超类签名还原出 `List<User>` 的完整类型。注解同样通过反射读取：`method.getAnnotation(Transactional.class)` 是 Spring 声明式事务的起点。

## 工程实践

- **典型应用场景**：IoC 容器装配 Bean、ORM 结果集映射、序列化/反序列化、注解处理器运行期部分、JDK 动态代理的 `invoke` 转发、单元测试框架发现与执行用例。
- **缓存反射对象**：任何需要反复调用的 `Method`/`Field` 都必须缓存，配合 `setAccessible(true)`，这是手写框架代码的第一守则。
- **优先构造器实例化**：`clazz.newInstance()` 早已被标记废弃，它会把构造器抛出的受检异常原样透传且不经过编译期检查；正确路径是 `getDeclaredConstructor().newInstance()`。
- **不要绕过类型系统做坏事**：反射可以给 `List<String>` 塞入 `Integer`（擦除让运行时拦不住），异常会延迟到读取元素时才以 `ClassCastException` 爆发，排查成本极高。

## 对比与权衡

| 维度 | 直接调用 | 反射调用 | MethodHandle | 字节码生成 |
| --- | --- | --- | --- | --- |
| 编译期类型检查 | 有 | 无，错误推迟到运行期 | 有（方法类型签名） | 取决于生成代码 |
| 调用性能 | 最快，可内联 | 较慢，Inflation 后接近直接调用 | 接近直接调用 | 等同直接调用 |
| 灵活性 | 编译期固定 | 运行期任意类任意成员 | 运行期但需已知签名 | 运行期生成，固定后不可变 |
| 典型使用者 | 业务代码 | IoC/ORM/测试框架 | 高性能框架、Lambda 底层 | CGLIB、ByteBuddy |

## 面试视角

**Class 对象有哪些获取方式，差别是什么？** 类字面量 `User.class`、实例的 `getClass()`、`Class.forName()`、`ClassLoader.loadClass()` 四种。核心差别在初始化时机：`forName` 默认触发类初始化（静态块执行），`loadClass` 只加载不初始化，类字面量不触发初始化，`getClass` 的前提则是实例已存在。

**反射为什么慢，如何优化？** 慢在三处：方法查找的遍历与校验、调用走本地路径无法内联、参数装箱与访问检查。优化手段是缓存 `Method`/`Field`、`setAccessible(true)` 关闭检查；JVM 的 Inflation 机制在调用次数超过阈值后会把反射调用替换为动态生成的字节码调用器，热路径性能接近直接调用。

**`getMethods` 和 `getDeclaredMethods` 有什么区别？** 前者返回本类和所有父类的 public 方法；后者只返回本类声明的方法，不分访问级别，不含继承。访问私有成员必须用 `Declared` 系列加 `setAccessible(true)`。

**反射能破坏单例吗？怎么防？** 能通过 `setAccessible` 调用私有构造器创建第二个实例。防御手段是在构造器中判断实例已存在则抛异常，或直接改用枚举单例——反射创建枚举实例会被 JVM 直接拒绝。

## 小结

- 反射把类型绑定推迟到运行期，是 IoC、ORM、动态代理、注解处理共同的地基。
- 四种 `Class` 获取方式的差异集中在类初始化时机；成员操作记住 `getXxx` 含继承 public、`getDeclaredXxx` 仅本类声明。
- 性能上要缓存反射对象并关闭访问检查，Inflation 机制让热路径反射调用接近直接调用，「反射慢」不该成为拒绝框架的理由。
- 反射绕开编译期类型检查，错误全部推迟到运行期；框架用它换灵活性，业务代码应优先使用编译期安全的直接调用。
---
title: "Java基础常见面试题总结(下)"
date: 2017-12-14 12:38:00
updated: 2017-12-14 12:38:00
permalink: knowledge/java/basis/java-basic-questions-03/
categories:
  - Java
tags:
  - Java基础
  - 面试
description: "Java 基础面试（下）深度解析：异常体系、finally 执行时机、反射与动态代理、序列化与 transient、I/O 模型的高频考题与原理。"
---

Java 基础面试的「下篇」覆盖异常体系、反射与动态代理、序列化、I/O 模型四条主线。这组题横跨语言机制与框架底层，想答出深度，需要把「编译器和 JVM 在背后做了什么」讲清楚，而不是停留在概念背诵。

<!-- more -->

## 考察地图

- **异常体系**：Exception 与 Error 的分工、Checked 与 Unchecked 之争、finally 的执行时机、try-with-resources。考察的是对「程序出错路径」的设计判断。
- **反射与动态代理**：反射的能力与代价、JDK 与 CGLIB 两条代理路线。考察对 Spring 等框架底层的理解。
- **序列化**：transient 的语义、JDK 原生序列化被弃用的原因。考察网络传输与持久化的工程常识。
- **I/O**：字节流与字符流的分工、BIO/NIO/AIO 的演进。考察对操作系统 I/O 模型的认知。
- 建议自行查阅：泛型类、泛型接口、泛型方法三种声明方式，注解的编译期与运行期两种解析时机，SPI 与 API 的区别，Throwable 常用方法清单，常见语法糖盘点——这些偏纯记忆或框架使用层面，面试中多作铺垫。

## 异常体系

### Exception 和 Error 有什么区别？

**结论**：二者都继承 `Throwable`。`Exception` 是程序可以预期、可以捕获处理的异常；`Error` 是 JVM 层面的严重问题，程序通常无力处理，也不应该捕获。

**原理**：`Error` 的典型代表是 `OutOfMemoryError`、`StackOverflowError`、`NoClassDefFoundError`，发生后 JVM 一般会终止当前线程。语法上 `catch (Error e)` 能编译通过，但捕获后通常做不出有意义的恢复，反而把致命问题掩盖成「程序还在跑」的假象。`Exception` 内部再分受检与非受检两类，这是下一题的内容。

**延伸**：一对高频易混点值得记住：`ClassNotFoundException` 是 Exception，发生在反射、`Class.forName` 等动态加载场景，目标类一开始就不在classpath 上，属于可预期的失败；`NoClassDefFoundError` 是 Error，表示编译期类还在、运行期类定义缺失，常见于 jar 包缺失或静态初始化失败后再次触碰该类。

> 追问：为什么说不建议捕获 `Throwable` 或 `Error`？提示：从「能否有效恢复」和「会不会掩盖 JVM 致命状态」两个角度想。

### Checked Exception 和 Unchecked Exception 有什么区别？

**结论**：Checked Exception（受检异常）必须在编译期被 `catch` 或用 `throws` 声明，否则编译不通过；Unchecked Exception 编译器不强制处理。

**原理**：除 `RuntimeException` 及其子类外，`Exception` 的其余子类都是受检异常，如 `IOException`、`SQLException`；`RuntimeException` 一族（NPE、越界、非法参数、类型转换错误）是非受检的，按 JLS 划分 `Error` 也属于非受检。设计意图是：受检异常代表「外部环境的可预期失败」，强制调用方给出对策；非受检异常多为代码缺陷，本质上是 bug，正确做法是修代码而不是拿 `try-catch` 糊住。

**延伸**：现代工程实践明显偏向少用受检异常——它会污染接口签名、在 lambda 里几乎无法传播，Spring 把 `SQLException` 翻译成非受检的 `DataAccessException` 就是典型案例。一般只在「异常本身是业务分支、必须强制调用方处理」时使用受检异常，比如余额不足。

> 追问：为什么在 Stream 的 lambda 里抛受检异常很别扭？提示：函数式接口的方法签名上没有 `throws` 位置。

### finally 中的代码一定会执行吗？

**结论**：不一定。正常流程下（包括 `try`/`catch` 中执行了 `return`）finally 必然执行；但 JVM 直接退出时不会执行，比如 `System.exit()`、`Runtime.halt()`、进程被强杀或断电。

**原理**：`return` 的语义是先把返回值暂存，执行完 finally 再返回。真正的坑是在 finally 里写 `return`：它会覆盖暂存的返回值，还会吞掉未处理的异常，而编译器不会报错：

```java
static int f() {
    try {
        return 1;
    } finally {
        return 2; // 方法返回 2，try 中的返回值被丢弃
    }
}
```

**延伸**：若当前是守护线程（daemon），当所有用户线程结束、JVM 直接退出时，finally 也可能来不及跑。实践结论：finally 只做资源清理，绝不在里面返回或抛异常。

> 追问：finally 里的 `return` 除了覆盖返回值还有什么危害？提示：`try` 中抛出的异常会被静默吞掉，调用方完全感知不到。

### try-with-resources 相比 try-finally 解决了什么问题？

**结论**：Java 7 起，实现 `AutoCloseable` 的资源直接声明在 `try` 后的括号里，编译器自动生成关闭逻辑：代码更短，且异常信息更完整。

**原理**：资源按声明的逆序关闭，关闭动作先于 `catch` 和 `finally` 执行。手动写法有个隐蔽缺陷——`try` 块抛出异常后，`finally` 里 `close()` 再抛异常会把前一个覆盖掉，真正的故障原因丢失；try-with-resources 则把 close 阶段的异常挂到主异常的 suppressed 列表里，可通过 `getSuppressed()` 取回：

```java
try (BufferedReader br = Files.newBufferedReader(path)) {
    return br.readLine();
} // 编译器自动生成关闭逻辑，异常不互相覆盖
```

**延伸**：Effective Java 的立场是「凡是必须关闭的资源，一律优先 try-with-resources」。注意括号里声明的变量隐式 final，不能在 try 体内重新赋值；自定义资源想支持该语法，实现 `AutoCloseable` 即可，`close()` 允许声明更具体的异常类型。

> 追问：try 括号里声明的资源抛异常、close 也抛异常，调用方拿到的是哪个？提示：拿到 try 块的主异常，close 异常进 suppressed。

## 反射与动态代理

### 什么是反射？有什么优缺点和应用场景？

**结论**：反射是在运行期动态探知类结构（字段、方法、构造器）并操作对象的能力。它是 Spring、MyBatis 等框架的基石，业务代码则应克制使用。

**原理**：普通代码在编译期就确定了类型与调用关系，反射把这一切推迟到运行期，通过 `Class`、`Method`、`Field` 这些元数据对象工作。典型场景：IoC 容器扫描注解并实例化 Bean、动态代理中通过 `Method.invoke` 转发调用、ORM 框架把查询结果集按字段名映射进 Java 对象。

**延伸**：代价主要有三。性能上，反射调用绕过了内联等 JIT 优化，框架普遍靠缓存 `Method` 对象缓解；封装性上，`setAccessible(true)` 可突破 `private` 访问检查，但在模块系统下对未开放的包会抛 `InaccessibleObjectException`；可维护性上，错误从编译期推迟到运行期，排查成本上升。

> 追问：反射调用为什么比直接调用慢？提示：访问检查、方法查找、无法内联；JDK 对热点反射调用有 inflation 机制，会生成字节码替代 native 调用。

### JDK 动态代理和 CGLIB 动态代理有什么区别？

**结论**：JDK 动态代理基于接口，运行期生成一个实现相同接口的代理类；CGLIB 基于继承，用 ASM 生成目标类的子类作为代理。

**原理**：JDK 版入口是 `Proxy.newProxyInstance`，代理对象上的任何调用都被统一转发到 `InvocationHandler.invoke`，再由 `method.invoke(target, args)` 反射调用目标方法——所以目标类必须实现接口。CGLIB 生成子类重写父类方法，调用被 `MethodInterceptor.intercept` 拦截，因此 `final` 类无法被代理，`final`、`private` 方法也无法被增强。

**延伸**：Spring AOP 的选择策略是：目标实现了接口默认走 JDK 代理，否则走 CGLIB（也可配置强制 CGLIB）。效率方面，多数场景 JDK 代理更优，且随 JDK 版本升级优势扩大；CGLIB 的额外开销主要在代理类生成期。

> 追问：为什么 CGLIB 增强不了 `final` 方法？提示：子类不能重写 `final` 方法，拦截逻辑没有挂载点。

## 序列化

### 不想让某些字段参与序列化怎么办？

**结论**：用 `transient` 修饰字段即可，序列化时跳过该字段，反序列化后它取类型默认值（引用为 null，`int` 为 0）。

**原理**：`transient` 只能修饰字段，不能修饰类和方法。`static` 字段属于类而非对象，天然不参与序列化，加不加 `transient` 结果一样。需要注意：如果 transient 字段有业务含义，反序列化后需要通过自定义 `readObject` 等手段重建，否则就是带着默认值的对象。

**延伸**：想更精细地控制序列化行为，可实现 `private writeObject`/`readObject` 或 `Externalizable` 接口。另外务必显式声明 `serialVersionUID`——不声明时编译器按类结构自动生成，类一旦改动，旧字节流反序列化直接抛 `InvalidClassException`。

> 追问：`ArrayList` 的 `elementData` 数组是 transient 的，元素为什么还能正常序列化？提示：`ArrayList` 自定义了 `writeObject`，只写入实际元素而非整个数组。

### 为什么不推荐使用 JDK 自带的序列化？

**结论**：三个硬伤——只认 Java 无法跨语言、序列化后字节体积大性能差、反序列化可被恶意输入利用执行任意代码。

**原理**：JDK 序列化把完整对象图连同类元数据写入字节流，体积远超 Hessian、Kryo、Protobuf 等二进制协议。安全问题是重点：反序列化时输入字节流可以控制要实例化的类，攻击者通过精心构造的 gadget 链能让反序列化过程执行任意代码，这正是各类 Java 反序列化漏洞的根源。底线原则：绝不反序列化不可信来源的数据。

**延伸**：工程选型上，RPC 场景多用 Protobuf、Hessian、Kryo 这类紧凑的二进制协议；JSON、XML 等文本协议可读性好但体积与性能一般，适合对外 API 和调试场景。

> 追问：如果存量系统必须用 JDK 序列化，如何缓解安全风险？提示：JEP 290 引入的 `ObjectInputFilter` 支持白名单校验。

## I/O

### 字节流和字符流为什么要分开？

**结论**：信息的最小存储单元是字节，字符流是 JVM 按指定编码把字节解码成字符后的封装。两者分别对应「通用二进制」和「文本编码」两类问题。

**原理**：Java I/O 的四十多个类派生自四个抽象基类：`InputStream`/`OutputStream` 处理字节，`Reader`/`Writer` 处理字符。直接用字节流读文本，不知道编码就容易把多字节字符切碎产生乱码；反过来，图片、压缩包这类二进制数据必须走字节流，经过字符解码会破坏原始数据。

**延伸**：`InputStreamReader` 和 `OutputStreamWriter` 是字节流到字符流的桥，构造时建议显式传入编码，不依赖平台默认值——这是跨平台乱码问题最常见的根因。

> 追问：`BufferedInputStream` 这类缓冲流为什么能提速？提示：用内存缓冲摊薄系统调用次数，与字节/字符的划分是正交的两个维度。

### BIO、NIO 和 AIO 有什么区别？

**结论**：BIO 一连接一线程、读写阻塞；NIO 基于 Channel、Buffer、Selector 做多路复用，单线程可管理海量连接；AIO 是基于回调的异步非阻塞模型。

**原理**：BIO 的瓶颈在线程模型：每个连接独占一个线程，连接数上万后内存占用与上下文切换都不可承受。NIO 用 Selector 轮询就绪事件，把「等待数据」从线程身上剥离，一个线程就能处理成千上万的连接，Netty 正是建立在 NIO 之上。AIO 进一步把读写完成通知交给操作系统回调，但 Linux 下的实现并不成熟，Netty 后来也移除了 AIO 传输方式。

**延伸**：NIO 并非处处快于 BIO——连接数少、报文大的场景，BIO 模型更简单直观，反而省心。选型要看连接规模和团队对复杂度的掌控力。

> 追问：Selector 在 Linux 底层对应什么机制？提示：epoll；JDK 曾因 epoll 空轮询 bug 导致 CPU 100%，Netty 通过定期重建 Selector 规避。

## 小结

- 异常设计的核心判断是「可预期的外部失败用受检异常，代码缺陷用非受检异常」；finally 不保证执行的场景只有 JVM 退出，但永远不要在 finally 里 `return`。
- 反射与动态代理是框架的地基：JDK 代理面向接口，CGLIB 面向继承，Spring AOP 按目标是否实现接口自动选择。
- transient 跳过字段序列化，JDK 原生序列化因跨语言、性能、安全三大问题被工程实践弃用。
- 字节流与字符流的分工源于编码问题；BIO/NIO/AIO 的差异本质是「等待数据的方式」，NIO 的多路复用是高并发网络编程的起点。
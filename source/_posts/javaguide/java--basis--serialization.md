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
description: "理解 Serializable 与 Externalizable 两套机制、serialVersionUID 的版本控制作用、transient 语义与反序列化安全风险，掌握 JSON/Protobuf/Kryo 的选型。"
---

序列化（Serialization）把对象状态转成可存储、可传输的字节流，反序列化则是它的逆过程。RPC 调用、缓存读写、Session 复制都建立在这对操作之上；但 JDK 原生序列化因体积臃肿、性能平庸且背着反序列化漏洞的历史包袱，早已不是现代系统的默认选项。

<!-- more -->

## 它解决什么问题

Java 对象只活在 JVM 堆内存里，进程一停就消失。一旦需要把对象写进磁盘、发到网络对端、放进 Redis 之类的外部存储，就必须先把它「拍平」成字节序列——这正是序列化的职责。放到网络模型里看，它对应 OSI 中表示层（Presentation Layer）的工作：把应用层数据结构编码为字节流，以及反向还原，所以序列化协议归属 TCP/IP 模型的应用层范畴。

围绕「对象 → 字节」这条通路，JDK 设计了一组控制点：`Serializable` 与 `Externalizable` 决定走哪套机制，`serialVersionUID` 管版本兼容，`transient` 管字段取舍。理解它们，才能谈得上正确使用和正确选型。

## 核心原理

JDK 原生序列化的门槛极低：类实现 `java.io.Serializable` 这个没有任何方法的标记接口，就能交给 `ObjectOutputStream` 写出。机制上不依赖接口方法，而是靠序列化运行时的特殊处理：写出时先记录类描述（类名、serialVersionUID、字段元信息），再递归遍历对象图，把所有非 static、非 transient 的字段值依次写入流；读回时绕过构造器，直接依据这些字节在堆上重建对象。

三个关键控制点：

- **serialVersionUID**：版本指纹。反序列化时比对流中记录的 UID 与本地类的 UID，不一致直接抛 `InvalidClassException`。不显式声明时由运行时按类结构哈希计算，加一个字段、改一处继承关系都可能改变结果，让历史数据突然无法反序列化。
- **transient**：被修饰的字段不参与默认序列化，反序列化后是类型默认值（int 为 0，引用为 null）。典型用途是敏感数据和可重新推导的缓存字段。它只能修饰字段，不能修饰类和方法。
- **static 字段**：属于类而非对象实例，天然不进入对象序列化流。

如果想完全接管编解码过程，可以实现 `Externalizable` 接口，在 `writeExternal`/`readExternal` 中手工写字段；更轻量的做法是在类里声明私有方法 `writeObject`/`readObject`，序列化机制会通过反射回调它们，让开发者在默认行为前后插入自定义逻辑。

## 深入机制

一个覆盖主要控制点的例子：

```java
public class Account implements Serializable {
    private static final long serialVersionUID = 1L;

    private String username;
    private transient String password; // 敏感字段，排除在默认机制之外

    public Account(String username, String password) {
        this.username = username;
        this.password = password;
    }

    // 序列化机制通过反射回调这两个私有方法
    private void writeObject(ObjectOutputStream out) throws IOException {
        out.defaultWriteObject();        // 先按默认规则写出普通字段
        out.writeUTF(encrypt(password)); // 敏感字段加密后手动写出
    }

    private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
        in.defaultReadObject();
        this.password = decrypt(in.readUTF()); // 必须与写出顺序一致地读回
    }

    private String encrypt(String s) { return s; } // 示意，省略实现
    private String decrypt(String s) { return s; }
}
```

要点有两个：`defaultWriteObject()` 负责默认部分，自定义读写紧随其后且顺序必须严格对称；`transient` 不是「绝对防泄漏」，它只是把字段排除在默认机制外，真要安全传输仍需加密或干脆不传。

serialVersionUID 的行为可以直接实验验证：把一个 UID 为 1L 的对象写入文件后，将类改成 2L 再读，立即得到 `InvalidClassException`，异常信息里同时打印流中与本地的两个 UID。这是排查「服务发版后缓存对象反序列化大面积失败」的标志性线索。

## 工程实践

**典型场景**：RPC 框架的消息体编解码、Redis 与本地缓存中的对象存取、Servlet 容器（如 Tomcat）的 Session 持久化与集群复制，以及把序列化当深拷贝工具用。

**常见坑**：

- 不显式声明 serialVersionUID，把版本控制权交给运行时的自动计算。类结构稍一变动，线上存量数据就全部反序列化失败。可序列化类应显式写一个固定值。
- 父类未实现 Serializable 时，父类字段不会进入序列化流，反序列化后它们由父类无参构造重新初始化——子类状态保住了，父类状态丢了。
- 单例类实现 Serializable 后，每次反序列化都会在堆上新建实例。解法是声明 `private Object readResolve()` 返回既有单例；枚举天然免疫，因为枚举序列化只记录名字。
- 把 Socket、线程、连接池这类与运行环境绑定的资源句柄序列化，反序列化后得到的只是无效引用。

**安全红线**：Java 反序列化漏洞（Deserialization Vulnerability）是安全史上的重灾区。机制本身会回调类的 `readObject` 等方法，攻击者构造恶意字节流，借助 classpath 上方法可被串成调用链的类（gadget chain），在反序列化过程中执行任意代码。缓解手段：绝不反序列化不可信来源的字节流；无法回避时用 JDK 提供的 `ObjectInputFilter` 配置类白名单；更彻底的做法是换用 JSON 这类没有代码执行面的格式。

## 对比与权衡

| 维度 | JDK 序列化 | JSON（Jackson 等） | Protobuf | Kryo | Hessian |
| --- | --- | --- | --- | --- | --- |
| 跨语言 | 仅 Java | 全语言 | 全语言 | 仅 Java（有移植版） | 多语言 |
| 字节体积 | 大（含类描述） | 中（文本） | 小 | 小 | 较小 |
| 性能 | 慢 | 中 | 快 | 很快 | 较快 |
| 可读性 | 不可读 | 好 | 不可读 | 不可读 | 不可读 |
| Schema 要求 | 无 | 无 | 需 .proto 定义 | 无 | 无 |
| 安全面 | 有反序列化风险 | 较小 | 小（强 Schema） | 建议注册类白名单 | 中等 |
| 典型场景 | 遗留系统、JDK 内部设施 | Web API、配置 | 跨语言 RPC（gRPC） | Java 系 RPC、缓存 | Dubbo 历史默认协议 |

Kryo 实例非线程安全，生产代码里通常用 ThreadLocal 或对象池隔离。选型经验：对外接口和跨语言场景用 JSON 或 Protobuf；纯 Java 内部追求极致性能用 Kryo；JDK 原生序列化只在维护遗留系统时被动接触。

## 面试视角

**serialVersionUID 有什么用，为什么建议显式声明？** 它是类的版本指纹，反序列化时与流中记录的值比对，不一致抛 InvalidClassException。不声明时由运行时按类结构自动计算，字段、方法、继承的变动都会改变计算结果，兼容性被意外打破；显式固定一个值，就把兼容性决策权收回开发者手中。

**transient 修饰的字段真的不会被序列化吗？** 默认机制下不会，反序列化后是类型默认值。但可以在 writeObject/readObject 中手动写出读回（常配合加密），实现 Externalizable 时更是完全由开发者决定。static 字段与 transient 无关——它属于类，本来就不参与对象序列化。

**为什么不推荐 JDK 原生序列化？** 字节流携带完整类描述，体积远大于二进制协议；编解码性能差；最严重的是反序列化会回调类方法，classpath 上存在可利用的 gadget 链时，不可信字节流可导致远程代码执行。加上不支持跨语言，工程上几乎没有继续选用的理由。

**反序列化如何破坏单例，怎么防？** 反序列化不走构造器，直接在堆上重建实例，单例语义被破坏。在类中声明 `private Object readResolve()` 返回单例即可，反序列化完成前会回调它替换结果；枚举实现的单例没有这个问题。

## 小结

- 序列化解决对象跨越 JVM 边界的存储与传输问题，JDK 用 Serializable + ObjectOutputStream 提供默认实现，用 Externalizable 与 writeObject/readObject 开放自定义。
- serialVersionUID 是版本兼容开关，必须显式声明；transient 把字段排除在默认机制外；static 字段天然不参与序列化。
- JDK 原生序列化体积大、速度慢、存在反序列化漏洞风险，生产系统优先 JSON（可读、跨语言）或 Protobuf/Kryo（高性能二进制）。
- 处理不可信数据时禁用 Java 原生反序列化，至少配置 ObjectInputFilter 白名单兜底。
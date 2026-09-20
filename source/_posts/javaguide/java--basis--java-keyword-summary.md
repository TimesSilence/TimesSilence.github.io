---
title: "Java 关键字总结"
date: 2017-10-09 12:28:00
updated: 2017-10-09 12:28:00
permalink: knowledge/java/basis/java-keyword-summary/
categories:
  - Java
tags:
  - Java基础
  - 关键字
description: "按用途分组梳理 Java 关键字的语义要点与常见误用，重点解析 final、static、synchronized、volatile、transient、instanceof。"
---

Java 有五十来个关键字，按字典逐个背没有意义。本文按用途把它们分成访问控制、类与继承、流程控制、异常、并发、类型与序列化六组，讲清每组的语义要点与常见误用，并对 `final`、`static`、`synchronized`、`volatile`、`transient`、`instanceof` 六个高频关键字给出代码示例。

<!-- more -->

## 分组总览

**访问控制**：`private`、默认（包可见）、`protected`、`public` 四级可见性逐级放大。常见误用是所有成员都 `public`，破坏封装；另一个坑是忘记默认级别是包可见，跨包测试时才发现访问不到。

**类与继承**：`class`、`interface`、`extends`、`implements`、`abstract`、`this`、`super`。`this` 指向当前实例，`super` 用于访问父类成员——它不是「父类对象」的引用。构造器中 `this(...)` 和 `super(...)` 必须放在首行；静态上下文没有当前实例，`this` 和 `super` 都不能用。

**流程控制**：`if`、`switch`、`for`、`while`、`do`、`break`、`continue`、`return`。`switch` 从 Java 7 起支持 `String`（底层按 `hashCode` 比对再 `equals` 确认），Java 14 起有了返回值、不再穿透的 switch 表达式。

**异常处理**：`try`、`catch`、`finally`、`throw`、`throws`。`throw` 抛出一个异常实例，`throws` 在方法签名上声明可能抛出的异常类型，一个是动作、一个是契约，别混用。

**并发与内存可见性**：`synchronized`、`volatile`。前者管互斥与可见性，后者只管可见性与有序性，区别见下文示例。

**类型与序列化**：`instanceof`、`transient`、`native`、`enum`、`record`。顺带一提，`var`（Java 10+）不是关键字，而是「受限类型名」，把它当变量名依然合法。

## 重点关键字

### final

修饰类表示不可继承，修饰方法表示不可重写，修饰变量表示只能赋值一次。注意 `final` 锁定的是引用本身，不锁定对象内容：

```java
final List<String> list = new ArrayList<>();
list.add("a");               // 合法：对象内部状态可变
// list = new ArrayList<>(); // 编译错误：引用不可改
```

常见误用是以为 `final` 引用等于不可变对象。另一个容易忽略的加分点：JLS 对 final 字段有特殊语义——对象构造完成后，final 字段对其他线程保证可见，不需要额外同步。

### static

`static` 成员属于类而非实例，被所有对象共享；静态方法没有 `this`，不能被重写（只能被同名静态方法隐藏）。`static` 还能修饰代码块（类初始化时执行一次）和内部类（不持有外围实例引用），后者是静态内部类单例的基础：

```java
public class Singleton {
    private Singleton() {}
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() {
        return Holder.INSTANCE; // 首次主动使用才初始化，JVM 保证线程安全
    }
}
```

常见误用：在静态方法里访问实例成员（编译错误）；通过实例引用调用静态方法（能编译但误导阅读）；把 static 字段当全局可变状态用，埋下线程安全隐患。

### synchronized

可修饰方法或代码块，锁的是对象监视器：实例方法锁 `this`，静态方法锁 `Class` 对象。它同时保证互斥与可见性——解锁前的写操作对后续持有同一把锁的线程可见：

```java
private final Object lock = new Object();
private int count;

public void add(int delta) {
    synchronized (lock) {
        count += delta;
    }
}
```

常见误用：用 `String` 字面量当锁（常量池共享会让无关代码互相阻塞）；锁一个会被重新赋值的字段（锁对象变了，互斥失效）；优先用私有的 `final` 锁对象，避免暴露 `this`。

### volatile

保证可见性（写立即对其他线程可见）与有序性（禁止相关指令重排序），但不保证原子性——`i++` 这类复合操作在 volatile 下依然线程不安全。典型用法是状态标志位：

```java
private volatile boolean running = true;

public void stop() {
    running = false; // 其他线程立刻看到停止信号
}
```

常见误用是把 volatile 当锁用做计数。另一个经典场景是双重检查单例：不加 volatile，指令重排序可能让其他线程拿到「半初始化」的对象引用。

### transient

阻止字段参与默认序列化，反序列化后该字段取类型默认值。`static` 字段本就不属于对象，天然不被序列化：

```java
class User implements Serializable {
    private String name;
    private transient String password; // 序列化时被跳过
}
```

常见误用：试图用 transient 修饰方法或类（只能修饰字段）；忘记反序列化后需要手工重建被跳过的字段，比如通过自定义 `readObject`。

### instanceof

判断对象的运行时类型，对 `null` 返回 `false` 而不是抛异常。Java 16 起支持模式匹配，判断与强转一步完成：

```java
if (obj instanceof String s) {
    System.out.println(s.length()); // 无需显式强转
}
```

常见误用：用大量 `instanceof` 链代替多态设计；对泛型参数使用 `instanceof List<String>`（类型擦除后运行期拿不到泛型实参，只能写 `instanceof List<?>`）。

## 小结

- 关键字按用途分组记忆：访问控制、类与继承、流程控制、异常、并发、类型与序列化，比按字母表背诵有效得多。
- `final` 锁引用不锁内容，`static` 属于类且静态上下文无 `this`，`synchronized` 管互斥加可见性，`volatile` 只保证可见性与有序性，`transient` 只影响默认序列化，`instanceof` 对 null 安全。
- 回答关键字题的标准姿势：讲清编译器检查什么、JVM 运行时保证什么，再补一个误用案例。
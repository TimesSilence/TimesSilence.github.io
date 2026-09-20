---
title: "Java 语法糖详解"
date: 2017-11-17 08:10:00
updated: 2017-11-17 08:10:00
permalink: knowledge/java/basis/syntactic-sugar/
categories:
  - Java
tags:
  - Java基础
  - 语法糖
description: "拆解泛型擦除、自动装箱拆箱、增强 for、try-with-resources、变长参数、switch 支持 String 与枚举在编译后的真实形态，理解脱糖才能解释那些反直觉行为。"
---

语法糖（Syntactic Sugar）是编译器提供的简写：不增加语言表达能力，只提升书写效率。JVM 只认识脱糖（desugar）之后的基础结构，很多「反直觉」的运行时行为——`Integer` 的 `==` 结果分裂、增强 for 里删除元素抛异常——把糖剥掉之后都一目了然。本文逐一拆解六种常用语法糖在编译后的真实形态。

<!-- more -->

## 它解决什么问题

Java 语言相对克制，许多便利写法并非 JVM 原生能力，而是 `javac` 在编译期的变换。理解脱糖结果有三重价值：

1. **解释怪异行为**：包装类型 `==` 时真时假、泛型方法无法按类型参数重载，都是擦除与缓存的直接推论；
2. **评估性能成本**：循环里的自动装箱会悄悄产生海量临时对象，看字节码才能发现；
3. **读懂反编译与字节码**：排查线上问题时面对的从来不是源码，而是脱糖后的形态。

## 核心原理

`javac` 的编译流水线中，语义分析阶段包含一个专门的解糖步骤：把增强 for、变长参数、字符串 switch 等高级写法还原为普通的循环、数组与整数分派，再生成字节码。也就是说，**JVM 指令集中不存在这些语法的对应物**。

验证方式很直接：`javap -c` 查看字节码，或用反编译工具把 class 文件转回 Java，对照源码即可看到每种糖的真实代价。后文所有「脱糖后形态」都可以用这个方法亲自复现。

## 深入机制

### 泛型：类型擦除（Type Erasure）

Java 泛型采用代码共享（Code Sharing）策略：所有参数化类型共享同一份字节码，类型参数被替换为其上界（未声明上界则为 `Object`），取值处由编译器插入强制转换：

```java
// 源码
List<String> list = new ArrayList<>();
list.add("hello");
String s = list.get(0);

// 脱糖后的等价形态
List list = new ArrayList();
list.add("hello");
String s = (String) list.get(0);
```

擦除带来一串可推导的后果：`List<String>` 与 `List<Integer>` 对应同一个 `List.class`，运行时无法区分；`method(List<String>)` 与 `method(List<Integer>)` 因签名相同而**无法重载**；泛型类型参数不能出现在 `catch` 中（异常分派发生在运行时，而类型信息已被擦除）；泛型类的静态字段被所有参数化实例共享。泛型的类型安全完全由编译器在编译期保证，运行时只剩原始类型。

### 自动装箱与拆箱

```java
Integer n = 10;  // 脱糖：Integer n = Integer.valueOf(10);
int i = n;       // 脱糖：int i = n.intValue();
```

装箱调用包装类的 `valueOf`，拆箱调用 `xxxValue`。关键在 `Integer.valueOf` 内部维护了一个缓存（IntegerCache）：默认缓存 -128 到 127 之间的对象，命中缓存直接复用，否则 `new Integer`。于是有了经典的面试现象：

```java
Integer a = 100, b = 100;
Integer c = 1000, d = 1000;
System.out.println(a == b); // true，同一缓存对象
System.out.println(c == d); // false，超出缓存，各自新建
```

`==` 比较的是引用，`equals` 比较的是值，包装类型判等永远用 `equals`。另一个坑是拆箱空指针：`Integer` 为 `null` 时参与算术运算，编译器插入的 `intValue()` 调用会抛出 `NullPointerException`。

### 增强 for：迭代器协议

增强 for 对数组和 `Iterable` 走两条不同的脱糖路径：

```java
for (String s : array) { ... }
// 数组 → 普通下标循环：for (int i = 0; i < array.length; i++) { String s = array[i]; ... }

for (String s : list) { ... }
// Iterable → 迭代器循环：
for (Iterator<String> it = list.iterator(); it.hasNext(); ) {
    String s = it.next();
    ...
}
```

这解释了为什么在循环体里调用 `list.remove(s)` 会抛 `ConcurrentModificationException`：以 `ArrayList` 为例，迭代器创建时记录 `expectedModCount`，每次 `next()` 都会校验集合的 `modCount` 是否变化，绕开迭代器直接改集合就会触发 fail-fast。要在遍历中删除元素，只能使用迭代器自己的 `remove()`，它会在删除后同步更新计数。

### try-with-resources

```java
try (BufferedReader br = new BufferedReader(new FileReader(path))) {
    return br.readLine();
}
```

脱糖后，编译器生成嵌套的 try-finally 结构：在 finally 中判空并调用 `close()`。精妙之处在异常处理——如果 try 体已经抛出了异常，而 `close()` 又抛出第二个异常，后者不会覆盖前者，而是通过 `Throwable.addSuppressed()` 挂到主异常的「被压制异常」列表里，日志中可以完整看到两条异常链。凡是实现 `AutoCloseable` 的资源都能享受这套机制。

### 变长参数

```java
void print(String... strs) { ... }
// 脱糖：void print(String[] strs) { ... }
print("a", "b");
// 调用处脱糖：print(new String[]{"a", "b"});
```

变长参数的本质是「调用方自动造数组」。每次调用都新建数组，热点路径上是一笔固定开销；直接传 `null` 会因类型歧义触发编译警告甚至运行期 NPE，传空数组或显式转型更稳妥。

### switch 支持 String 与枚举

早期 switch 只接受整型家族。对 `String` 的支持是编译器的两段式变换：

```java
switch (str) {
    case "hello": ...
    case "world": ...
}

// 脱糖后近似：
// switch (str.hashCode()) {
//     case 99162322: if (str.equals("hello")) { ... } break;
//     case 113318802: if (str.equals("world")) { ... } break;
// }
```

先按 `hashCode()` 做整数 switch 快速分派，命中后再用 `equals` 确认，因为不同字符串可能哈希碰撞。所以字符串 switch 天然要求非 null（否则 `hashCode()` 调用 NPE），性能也略逊于纯整数分派。

枚举 switch 的做法更隐蔽：编译器生成一个合成类，持有一个「枚举 ordinal → switch 分支序号」的静态映射数组，类初始化时按 `ordinal()` 填充，switch 实际作用于映射后的整数。这样做的好处是枚举常量的声明顺序日后调整时，已编译的 switch 行为不受影响。

## 工程实践

- **包装类型判等用 equals**，并警惕拆箱 NPE：接口返回的 `Integer` 参与运算前先判空。
- **热点循环避免隐式装箱**：`for (Integer i : intList)` 每次迭代都拆箱，累计数字时用 `long` 而非 `Long`，避免在百万级循环里制造对象洪流。
- **遍历中改集合走迭代器**：增强 for 里需要删除元素时改用显式 `Iterator` 并调用其 `remove()`；多线程场景直接用并发容器。
- **泛型信息只在编译期存在**：需要运行时类型时传入 `Class<T>` 或 `TypeReference`，不要指望从泛型实例上取回类型参数。

## 对比与权衡

| 语法糖 | 脱糖后形态 | 主要注意点 |
| --- | --- | --- |
| 泛型 | 类型擦除为上界 + 强制转换 + 桥方法 | 运行时无类型信息；无法按类型参数重载 |
| 自动装箱/拆箱 | `valueOf` / `xxxValue` 调用 | 缓存区间内 `==` 才为 true；null 拆箱 NPE |
| 增强 for | 数组走下标循环，Iterable 走 Iterator | 循环内结构性修改触发 fail-fast |
| try-with-resources | 嵌套 try-finally + addSuppressed | 资源需实现 AutoCloseable |
| 变长参数 | 调用处自动构造数组 | 每次调用新建数组；慎传 null |
| switch String/枚举 | hashCode 分派 + equals 确认 / ordinal 映射 | 字符串 switch 不支持 null |

## 面试视角

**泛型擦除是什么，带来哪些限制？** 编译后类型参数被替换为上界（默认 Object），所有参数化类型共享同一份字节码。因此 `List<String>` 和 `List<Integer>` 运行时无法区分、不能据以重载，泛型参数不能用于 catch，也不能 `new T()`，需要运行时类型时必须显式传递 `Class` 对象。

**`Integer a = 100, b = 100, c = 1000, d = 1000`，两个 `==` 的结果是什么？** `a == b` 为 true，`c == d` 为 false。装箱走的是 `Integer.valueOf`，其内部缓存默认覆盖 -128 到 127，区间内复用同一对象，区间外各自新建。结论：包装类型判等永远用 `equals`。

**增强 for 里为什么不能直接删除元素？** 增强 for 脱糖为迭代器遍历，迭代器持有创建时的 `expectedModCount`，`next()` 时校验集合的 `modCount`。调用集合自身的 `remove` 会改变 `modCount` 而迭代器不知情，触发 fail-fast 抛出 `ConcurrentModificationException`；用 `Iterator.remove()` 则会在删除后同步计数。

**try-with-resources 比手写 finally 强在哪？** 除了省掉判空与嵌套 try，核心差异是异常压制：try 体与 `close()` 先后抛异常时，后者被 `addSuppressed` 挂到前者上，两条异常都保留在堆栈里；手写 finally 若处理不当，close 异常会直接覆盖业务异常，掩盖真正的故障原因。

**switch 是怎么支持 String 的？** 编译器两段式变换：先按字符串的 `hashCode` 做整数 switch 分派，命中分支后再用 `equals` 复核，防止哈希碰撞导致误判。这也是为什么字符串 switch 对 null 会直接抛 NPE。

## 小结

- 语法糖不改变 JVM 能力边界，`javac` 解糖后一切都还原为基础结构；`javap -c` 是看清真相的工具。
- 泛型是编译期的类型检查机制，擦除之后运行时只剩原始类型与强制转换。
- 装箱走 `valueOf`（带缓存），拆箱走 `xxxValue`；缓存区间解释 `==` 分裂，null 拆箱解释 NPE。
- 增强 for、try-with-resources、变长参数、字符串 switch 各自对应迭代器、finally 关闭、数组构造与哈希分派，理解真实形态才能预判坑位。
- 遇到「不合直觉」的行为时，先问一句：这颗糖脱糖之后长什么样？
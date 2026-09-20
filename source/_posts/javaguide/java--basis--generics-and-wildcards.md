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
description: "讲透类型擦除与桥接方法的实现原理、泛型不支持协变的原因，用 PECS 原则厘清 extends 与 super，并解析典型编译错误。"
---

泛型（Generics）把类型检查从运行期前移到编译期，让集合和通用 API 在写代码时就能暴露类型错误；通配符（Wildcard）则在「保持 API 灵活」与「保证读写安全」之间给出受控的折中。理解类型擦除（Type Erasure）是理解这一切的前提。

<!-- more -->

## 它解决什么问题

JDK 5 之前，集合里取出的元素都是 `Object`，用之前得手动强转。转错了编译器不管，运行期才抛 `ClassCastException`——错误暴露得越晚，定位成本越高。泛型要解决的正是这个问题：把「这个列表只装 String」变成类型系统的一部分，让编译器在编译期就拦住错误，同时自动插入类型转换，省去满屏的强制转型。

泛型有三种使用形态：泛型类（`class Box<T>`）、泛型接口（`interface Comparable<T>`）、泛型方法（`static <T> T pick(T a, T b)`）。其中泛型方法的类型参数声明在返回值之前，与所在类是否泛型无关，静态方法也完全可以拥有自己的类型参数。

## 核心原理

### 类型擦除：兼容优先的设计

Java 泛型没有选择 C# 那样的运行期具化，而是采用**类型擦除**：编译器完成类型检查后，把类型参数替换为其上界（无上界则为 `Object`），生成的字节码中不再携带 `List<String>` 这样的实参信息。也就是说，运行期的 `List<String>` 和 `List<Integer>` 是同一个 `List` 类。

这样设计的核心动机是与泛型出现之前的海量代码和二进制类库兼容——新旧代码可以混合编译、混合运行，集合框架得以平滑升级。代价则是运行期「类型失明」：

```java
List<String> list = new ArrayList<>();
// list.add(42);            // 编译期直接被拦截，这正是泛型的价值
Method add = List.class.getMethod("add", Object.class);
add.invoke(list, 42);       // 运行期擦除后拦不住，编译器救不了你
System.out.println(list.get(0)); // 此处才抛 ClassCastException
```

注意擦除并非信息全无：类文件的 `Signature` 属性里保留了字段、方法签名上的泛型声明，反射可以通过 `ParameterizedType` 读回——Jackson 的 `TypeReference`、Gson 的 `TypeToken` 都是靠继承匿名子类来保留泛型父类签名，从而还原完整类型。

### 桥接方法：擦除之后如何保住多态

擦除会制造一个多态漏洞，编译器用**桥方法（Bridge Method）**补上：

```java
class Node<T> {
    private T data;
    public void setData(T data) { this.data = data; }
}

class MyNode extends Node<Integer> {
    @Override
    public void setData(Integer data) { super.setData(data); }
}
```

`Node<T>` 擦除后方法签名是 `setData(Object)`，而子类 `MyNode` 重写的是 `setData(Integer)`——按 JVM 的重写规则，参数签名必须一致，这两个方法本不构成重写。如果通过 `Node<Integer> n = new MyNode(); n.setData(1)` 调用，虚方法分派将找不到子类实现。为此编译器在 `MyNode` 中自动合成一个桥方法：

```java
// 编译器自动合成，非手写
public void setData(Object data) {
    setData((Integer) data);
}
```

桥方法对源码不可见（字节码中带 `ACC_BRIDGE` 标记），它保证了泛型父类被子类特化后多态依然成立。这也解释了一个现象：实现两个不同实参的同一泛型接口（`implements Comparable<A>, Comparable<B>`）会被拒绝——擦除后两个桥方法签名相同，必然冲突。

### 泛型为什么不支持协变

数组是协变的：`Integer[]` 可以赋值给 `Number[]`。这个设计在数组上已经被证明是漏洞——往 `Number[]` 里塞 `Double`，编译期放行，运行期抛 `ArrayStoreException`。泛型吸取了教训，选择**不变（invariant）**：`List<Integer>` 不是 `List<Number>` 的子类型。

```java
Node<Circle> nc = new Node<>();
// Node<Shape> ns = nc; // 编译错误：Node<Circle> 不是 Node<Shape> 的子类
```

若允许这种赋值，就可以通过 `Node<Shape>` 的引用往 `Circle` 的容器里放 `Rectangle`，而数组那套运行期检查在擦除后又不存在，类型安全将彻底失守。通配符正是为了在不变的前提下，重新打开受控的「协变/逆变」通道。

## 深入机制：通配符与 PECS

- `? extends T`（上界通配符）：参数化类型的实参是 T 或其某个子类。从 `List<? extends Number>` **读**是安全的，编译器保证取出的至少是 `Number`；**写**则不行——编译器不知道实参到底是哪个子类，任何非 null 写入都可能放错类型，因此直接禁止。
- `? super T`（下界通配符）：实参是 T 或其某个父类。往 `List<? super Integer>` **写** `Integer`（及其子类）是安全的，因为无论实参是 `Number` 还是 `Object`，装下一个 `Integer` 都不违反约束；**读**出来的元素只能按 `Object` 接收。
- `?`（无界通配符）：等价于 `? extends Object`，表示「某个未知但固定的类型」。它与原生类型 `List` 不同——后者绕过泛型检查只产生警告，`List<?>` 则是类型安全的，写入被禁止。

这套读写规则可以归纳成 PECS 原则（Producer Extends, Consumer Super）：**只往外提供数据的参数用 `extends`，只往里消费数据的参数用 `super`**。`Collections.copy(List<? super T> dest, List<? extends T> src)` 是教科书范例：dest 是消费者用 `super`，src 是生产者用 `extends`：

```java
public static <T> void copy(List<? super T> dest, List<? extends T> src) {
    for (int i = 0; i < src.size(); i++) {
        dest.set(i, src.get(i)); // 从 src 读出 T，写入 dest 安全
    }
}
```

若一个参数既要读又要写，就不要用通配符，直接用类型参数 `T`。

## 工程实践

- **API 设计用通配符扩大适用面**：`void process(List<? extends Shape> shapes)` 比 `void process(List<Shape> shapes)` 能接收 `List<Circle>`，调用方更自由，这是 Effective Java 反复强调的 API 设计要点。
- **泛型的硬性限制都源于擦除**：不能 `new T()`（擦除后不知道该构造谁）、不能 `new T[10]`、不能 `instanceof List<String>`、不能重载 `f(List<String>)` 与 `f(List<Integer>)`（擦除后签名相同）、静态成员不能引用类的类型参数（静态上下文不属于任何实例的类型实参）。
- **需要运行期类型时显式传递 Class**：想绕过「不能 `new T()`」，惯例是把 `Class<T>` 作为参数传入，再用反射实例化，Spring 的 `BeanFactory.getBean(Class<T>)` 就是这个模式。
- **典型编译错误解析**：`static T instance` 报错是因为静态字段属于类而非某个泛型实例；`x > y` 在 `<T> T max(T x, T y)` 中不合法是因为 T 无上界、擦除为 `Object` 后没有比较能力，解法是 `<T extends Comparable<? super T>>`——参数用 `? super T` 同样是 PECS 的应用（`Comparable` 消费 T）。

## 对比与权衡

| 写法 | 能读成 | 能写入 | 适用角色 |
| --- | --- | --- | --- |
| `List<T>` | T | T 及其子类 | 既要读又要写 |
| `List<? extends T>` | T | 仅 null | 生产者（只读） |
| `List<? super T>` | Object | T 及其子类 | 消费者（只写） |
| `List<?>` | Object | 仅 null | 不关心元素类型的通用逻辑 |
| 原生 `List` | Object | 任意（仅警告） | 遗留代码兼容，新代码禁用 |

## 面试视角

**什么是类型擦除，为什么要擦除？** 编译期完成类型检查后，类型参数被替换为上界（默认 `Object`），字节码中不保留泛型实参，运行期 `List<String>` 与 `List<Integer>` 同为 `List`。动机是与泛型引入前的代码和二进制保持兼容；代价是运行期无法做 `new T()`、`instanceof List<String>` 等需要实参信息的操作。

**桥接方法是什么？** 擦除使泛型父类方法签名变为上界类型（如 `setData(Object)`），与特化子类的重写方法（`setData(Integer)`）签名不一致，多态会失效。编译器自动合成一个参数为上界类型、内部强转后委托给真实方法的桥方法，维持重写关系。

**为什么不能向 `List<? extends Number>` 添加元素？** 编译器只知道实参是 `Number` 的某个子类，不知道具体是哪个；若允许写入 `Integer`，实参可能是 `Double` 的列表，类型安全就被破坏。除 null 外的写入因此被整体禁止，读取则保证至少是 `Number`。

**PECS 原则怎么用？** 参数作为生产者（只从中取数据）用 `? extends T`，作为消费者（只往里放数据）用 `? super T`；既要读又要写就不用通配符。`Collections.copy` 的 dest 用 super、src 用 extends 是标准示例。

**泛型和数组的协变性有何不同？** 数组协变（`Integer[]` 是 `Number[]` 子类型），错误靠运行期 `ArrayStoreException` 兜底；泛型不变，因为擦除后运行期没有实参信息可供检查，只能在编译期一刀切禁止，灵活性由通配符受控开放。

## 小结

- 泛型的价值在编译期类型检查与自动转型，其实现基础是类型擦除，一切限制（不能实例化 T、不能泛型数组、不能重载不同实参）都源于此。
- 擦除会破坏多态，桥方法是编译器补上的缝合层；擦除会丢失运行期实参，`Signature` 属性与 `ParameterizedType` 是仅有的取回通道。
- 泛型默认不协变，用 `? extends` / `? super` 按 PECS 原则开放受控的读写通道：生产者 extends，消费者 super。
- 写 API 时优先用通配符放宽参数、用类型参数约束返回值与参数间关系；遇到编译错误，先想「擦除之后这行代码还剩下什么信息」。
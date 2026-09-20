---
title: "Java基础常见面试题总结(中)"
date: 2017-12-07 11:31:00
updated: 2017-12-07 11:31:00
permalink: knowledge/java/basis/java-basic-questions-02/
categories:
  - Java
tags:
  - Java基础
  - 面试
description: "Java 基础面试（中）深度解析：面向对象、Object 相等性契约、String 不可变性与字符串常量池的高频考题与原理。"
---

Java 基础面试的「中篇」围绕三条主线展开：面向对象的设计契约、Object 奠定的相等性规则、String 的不可变性与常量池机制。这组题看似基础，却最容易在原理细节上翻车。

<!-- more -->

## 考察地图

- **面向对象**：接口与抽象类的区别、深拷贝与浅拷贝。考察的是抽象设计能力，而非背定义。
- **Object 与相等性**：`==` 与 `equals`、`hashCode` 的作用、equals/hashCode 契约。考察对散列容器底层逻辑的理解。
- **String**：三兄弟选型、不可变性的根因、`+` 拼接的编译期行为、常量池与 `intern`。考察对 JVM 内存与编译器优化的掌握。
- 建议自行查阅：构造方法能否被重写、Object 类常见方法清单、`String#equals` 与 `Object#equals` 的差异——这些是纯记忆题，面试中多作为铺垫而非考点本身。

## 面向对象

### 接口和抽象类有什么共同点和区别？

**结论**：共同点是都不能实例化、都能声明抽象方法；区别在设计意图上——接口约束「能做什么」（行为规范），抽象类表达「是什么」（is-a 的代码复用）。

**原理**：从语言机制看，一个类只能继承一个父类，但可实现多个接口；接口的成员变量隐式为 `public static final`，抽象类的字段没有限制。Java 8 起接口可定义 `default` 与 `static` 方法，Java 9 又放开了 `private` 方法，接口与抽象类在「提供默认实现」上的差距被抹平，真正的分水岭只剩下两点：接口不持有实例状态，以及接口支持多实现。`default` 方法的现实意义是演进能力——JDK 给 `Collection` 加 `stream()` 时，若接口不支持默认实现，所有现存实现类都得改。

**延伸**：当一个类实现两个接口且二者有签名相同的 default 方法时，编译器强制实现类重写以消除歧义；抽象类则天然不存在菱形问题，这正是 Java 单继承 + 多接口组合的用意。

> 追问：default 方法冲突的解决规则（类优先、子接口优先、显式重写）能否说全？什么场景下你会选抽象类而不是带 default 方法的接口？提示：从「是否需要共享实例字段与构造逻辑」切入。

### 深拷贝和浅拷贝区别了解吗？什么是引用拷贝？

**结论**：引用拷贝只复制引用，两个变量指向同一对象；浅拷贝创建新对象但字段中的引用仍共享内部对象；深拷贝连同内部对象递归复制，副本与原对象完全独立。

**原理**：`Object#clone()` 是 native 方法，做的是逐字段的位拷贝（浅拷贝），且类必须实现 `Cloneable` 标记接口，否则抛 `CloneNotSupportedException`。要得到深拷贝，需在 `clone()` 里手动级联：

```java
@Override
public Person clone() throws CloneNotSupportedException {
    Person copy = (Person) super.clone();
    copy.address = this.address.clone(); // 级联复制内部对象
    return copy;
}
```

**延伸**：对象图很深时级联 `clone()` 脆弱且易漏，工程上更常用序列化（Java 原生、JSON、Protobuf）或拷贝构造器实现深拷贝。顺带一提，`Cloneable` 没有定义任何方法，`clone()` 却在 `Object` 上——这是 JDK 早期的设计失误，Effective Java 明确建议慎用。

> 追问：不可变对象（如 String、Integer）在深拷贝里需要复制吗？提示：不可变对象共享是安全的，深拷贝只关心可变内部状态。

## Object 与相等性

### == 和 equals() 的区别？

**结论**：`==` 对基本类型比值，对引用类型比「是否指向同一对象」；`equals()` 是 `Object` 定义的方法，默认可被重写为比较逻辑内容。

**原理**：`Object` 的 `equals` 实现就是 `return this == obj`，所以不重写时两者等价。`String`、`Integer` 等类重写了它，改为逐字符或按值比较。一个经典陷阱是装箱缓存：

```java
Integer a = 127, b = 127;
Integer c = 128, d = 128;
System.out.println(a == b); // true，命中 IntegerCache
System.out.println(c == d); // false，超出默认 -128~127 缓存范围
```

`Integer.valueOf()` 默认缓存 -128 到 127 的对象，区间内自动装箱复用同一实例，区间外每次新建——用 `==` 比较包装类型等于把正确性交给缓存范围。

**延伸**：比较对象内容永远用 `equals()`，且把已知非空字面量放前面（`"x".equals(str)`）防 NPE；Java 7 起可用 `Objects.equals(a, b)` 统一处理 null。

> 追问：`equals` 的五个约定（自反、对称、传递、一致、对 null 返回 false）能背几条？违反对称性会发生什么？提示：子类与父类混比是重灾区。

### hashCode() 有什么用？为什么要有它？

**结论**：`hashCode()` 返回 int 散列值，作用是让哈希容器（HashMap/HashSet）能快速定位桶位，把查找从 O(n) 降到接近 O(1)。

**原理**：以 `HashSet` 去重为例：插入时先算 `hashCode` 定位桶，桶空直接放入；桶非空则只与桶内元素逐一 `equals`。散列值不同直接跳过，相同才进入精确比较——`hashCode` 把 `equals` 的调用次数压缩到桶内极少数元素上。为什么不能只靠 `hashCode`？因为 int 只有 2^32 种取值，不同对象必然可能撞出相同散列值（哈希碰撞），碰撞时只能靠 `equals` 裁决。

**延伸**：`Object#hashCode()` 是 native 方法，OpenJDK 默认实现是基于线程局部状态的随机数生成，并非网传的「内存地址」。`String` 则按内容计算 `s[0]*31^(n-1) + ...`，乘 31 是因为它是奇素数且 `31*i` 可被 JIT 优化为 `(i<<5)-i`。

> 追问：HashMap 在 JDK 8 对 hashCode 还做了一次扰动（高 16 位异或低 16 位），目的是什么？提示：与 `(n-1) & hash` 取桶时低位利用率和链表树化阈值有关。

### 为什么重写 equals() 时必须重写 hashCode()？

**结论**：契约规定「equals 相等的两个对象，hashCode 必须相等」。只重写 equals 会破坏这条约定，导致哈希容器行为错乱。

**原理**：假设两个 `Person` 按姓名逻辑相等，但 `hashCode` 沿用 `Object` 默认实现（每个实例基本不同）。把它们放入 `HashSet` 时，两者被散列到不同桶，`contains` 先去错误的桶里找，自然返回 false——「相等」的对象在容器里成了两个人。反过来不要求：hashCode 相等的对象可以不相等（碰撞），所以重写 hashCode 时「相等必同码，同码未必相等」。

**延伸**：实践上用 IDE 自动生成或 `Objects.hash(field1, field2)`，保证 equals 用到的字段全部参与 hashCode 计算，且字段最好不可变——对象入 HashSet 后修改关键字段，会让它「困」在错误的桶里再也找不到。

> 追问：只重写 hashCode 不重写 equals 行不行？提示：不会违反契约但语义没变，逻辑相等的对象仍被当作不同 key。

## String

### String、StringBuilder、StringBuffer 的区别？

**结论**：`String` 不可变、线程安全；`StringBuilder` 可变、无同步、单线程首选；`StringBuffer` 可变、方法级 synchronized、多线程共享缓冲区时才用。

**原理**：后两者都继承 `AbstractStringBuilder`，内部持有一个可扩容的字符数组（JDK 9 起改为 byte 数组配合编码标记），`append` 直接在原数组上写，按需扩容。`StringBuffer` 给方法加了 `synchronized`，换取线程安全也带来锁开销，单线程下比 `StringBuilder` 慢 10%~15% 左右，且现代 JVM 的锁消除会进一步缩小差距。选型口诀：少量操作用 `String`，单线程大量拼接用 `StringBuilder`，缓冲区被多线程共享才轮到 `StringBuffer`。

**延伸**：循环外 `String` 拼接看似每次产生新对象，但 JIT 的逃逸分析可能让短生命周期对象在栈上分配并被标量替换，实际开销没有教科书描述的那么夸张——不过这不改变「循环里别用 `+`」的结论（见下一题）。

> 追问：`StringBuffer` 的 synchronized 能保证复合操作的原子性吗？提示：不能，`append` 多次调用之间没有互斥，线程安全仅限于单次方法调用。

### String 为什么是不可变的？

**结论**：不可变是设计选择而非 `final` 的副产品：类被 `final` 修饰禁止继承破坏，内部数组 `private final` 且不暴露任何修改入口，二者叠加才构成真正的不可变。

**原理**：流传甚广的说法是「因为 char 数组被 final 修饰」，这不成立——`final` 只锁定引用，数组内容仍可改。真正的防线有三：`String` 类 `final` 防子类篡改编码语义；`value` 数组私有且无 setter；所有「修改」方法（`concat`、`substring` 等）都返回新对象。JDK 9 后底层从 `char[]` 换成 `byte[]` 加 coder 标记：纯 Latin-1 字符串每字符只占 1 字节，内存直接减半。

**延伸**：不可变换来四个红利：常量池可以安全复用；`hashCode` 可缓存（String 的 hash 只算一次）；天然线程安全；作为 HashMap key、类加载路径、网络地址时不会被恶意篡改。代价是频繁修改产生大量临时对象，这正是 `StringBuilder` 存在的理由。

> 追问：反射能改掉 String 的 value 吗？提示：JDK 9 模块强封装后反射 setAccessible 会被拒绝，且 JIT 对 String 常量做了折叠优化，即使改了也可能不生效。

### 字符串拼接用“+”还是 StringBuilder？

**结论**：单行拼接用 `+` 没问题（编译器会优化），循环内必须显式用 `StringBuilder`。

**原理**：`+` 是语言规范为字符串特设的运算符。JDK 8 下 `javac` 把它翻译成 `new StringBuilder().append(...).toString()`；JDK 9 起（JEP 280）改为 `invokedynamic` 交给 `StringConcatFactory` 在运行期选择最优策略，预计算容量、减少中间对象。但两种方案对循环都无能为力——每次迭代都会新建一个拼接器：

```java
String s = "";
for (String item : items) {
    s += item; // 每轮新建 StringBuilder 并拷贝已有内容，O(n²)
}
```

显式持有一个 `StringBuilder` 则全程复用同一缓冲区，复杂度回到 O(n)。如果拼接结果长度可预估，构造时传入容量还能避免多次扩容拷贝。

**延伸**：编译期常量表达式（字面量、`static final` 常量之间的 `+`）会被常量折叠直接合成一个字符串，连拼接动作都不发生。

> 追问：`String.concat()` 和 `+` 有什么差别？提示：concat 不处理 null、内部直接数组拷贝，大量拼接时性能反而更差。

### String s1 = new String("abc") 创建了几个对象？

**结论**：1 个或 2 个。常量池已有 "abc" 时只新建 1 个堆对象；没有时先在常量池创建 1 个，再在堆里创建 1 个。

**原理**：看字节码就清楚了：`new java/lang/String` 在堆上分配未初始化的实例；`ldc "abc"` 加载字面量——JVM 先查字符串常量池，存在则直接返回引用，不存在则创建并驻留；最后 `invokespecial <init>` 用常量池里的那份内容初始化堆上的新对象。所以 `new String("abc")` 永远保证堆里那个是新的，常量池那份是复用的。JDK 7 起字符串常量池从永久代迁到了堆中，「池内对象」与「堆对象」本质是同代内存，只是身份不同。

**延伸**：这也是 `String s = "abc"` 与 `new String("abc")` 用 `==` 比较必为 false 的原因——前者拿池内引用，后者拿堆上新实例。

> 追问：那 `new String("a") + new String("b")` 涉及几个对象？提示：算上拼接产物约 5~6 个，且 "ab" 不会自动入池，除非调用 `intern()`。

### String#intern() 方法有什么作用？

**结论**：`intern()` 返回字符串在常量池中的唯一规范引用：池里有同内容字符串就返回池中引用，没有就把当前字符串放入池中再返回。

**原理**：JDK 6 与 JDK 7+ 行为有本质差异。JDK 6 常量池在永久代，池中没有时会**复制**一个对象进永久代；JDK 7 起常量池移入堆中，改为直接**记录堆中已有对象的引用**，不再复制。这导致同一段代码在两个版本下 `==` 结果可能相反。经典应用是海量重复字符串去重——比如解析日志、CSV 时把重复度高的列值 intern 化，全 JVM 只留一份：

```java
String a = new String("xyz").intern();
String b = "xyz";
System.out.println(a == b); // true，均为池内引用
```

**延伸**：常量池本质是固定容量的 `StringTable`（可用 `-XX:StringTableSize` 调桶数），无节制 intern 大量低重复字符串会造成池膨胀和哈希冲突，JDK 6 时代甚至能直接把永久代打满。

> 追问：为什么 G1 提供了 `-XX:+UseStringDeduplication` 还要手动 intern？提示：去重的是堆中 char/byte 数组，且只在 GC 时异步进行，与常量池驻留是两回事。

### String 类型的变量和常量做“+”运算时发生了什么？

**结论**：编译期能确定值的表达式会被「常量折叠」成单个字符串并入池；含普通变量的拼接只能留到运行期，每次生成新的堆对象。

**原理**：常量折叠是 `javac` 做的少数优化之一。`"str" + "ing"` 在 class 文件里已经是 `"string"`；`final` 修饰的局部变量若编译期可确定值，也享受同等待遇：

```java
final String a = "str", b = "ing";
String c = "string";
System.out.println(c == a + b); // true，折叠后同为池内 "string"
String d = getStr();            // 运行期才有值
final String e = "str";
System.out.println(c == e + d); // false，运行期拼接产生堆对象
```

判断口诀：参与 `+` 的每一项在编译期都是常量表达式，结果就是池内常量；只要有一项是运行期才能确定的引用，结果就是新对象。

**延伸**：这也解释了为什么 `==` 比较拼接结果不可靠——同样的逻辑写法，加不加 `final`、值是否编译期可见，结果完全不同。比较内容请一律 `equals()`。

> 追问：方法内联后运行期才能确定的 final 变量（如 `final String s = getStr()`）参与折叠吗？提示：常量折叠只发生在编译期，与 JIT 内联无关，答案是否定的。
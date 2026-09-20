---
title: "类文件结构详解"
date: 2021-07-30 15:29:00
updated: 2021-07-30 15:29:00
permalink: knowledge/java/jvm/class-file-structure/
categories:
  - Java
tags:
  - JVM
  - 类文件
description: "对照 javap -v 真实输出拆解 Class 文件结构：魔数与版本号、常量池的字面量与符号引用、访问标志，以及字段表/方法表/属性表的层级组织方式。"
---

`.class` 文件是 Java 跨平台承诺的物理载体，也是反射、动态代理、字节码增强等一切上层技术的地基。本文用一个简单类的 `javap -v` 真实输出，把魔数、常量池、访问标志、字段表、方法表、属性表这条结构主线逐个讲透。

<!-- more -->

## 它解决什么问题

Java 宣称「一次编译，到处运行」，靠的就是统一、平台无关的 Class 文件格式：任何语言（Java、Kotlin、Scala、Groovy）只要编译成这个格式，任何平台上的 JVM 都能加载执行。对工程师而言，读懂这个格式不是猎奇——反射拿到的方法名和参数名、ASM/Javassist 织入的字节码、线上 `NoSuchMethodError` 排查时要确认的符号引用，全都存放在这套结构里。看懂它，等于拿到了 JVM 世界的「通用图纸」。

## 核心原理

Class 文件是一组以 8 位字节为单位的二进制流，数据项按固定顺序紧凑排列，大端序存储。规范用类似 C 结构体的方式描述它：

```text
ClassFile {
    u4 magic;                    // 魔数
    u2 minor_version;            // 次版本号
    u2 major_version;            // 主版本号
    u2 constant_pool_count;      // 常量池容量（计数从 1 开始）
    cp_info constant_pool[];     // 常量池
    u2 access_flags;             // 访问标志
    u2 this_class, super_class;  // 本类、父类索引
    u2 interfaces_count; u2 interfaces[];   // 接口索引集合
    u2 fields_count;  field_info  fields[]; // 字段表集合
    u2 methods_count; method_info methods[];// 方法表集合
    u2 attributes_count; attribute_info attributes[]; // 属性表集合
}
```

整条主线可以记成一句话：**魔数验明正身 → 版本号划定门槛 → 常量池囤好全部素材 → 访问标志和继承索引描述「我是谁」→ 字段表、方法表、属性表描述「我有什么」**。

## 深入机制

### 魔数与版本：文件的头 8 个字节

前 4 字节魔数固定为 `0xCAFEBABE`，唯一作用是让 JVM 快速确认「这是一个 Class 文件」，不合法直接拒载。第 5~8 字节是次版本号和主版本号，主版本号随 JDK 大版本递增：Java 8 是 52，Java 11 是 55，Java 17 是 61，Java 21 是 65。高版本 JVM 能运行低版本编译的 Class，反之直接抛 `UnsupportedClassVersionError`——部署环境 JDK 低于开发编译版本时的经典报错，根源就在这两个字节。

### 常量池：Class 文件的「资源仓库」

常量池是 Class 文件中占用空间最大、也最重要的数据项。叫「仓库」是因为它囤积了后面所有表要用的素材，且全部通过**索引**被复用——字段表不存字段名字符串，只存指向常量池的编号。库存分两大类：

- **字面量**：文本字符串、`final` 常量值、整数浮点数等，接近 Java 语言层面的常量概念。
- **符号引用**：类和接口的全限定名、字段的名称和描述符、方法的名称和描述符。编译时 Java 不知道目标类的真实内存布局，只能用这些符号「指名道姓」，等运行期解析阶段再换成直接引用。

常量池计数器从 1 开始（第 0 项空置，表示「不引用任何常量」），每项以 1 字节 tag 开头标明类型，常见如 `Utf8`（1）、`Integer`（3）、`Class`（7）、`Fieldref`（9）、`Methodref`（10）、`NameAndType`（12）。

### 访问标志、字段表、方法表、属性表的层级

常量池之后依次是：

- **访问标志（2 字节）**：位掩码描述类/接口层面的修饰信息——`public`、`final`、`abstract`、是类还是接口（`ACC_INTERFACE`）。
- **this_class / super_class / interfaces**：三个索引指向常量池里的 `Class` 项，确定继承结构。除 `Object` 外每个类的父类索引都非零。
- **字段表（field_info）**：描述类变量和实例变量（不含局部变量），结构为访问标志 + 名称索引 + 描述符索引 + 属性表。字段名、类型不直接存，而是索引回常量池。
- **方法表（method_info）**：结构与字段表完全同构，但访问标志集合不同——没有 `volatile`/`transient`，多出 `synchronized`、`native`、`abstract`。
- **属性表（attribute_info）**：Class 文件、字段表、方法表**都可以携带**自己的属性表，这是三层嵌套的扩展机制。最重要的属性是 `Code`：方法体字节码、操作数栈深度、局部变量表都装在方法表的 `Code` 属性里。属性表的设计刻意宽松——虚拟机必须忽略不认识的属性，第三方编译器因此可以自由扩展。

### 用 javap -v 对照一个真实类

```java
public class Demo {
    private static final int LIMIT = 100;
    private int count;

    public int add(int delta) {
        return count + delta;
    }
}
```

`javac Demo.java && javap -v Demo.class` 的关键输出（JDK 21 编译）：

```text
  minor version: 0
  major version: 65                      // Java 21
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER  // public 类
  this_class: #8                         // Demo
  super_class: #2                        // java/lang/Object
  interfaces: 0, fields: 2, methods: 2, attributes: 1
Constant pool:
   #1 = Methodref   #2.#3   // java/lang/Object."<init>":()V
   #2 = Class       #4      // java/lang/Object
   #3 = NameAndType #5:#6   // "<init>":()V
   #7 = Fieldref    #8.#9   // Demo.count:I
   #8 = Class       #10     // Demo
  #13 = Utf8        LIMIT
  #14 = Utf8        ConstantValue
  #15 = Integer     100
  ...
  public int add(int);
    descriptor: (I)I
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=2, args_size=2
         0: aload_0
         1: getfield      #7   // Field count:I
         4: iload_1
         5: iadd
         6: ireturn
```

逐条对照看「仓库」如何被消费：`add` 方法里的 `getfield #7` 取出常量池 #7，#7 是 `Fieldref`，再拆成 #8（`Class Demo`）+ #9（`NameAndType count:I`）——一个符号引用就是这样由多个常量项拼装出来的。`LIMIT = 100` 这个编译期常量没有出现在任何指令里，而是以字段的 `ConstantValue` 属性（#14、#15）静态地挂在字段表上，对应「准备阶段直接赋真值」的机制。`major version: 65`、`ACC_PUBLIC` 标志位、方法表里的 `Code` 属性（stack/locals + 指令序列），都能在这条主线上一一对号入座。

## 工程实践

三个高频用法：其一，`javap -v` 查版本号定位 `UnsupportedClassVersionError`——看 major version 就知道是哪个 JDK 编译的；其二，线上报 `NoSuchMethodError` / `NoSuchFieldError` 时，用 `javap -v` 确认常量池里那条符号引用到底指向哪个签名，再对比部署 jar 里目标类的真实方法表，多数情况是多版本依赖冲突；其三，评估字节码增强或编译插件产物时，`javap -c` 对照源码看织入了什么指令，比猜可靠得多。

## 对比与权衡

| 结构项 | 存储内容 | 被谁引用 |
| --- | --- | --- |
| 魔数 + 版本号 | 文件身份与编译版本 | JVM 加载器校验 |
| 常量池 | 字面量 + 符号引用 | 所有后续表项通过索引复用 |
| 访问标志 | public/final/abstract 等位掩码 | 类、字段、方法三层各自一份 |
| 字段表 | 类变量/实例变量的名称、类型、属性 | 通过索引引用常量池 |
| 方法表 | 方法签名 + Code 属性（字节码） | 同上，结构与字段表同构 |
| 属性表 | Code、ConstantValue、LineNumberTable 等 | 可挂在类/字段/方法任意一层 |

设计上的权衡很典型：**用索引换空间**。字段表、方法表不重复存储字符串，一切素材归入常量池；**用宽松换扩展**。属性表不强制顺序、允许自定义、必须忽略未知项，让格式二十多年来能向后兼容地生长出 `StackMapTable`、`Record`、`PermittedSubclasses` 等新属性。

## 面试视角

**问：Class 文件的头几个字节是什么？** 前 4 字节魔数 `0xCAFEBABE` 用于验明文件身份，随后 4 字节是次版本号和主版本号（如 52 对应 Java 8、61 对应 Java 17），JVM 据此校验能否加载。

**问：常量池里存什么？为什么说它是仓库？** 存字面量和符号引用两类素材：字符串、`final` 常量值属于前者；类全限定名、字段/方法名和描述符属于后者。后续字段表、方法表全部通过索引引用常量池而不自带字符串，故称仓库。

**问：符号引用和直接引用是什么关系？** Class 文件里只有符号引用——编译期无法知道目标类在内存中的位置。类加载的解析阶段把符号引用替换为 JVM 可直接定位目标的直接引用。

**问：字段表和方法表的关系？方法体代码存在哪？** 两者结构同构（访问标志 + 名称索引 + 描述符索引 + 属性表）。方法体不在方法表的固定字段里，而是封装为 `Code` 属性挂在方法表的属性表中。

**问：访问标志能表达哪些信息？** 类层面标识 `public`、`final`、`abstract`、类还是接口；字段和方法各有自己的标志集，如字段有 `static`、`volatile`、`transient`，方法则换成 `synchronized`、`native`、`abstract`。

## 小结

Class 文件的设计一句话概括：魔数和版本号负责准入校验，常量池集中囤积全部字面量与符号引用供全文件索引复用，访问标志与继承索引描述类型身份，字段表和方法表以同构结构描述成员，属性表则以宽松的三层可挂载机制承载字节码与一切扩展信息。结合 `javap -v` 的真实输出走一遍这条主线，抽象的规范条目就会变成可对照、可验证的具体结构——这也是排查版本冲突、符号引用错误时最直接的底牌。
---
title: "Java 魔法类 Unsafe 详解"
date: 2017-11-24 09:17:00
updated: 2017-11-24 09:17:00
permalink: knowledge/java/basis/unsafe/
categories:
  - Java
tags:
  - Java基础
  - Unsafe
  - 并发
description: "拆解 Unsafe 的直接内存、CAS、对象操作与 park/unpark 能力，理解它为何不安全、在 JUC 与 Netty 中的应用，以及 VarHandle 的现代化替代。"
---

`sun.misc.Unsafe` 是 JDK 的内部类，提供直接内存操作、CAS 原子指令、按偏移量读写字段、线程 park/unpark 等接近 C 指针的低层能力。它是 JUC 并发包和 Netty 高性能的地基，也因绕过 Java 安全模型而被冠以「不安全」之名，如今正被 VarHandle 与 FFM API 逐步取代。

<!-- more -->

## 它解决什么问题

Java 的安全模型划了几条硬边界：内存由 JVM 分配回收，程序员不能碰裸指针；字段访问要过访问权限检查；线程调度依赖 `synchronized` 和 `Object.wait/notify`；任何对象创建必须经过构造器。这些边界保证了安全，却也挡住了高性能基础设施的路：

- 堆内内存归 GC 管，大缓存、高吞吐 IO 场景下 GC 停顿和堆内外数据拷贝都是负担，需要堆外内存；
- 无锁并发需要硬件原子指令，Java 语言层面没有暴露比较并交换（Compare And Swap，CAS）能力；
- AQS 这类同步器需要精确的「挂起/唤醒某个线程」原语，wait/notify 的语义满足不了。

Unsafe 就是这些能力的总出口。它的方法几乎全是 native 实现，直接穿透 JVM 抵达操作系统与硬件。

## 核心原理

Unsafe 是单例，但 `getUnsafe()` 会检查调用者的类加载器，只有启动类加载器加载的类（即 JDK 自身代码）才能拿到实例，普通业务代码直接调用会抛 `SecurityException`。这是一道刻意的门禁：能力太危险，只对受信代码开放。实验时通常用反射读取私有静态字段 `theUnsafe` 获取实例。

```java
private static Unsafe getUnsafeInstance() throws Exception {
    Field field = Unsafe.class.getDeclaredField("theUnsafe");
    field.setAccessible(true);
    return (Unsafe) field.get(null);
}
```

它提供的能力大致可归为几组：

- **内存操作**：`allocateMemory`/`reallocateMemory`/`freeMemory` 直接管理堆外内存，`copyMemory`、`setMemory` 做块拷贝与填充。
- **CAS 操作**：`compareAndSwapInt/Long/Object`，对应 x86 上的 `cmpxchg` 这类原子指令。
- **对象操作**：`objectFieldOffset` 拿字段偏移量，配合 `putInt`/`getObject` 等按偏移读写，绕过访问权限；`allocateInstance` 不调构造器直接建实例。
- **线程调度**：`park`/`unpark` 挂起与恢复指定线程。
- **内存屏障**：`loadFence`/`storeFence`/`fullFence`，约束屏障两侧指令的重排序。
- **数组与系统信息**：`arrayBaseOffset`/`arrayIndexScale` 定位数组元素，`addressSize`/`pageSize` 查询平台参数。

## 深入机制

### CAS：无锁原语

CAS 的语义是「比较内存位置的值与预期值，相等则原子地换成新值」。签名里 `o` 是宿主对象，`offset` 是字段偏移量：

```java
private volatile int state;
private static final long STATE_OFFSET;

static {
    try {
        STATE_OFFSET = UNSAFE.objectFieldOffset(Demo.class.getDeclaredField("state"));
    } catch (NoSuchFieldException e) {
        throw new ExceptionInInitializerError(e);
    }
}

void increment() {
    int expect;
    do {
        expect = UNSAFE.getIntVolatile(this, STATE_OFFSET);
    } while (!UNSAFE.compareAndSwapInt(this, STATE_OFFSET, expect, expect + 1));
}
```

CAS 本身只执行一次比较交换，失败就返回 false，所以调用方要包一层自旋循环。`AtomicInteger` 的 `getAndIncrement` 内部正是这个结构。要注意 CAS 并不总是优于锁：竞争激烈时大量线程空转烧 CPU，且存在 ABA 问题（值从 A 变 B 又变回 A，CAS 察觉不到变化历史），对历史敏感的场景需要 `AtomicStampedReference` 这类带版本号的方案。

### park/unpark：精确的线程开关

`park(boolean isAbsolute, long time)` 阻塞当前线程，`unpark(Thread thread)` 唤醒指定线程。底层机制是每线程一张「许可」（permit）：unpark 发放许可，park 消耗许可，许可最多攒一张。这意味着先 unpark 后 park 不会阻塞，顺序无关——这是它比 wait/notify 干净的根本原因：不需要先持有监视器，也没有「先 notify 后 wait 导致永久等待」的丢失唤醒问题。

`LockSupport.park/unpark` 是 Unsafe 这两个方法的公开封装，AQS（`AbstractQueuedSynchronizer`）靠它挂起和唤醒排队线程，可以说整个 JUC 锁体系都压在这对原语上。park 可能因中断、超时或虚假唤醒返回，所以规范的阻塞逻辑必须把条件检查放在循环里。

### 堆外内存与对象绕过

`DirectByteBuffer` 的构造过程就是 Unsafe 内存 API 的教科书用法：`allocateMemory` 分配、`setMemory` 清零，再挂一个 `Cleaner` 跟踪堆内 Buffer 对象的回收，以便连带释放堆外内存。堆外内存的价值在于两块：不受 GC 管理，大容量缓存不再拉长停顿；IO 时省掉堆内到堆外的一次数据拷贝。Netty 的 `ByteBuf` 体系正是沿着这条路做的，只是换上了自己的内存池和引用计数。

`allocateInstance` 则展示了另一种「绕过」：只凭 Class 对象建实例，不执行构造器、不做初始化检查。Gson 反序列化无无参构造的类、Objenesis 库，用的都是它。

## 工程实践

Unsafe 的「不安全」是实打实的：

- 堆外内存必须手动 `freeMemory`，忘了是泄漏，释放两次是 double free，立刻段错误级别的崩溃；
- 偏移量写错一位，`putLong` 就可能踩烂相邻对象的内存，JVM 层面无任何保护；
- `allocateInstance` 跳过构造器，对象可能处于不满足类不变量的非法状态；
- 它是内部 API，方法与行为随 JDK 版本变动甚至移除，比如监视器操作 `monitorEnter/monitorExit` 已在 JDK 9 移除，`defineClass` 在 JDK 11 移除，`defineAnonymousClass` 在 JDK 17 移除；JDK 23 起内存访问方法被标记为待移除，JDK 24 起首次调用会输出运行时警告。

结论很明确：业务代码绝不直接用 Unsafe。需要对应能力时走标准替代：

- **变量句柄（VarHandle，JDK 9 引入）**：替代 Unsafe 的字段读写、volatile 语义与 CAS。类型安全，配合 `MethodHandles.lookup()` 使用，还细化了 plain/opaque/acquire-release/volatile 四种内存序访问模式。

```java
class Counter {
    private volatile int value;
    private static final VarHandle VALUE;

    static {
        try {
            VALUE = MethodHandles.lookup()
                    .findVarHandle(Counter.class, "value", int.class);
        } catch (ReflectiveOperationException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    int increment() {
        return (int) VALUE.getAndAdd(this, 1);
    }
}
```

- **外部函数与内存 API（Foreign Function & Memory API）**：以 `Arena` + `MemorySegment` 替代堆外内存的手工管理，内存随作用域自动释放，不再有泄漏与 double free。
- 定义动态类用 `MethodHandles.Lookup.defineHiddenClass`，线程调度直接用 `java.util.concurrent` 的现成设施。

## 对比与权衡

| 维度 | Unsafe | VarHandle | FFM API（Arena/MemorySegment） |
| --- | --- | --- | --- |
| 定位 | 内部 API，无兼容性承诺 | 标准 API（java.lang.invoke） | 标准 API（java.lang.foreign） |
| 主要能力 | 内存、CAS、对象、线程调度全包 | 字段/数组的受控访问、CAS、内存序 | 堆外内存与本地函数调用 |
| 类型/边界检查 | 无 | 有 | 有（越界抛异常） |
| 内存释放 | 手动 | 不涉及 | 作用域自动释放 |
| 适用人群 | JDK 与框架底层作者 | 并发库作者、进阶业务代码 | 需要堆外内存/本地交互的代码 |

## 面试视角

**Unsafe 为什么叫「不安全」？** 它把内存分配释放、裸地址读写、绕过构造器的对象创建等能力暴露给 Java 代码，出错即内存泄漏、数据损坏甚至 JVM 崩溃，且不受编译期和运行时的常规保护。同时它是内部 API，不承诺跨版本兼容。

**CAS 的原理和问题是什么？** CAS 是一条硬件级原子指令：比较内存值与预期值，相等则更新。Java 中靠自旋循环重试。问题有三：高竞争下自旋空耗 CPU；ABA 问题需要版本号解决；只能保证单个变量的原子性，多变量复合操作仍需锁。

**park/unpark 与 wait/notify 有什么区别？** park/unpark 基于每线程一张的许可工作，不要求先持有监视器，唤醒目标明确，且先 unpark 后 park 不会永久阻塞；wait/notify 必须在 synchronized 块内使用，notify 无法指定线程，先 notify 后 wait 会丢失唤醒。AQS 的线程排队正是建立在 park/unpark 之上。

**堆外内存有什么优势，谁来释放？** 优势是不占堆、不受 GC 停顿影响，IO 时省去堆内外拷贝。代价是必须手动释放，DirectByteBuffer 靠 Cleaner 在堆内对象被回收时连带释放，Netty 用引用计数管理。用 FFM API 的 Arena 则可获得作用域内自动释放。

**JDK 高版本用什么替代 Unsafe？** 字段与数组的原子/volatile 操作用 VarHandle；堆外内存用 FFM API 的 MemorySegment 与 Arena；动态类定义用 MethodHandles.Lookup.defineHiddenClass。Unsafe 的内存访问方法已在走弃用移除流程。

## 小结

- Unsafe 是 JDK 留给自己的后门：直接内存、CAS、偏移读写、park/unpark，JUC 与 Netty 的高性能都建立在它上面。
- 「不安全」体现在三层：手动内存管理、绕过安全检查、内部 API 无版本承诺。
- CAS 要配自旋循环并警惕 ABA；park/unpark 靠许可机制规避了 wait/notify 的顺序陷阱。
- 新代码应转向标准替代：VarHandle 管字段级并发操作，FFM API 管堆外内存，Unsafe 只留给源码阅读。
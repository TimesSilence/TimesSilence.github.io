---
title: "Java 22 & 23 新特性概览"
date: 2022-02-24 17:03:00
updated: 2022-02-24 17:03:00
permalink: knowledge/java/new-features/java22-23/
categories:
  - Java
tags:
  - Java新特性
  - Java22
  - Java23
description: "JDK 22/23 重点：未命名变量与模式转正、FFM API 结束预览正式替代 JNI、Stream Gatherers 亮相、结构化并发与作用域值持续演进。"
---

JDK 22（2024 年 3 月）和 JDK 23（2024 年 9 月）都是非 LTS 版本，改动主线很清晰：语言层面继续做减法，原生互操作完成关键一跃，并发新 API 则在多轮预览中打磨。两个版本特性重合度高，放在一起看最省力气。

<!-- more -->

## 版本定位

这两个版本都属于半年一发的过渡版本，官方支持期只有六个月左右，定位是"预览新方向的试验田"，不是生产环境的主力选择——它们之后的长期支持版是 JDK 25。价值在于：一批重要特性在这里定型或接近定型，提前了解能在下一个 LTS 到来时直接上手。另外值得一提，JDK 23 起 ZGC 默认切换到分代模式，非分代模式开始走向移除。

## 未命名变量与模式（_）

该特性在 JDK 21 首次预览，JDK 22 正式转正。痛点很日常：`catch` 到的异常根本不看、try-with-resources 里只为了触发关闭、lambda 参数只用其中一个——这些"声明了却不用"的变量既是噪音又容易触发告警。现在统一用下划线表达"我故意不用它"：

```java
try {
    Files.readString(path);
} catch (IOException _) {
    return DEFAULT_CONFIG;
}

map.forEach((_, value) -> System.out.println(value));
```

模式匹配里同样适用，比如 `if (obj instanceof Point(_, int y))` 只解构出 y。注意 `_` 不占名字，同一作用域可以出现多个；一旦需要读这个值，就必须老老实实命名。

## FFM API 转正：告别 JNI 的正路

Foreign Function & Memory API（JEP 454）从 JDK 17 开始孵化，历经多轮预览，在 JDK 22 正式转正。它解决的是 Java 调用本地库、操作堆外内存的老大难问题：传统 JNI 需要写 C 胶水层、生成头文件、手工管理内存，一个指针错误就是整个 JVM 崩溃，排查成本极高。

FFM 的思路是用纯 Java 描述内存布局和函数签名，安全边界由 JVM 把守：

```java
try (Arena arena = Arena.ofConfined()) {
    MemorySegment segment = arena.allocate(ValueLayout.JAVA_INT, 100);
    segment.set(ValueLayout.JAVA_INT, 0, 42);
    int first = segment.get(ValueLayout.JAVA_INT, 0);
}
```

`Arena` 负责内存生命周期，作用域结束自动释放，杜绝泄漏和悬垂指针。转正意味着签名稳定、可上生产，也让 JDK 23 弃用 `sun.misc.Unsafe` 内存访问方法顺理成章——官方给的替代路线就是 FFM 加 VarHandle。

## Stream Gatherers：Stream 的自定义中间操作

内置的 `filter`、`map`、`distinct` 表达能力有限，滑动窗口、按状态去重、批量切分这类有状态转换过去只能写进 `collect` 或借助第三方库。Stream Gatherers（JDK 22 首次预览、23 二次预览）通过 `gather` 方法把中间操作开放出来：

```java
stream.gather(myGatherer).collect(Collectors.toList());
```

在 22/23 阶段它仍是预览特性，需要 `--enable-preview` 开启，重点是验证 API 形态；正式转正发生在后续版本，生产代码建议等转正再接入。

## 结构化并发与作用域值持续演进

两者在 JDK 23 都推进到第三次预览，API 形态已基本稳定。`StructuredTaskScope` 把一组并发子任务收敛成一个工作单元：父任务等待所有子任务完成，失败统一传播，配合虚拟线程可以写出演算清晰、不泄漏线程的并发代码。`ScopedValue` 则面向虚拟线程时代替代 `ThreadLocal`：不可变、按作用域绑定、子线程可继承，避免了百万级虚拟线程下 ThreadLocal 的内存开销。

多轮预览说明设计已收敛但尚未承诺冻结，建议此时跟进学习、做小范围实验，正式引入再等转正。

## 升级建议

非 LTS 版本不建议直接部署生产，但值得在 CI 中加一条 latest JDK 的流水线跑预览实验。FFM API 已转正、不受预览开关限制，有 native 交互或堆外内存需求的团队可以优先评估从 JNI/Unsafe 迁移；其余预览特性保持关注即可。

## 小结

- 未命名变量（`_`）转正，消灭"声明了不用"的样板代码。
- FFM API 转正，Java 有了安全、稳定的 JNI 替代方案。
- Stream Gatherers 连续预览，Stream 即将支持自定义中间操作。
- 结构化并发与作用域值进入第三次预览，形态趋稳，等转正再上生产。
---
title: "Java 17（JDK 17）新特性：密封类、switch 模式匹配与随机数 API"
date: 2022-01-07 12:28:00
updated: 2022-01-07 12:28:00
permalink: knowledge/java/new-features/java17/
categories:
  - Java
tags:
  - Java新特性
  - Java17
description: "Java 17 LTS 深度解读：密封类转正、switch 模式匹配预览、伪随机数新 API，以及从 8/11 升级时的强封装与移除项避坑指南。"
---

Java 17 于 2021 年 9 月发布，是继 8 和 11 之后第三个长期支持版本，也是 Spring Boot 3 的最低运行基线。它把密封类推向正式，首次预览 switch 模式匹配，统一了伪随机数生成器 API，同时通过强封装 JDK 内部 API 抬高了老项目的升级门槛。

<!-- more -->

## 版本定位

按六个月一发的节奏，Java 17 沉淀了 12 到 16 四个快速版本的成果：文本块、Records、instanceof 模式匹配在此之前已陆续转正，密封类在 17 完成最后一跃。因此相对 Java 8，17 的语言面貌存在代际差。再加上 Spring Framework 6 与 Spring Boot 3 把最低版本定在 17，它成为当前企业升级最现实的目标版本，也是面试中"LTS 怎么选"的高频背景板。

支持周期方面，Oracle 为 17 提供多年的商业支持，OpenJDK 各发行版（Temurin、Corretto、Dragonwell 等）的免费更新节奏各不相同，生产选型时以实际使用的发行版政策为准。与 8、11 相比，17 的生态位更清晰：新框架以它为基线，旧框架大多仍兼容，进退都有路。

## 密封类转正：用 permits 表达受限继承

传统继承只有两个极端：类要么 `final` 禁止任何扩展，要么放开后谁都能继承。建模"一个接口只有固定几种实现"时——比如表达式树的节点、支付结果的成功与失败——过去只能靠包私有构造器或文档约定约束，编译器帮不上忙。

密封类（sealed class）填补了这块空白。它在 15、16 两轮预览后于 17 正式转正（JEP 409）：

```java
public sealed interface Shape
        permits Circle, Rectangle, Triangle {}

final class Circle implements Shape {
    double radius() { return 1.0; }
}

non-sealed class Rectangle implements Shape {}

sealed class Triangle implements Shape permits EquilateralTriangle {}
```

要点有三个：

- `permits` 显式列出获准继承的子类；子类与父类同包同模块时可省略，编译器自动推断。
- 每个子类必须三选一：`final`（终止继承）、`sealed`（继续受限下放）、`non-sealed`（重新放开）。
- 子类必须与父类处于同一模块（或未命名模块的同包），防止外部偷偷扩展。

真正的价值在于：编译器由此掌握了类型的全集。对一个 sealed 层级做 switch 时可以启用穷尽性检查，漏掉分支直接编译报错；将来新增一个实现类，所有相关 switch 全部亮红灯——这是可维护性的质变，而不只是语法糖。

## switch 模式匹配（首次预览）

按类型分派的传统写法是一串 `instanceof` 加强转的 if-else，啰嗦且容易写错。17 首次预览了 switch 的模式匹配（JEP 406）：

```java
static String describe(Object o) {
    return switch (o) {
        case Integer i -> "整数 " + i;
        case Long l    -> "长整数 " + l;
        case String s  -> "字符串，长度 " + s.length();
        case null      -> "空值";
        default        -> "其他类型";
    };
}
```

相比旧写法：`case` 直接绑定变量，省掉强转；支持 `case null`，不必在 switch 前单独判空；作用于 sealed 层级时编译器做穷尽性检查，甚至可以省掉 `default`。

注意这是预览特性：编译和运行都要加 `--enable-preview`，编译产物的 class 文件带有预览标记，只能跑在同版本且开启预览的 JVM 上。生产环境建议等它转正（Java 21 正式转正），个人项目和内部工具可以先行体验。

## 伪随机数生成器新 API

17 之前生成随机数有三个常用类，各有各的别扭：`Random` 在多线程下竞争同一个原子种子，并发性能差；`ThreadLocalRandom` 快但不能显式设种子，测试难以复现；`SplittableRandom` 适合拆分却又自成一派。三者没有统一接口，想换一个更现代的算法几乎要重写调用处。

JEP 356 引入 `RandomGenerator` 统一接口与 `RandomGeneratorFactory` 工厂，内置了 L32X64MixRandom、L128X256MixRandom、Xoshiro256PlusPlus 等一批新算法：

```java
RandomGeneratorFactory<RandomGenerator> factory =
        RandomGeneratorFactory.of("Xoshiro256PlusPlus");
RandomGenerator generator = factory.create(42L);
int n = generator.nextInt(100);
```

`Random`、`ThreadLocalRandom`、`SplittableRandom` 都改造实现了该接口，老代码可以平滑过渡。接口还提供 `ints()`、`doubles()` 等流式方法，配合 `RandomGeneratorFactory.all()` 可以枚举全部内置算法，按需挑选周期与统计质量合适的实现。注意这套 API 面向仿真、游戏、测试等统计性场景，加密安全场景仍然必须使用 `SecureRandom`，两者不要混用。

## 从 8/11 升级的注意事项

升级 17 最大的拦路虎不是语法，而是兼容性清单。

**内部 API 强封装**：17 默认强封装 JDK 内部包（JEP 403），并移除了 16 里用于过渡的 `--illegal-access` 宽松开关。反射访问 `sun.*`、`jdk.internal.*` 等非公开成员会直接抛 `InaccessibleObjectException`。老版本的 Lombok、部分 AOP 与序列化框架是重灾区。首选方案是升级依赖到适配 17 的版本；确实无法替换时，临时用启动参数放行：

```bash
java --add-opens java.base/java.lang=ALL-UNNAMED -jar app.jar
```

**移除项**：RMI Activation（JEP 407）和实验性的 AOT/JIT 编译器（JEP 410）在 17 被删除；Applet API 与 Security Manager 被标记为待移除。若从 8 直接跳升，还要把 9~16 的旧账一起还上：JAXB、JAX-WS 等 Java EE 模块在 11 已删，Nashorn 引擎在 15 移除，都需要自行引入替代依赖。

## 工程实践/升级建议

1. **依赖审计先行**：用 `jdeps --jdk-internals app.jar` 扫描所有 jar，列出依赖内部 API 的清单，逐个确认是否有适配版本。
2. **双轨验证**：先在 17 上跑完整测试套件与压测，重点观察反射异常、GC 行为与启动时间，再切换生产。
3. **评估新 GC**：17 里 G1 仍是默认，ZGC 与 Shenandoah 均已生产可用，大堆、低延迟服务可以借机切换验证。
4. **拆解升级步奏**：JDK 升级与 Spring Boot 3 框架升级尽量分成两次发布，避免问题叠加难以定位。
5. **容器环境复核**：8 时代的 JVM 参数（如 `MaxRAMFraction`、显式堆外内存配置）在 17 的容器感知默认策略下可能多余甚至有害，升级时顺手清理。

## 面试视角

1. **密封类和枚举有什么区别？** 枚举表达的是"有限的实例"，密封类表达的是"有限的子类"，每个子类可以有独立的字段与实例；sealed 配合 switch 的穷尽性检查，是建模领域有限变体的组合拳。
2. **switch 模式匹配相比 instanceof 链强在哪？** 无需强转、支持 null 分支、编译器可做穷尽性检查；同时要能说出它在 17 仍是预览、需要 `--enable-preview`。
3. **从 8 直升 17 最常见的坑？** 内部 API 强封装导致的 `InaccessibleObjectException` 与 `--add-opens` 的取舍，以及 11 中被删除的 Java EE 模块。
4. **为什么需要 RandomGenerator 体系？** 统一接口、算法可插拔、弥补 `Random` 并发性能与 `ThreadLocalRandom` 不可复现的短板。
5. **LTS 怎么选，为什么很多团队从 8 直接跳 17？** 支持周期、框架基线（Spring Boot 3）、升级成本一次性支付，跳过中间 LTS 反而更经济。

## 小结

Java 17 的关键词是"收口"：密封类收口继承层次，模式匹配收口类型分派，强封装收口内部 API。升级成本主要集中在历史依赖对 JDK 内部 API 的使用上，收益则是现代化的语言表达力与更长的支持周期——对大多数团队，这是一笔划算的买卖。
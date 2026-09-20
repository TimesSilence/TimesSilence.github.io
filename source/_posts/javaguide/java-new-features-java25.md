---
title: "Java 25 新特性概览"
date: 2022-03-16 09:17:00
updated: 2022-03-16 09:17:00
permalink: knowledge/java/new-features/java25/
categories:
  - Java
tags:
  - Java新特性
  - Java25
description: "JDK 25(LTS)：紧凑源文件与实例 main、模块导入声明、Scoped Values 转正，分代 Shenandoah 与紧凑对象头落地，值得作为新生产基线评估。"
---

JDK 25 于 2025 年 9 月发布，是继 JDK 21 之后的又一个 LTS（长期支持）版本，也是未来几年企业升级的主线基线。它的关键词是"兑现"：前几轮预览的语言简化、模块导入、作用域值在这里集中转正，GC 侧也有分代 Shenandoah 和紧凑对象头两项实打实的性能改进。

<!-- more -->

## 版本定位

LTS 版本意味着主流发行版会提供多年更新，适合作为生产环境的下一个基线。对目前仍在 JDK 17 或 21 的团队，JDK 25 汇集了三年来语言、并发、GC 三条线的演进成果，是评估升级的合理目标版本。

## 紧凑源文件与实例 main 方法转正

从 JDK 21 首次预览、经历四次打磨后正式转正。`main` 方法可以是实例方法，类声明可以整个省略：

```java
void main() {
    System.out.println("Hello, World!");
}
```

初学者不必先理解 `public static void main(String[] args)` 这一串仪式性声明，写脚本、做原型验证时 Java 也不再显得笨重。对大型工程没有影响，但教学和工具脚本场景体验明显变好。

## 模块导入声明转正

JDK 23 预览、25 转正的 `import module` 允许一条语句导入整个模块导出的全部包：

```java
import module java.base;

void main() {
    var list = List.of("a", "b");
    list.stream().map(String::toUpperCase).forEach(System.out::println);
}
```

痛点很明确：写小段代码时 `java.util`、`java.io`、`java.util.stream` 一长串 import 纯粹是体力活。模块导入让快速编码和示例代码清爽很多，且不要求使用者自己的代码模块化。注意它与单类型导入可以共存，但可能引入名字冲突，大型工程建议团队统一约定是否使用。

## Scoped Values 转正

作用域值结束多轮预览正式转正，定位是虚拟线程时代的 `ThreadLocal` 替代：值不可变、在明确的作用域内绑定、结构化并发派生的子线程可以继承绑定而无需复制：

```java
private static final ScopedValue<String> USER = ScopedValue.newInstance();

ScopedValue.where(USER, "alice").run(() -> handleRequest());
// handleRequest 内部任意深处：USER.get() 得到 "alice"
```

`ThreadLocal` 在百万级虚拟线程下的内存开销和可移除性问题一直被诟病，ScopedValue 用"单向、不可变、随作用域自动失效"的模型绕开了这些坑。需要跨层传递上下文（用户身份、traceId）的服务端代码值得优先迁移。

## 分代 Shenandoah 与紧凑对象头

GC 侧两项正式特性。Shenandoah 是 Red Hat 主导的低暂停收集器，此前不分代，回收"朝生夕死"的年轻代对象效率偏低；分代模式转正后，它在保持极低暂停的同时吞吐明显提升，通过 `-XX:+UseShenandoahGC -XX:ShenandoahGCMode=generational` 启用，低延迟场景多了一个 ZGC 之外的成熟选项。紧凑对象头则把 64 位平台上的对象头从 12–16 字节压缩到 8 字节，直接降低堆占用、提升缓存局部性，用 `-XX:+UseCompactObjectHeaders` 开启，对象数量巨大的应用收益最明显。两者都不是默认开启，上线前需用自己的负载压测验证。

## 升级建议

LTS 身份使 JDK 25 值得认真评估：先确认依赖框架声明支持，再用 CI 跑全量测试，灰度阶段可试点紧凑对象头；并发代码可考虑引入 ScopedValue 替代 ThreadLocal，但结构化并发在本版本仍处于预览阶段，生产代码暂缓引入。还在 JDK 8/11 的系统建议直接以 25 为目标做跨越式升级规划，而不是逐版本爬行。

## 小结

- JDK 25 是新 LTS，多个预览特性集中转正，升级价值高。
- 紧凑源文件、实例 main、模块导入声明转正，小代码场景体验大幅改善。
- ScopedValue 转正，虚拟线程时代传递上下文有了正确姿势。
- 分代 Shenandoah 与紧凑对象头落地，低延迟和内存密度各进一步。
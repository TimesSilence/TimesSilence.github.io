---
title: "Java 21（JDK 21）新特性：虚拟线程、分代 ZGC 与有序集合"
date: 2022-02-15 16:56:00
updated: 2022-02-15 16:56:00
permalink: knowledge/java/new-features/java21/
categories:
  - Java
tags:
  - Java新特性
  - Java21
description: "Java 21 LTS 新特性详解：虚拟线程正式转正、分代 ZGC、switch 与 Record 模式匹配、Sequenced Collections、字符串模板预览，附升级决策分析。"
---

Java 21 于 2023 年 9 月发布，是继 Java 17 之后的又一个长期支持（LTS）版本。它最响亮的标签是虚拟线程正式转正，同时一次性转正了 Record 模式、switch 模式匹配、Sequenced Collections，并引入分代 ZGC——无论从哪个角度看，它都是停在 Java 8/11/17 的团队最该评估的升级目标。

<!-- more -->

## 版本定位

JDK 21 共包含 15 项 JEP，转正清单豪华：JEP 444 虚拟线程、JEP 440 Record 模式、JEP 441 switch 模式匹配、JEP 431 Sequenced Collections、JEP 439 分代 ZGC。LTS 意味着主流发行版提供多年维护，Spring Boot 3.2+ 也把它作为生产基线并内置虚拟线程开关。下面按工程价值逐个拆解。

## 虚拟线程正式转正

### 是什么

虚拟线程由 JVM 而非操作系统调度。成千上万个虚拟线程复用少量平台线程（载体线程）：遇到阻塞 I/O 时从载体上卸载，载体立即转去执行其他虚拟线程，I/O 就绪后再挂载继续执行。写法上还是朴素的同步代码，吞吐却能逼近复杂的异步回调模型。

### 用法

```java
// 方式一：直接创建一个虚拟线程
Thread vt = Thread.startVirtualThread(() -> handle(request));

// 方式二：每任务一个虚拟线程的执行器（推荐）
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> fetchUser(1L));
    executor.submit(() -> fetchOrders(1L));
} // 关闭时等待所有任务结束
```

注意这个执行器不要池化：虚拟线程创建成本极低，池化反而违背设计初衷。

### 与平台线程的对比

平台线程一对一映射内核线程，创建和切换都要进内核态，数量到几千就吃紧，阻塞时整条 OS 线程跟着空转。虚拟线程由 JVM 在堆上调度，创建是纳秒级内存操作，可到百万级，阻塞代价只是一次栈帧的卸载与恢复。代价是：跑的还是同一块 CPU，CPU 密集任务用它不会有提升。

### 适用场景与 pin 注意事项

最适合的场景是阻塞密集的调用链：网关、RPC 与 HTTP 客户端、数据库访问层——线程大部分时间都在等 I/O。两个坑必须提前知道：

1. **Pinning（钉住）**：JDK 21 中，虚拟线程在 `synchronized` 块或 native 方法内阻塞时无法卸载，会把载体线程一起拖住，高并发下可能抵消收益。热点路径把 `synchronized` 换成 `ReentrantLock` 可显著缓解；该问题在 JDK 24 才从 JVM 层面根本改进。
2. **ThreadLocal 失控**：百万级虚拟线程各持一份大对象 ThreadLocal，内存会直接爆炸。大块上下文应改用作用域值来传。

## 分代 ZGC

痛点：此前的 ZGC 不分代，所有对象一视同仁，而「朝生夕死」的年轻对象占了分配大头。不分代意味着每次回收都要扫全堆，分配速率高的应用回收开销和堆占用都更高。

JEP 439 把 ZGC 拆成年轻代与老年代，对年轻代做更频繁的回收：在保持亚毫秒级暂停的同时，降低停顿风险、减少堆占用、提升吞吐。21 中分代默认关闭，需显式开启：

```bash
java -XX:+UseZGC -XX:+ZGenerational ...
```

官方路线明确：后续版本将默认分代并最终移除非分代模式，新应用直接开启即可。交易、实时推荐这类大堆低延迟服务受益最大。

## switch 模式匹配转正

历经四版预览，switch 模式匹配在 JEP 441 中转正。case 标签可以直接写类型模式，还能叠加 `when` 守卫条件：

```java
static String describe(Object o) {
    return switch (o) {
        case Integer i when i > 0 -> "正整数 " + i;
        case Integer i            -> "非正整数 " + i;
        case String s             -> "长度为 " + s.length() + " 的字符串";
        case null                 -> "空值";
        default                   -> "其他类型";
    };
}
```

两个细节值得记住：`case null` 现在可以显式书写，不写则传入 null 依旧抛 NPE；switch 作用于 sealed（密封）类型层级且 case 覆盖全部子类型时，可以省掉 default，编译器会做穷尽性检查，新增子类时直接编译报错，重构更安全。

## Record 模式转正

Record 模式在 Java 19、20 各预览一轮后，由 JEP 440 转正。它与 instanceof 或 switch 配合，直接解构 record 组件，省掉一串 getter 调用：

```java
record Point(int x, int y) {}

if (obj instanceof Point(int x, int y)) {
    System.out.println(x + ", " + y);
}
```

还支持嵌套解构，`Box(Point(int x, int y))` 可以一层拆到底，处理树状数据结构尤其顺手。注意 `null` 不匹配任何 Record 模式，判空逻辑仍需先行；也别把 Record 模式和 Java 16 转正的 record 类混为一谈。

## Sequenced Collections

痛点：取 `List` 尾元素得写 `list.get(list.size() - 1)`，`LinkedHashMap` 没有访问首尾键值对的 API，`SortedSet` 又是 `first()/last()` 另一套叫法——「有确定遍历顺序的集合」一直缺统一抽象。

JEP 431 新增 `SequencedCollection`、`SequencedSet`、`SequencedMap` 三个接口，`List`、`Deque`、`LinkedHashSet`、`LinkedHashMap`、`SortedSet`、`SortedMap` 全部挂进这套体系，统一提供首尾访问和反向视图：

```java
LinkedHashMap<Integer, String> map = new LinkedHashMap<>();
map.put(1, "一");
map.put(2, "二");
map.putFirst(0, "零");         // {0=零, 1=一, 2=二}
var first = map.firstEntry();  // 0=零
var view  = map.reversed();    // 反向视图：{2=二, 1=一, 0=零}
```

`reversed()` 返回的是视图而非拷贝，修改视图会直接作用于原集合，多线程共享时留心。

## 字符串模板（预览）

JEP 430 以预览形式引入字符串模板：用 `STR` 处理器把表达式直接嵌进字符串字面量，比 `+` 拼接和 `String.format` 更可读：

```java
String name = "World";
String msg = STR."Hello, \{name}!";
```

除 `STR` 外还有带格式说明符的 `FMT` 和返回模板对象的 `RAW`，处理器机制也为 SQL 防注入等场景预留了扩展口。但必须提醒：这套语法只在 Java 21、22 中预览过，后续提案已被撤回，当前 JDK 不再提供——了解即可，切勿在生产中依赖。

## 工程实践与升级建议

升级决策按现状分三档：

- **从 Java 17 升级**：收益最直接——虚拟线程加三个语言转正特性一次收齐，Spring Boot 3.2+ 官方适配，改动面可控，建议尽快排期。
- **从 Java 8/11 升级**：跨度较大，先用 CI 做全量回归，重点排查已移除的 API（如 Nashorn 引擎）、对 `sun.misc.*` 等内部 API 的依赖，以及 TLS、GC 默认值的变化。测试窗口不足可先到 17 过渡，窗口充足则一步到位。
- **虚拟线程落地顺序**：先在 I/O 密集的独立服务试点，替换热点路径上的 `synchronized`，审视连接池与限流配置（虚拟线程能瞬间打出远超池大小的并发），验证稳定后再推向核心链路。
- **GC 选择**：大堆低延迟选分代 ZGC，其余继续用 G1，两者在 21 里都是成熟选项。

## 面试视角

1. 虚拟线程和平台线程的本质区别是什么？为什么虚拟线程不适合 CPU 密集型任务？
2. 什么是虚拟线程的 pinning 问题？在 JDK 21 中如何规避？
3. 分代 ZGC 相对传统 ZGC 解决了什么问题？启用参数是什么？
4. switch 模式匹配的穷尽性检查如何工作？sealed 类在其中扮演什么角色？
5. ThreadLocal 在虚拟线程时代暴露出哪些问题？JDK 给出的替代方向是什么？

## 小结

Java 21 是近几年含金量最高的 LTS：虚拟线程改写了高并发编程模型，Record 与 switch 模式匹配让数据处理代码脱胎换骨，分代 ZGC 与 Sequenced Collections 补齐运行时和集合 API 短板。还在 Java 17 及以下的团队，值得把它列入下一季度的升级清单。
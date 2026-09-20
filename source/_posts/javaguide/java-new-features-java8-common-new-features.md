---
title: "Java8 新特性实战"
date: 2021-10-23 14:32:00
updated: 2021-10-23 14:32:00
permalink: knowledge/java/new-features/java8-common-new-features/
categories:
  - Java
tags:
  - Java新特性
  - Java8
description: "深入 Java 8 核心特性：Lambda 与函数式接口、Stream 流水线与并行流陷阱、Optional 的正确边界、接口默认方法，以及线程安全的 java.time 日期 API。"
---

Java 8 是近十年 Java 语言最重要的一次进化，函数式编程能力从此进入主流语法。本篇聚焦日常开发离不开的五个特性：Lambda、Stream、Optional、接口默认方法和新日期时间 API，讲清它们各自解决什么问题、怎么用、在哪里容易踩坑。

<!-- more -->

## 版本定位

Java 8 发布于 2014 年 3 月，是 Oracle 官方认定的 LTS 版本之一。它要回答的时代问题是：硬件早已进入多核时代，而 Java 的集合处理仍停留在「外部迭代 + 匿名内部类」的冗长写法上，代码既不简洁也难以并行化。Java 8 给出的答案是一整套组合拳：Lambda 让行为可以像数据一样传递，Stream 把集合操作升级为声明式流水线，接口默认方法为这套演进提供兼容性地基，Optional 和 java.time 则顺手修补了空指针与日期处理这两个历史顽疾。

## Lambda 与函数式接口

函数式接口（SAM 接口）指只有一个抽象方法的接口，`@FunctionalInterface` 注解只做编译期校验，有没有它都不影响本质。Lambda 表达式就是函数式接口实例的紧凑写法，底层靠 `invokedynamic` 在运行期生成实现，而不是像匿名内部类那样额外编译出一个 class 文件。

```java
// Java 8 之前：匿名内部类
Collections.sort(names, new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return a.length() - b.length();
    }
});

// Java 8：Lambda + 方法引用
names.sort(Comparator.comparingInt(String::length));
```

使用注意：

- Lambda 捕获的局部变量必须是 final 或事实上 final，否则编译失败。
- Lambda 里的 `this` 指向外围类，不像匿名内部类那样指向自身。
- 方法引用 `String::length` 等价于 `s -> s.length()`，属于「任意对象的实例方法」引用。
- `java.util.function` 包的 Predicate、Function、Consumer、Supplier 四件套覆盖了大部分场景；参数语义复杂时，自定义一个有名字的函数式接口比堆泛型更可读。

## Stream API

Stream 是对集合数据的声明式处理流水线：你描述要做什么，而不是怎么遍历。操作分两类——中间操作（`filter`、`map`、`sorted` 等，返回新 Stream，惰性不执行）和终止操作（`collect`、`forEach`、`reduce`、`count` 等，触发整条流水线真正求值）。

```java
List<String> tops = orders.stream()
        .filter(o -> o.getAmount() > 100)
        .map(Order::getCustomerName)
        .distinct()
        .sorted()
        .limit(10)
        .collect(Collectors.toList());
```

惰性求值的价值在于融合与短路：中间操作只是记账，终止操作到来时才把整条链融合成尽量少的遍历；`findFirst`、`anyMatch` 这类短路终止操作甚至不需要处理全部元素。还有两个容易忽略的事实：Stream 只能消费一次，终止之后再次操作会抛出 `IllegalStateException`；只是遍历处理用 `forEach`，需要产出新集合则用 `collect`，不要混用 `forEach` 往外部集合里塞数据。

并行流是重灾区，务必记住三个陷阱：

1. `parallelStream()` 底层共用 `ForkJoinPool.commonPool()`，任何一处提交阻塞或长耗时任务，都会拖垮同一 JVM 内所有并行流。
2. 操作里触碰共享可变状态（比如往外面的 ArrayList 里 add），会产生线程安全问题，结果错乱且难复现。
3. 数据量小、任务偏 IO、或数据源不易拆分（LinkedList 远差于 ArrayList）时，并行反而更慢。

经验法则：无状态操作 + 计算密集 + 数据量大 + 易拆分数据源，四个条件齐备才考虑并行，并且用基准测试验证收益，否则默认串行。

## Optional 的正确用法

Optional 是一个最多装一个值的容器，设计意图只有一个：作为方法的返回值，显式声明「结果可能为空」，把 null 检查从运行期的 NPE 前移为编译期可见的契约。

```java
public Optional<User> findById(long id) {
    return Optional.ofNullable(repository.load(id));
}

String name = findById(42L)
        .map(User::getName)
        .orElse("匿名用户");
```

使用注意：

- 不要把 Optional 用作实体字段（序列化框架普遍不支持）或方法参数（反而强迫调用方做包装）。
- `orElse(x)` 的参数无论值是否存在都会构造，构造代价高时改用惰性求值的 `orElseGet(() -> ...)`。
- 永远不要在未判断的情况下直接 `get()`，那和裸用 null 一样危险。

## 接口默认方法与静态方法

Java 8 允许接口中出现两类带方法体的成员：`default` 方法（实例方法，可被子接口继承、被实现类重写）和 `static` 方法（只能通过接口名调用，不参与继承）。

它解决的痛点非常具体：Java 8 要给 `Collection` 增加 `stream()`、`forEach()` 等方法，如果按老规矩只加抽象方法，全世界已有的实现类会全部编译失败。默认方法让接口获得了「向前演进而不破坏二进制兼容」的能力，这正是 Lambda 与 Stream 能够落地的前提。

```java
public interface Repository<T> {
    T find(long id);

    default boolean exists(long id) {
        return find(id) != null;
    }

    static <T> Repository<T> empty() {
        return id -> null;
    }
}
```

使用注意：一个类实现的两个接口存在同名 default 方法时必须重写，并可用 `InterfaceA.super.method()` 显式选择其中一方的实现；默认方法不能重写 Object 的 `equals`、`hashCode`、`toString`；接口依然没有实例状态，定位与抽象类不同，不要因为新特性把本该是抽象类的地方换成接口。

## 新日期时间 API

旧的 `java.util.Date` 与 `Calendar` 坑点密集：对象可变、线程不安全、月份从 0 开始计数，而 `SimpleDateFormat` 在多线程下共享使用会直接算出错乱结果，是线上事故的高发区。

Java 8 引入 `java.time` 包：`LocalDate`、`LocalTime`、`LocalDateTime` 表示不带时区的日期时间，`ZonedDateTime` 带时区，`Instant` 表示机器时间戳，`Duration` 与 `Period` 分别度量时间与日期跨度。核心类全部是不可变对象，天然线程安全；`DateTimeFormatter` 同样线程安全，可以放心定义为 `static final` 常量全局复用。

```java
// 旧写法：共享的 SimpleDateFormat 是线程安全隐患
private static final SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd");

// 新写法：不可变 + 线程安全
private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

LocalDate today = LocalDate.now();
LocalDateTime deadline = today.plusDays(7).atTime(18, 0);
String text = deadline.format(FMT);
```

新旧互转走 `Date.toInstant()` 与 `Date.from(instant)`，配合 `atZone(ZoneId.systemDefault())` 在 `LocalDateTime` 与 `Instant` 之间衔接。注意 `LocalDateTime` 本身不含时区信息，跨时区比较必须先转成 `ZonedDateTime` 或 `Instant`。线程安全带来的实际收益是：格式化器可以全局共享一份，方法之间随意传递日期对象也不用担心被谁偷偷改掉，防御性拷贝从此成为历史。

## 工程实践与升级建议

- 从老版本升级时，优先改造集合处理密集的业务代码，收益最直接；但不必追求全面 Lambda 化，嵌套三层以上的 Lambda 反而损害可读性。
- Stream 适合数据转换与聚合；循环体内带复杂业务状态、需要精确控制资源释放的场景，传统 for 循环往往更清晰。
- 全局检索 `SimpleDateFormat` 并替换为 `DateTimeFormatter`，是升级后性价比最高的排雷动作之一。
- 并行流默认不开，逐场景压测后再启用；公共线程池内严禁提交阻塞任务。
- 团队约定 Optional 只出现在方法返回值上，写进代码评审清单。

## 面试视角

1. Lambda 的底层实现原理是什么？和匿名内部类有什么区别？（`invokedynamic` + `LambdaMetafactory` 运行期生成，无额外 class 文件；`this` 语义不同。）
2. Stream 的中间操作和终止操作如何区分？惰性求值带来什么好处？
3. 为什么生产环境要慎用 `parallelStream()`？它共享的是哪个线程池？
4. Optional 为什么不适合做字段和参数？`orElse` 与 `orElseGet` 的区别是什么？
5. 接口的 default 方法解决了什么问题？两个接口有同名默认方法时编译器怎么处理？

## 小结

Java 8 的本质是把「行为」提升为可以传递的值：Lambda 提供语法，函数式接口提供类型，Stream 提供主战场，默认方法提供演进的地基，Optional 与 java.time 则是同一波工程思维对历史顽疾的清理。掌握这套组合的关键不在于背 API，而在于理解它们为什么必须在同一个版本里一起出现。
---
title: "Java 16 新特性概览"
date: 2021-12-29 11:21:00
updated: 2021-12-29 11:21:00
permalink: knowledge/java/new-features/java16/
categories:
  - Java
tags:
  - Java新特性
  - Java16
description: "Java 16 将 Records 与 instanceof 模式匹配转正，新增 Stream.toList()，Vector API 开始孵化；附 Records 与 Lombok @Value 的取舍思考。"
---

Java 16 把前两轮预览的两个重磅语法转正：Records 与 instanceof 模式匹配，同时带来 Stream.toList() 这样的顺手 API，Vector API 则开始漫长的孵化之旅。

<!-- more -->

## 版本定位

JDK 16 发布于 2021 年 3 月，是 17 LTS 之前的最后一个非 LTS 版本，角色类似"定型前的封板"：语言侧没有全新预览登场，而是把 Records、instanceof 模式匹配修成正果；平台侧默认强封装 JDK 内部 API，jpackage 打包工具转正，Vector API 首次孵化。它的内容几乎原样进入 Java 17，值得当作 LTS 演练场认真对待。

## Records 转正

Records 在 14、15 两轮预览后于 16 正式转正。一行声明换来不可变数据载体全家桶：

```java
record UserDto(long id, String name) { }

UserDto u = new UserDto(1L, "neo");
System.out.println(u.name()); // neo
```

还可以用紧凑构造器把参数校验收拢到一处，赋值语句由编译器自动补上：

```java
record Range(int from, int to) {
    Range {
        if (from > to) {
            throw new IllegalArgumentException("from 不能大于 to");
        }
    }
}
```

使用注意：record 的字段全部 final，类不能再继承其他类（隐式继承 `java.lang.Record`），可以实现接口；访问器命名是 `name()` 而非 `getName()`，依赖 JavaBeans 内省约定的老框架需要先确认兼容性。

### 与 Lombok @Value 的对比

很多项目早已用 Lombok 的 `@Value` 实现同样效果，两者怎么选？

- **标准与外挂**：record 是语言级特性，不依赖注解处理器和 IDE 插件，编译链路干净；Lombok 靠构建期插桩，升级 JDK 时偶尔要踩兼容坑。
- **能力边界**：Lombok 生态还内建 builder、with 方法等，record 不提供 builder，需要链式建造时得手写或借助第三方库。
- **语义强弱**：record 明确声明"这是透明的数据载体"，字段即 API，Jackson 等序列化框架可依赖其规范构造器做精确映射；`@Value` 生成的只是普通 final 类。

实操建议：新项目、纯数据传输场景优先 record；存量 Lombok 代码不必急于重写，但团队应约定新代码统一风格，避免两套体系长期并存。

## instanceof 模式匹配转正

14 首次预览、15 二次预览之后，模式匹配在 16 转正。类型判断与变量绑定一次完成：

```java
if (o instanceof String s && !s.isBlank()) {
    System.out.println(s.trim());
}
```

模式变量的作用域由编译器做流分析，只在确定匹配成立的位置可见，写错会直接编译失败——比运行时的 ClassCastException 友好得多。16 还微调了语义：模式变量不再隐式 final，允许重新赋值，不过多数风格指南仍建议当作只读来用。

## Vector API（孵化）

Vector API 以孵化模块 `jdk.incubator.vector` 首次亮相，目标是让开发者显式表达向量计算，运行时再编译为当前 CPU 支持的最优向量指令（SIMD）。在数值计算、图像处理这类数据并行场景，它比等价的标量循环快得多。HotSpot 虽有自动向量化，但可转换的模式有限且对代码形态敏感，手写向量 API 提供了确定性的优化路径。

使用注意：孵化 API 比预览特性更不稳定，包名和接口在后续版本都可能大改，只适合性能敏感的探索性代码，不建议进入主干分支。

## Stream.toList()

```java
List<String> names = users.stream()
        .map(User::name)
        .toList();
```

替代啰嗦的 `collect(Collectors.toList())`。语义上有差异必须留意：`toList()` 返回的是不可变列表，对元素中的 null 也不宽容，遇 null 直接抛 NullPointerException。旧代码如果依赖返回结果可增删、或流中可能含 null，应继续使用 `Collectors.toCollection(ArrayList::new)`。

## 其他值得知道的

- **jpackage 转正**：可将应用打成平台原生安装包（msi/exe/pkg/dmg/deb/rpm），交付桌面程序方便不少。
- **默认强封装 JDK 内部 API**：`--illegal-access` 默认值收紧为 deny，依赖 `sun.*` 内部类反射的老框架需要 `--add-opens` 显式开包，这是升级到 16 及以上最常见的坑。
- **Unix 域套接字通道**：本机进程间通信可以走文件系统路径寻址，比 TCP 环回更省开销。

## 升级建议

16 本身是短期版本，生产环境直接部署的意义不大，但它的全部内容都会进入 17 LTS。建议把它当预演环境：验证内部 API 强封装对依赖框架的影响、把合适的 DTO 改写为 record、统一 Stream.toList() 的使用规约，这样升 17 时只剩换版本号的工作量。

## 小结

- Records 转正：语言级不可变数据载体；对比 Lombok @Value 胜在标准与语义明确，弱在没有内建 builder。
- instanceof 模式匹配转正：判断即绑定，作用域交给编译器管理。
- Vector API 孵化：面向 SIMD 的显式向量计算，观望为主、谨慎试用。
- Stream.toList() 更简洁，但返回不可变列表且拒绝 null，替换前先核对语义。
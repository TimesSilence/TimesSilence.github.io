---
title: "Gradle 核心概念总结"
date: 2023-01-01 09:47:00
updated: 2023-01-01 09:47:00
permalink: knowledge/tools/gradle/gradle-core-concepts/
categories:
  - 开发工具
tags:
  - 开发工具
description: "讲清 Gradle 的 DSL 即代码理念、Task 依赖图、配置与执行两阶段的区分、增量构建与构建缓存原理，以及它与 Maven 在设计哲学上的取舍。"
---

Gradle 是运行在 JVM 上的构建工具，用 Groovy/Kotlin DSL 把构建脚本变成真正的代码，用 Task 依赖图组织构建，靠增量构建与缓存获得远超 Maven 的速度。Android 官方构建系统和越来越多 Spring 项目都在用它。本文讲清它的核心机制与和 Maven 的本质差异。

<!-- more -->

## 构建脚本即代码

Maven 的 POM 是声明式 XML：你只能填配置项，表达不了的逻辑就得写插件。Gradle 换了思路——构建脚本本身就是可执行代码，官方支持两种 DSL：

```groovy
// build.gradle（Groovy DSL）
plugins {
    id 'java'
}

dependencies {
    implementation 'com.google.guava:guava:33.3.1-jre'
}
```

```kotlin
// build.gradle.kts（Kotlin DSL）
plugins {
    java
}

dependencies {
    implementation("com.google.guava:guava:33.3.1-jre")
}
```

Groovy DSL 历史久、老项目资料多；Kotlin DSL 类型安全、IDE 补全和重构支持好，是新项目的推荐选择。两者背后是同一套 API。脚本即代码的好处是构建逻辑可以用条件、循环、函数自由编排，代价是自由度太高时容易写出只有作者能看懂的"面条脚本"——这是能力也是纪律要求。

## Task 与依赖图

Task 是 Gradle 构建的最小执行单元，编译源码、跑测试、打 jar 各是一个 Task。Task 之间通过 `dependsOn` 声明依赖，Gradle 据此构造一张**有向无环图（DAG）**，执行前先做拓扑排序：

```groovy
task first {
    doLast {
        println 'first'
    }
}

task second {
    dependsOn first
    doLast {
        println 'second'
    }
}
```

一个 Task 的内部是若干按序执行的 Action，`doFirst` 往队列头插、`doLast` 往队尾追加。插件（如 `java` 插件）的本质就是一组预置 Task 与约定的封装：`compileJava`、`test`、`jar` 都不是 Gradle 内核自带的，而是插件注册的。理解这一点，"改构建流程"就变成了"改某张图上的节点与边"。

## 配置阶段 vs 执行阶段

Gradle 每次构建分三个阶段：

1. **初始化**：解析 `settings.gradle(.kts)`，确定哪些项目参与构建，为每个项目创建 Project 实例。
2. **配置**：执行各项目的 `build.gradle` 脚本——注意，是**整段脚本都执行**，包括所有 Task 配置块，目的是算出本次要跑的 Task 子集和依赖图。
3. **执行**：按图序只运行目标 Task 及其依赖。

最常见的性能坑由此而来：把昂贵操作（读文件、发网络请求）写在 Task 的配置块或脚本顶层，它会在**每次构建的配置阶段**都执行，哪怕只是跑个 `tasks` 列表。正确做法是把这些逻辑放进 `doLast` 等 Action 里，延迟到执行阶段、且仅当该 Task 真正参与构建时才运行。判断标准很简单：配置阶段的代码描述"做什么"，执行阶段的代码才真正"做"。

## 增量构建与构建缓存

这是 Gradle 性能领先的关键机制。

**增量构建**：Task 声明自己的输入（源码、配置）和输出（class 文件、jar）。执行前 Gradle 对比输入输出的快照，没变就直接标记 `UP-TO-DATE` 跳过整个 Task。改了一个文件，只重跑受影响的任务链。

**构建缓存**：更进一步，Task 的输出按输入的哈希值缓存起来，可以本地复用，也可以推送到远程缓存服务器。你切回旧分支、同事在 CI 上构建过的模块，都能直接命中缓存——第一次构建也很快。前提是 Task 的输入输出声明完整且确定：依赖了未声明的隐式输入（系统时间、环境变量），缓存键就会算错，要么缓存被击穿，要么拿到错误产物。

```bash
./gradlew build --build-cache
```

## Gradle vs Maven：约定与灵活的取舍

| 维度 | Maven | Gradle |
| --- | --- | --- |
| 构建描述 | 声明式 XML（POM） | 可执行脚本（Groovy/Kotlin DSL） |
| 核心模型 | 固定生命周期 phase | 自由组合的 Task 依赖图 |
| 扩展方式 | 写插件（门槛高） | 脚本内直接编排，也可写插件 |
| 性能 | 全量执行，无增量与缓存 | 增量构建 + 本地/远程缓存 |
| 学习曲线 | 平缓，约定优于配置 | 陡峭，灵活意味着更多决策 |
| 典型用户 | 国内 Java 后端主流 | Android 官方、Spring 系、大型多模块项目 |

一句话：Maven 用强约定换低门槛，构建长什么样基本固定；Gradle 用灵活性换表达力与性能，构建长什么样由你定义。只写 CRUD 后端，Maven 完全够用；构建流程复杂、模块多、对构建速度敏感，Gradle 的优势就出来了。

工程上两者有共同的底线：都用 Wrapper 固定工具版本——Gradle 执行 `gradle wrapper` 生成 `gradlew` 脚本与 `gradle-wrapper.properties`（记录发行版 URL 与校验值），提交后团队成员和 CI 无需预装即可用同一版本构建，日常构建一律走 `./gradlew` 而非本机 `gradle`。

## 小结

- 构建脚本是代码：Groovy DSL 兼容老项目，Kotlin DSL 类型安全，二选一背后是同一套 API。
- Task 是执行单元，插件是 Task 的封装，构建就是按依赖图跑 Task。
- 三阶段模型：初始化、配置、执行；昂贵逻辑必须放进 Action，别污染配置阶段。
- 增量构建跳过未变化的 Task，构建缓存跨机器复用产物，前提是输入输出声明完整。
- Gradle 以灵活和性能见长，Maven 以约定和低门槛见长，按项目复杂度选型；两者都该用 Wrapper 锁版本。
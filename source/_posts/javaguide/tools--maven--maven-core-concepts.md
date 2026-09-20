---
title: "Maven 核心概念总结"
date: 2020-08-28 09:17:00
updated: 2020-08-28 09:17:00
permalink: knowledge/tools/maven/maven-core-concepts/
categories:
  - 开发工具
tags:
  - 开发工具
description: "讲清 Maven 的坐标体系、传递依赖仲裁规则（最短路径与声明优先）、四种常用依赖范围、生命周期与插件的绑定关系、dependency:tree 排查冲突以及 SNAPSHOT 语义。"
---

Maven 是 Java 生态最常用的构建与依赖管理工具：用坐标唯一定位构件，用三套 classpath 区分依赖范围，用"最短路径 + 声明优先"仲裁传递依赖冲突，用生命周期阶段绑定插件目标来组织构建。本文把这五块核心机制讲透。

<!-- more -->

## Maven 解决什么问题

手写 `javac` 加一堆 jar 包参数的时代，构建脚本不可复用、依赖靠人肉拷贝。Maven 用一份 `pom.xml`（Project Object Model）集中描述项目：坐标、依赖、插件、打包方式都在其中。开发者得到三样东西：跨平台的标准化构建流程、自动化的依赖下载与冲突管理、统一的目录结构约定。日常接触的 `mvn compile`、`mvn package`，本质都是触发这套模型中的某个阶段。

## 坐标：构件的唯一标识

Maven 世界里的任何依赖、插件、构建产物都叫构件，每个构件由坐标唯一标识：

- **groupId**：隶属的组织或公司，通常按"域 + 公司名"分段，如 `org.apache`。
- **artifactId**：项目名称，如 `easyexcel`。
- **version**：版本号。
- **packaging**（可选）：打包方式，默认 `jar`。
- **classifier**（可选）：区分同一 POM 产出的不同附属构件，如 `sources`、`jdk17`。

给出正确的 groupId + artifactId + version，Maven 就能从仓库（先本地 `~/.m2/repository`，再远程中央仓库或私服）找到对应构件。找依赖坐标最常用的站点是 mvnrepository.com。

## 依赖范围：三套 classpath 的取舍

Maven 的编译、测试、运行分别使用三套 classpath，依赖范围（scope）决定一个 jar 出现在哪几套里：

- **compile**（默认）：三个阶段全部有效。绝大多数业务依赖用这个。
- **provided**：编译和测试有效，运行无效。典型场景是 `servlet-api`：Tomcat 容器运行时自带，打进去反而冲突。Lombok 也同理——编译期生成代码，运行时不需要。
- **test**：只参与测试编译与执行，如 JUnit、Mockito。
- **runtime**：测试和运行有效，编译主代码时无效。JDBC 驱动是教科书例子：代码面向 `java.sql.Driver` 接口编程，编译期不需要具体实现。

另外还有 `system`（用 `systemPath` 指向本地文件，破坏可移植性）和 `import`（导入 BOM），实际项目应尽量避免前者。选错 scope 的常见后果：该 provided 的打进了 war 包导致类冲突，该 runtime 的写成 compile 让编译期绑死了实现。

## 依赖传递与仲裁

A 依赖 B，B 依赖 C，那么 A 自动获得 C——这就是传递依赖。它带来便利，也带来冲突：两条路径可能引入同一构件的不同版本。

Maven 的仲裁（依赖调解）只有两条规则，按序生效：

1. **最短路径优先**：`A → B → C → X(1.0)` 路径长 3，`A → D → X(2.0)` 路径长 2，则选用 X(2.0)。
2. **声明顺序优先**：路径等长时，`pom.xml` 中先声明的那条依赖链获胜。

注意同一个 POM 里重复声明同 groupId + artifactId 的不同版本时，后声明的生效——这不是仲裁，只是覆盖。

仲裁结果未必是业务想要的。假设 `A → D → X(1.0)` 胜出，但 B 链路实际调用了 X(1.5) 才有的类，运行时就会抛 `NoClassDefFoundError`；如果只是用了新方法，则抛 `NoSuchMethodError`。这类报错十有八九是依赖冲突。解法是用 `exclusions` 把不想要的传递依赖排除掉：

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>d</artifactId>
    <version>1.0</version>
    <exclusions>
        <exclusion>
            <groupId>org.example</groupId>
            <artifactId>x</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

一般优先保留高版本（多数库向后兼容）；若高版本删了旧类，就该升级依赖它的上层构件，而不是硬留低版本。

## 生命周期与插件：phase 绑定 goal

Maven 内置三套相互独立的生命周期：`default`（构建，含 validate、compile、test、package、install、deploy 等 23 个阶段）、`clean`（3 个阶段）、`site`（4 个阶段）。同一生命周期内阶段有序：执行 `mvn test` 会先跑完 validate 到 test 之间的所有阶段，这就是"测试时代码自动编译"的原因；而 `mvn clean package` 是跨生命周期调用，互不影响顺序。

但阶段本身不干活——Maven 本质是个插件执行框架，真正干活的是插件的 goal（目标）。每个阶段绑定了默认插件目标，例如 `compile` 绑定 `maven-compiler-plugin:compile`，`test` 绑定 `maven-surefire-plugin:test`。我们也可以在 POM 里把某个 goal 显式挂到指定 phase 上，下面的配置让 JaCoCo 在 test 阶段生成覆盖率报告：

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.12</version>
    <executions>
        <execution>
            <id>coverage-report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

理解"生命周期定义顺序、插件提供能力"这一分层，就能解释为什么换个插件版本构建行为会变。

## 依赖冲突排查：dependency:tree

遇到 `NoClassDefFoundError` 或行为诡异时，先看依赖树：

```bash
mvn dependency:tree
# 只关注某个构件
mvn dependency:tree -Dincludes=com.google.guava:guava
# 打印冲突分析（verbose 模式会标注 omitted for conflict）
mvn dependency:tree -Dverbose
```

输出中每级缩进代表一跳传递路径，`omitted for conflict` 标注的就是被仲裁掉的版本。顺着树找到引入低版本的上层依赖，再决定用 `exclusions` 排除还是在 `dependencyManagement` 里强制锁定版本。改完务必重跑完整测试。

## SNAPSHOT 语义

版本号带 `-SNAPSHOT` 后缀的是快照版，表示仍在开发中的不稳定构建。Maven 对它的特殊处理是：每次构建都会向远程仓库检查是否有更新（由 `updatePolicy` 控制，默认 daily），同一版本号可以被反复覆盖部署；而正式版（如 `1.0.0`）一旦发布就不可变，本地缓存了就不会重新下载。

协作上的推论：联调阶段依赖别人的 SNAPSHOT 能持续拿到最新改动，但**正式发布绝不能依赖 SNAPSHOT**——构建不可重现，今天打出的包和明天的可能不是同一份字节码。release 插件也会拒绝带 SNAPSHOT 依赖的发布。

## 面试视角

**传递依赖冲突，Maven 怎么选版本？**

两条规则按序生效：先比路径长短，短的胜；等长再比 POM 中的声明顺序，先声明的胜。追问"规则选的版本不对怎么办"，答 `exclusions` 排除或 `dependencyManagement` 锁版本，并用 `dependency:tree` 验证。

**provided 和 compile 的区别？**

compile 三套 classpath 全程有效；provided 运行期无效，适用于容器已提供的 API（servlet-api）或编译期工具（Lombok）。

**生命周期和插件是什么关系？**

生命周期是抽象的阶段序列，只定义顺序；插件的 goal 才是真正执行体，通过绑定 phase 在构建中被触发。Maven 核心几乎不含构建逻辑，全是插件。

## 小结

- 坐标（groupId/artifactId/version）唯一定位构件，仓库按本地 → 远程顺序解析。
- scope 决定依赖落在编译、测试、运行哪几套 classpath，选错会引发冲突或编译失败。
- 传递依赖仲裁：最短路径优先，等长则声明优先；不满意就排除或锁版本。
- 生命周期定顺序，插件 goal 干实事，phase 绑定 goal 是扩展构建的标准方式。
- 排查冲突用 `mvn dependency:tree -Dverbose`，正式发布禁止依赖 SNAPSHOT。
---
title: "Maven 最佳实践"
date: 2020-08-18 08:10:00
updated: 2020-08-18 08:10:00
permalink: knowledge/tools/maven/maven-best-practices/
categories:
  - 开发工具
tags:
  - 开发工具
description: "Maven 工程实战规范：用 BOM 与 dependencyManagement 统一版本、多模块项目的组织方式、并行构建与镜像加速，以及最常见的一批坑。"
---

会写 `pom.xml` 不等于会用 Maven。本文聚焦工程实战：版本怎么统一管、多模块怎么组织、构建怎么提速，以及那些几乎每个团队都踩过的坑。

<!-- more -->

## 用 BOM 统一管理版本

BOM（Bill of Materials）是一个只声明依赖版本的特殊 POM，通过 `dependencyManagement` 加 `import` 作用域引入。Spring Boot、Spring Cloud 都提供官方 BOM：

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.3.4</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

导入后，BOM 覆盖范围内的依赖（如 Jackson、Netty）都不用写版本号，且各组件版本经过官方兼容性验证，省去手工拼版本的试错成本。自定义内部框架也建议发一个 BOM，让业务方一行导入。

## dependencyManagement vs dependencies

这是高频混淆点：

- `dependencies`：**真实引入**依赖，子模块会继承。
- `dependencyManagement`：只**声明版本和 scope 的默认值**，不引入任何依赖。子模块仍需显式写 `groupId + artifactId`，但可以省略 version。

```xml
<!-- 父 POM：只管版本 -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.10.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 子模块：声明使用，不写版本 -->
<dependencies>
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
    </dependency>
</dependencies>
```

配套的还有 `pluginManagement`，同样只锁插件版本不启用插件。另一个重要用途是**强制锁定传递依赖版本**：在 dependencyManagement 里声明的版本优先级高于传递仲裁结果，是修冲突的正规手段。

## 多模块项目组织

多模块项目 = 一个父 POM（packaging 为 `pom`）+ 若干子模块。父 POM 的职责收敛到三件事：声明 `<modules>`、集中管理依赖与插件版本、定义公共属性。业务依赖只在用到的模块里声明，别把父 POM 堆成大杂烩——所有子模块会被动继承 `dependencies`，无关依赖一旦写进父 POM，每个模块都会背上。

模块划分按职责边界来：Dubbo 拆出 dubbo-common、dubbo-remoting、dubbo-rpc 就是范例。划分得当的收益是降低耦合（jar 级边界比包级更难逾越）、复用性提升、构建可以按模块增量进行。

## 明确声明编译与插件版本

两件事必须显式写进 POM，不能依赖默认值：

```xml
<properties>
    <maven.compiler.release>17</maven.compiler.release>
</properties>
```

`maven.compiler.release` 对应 `javac --release`，比分开配 `source`/`target` 更可靠——它会同时约束字节码版本和可用的 JDK API，防止误用新版 API 却打着旧版 target。版本号写 `8`、`17`、`21` 这种格式，别再用 `1.8`。Maven Compiler Plugin 3.13.0 起在 JDK 8 上也能识别 `release` 并自动转换，更旧的插件才需要退回 `source`/`target`。

插件版本同理。Maven 核心插件的默认版本跟着 Maven 发行版走，换 Maven 版本构建行为就可能漂移。项目用到的每个插件（compiler、surefire、shade……）都应显式声明 version，多模块项目统一放进父 POM 的 `pluginManagement`。

## 构建加速

几个立竿见影的手段：

```bash
# 并行构建：按模块数开线程，1C 表示每核一个线程
mvn -T 1C clean install

# 只构建指定模块及其依赖（多模块项目改了一个模块时）
mvn -pl order-service -am clean install

# 跳过测试（仅限本地验证，CI 不要跳）
mvn clean install -DskipTests
```

下载慢则换镜像。在 `settings.xml` 里配置阿里云镜像替代中央仓库：

```xml
<mirror>
    <id>aliyun</id>
    <mirrorOf>central</mirrorOf>
    <name>Aliyun Maven</name>
    <url>https://maven.aliyun.com/repository/public</url>
</mirror>
```

CI 上再叠一层本地仓库缓存（GitHub Actions 的 `cache: "maven"`），避免每次全量下载。

## 常见坑

- **不指定编译版本**：依赖插件默认值，换台机器行为就变。显式配置 `maven.compiler.release`（JDK 9+ 对应 `javac --release`），Java 17 就写 `17`，别再写 `1.8` 风格的旧格式。
- **不锁插件版本**：Maven 核心插件的默认版本随 Maven 版本漂移，构建不可重现。所有用到的插件都显式写 version。
- **依赖 SNAPSHOT 上生产**：快照版每次构建可能拉到不同产物，正式发布必须全部用固定版本。
- **靠 `mvn install` 出包**：CI 里推荐 `./mvnw -B clean verify`，`install` 会污染本地仓库，只有后续步骤确实依赖本地安装结果时才用。
- **不提交 Maven Wrapper**：提交 `mvnw`、`mvnw.cmd` 和 `.mvn/wrapper/` 目录，新人和 CI 无需预装 Maven，且版本与项目声明一致。
- **Profile 滥用**：Profile 适合做环境参数开关（dev/prod），不适合制造两套完全不同的构建——那意味着你永远只测过其中一半。

## 小结

- 版本管理三板斧：官方 BOM 打底、dependencyManagement 锁版本、properties 收敛自定义版本号。
- dependencyManagement 只声明不引入，真实依赖仍需子模块显式声明。
- 多模块父 POM 保持精简，依赖按需下沉到子模块。
- 提速组合：`-T` 并行、`-pl/-am` 局部构建、镜像仓库、CI 缓存。
- 显式指定编译版本与插件版本、提交 Wrapper、生产禁用 SNAPSHOT，是构建可重现的底线。
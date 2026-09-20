---
title: "Maven 专题：POM、坐标、仓库、依赖管理、生命周期、插件与多模块项目"
date: 2020-07-22 15:49:00
updated: 2020-07-22 15:49:00
permalink: knowledge/tools/maven/overview/
categories:
  - 开发工具
tags:
  - 开发工具
description: "Maven 模块学习地图：坐标、依赖仲裁、生命周期与插件、多模块与最佳实践之间的依赖关系与推荐学习顺序。"
---

Maven 是 Java 后端项目最常见的构建与依赖管理工具。本文是 Maven 模块的学习地图：要讲哪些主题、彼此的依赖关系、按什么顺序学，以及怎么用真实项目巩固。

<!-- more -->

## 主题划分

Maven 模块的内容可以分成四组：

- **核心模型**：POM 的结构、坐标三要素（groupId/artifactId/version）、本地仓库与中央仓库、私服的解析顺序。这是一切讨论的词汇表。
- **依赖管理**：依赖范围（compile/provided/test/runtime）、传递依赖、仲裁规则、排除与版本锁定、依赖树排查。日常开发 80% 的 Maven 问题出在这里。
- **构建机制**：三套生命周期、phase 与插件 goal 的绑定关系、常用插件（compiler/surefire/shade 等）。回答"为什么执行 mvn test 代码会被自动编译"这类问题。
- **工程化**：多模块项目组织、父 POM 与 BOM、Maven Wrapper、CI 集成、构建加速。从"个人能跑"到"团队可协作可重现"的一层。

## 依赖关系

```text
核心模型（坐标/仓库）
   ├──> 依赖管理（范围/传递/仲裁/排查）
   └──> 构建机制（生命周期/插件）
            └──> 工程化（多模块/BOM/Wrapper/CI）
```

不理解坐标与仓库解析，就看不懂依赖从哪来；不理解传递与仲裁，就查不了 `NoClassDefFoundError`；不理解 phase 绑定 goal，就说不清为什么改个插件版本构建行为就变了。多模块与 BOM 则是把前两组知识放到团队尺度上的应用。

## 推荐学习顺序

1. **先读 [Maven 核心概念总结](/knowledge/tools/maven/maven-core-concepts/)**：建立坐标、依赖范围、仲裁规则、生命周期与插件的整体认知。
2. **再读 [Maven 最佳实践](/knowledge/tools/maven/maven-best-practices/)**：学 BOM、dependencyManagement、多模块、构建加速和常见坑。
3. **回到真实项目验证**：找一个 Spring Boot 多模块项目，翻它的父 POM 与子模块 POM，跑一遍 `mvn dependency:tree -Dverbose`，把被 `omitted for conflict` 的条目逐个对上人脑中的仲裁规则。

## 高频问题自测

学完后应该能流畅回答：

- Maven 解决什么问题？POM 里都有哪些信息？
- 坐标由哪些元素组成？本地仓库、私服、中央仓库的查找顺序是什么？
- compile、provided、runtime、test 各在什么场景用？
- 传递依赖冲突时 Maven 按什么规则选版本？不满意怎么办？
- dependencyManagement 和 dependencies 有什么区别？
- 生命周期和插件是什么关系？
- 为什么正式发布不能依赖 SNAPSHOT？
- 团队项目为什么建议提交 Maven Wrapper？

任何一题卡壳，就回到对应章节重读并动手验证。Maven 的知识点不背命令也能记住——前提是亲手用 `dependency:tree` 抓过一次冲突。

## 怎么巩固

最有效的练习是制造问题再解决问题：故意在一个多模块项目里引入两个版本的同一构件，观察仲裁结果，再用排除或 dependencyManagement 修正；把某个依赖的 scope 从 compile 改成 provided，观察打包产物的变化；给 POM 挂一个绑定到 test 阶段的插件 goal，体会"生命周期定顺序、插件干活"的分层。每折腾一次，概念就落地一分。最后别忘了把改动交给 CI 跑一遍完整构建，本地通过不代表环境无关，构建可重现才是终点。

## 小结

- 四组主题：核心模型、依赖管理、构建机制、工程化。
- 顺序是"概念 → 实践 → 真实项目验证"，依赖树是最好的实验工具。
- 面试高频集中在仲裁规则、scope 差异、dependencyManagement 与插件机制。
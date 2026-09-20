---
title: "开发工具知识体系：Maven、Gradle、Git、GitHub、Docker 与 IDEA"
date: 2020-07-31 16:56:00
updated: 2020-07-31 16:56:00
permalink: knowledge/tools/overview/
categories:
  - 开发工具
tags:
  - 开发工具
description: "开发工具模块学习地图：Maven、Gradle、Git、GitHub、Docker、IDEA 六组主题的分工、依赖关系与推荐学习顺序。"
---

开发工具决定团队协作的下限和交付效率的上限。本文是开发工具模块的学习地图：六组工具各自解决什么问题、学习上的依赖关系是什么、按什么顺序投入性价比最高。

<!-- more -->

## 主题分组

开发工具模块覆盖六组内容：

- **Maven**：Java 项目构建与依赖管理的事实标准。坐标、依赖仲裁、生命周期、插件、多模块与 BOM。
- **Gradle**：更灵活的构建工具。DSL 脚本、Task 依赖图、增量构建与缓存，Android 和部分 Spring 项目的标配。
- **Git**：版本控制的地基。工作区/暂存区/仓库模型、提交、分支、合并与冲突处理。
- **GitHub**：代码托管之外的协作平台。PR 流程、Actions 自动化、代码阅读与开源参与。
- **Docker**：环境一致性的解法。镜像、容器、数据卷、Compose 编排，打通开发到部署。
- **IDEA**：日常编码的主战场。快捷键、调试、重构与插件生态。

## 依赖关系

```text
Git（版本控制，一切协作的前提）
   └──> Maven（构建与依赖管理）
           ├──> Gradle（按项目需要横向补充）
           └──> Docker（构建产物的交付与运行环境）
                    └──> GitHub Actions（把构建、测试、部署串成流水线）
IDEA 贯穿全程，随时学随时受益
```

Git 是底层协议：不会分支和合并，后面的协作流程都立不住。Maven 是 Java 项目的构建主线，Gradle 是同一问题的另一种答案，可以晚点学。Docker 消费构建产物——jar 打进镜像才有意义。GitHub Actions 则把前三者编排成自动化流水线。

## 推荐学习顺序

1. **Git 先行**：读 [Git 专题](/knowledge/tools/git/git-intro/)，重点理解三个区域的模型，而不是背命令。
2. **Maven 主线**：按 [Maven 核心概念](/knowledge/tools/maven/maven-core-concepts/) → [Maven 最佳实践](/knowledge/tools/maven/maven-best-practices/) 推进，前者建认知，后者学规范。
3. **Docker 补交付**：先读 [Docker 核心概念](/knowledge/tools/docker/docker-intro/) 建立镜像/容器心智，再用 [Docker 实战](/knowledge/tools/docker/docker-in-action/) 动手。
4. **按需扩展**：构建慢或流程复杂再看 [Gradle 核心概念](/knowledge/tools/gradle/gradle-core-concepts/)；协作提效看 [GitHub 技巧](/knowledge/tools/git/github-tips/)；IDEA 教程随用随查。

## 怎么学才有效

工具类知识最大的陷阱是"看会了"。每个工具至少配一次真实操练：给项目制造一次依赖冲突再用 `dependency:tree` 解决；故意合并两个分支产生冲突再手动解开；写一个 Dockerfile 把 Spring Boot 应用跑起来；配一条 GitHub Actions 流水线自动构建测试。操作过程中卡住的地方，才是真正没学会的地方。

另一条经验：团队引入任何工具配置（Mirror、Wrapper、CI 脚本），都要保证本地与 CI 走同一入口，否则"我这能跑"会成为甩锅日常。

面试准备上，工具题很少考命令本身，考的是机制理解：Maven 依赖仲裁规则、生命周期与插件的关系、Git merge 与 rebase 的差异、容器与虚拟机的隔离原理。回答时先讲清工具解决什么问题，再给机制，最后补一个自己踩过的坑，比背定义有说服力得多。

## 小结

- 六组工具：Git 管协作，Maven/Gradle 管构建，Docker 管交付，GitHub 管平台，IDEA 管日常。
- 顺序是 Git → Maven → Docker，Gradle 与 GitHub 技巧按需补充。
- 工具能力只能靠动手获得，每个主题至少完成一次真实操练。
- 团队统一入口与版本，比个人熟练度更能决定协作效率。
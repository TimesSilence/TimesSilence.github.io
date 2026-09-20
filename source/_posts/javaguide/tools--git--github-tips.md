---
title: "GitHub 实用小技巧总结"
date: 2020-08-09 17:03:00
updated: 2020-08-09 17:03:00
permalink: knowledge/tools/git/github-tips/
categories:
  - 开发工具
tags:
  - 开发工具
description: "GitHub 实用技巧：用搜索限定符精准找代码，GitHub Actions 入门自动化，PR 协作的基本礼仪，以及按 . 打开 Web 编辑器、键盘快捷键等隐藏功能。"
---

GitHub 不只是代码托管，它还是搜索引擎、CI 平台和协作空间。本文挑四类真正高频的技巧：搜索限定符、Actions 自动化入门、PR 协作礼仪，以及一批能立刻提升效率的隐藏功能。

<!-- more -->

## 搜索技巧：用限定符精准定位

GitHub 全局搜索默认会扫出海量噪音，限定符能把结果收窄几个数量级。常用限定符：

- `language:java` — 按语言过滤。
- `stars:>1000` — 按 star 数过滤（也支持 `stars:100..500` 区间）。
- `repo:facebook/react` — 只在指定仓库内搜。
- `user:torvalds` / `org:google` — 按用户或组织过滤。
- `filename:application.yml` — 按文件名搜，找配置示例特别好用。
- `extension:md` — 按扩展名过滤。
- `path:src/main` — 限定路径。
- `in:name,description,readme` — 限定搜索范围在名称、描述或 README。

组合起来威力很大，比如找「高 star 的 Java 电商项目」：`mall in:name language:java stars:>10000`。在仓库页面按 `/` 聚焦搜索框，输入内容后选「In this repository」就只搜当前仓库——阅读开源项目源码时，这比 clone 下来本地搜还快。

## GitHub Actions 入门

Actions 是 GitHub 内置的 CI/CD：在仓库里放一个 YAML 工作流文件，事件（push、PR、定时）触发后由 GitHub 提供的运行器执行。最小可运行的例子——每次 push 跑一次 Maven 构建：

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
          cache: maven

      - name: Build with Maven
        run: mvn -B package
```

结构就三层：`on` 定义触发事件，`jobs` 定义任务（可多个并行），每个 job 里的 `steps` 按序执行。`uses` 引用社区现成动作（checkout、setup-java 是最常用的两个），`run` 直接执行 shell 命令。`cache: maven` 一行就能缓存依赖，第二次构建快很多。敏感信息（密码、Token）放仓库的 Settings → Secrets，工作流里用 `${{ secrets.MY_TOKEN }}` 引用，绝不写进 YAML。

## PR 协作礼仪

给开源项目提 PR，细节决定维护者愿不愿意理你：

1. **先开 Issue 再动手**：大改动先讨论方案，避免写完被拒。
2. **一个 PR 只做一件事**：小而专注的 PR 评审快、易合并；顺手重构请另开 PR。
3. **写清描述**：做了什么、为什么、怎么验证，附上相关 Issue 链接（`Closes #123` 合并后自动关 Issue）。
4. **保持 CI 绿**：提交前本地跑通测试和 lint，PR 红了先自查再请人看。
5. **响应评审**：用新提交回应意见（方便评审者看增量），合并时维护者可 squash；收到意见及时回复，哪怕只是说「我看看」。
6. **同步上游**：fork 项目先 `Sync fork`，或本地 `git fetch upstream` 后 rebase，减少冲突。

评审别人 PR 时同样：对代码不对人，质疑写成问题（「这里并发下会不会丢数据？」）而非断言，明显的小事用 suggestion 直接给出修改建议。

## 隐藏但好用的功能

- **按 `.` 打开 Web 编辑器**：在任何仓库页面按 `.`（或把 `github.com` 改成 `github.dev`），打开一个基于浏览器的 VS Code，改代码、提交 PR 全程不用 clone。
- **键盘快捷键**：`t` 激活文件查找器快速跳文件；`l` 跳到某行；`b` 查看文件的 blame；`?` 查看当前页全部快捷键。
- **代码跳转与引用**：查看代码时点击行号生成锚点链接，按住 Shift 选多行，贴到 Issue/PR 里就是漂亮的代码引用卡片。
- **永久链接**：按 `y` 把 URL 切到包含 commit 哈希的固定链接，避免分支更新后行号漂移。
- **Profile README**：建一个与用户名同名的仓库，里面的 README.md 会显示在个人主页，是技术简历的门面。
- **徽章（Badge）**：用 shields.io 给 README 加构建状态、版本、License 徽章，一眼传达项目健康度。
- **Trending 与 Explore**：github.com/trending 按日/周/月和语言看热门项目，是追踪技术风向的好地方。
- **Saved replies**：在设置里预存常用回复，Issue/PR 讨论时一键插入。

## 小结

- 搜索靠限定符：语言、star、仓库、文件名组合使用，仓库内搜索按 `/`。
- Actions = 事件 + 任务 + 步骤，从「push 触发构建」这个最小闭环开始。
- PR 礼仪的核心是降低维护者成本：一事一 PR、描述清晰、CI 保持绿、及时响应。
- 按 `.` 开编辑器、`t` 跳文件、`y` 固定链接，三个按键先练熟，效率立刻不同。
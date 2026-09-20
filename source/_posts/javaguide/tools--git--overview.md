---
title: "Git 专题：版本控制、分支协作、提交管理、冲突处理与 GitHub 技巧"
date: 2020-07-13 14:42:00
updated: 2020-07-13 14:42:00
permalink: knowledge/tools/git/overview/
categories:
  - 开发工具
tags:
  - 开发工具
description: "Git 学习地图：明确适合读者、学习重点与推荐顺序，串起版本控制模型、分支协作、撤销操作与 GitHub 实用技巧的核心文章与高频问题。"
---

Git 是每个开发者的基本功，但只背命令会在冲突和误操作时栽跟头。本专题用两篇主线文章打通「概念模型 → 协作平台」的链路，这篇地图说明适合谁看、重点学什么、按什么顺序学。

<!-- more -->

## 适合谁看

- 刚接触 Git 和 GitHub、想建立完整概念的初学者。
- 天天用 Git，但对工作区、暂存区、分支指针理解模糊的开发者。
- 准备面试，需要把 merge 与 rebase、reset 与 revert 讲清楚的同学。
- 想提升 GitHub 搜索效率、自动化能力和开源协作质量的读者。

## 学习重点

- Git 是分布式版本控制系统，每个克隆都是完整仓库，大部分操作离线完成。
- 三区模型：工作区、暂存区、本地仓库，外加远程仓库，是理解一切命令的地图。
- 分支的本质是指向 commit 的指针，这是 Git 轻量分支能力的根源。
- merge 保留分叉历史，rebase 整理成直线；共享提交不 rebase 是铁律。
- 撤销操作分场景：未提交用 restore，未推送用 reset，已推送用 revert，误删找 reflog。
- GitHub 层面：搜索限定符、Actions 自动化、PR 协作礼仪、隐藏快捷键。

## 建议阅读顺序

1. [Git 核心概念总结](./git-intro.md)：先建立三区模型和对象模型直觉，理解分支即指针、merge 与 rebase 的取舍、撤销操作的决策树。
2. 在本地项目完整走一遍：clone → 建分支 → 提交 → 合并 → 解决冲突 → 推送，把概念对应到命令。
3. [GitHub 实用小技巧总结](./github-tips.md)：补上搜索限定符、Actions 入门、PR 礼仪和 Web 编辑器等效率技巧。

## 核心文章

- [Git 核心概念总结](./git-intro.md)：分布式版本控制的来龙去脉、三区与对象模型、分支指针、merge vs rebase、reset/revert/checkout 辨析与撤销决策树。
- [GitHub 实用小技巧总结](./github-tips.md)：搜索限定符、GitHub Actions 入门、PR 协作礼仪、按 `.` 开 Web 编辑器等隐藏功能。

## 高频问题

- Git 和 SVN 的核心区别是什么？
- 为什么说 Git 是分布式的？
- 工作区、暂存区、本地仓库、远程仓库分别是什么？
- `git add`、`git commit`、`git push` 各做了什么？
- 为什么 Git 创建和切换分支那么快？
- merge 和 rebase 怎么选？什么情况下绝不能 rebase？
- 提交错了怎么撤销？推送了又怎么撤销？
- 发生冲突时的处理流程是什么？
- GitHub 搜索有哪些常用限定符？Actions 能做什么？

## 相关专题

- [Docker 专题](../docker/overview/)
- [开发工具知识体系](../)
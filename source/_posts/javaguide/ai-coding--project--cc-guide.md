---
title: "在 IDEA 中使用 Claude Code 和 Codex：CC GUI 上手指南"
date: 2026-07-30 08:00:00
updated: 2026-07-30 08:00:00
permalink: knowledge/ai-coding/project/cc-guide/
categories:
  - AI 编程
tags:
  - IDEA
  - CC GUI
  - Codex
description: "JetBrains 插件 CC GUI 接入 Claude Code 与 Codex 的安装与 diff 工作流。"
---

CC GUI 把终端 Agent 带回编辑器 diff 体验，适合 Java 栈不想离开 IDEA 的团队。

<!-- more -->

## 适用场景

IntelliJ 主力开发；已用 Claude Code/Codex CLI 但想要图形 diff、项目树上下文；需 MCP 在 IDE 内配置。

## 方法与要点

插件安装后配置 CLI 路径与认证。Agent 面板发指令，变更以 patch/diff 展示，逐块 accept。与纯 CLI 共享 CLAUDE.md/AGENTS.md。MCP 在 IDE 设置中增删。注意插件版本与 CLI 版本兼容矩阵。

## 工作流

IDE 开 feature 分支 → GUI 触发 agent → 局部 accept → 运行 IDEA 测试 → commit。复杂重构仍可用外部 CLI worktree，IDE 只做审查合并。

## 风险

部分 CLI 新 flag 插件未跟进；大块 accept 审查不足；IDE 索引未完成导致 Agent 读错文件。

## 检查清单

- [ ] CLI 与插件版本匹配文档
- [ ] 认证 token 安全存储
- [ ] diff accept 粒度保持小
- [ ] MCP 权限最小化
- [ ] 回退纯终端路径可用

## 落地建议

把「在 IDEA 中使用 Claude Code 和 Codex」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
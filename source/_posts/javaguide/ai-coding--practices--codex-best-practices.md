---
title: "Codex 使用指南：配置、AGENTS.md 与 Agentic 工作流"
date: 2026-05-18 14:22:00
updated: 2026-05-18 14:22:00
permalink: knowledge/ai-coding/practices/codex-best-practices/
categories:
  - AI 编程
tags:
  - Codex
  - AGENTS.md
  - OpenAI
description: "OpenAI Codex CLI 的任务描述、AGENTS.md 与 agentic 流水线实践。"
---

Codex 强调计划阶段与 AGENTS.md 跨工具规则，适合已有 OpenAI 栈的团队。

<!-- more -->

## 适用场景

采用 OpenAI Codex CLI/IDE 扩展；需要与 Cursor、Jules 等共用 AGENTS.md 指令。

## 方法与要点

任务描述含目标、约束、验证命令，避免一句话需求。config.toml 管模型、沙箱、审批。AGENTS.md 指向 docs/ 深链，入口保持短。Subagents、Hooks、Scheduled Tasks 与 Claude 生态类似，命名不同。计划阶段输出步骤清单再执行。

## 工作流

写 AGENTS.md → 本地 codex 计划 → 人批计划 → 执行 → sandbox 测试 → PR。Scheduled 适合依赖升级扫描。Skills 目录按需加载领域知识。

## 风险

沙箱过宽访问 secrets；计划未审直接执行；AGENTS.md 与 CLAUDE.md 漂移。

## 检查清单

- [ ] AGENTS.md 行数可控
- [ ] 验证命令在 task 中显式
- [ ] 沙箱网络策略明确
- [ ] 计划/执行日志留存
- [ ] 多工具规则单一来源

## 落地建议

把「Codex 使用指南」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
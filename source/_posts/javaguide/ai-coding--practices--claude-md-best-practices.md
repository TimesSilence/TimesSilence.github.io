---
title: "CLAUDE.md 最佳实践：该写什么、不该写什么、项目变大后怎么拆"
date: 2026-04-19 09:47:00
updated: 2026-04-19 09:47:00
permalink: knowledge/ai-coding/practices/claude-md-best-practices/
categories:
  - AI 编程
tags:
  - CLAUDE.md
  - Claude Code
  - 规范
description: "项目级 AI 规则文件应写什么、如何与 AGENTS.md 和 .claude/rules 协同。"
---

CLAUDE.md 是持久指令而非第二份 README，应只保留「删掉就会犯错」的信息。

<!-- more -->

## 适用场景

Claude Code 反复猜错启动命令、包管理器或目录禁忌； monorepo 变大后根规则文件膨胀。

## 方法与要点

写入：技术栈版本、必跑检查、不可改目录、API 错误格式、已知坑。不写：长篇教程、Marketing、重复 README。与 AGENTS.md 可 `@import` 复用；目录级规则放 `.claude/rules/` 并用 paths 限域。Spec 管当次任务，CLAUDE.md 管长期行为。

## 工作流

新规则 PR 评审问「删掉是否增错率」；季度清理过期命令；子包 CLAUDE.md 随目录按需加载。大项目拆：根文件 ≤200 行 + 链接 docs/ 深文档。

## 风险

规则堆叠挤占上下文；paths 配错导致规则未加载；与 Spec 混淆使需求漂移。

## 检查清单

- [ ] 每条规则有「删了会怎样」理由
- [ ] 全局/路径规则分工清晰
- [ ] 与 AGENTS.md 不重复维护
- [ ] `/context` 查看实际加载
- [ ] 变更有 owner 与 review

## 落地建议

把「CLAUDE.md 最佳实践」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
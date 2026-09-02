---
title: "Claude Code 核心命令详解：code-review、loop、goal、batch、run、verify"
date: 2026-05-01 11:01:00
updated: 2026-05-01 11:01:00
permalink: knowledge/ai-coding/practices/claudecode-commands/
categories:
  - AI 编程
tags:
  - Claude Code
  - 命令
  - 自动化
description: "Claude Code 内置斜杠命令在审查、循环任务与批量执行中的用法。"
---

斜杠命令把重复工作流固化，比纯自然语言更稳定、可审计。

<!-- more -->

## 适用场景

需要标准化代码审查、周期性检查、批量重构或「直到条件满足为止」的自动化循环。

## 方法与要点

`/code-review` 偏正确性；`/simplify` 偏清理（非 bug  hunt）。`/loop` 按时间重复 prompt；`/goal` 按完成条件停止。`/batch` 多文件同质操作；`/run` 执行脚本；`/verify` 对接测试。自定义命令放 `.claude/commands` 与团队共享。

## 工作流

审查：改完 → `/verify` → `/code-review` → 人合并。夜间 `/loop` 跑 lint 修复需配上限轮次。Goal 型任务写清可观测完成条件（测试绿、覆盖率、issue 关闭）。

## 风险

Loop 无上限烧 token；simplify 改变行为语义；batch 误伤生成文件。Review 命令替代人工安全审计。

## 检查清单

- [ ] 循环有 max iterations/timeout
- [ ] Goal 条件可机器判定
- [ ] Batch 范围有 glob 白名单
- [ ] 审查仍有人类签核
- [ ] 命令版本在 CLAUDE.md 注明

## 落地建议

把「Claude Code 核心命令详解」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
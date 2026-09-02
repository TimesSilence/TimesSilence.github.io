---
title: "Spec Coding 规范驱动编程实战：从 Vibe Coding 到 AI 代码规范"
date: 2026-06-25 11:11:00
updated: 2026-06-25 11:11:00
permalink: knowledge/ai-coding/practices/spec-coding/
categories:
  - AI 编程
tags:
  - Spec Coding
  - Vibe Coding
  - 规范
description: "用 Spec 驱动 AI 实现：需求边界、设计与验收的标准化流水线。"
---

Spec Coding 把「做什么、怎么验」写在前，降低 Vibe Coding 的漂移与返工。

<!-- more -->

## 适用场景

AI 实现频繁偏离需求；多人协作需要统一需求 artefact；要把 Agent 工作纳入审计友好流程。

## 方法与要点

阶段常见为 Specify→Design→Implement→Test，文件可能是 requirements/design/tasks。Spec 写边界、非目标、验收用例。Vibe 适合探索性 spike，Spec 适合交付。权限三色：只读/提议/可写目录。多 Agent 时 Spec 是单一真相源。

## 工作流

Issue → 生成 Spec PR → 人审 → Agent 实现分支 → 测试对齐 Spec 条目 → 勾选 acceptance。Spec 变更走 amendment PR，禁止 silent drift。

## 风险

Spec 过细拖慢；过粗无法验收；多 Agent 各读不同版本 Spec；Spec 与代码双轨不同步。

## 检查清单

- [ ] 每条需求有可测 acceptance
- [ ] Spec 版本与实现 commit 关联
- [ ] 非目标显式列出
- [ ] Agent 权限与 Spec 范围一致
- [ ] Retro 统计 Spec 变更次数

## 落地建议

把「Spec Coding 规范驱动编程实战」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
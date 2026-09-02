---
title: "强模型时代，AI 编程 Skills 还有必要装吗？"
date: 2026-06-20 10:04:00
updated: 2026-06-20 10:04:00
permalink: knowledge/ai-coding/practices/skill-selection-and-pruning/
categories:
  - AI 编程
tags:
  - Skills
  - 上下文
  - 精简
description: "强模型下哪些 Skill 可删、哪些流程 Skill 仍值得保留。"
---

模型变强后，简单提示类 Skill 贬值；流程约束与团队规范类 Skill 仍值钱。

<!-- more -->

## 适用场景

升级旗舰模型后感觉 Skills 边际下降；上下文被大量 Skill 描述占满；需要定期 pruning。

## 方法与要点

可删：与模型内置能力重复的「如何写 for 循环」类。保留：团队合规步骤、发布 checklist、领域框架约束。grilling 等在弱模型更有用，强模型可改为轻量 Spec。测量：对比启用/禁用 Skill 的任务成功率与 token。

## 工作流

每季度 Skill audit → 标记 30 天未触发 → 归档 → 保留核心 5-8 个 → 新项目从最小集开始再加。

## 风险

误删合规 Skill 导致发布事故；以为模型万能跳过 TDD；pruning 无数据凭感觉。

## 检查清单

- [ ] 有 Skill 使用遥测或手工 log
- [ ] 合规/安全类永不自动删
- [ ] pruning 后跑回归任务集
- [ ] 文档说明「默认最小集」
- [ ] 新人 onboarding 不复制老人全量安装

## 落地建议

把「强模型时代，AI 编程 Skills 还有必要装吗？」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
---
title: "Vibe Coding 实用技巧总结：Git、Spec、上下文管理与多 Agent 协作"
date: 2026-06-30 12:18:00
updated: 2026-06-30 12:18:00
permalink: knowledge/ai-coding/practices/the-cool-tricks-for-vibe-coding/
categories:
  - AI 编程
tags:
  - Vibe Coding
  - Git
  - 多 Agent
description: "让 Vibe Coding 可控的技巧：Git 粒度、Spec 范围、上下文与多 Agent 分工。"
---

Vibe 不是不审查，而是用轻量约束让即兴探索仍可回滚、可合并。

<!-- more -->

## 适用场景

快速原型、个人项目或探索性分支；想在保持「对话式」体验的同时避免不可恢复的混乱。

## 方法与要点

Git：频繁 commit、分支专用于 agent、禁止直接在 main vibe。Spec 轻量版只写 5 条 acceptance。上下文：相关文件 @ 引用，避免整库。多 Agent：读/写分离，写者单线程。多模型：贵模型规划，便宜模型填坑。

## 工作流

`git switch -c vibe/foo` → 小 Spec → 对话迭代 → 每绿测试 commit → squash 前人工读 diff → PR。结束删分支或 promote 为正式 Spec 流程。

## 风险

在 main 上 vibe；commit 消息无意义无法 bisect；多 Agent 互踩；完全不写 Spec 无法交接。

## 检查清单

- [ ] 专用分支且 CI 仍运行
- [ ] 至少 3 条书面 acceptance
- [ ] 合并前完整 diff review
- [ ] 实验性依赖未进 lockfile 污染
- [ ] 弃用分支可安全删除

## 落地建议

把「Vibe Coding 实用技巧总结」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
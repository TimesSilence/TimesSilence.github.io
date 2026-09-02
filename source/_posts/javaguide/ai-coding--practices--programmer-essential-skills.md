---
title: "AI 编程 Skills 选型清单：需求澄清、TDD、代码审查与 UI 设计"
date: 2026-06-15 09:57:00
updated: 2026-06-15 09:57:00
permalink: knowledge/ai-coding/practices/programmer-essential-skills/
categories:
  - AI 编程
tags:
  - Skills
  - TDD
  - Superpowers
description: "按场景选型 Skills：澄清需求、测试驱动、审查与设计类能力组合。"
---

Skills 应按工程环节补缺，而非堆砌名称吓退上下文预算。

<!-- more -->

## 适用场景

团队安装过多社区 Skills 不知取舍；希望在需求、TDD、Review、UI、DB 等环节有默认组合。

## 方法与要点

映射表：需求模糊 → 澄清类；新功能 → TDD/测试生成；合并前 → review；前端 → UI/ a11y；SQL 密集 → postgres 优化类。Superpowers 等套件提供流水线但需裁剪。只启用当前 sprint 相关 Skills。

## 工作流

Sprint 开始定「Skill 包」→ 写入 CLAUDE.md 链接 → 任务卡引用 → Retro 统计触发率与失败率 → 下迭代增减。

## 风险

Skills 重复功能浪费 token；TDD Skill 生成脆弱测试；UI Skill 与设计师系统冲突。

## 检查清单

- [ ] 每 Skill 有 owner 与禁用条件
- [ ] 与 CI 测试非重复
- [ ] 安装列表 ≤10 活跃
- [ ] 新 Skill 试点一条真实任务
- [ ] 文档记录组合顺序

## 落地建议

把「AI 编程 Skills 选型清单」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
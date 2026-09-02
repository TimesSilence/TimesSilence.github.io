---
title: "mattpocock/skills：我最推荐的 4 个 AI 编程 Skill"
date: 2026-06-04 17:43:00
updated: 2026-06-04 17:43:00
permalink: knowledge/ai-coding/practices/mattpocock-skills/
categories:
  - AI 编程
tags:
  - Skills
  - 代码审查
  - 调试
description: "grilling、research、diagnosing-bugs、code-review 四类 Skill 的适用场景。"
---

精选 Skill 解决 Agent 常见失败点：需求含糊、调研浅、调试乱猜、审查走过场。

<!-- more -->

## 适用场景

Agent 常「理解错需求就开写」；bug 修复靠猜；code review 只报风格问题。

## 方法与要点

grilling：强制澄清问答再实现。research：结构化调研与引用。diagnosing-bugs：假设-实验-证据链。code-review：按严重级别报 security/correctness。按需安装，勿全量塞入上下文。

## 工作流

新功能先 `/grilling` 或等价 Skill → research 第三方 API → 实现 → diagnosing 若失败 → review 前自检。与 TDD Skill 串联。

## 风险

grilling 过度拖慢简单任务；research 不验证来源；review Skill 替代安全扫描工具。

## 检查清单

- [ ] Skill 与任务类型映射表
- [ ] 澄清结论写入 Spec/issue
- [ ] bug 会话保留 repro 命令
- [ ] review 输出有 blocker 分级
- [ ] 定期卸载未用 Skill

## 落地建议

把「mattpocock/skills」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
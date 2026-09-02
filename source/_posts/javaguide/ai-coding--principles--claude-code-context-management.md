---
title: "Claude Code 上下文管理详解：窗口预算、压缩与长任务治理"
date: 2026-07-05 13:25:00
updated: 2026-07-05 13:25:00
permalink: knowledge/ai-coding/principles/claude-code-context-management/
categories:
  - AI 编程
tags:
  - 上下文
  - Claude Code
  - AutoCompact
description: "上下文窗口预算、压缩、子代理隔离与长任务 handoff 策略。"
---

长任务失败多因上下文腐烂而非模型能力，需主动治理窗口与工具输出。

<!-- more -->

## 适用场景

单会话跨天改大型仓库；工具输出爆炸（测试日志、grep 海量）；感觉 Agent「忘记早期约束」。

## 方法与要点

窗口 = 系统+规则+工具结果+对话。Context rot：越早信息被挤掉。AutoCompact/`/compact` 摘要历史；清理巨大工具输出；Sub-agent 隔离探索；handoff 文件传递状态。Reset 前导出未决清单。

## 工作流

任务切分 milestone → 每 milestone 新会话或 compact → 工具输出写磁盘只留摘要 → 子代理读库主会话收结论 → 结束写 HANDOFF.md。

## 风险

过度 compact 丢细节；子代理结论未验证；把日志全贴进聊天。窗口满后 silent 违规。

## 检查清单

- [ ] `/context` 定期查看占用
- [ ] 大输出落盘+指针
- [ ] handoff 模板固定字段
- [ ] 子代理只读/写 scope 清晰
- [ ] 长任务有 milestone 定义

## 落地建议

把「Claude Code 上下文管理详解」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
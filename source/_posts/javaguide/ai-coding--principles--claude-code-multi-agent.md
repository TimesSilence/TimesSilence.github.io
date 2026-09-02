---
title: "Claude Code Multi-Agent 机制详解：Subagent、Subtask、Fork 与 Agent Teams"
date: 2026-07-25 17:53:00
updated: 2026-07-25 17:53:00
permalink: knowledge/ai-coding/principles/claude-code-multi-agent/
categories:
  - AI 编程
tags:
  - Multi-Agent
  - Subagent
  - Claude Code
description: "Subagent、Fork、Agent Teams 的任务拆分、上下文隔离与协作模式。"
---

多 Agent 的价值是并行与隔离，代价是协调成本，需匹配任务可分解性。

<!-- more -->

## 适用场景

大 repo 探索与实现可并行；审查与实现需角色分离；长调研不污染主会话上下文。

## 方法与要点

Subagent：短生命周期 worker，结果摘要回传。Subtask：结构化子目标。Fork：分支会话实验。Agent Teams：点对点协作，需防写冲突。权限：子代理 often 只读或限目录。主 Agent 负责合并与验收。

## 工作流

主会话写 plan → spawn 读-only 子代理调研 → 实现子代理按文件域划分 → 主会话 merge diff → 单测门禁。Team 模式仅用于明确接口的任务卡。

## 风险

子代理重复劳动；结论矛盾未解决就合并；token 成本线性增；并行写同一模块。

## 检查清单

- [ ] 子任务输入/输出 schema 清晰
- [ ] 写 scope 互斥
- [ ] 主 Agent 验证子 Agent 产出
- [ ] 成本预算（子调用次数）
- [ ] 失败子任务可重试隔离

## 落地建议

把「Claude Code Multi-Agent 机制详解」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
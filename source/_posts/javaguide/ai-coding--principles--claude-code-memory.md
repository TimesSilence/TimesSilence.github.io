---
title: "Claude Code 记忆系统详解：Markdown、Auto Memory 与向量检索怎么选"
date: 2026-07-16 15:39:00
updated: 2026-07-16 15:39:00
permalink: knowledge/ai-coding/principles/claude-code-memory/
categories:
  - AI 编程
tags:
  - Memory
  - Claude Code
  - 向量检索
description: "CLAUDE.md、Auto Memory 与第三方记忆插件的分工与选型。"
---

LLM 不持久记忆，跨会话知识必须外置且可治理，避免「记错」比「忘记」更糟。

<!-- more -->

## 适用场景

多会话重复解释同一架构；希望 Agent 记住团队偏好；评估 claude-mem、memsearch 等插件。

## 方法与要点

Markdown 规则：确定性、可 review。Auto Memory：Agent 提议写入，人应 periodic 清理。向量检索：适合大文档库，需防幻觉引用。Subagent/Team 各有 memory scope。敏感信息永不进 memory。

## 工作流

稳定事实 → CLAUDE.md；会话洞察 → Auto Memory 候选 → weekly review 合并或删。RAG 插件索引 docs/ 子集，query 带 citation 要求。

## 风险

Memory 写入错误约定永久化；向量库召回无关片段；跨项目 memory 泄漏。GDPR/密钥进 memory。

## 检查清单

- [ ] Memory 变更有人 review
- [ ] 季度 audit 过期条目
- [ ] RAG 有来源引用要求
- [ ] 秘密分级禁止写入
- [ ] `/memory` 查看实际内容

## 落地建议

把「Claude Code 记忆系统详解」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
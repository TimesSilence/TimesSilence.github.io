---
title: "AI Agent 核心概念：Agent Loop、Plan-and-Execute、A2A、Agentic Workflows、Tools 注册"
date: 2025-10-09 14:52:00
updated: 2025-10-09 14:52:00
permalink: knowledge/ai/agent/agent-basis/
categories:
  - 人工智能
tags:
  - Agent
  - ReAct
  - Workflow
  - Function Calling
description: "AI Agent 核心概念：演进历程、Agent Loop、工具注册与 Workflow 选型。"
---

理解 Agent 首先要分清：谁决定下一步——程序员、流程图，还是模型。

<!-- more -->

## 概念辨析

传统编程路径固定；Workflow 用 DAG 约束分支；Agent 由模型根据 Observation 动态选动作。订单扣库存适合代码；「排查服务变慢」适合 Agent——中间证据决定下一步查监控还是日志。

## Agent Loop 机制

每轮：LLM 读上下文 → 输出工具调用或最终答案 → 执行工具 → 结果写回上下文。ReAct 显式交替推理与行动。Plan-and-Execute 先规划再逐步执行，适合步骤多但子任务可拆的场景。

## 工程落地

最少三层：工具层（Schema + 鉴权）、编排层（Loop/停止条件）、观测层（日志/Trace）。Tools 注册遵循 name/description/parameters JSON Schema；执行结果必须回灌上下文。

## 风险与误区

长上下文不等于更好——中间信息利用率低、成本飙升。工具不能消灭幻觉，只能约束行动边界。多 Agent 之前先做单 Agent 闭环与评测。

## 延伸思考

实现 Agent Loop 时，建议为每轮保留结构化事件：intent、tool_name、arguments、observation、token_usage。这样 Badcase 可以定位是「选错工具」还是「参数 hallucination」。与 Workflow 混合时，固定步骤用 DAG 节点，不确定步骤嵌入 Agent 子图，并设置 max_iterations。A2A（Agent-to-Agent）协议适合跨系统委派，但仍需统一任务契约与超时，否则排障困难。

## 实践小结

练习：实现三工具 Agent（查配置、查日志、发通知），限制 max_steps=8，记录每步 token。故意注入错误 Observation，观察模型是否纠错。对比纯 Workflow 实现同一任务的代码量、延迟与可维护性，形成选型依据。

## 工程检查清单

检查清单：是否区分 Agent/Workflow/脚本；max_iterations 是否配置；工具执行是否 audit；Plan-and-Execute 规划结果是否可持久化；错误 Observation 是否导致死循环；A2A 调用是否设超时与 idempotency。上线前用对抗样本测「工具参数乱填」「重复调用同一 tool」两类情况。

## 读者 takeaway

读者 takeaway：Agent 不是魔法自动化，而是「模型决策 + 工程约束」。选型时先问路径是否可枚举；不可枚举再用 Agent，并立即补上 Trace 与步数上限。

## 学习建议
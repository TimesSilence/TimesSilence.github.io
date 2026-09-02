---
title: "AI Agent 专题：Agent Loop、Memory、Prompt、Context、MCP 与 Skills"
date: 2025-09-28 13:45:00
updated: 2025-09-28 13:45:00
permalink: knowledge/ai/agent/overview/
categories:
  - 人工智能
tags:
  - Agent
  - MCP
  - Prompt
  - Memory
description: "AI Agent 专题导读：Loop、记忆、上下文工程、MCP 与 Skills 的学习重点与阅读顺序。"
---

Agent 专题解决「模型如何持续感知环境并执行动作」这一核心问题。

<!-- more -->

## 核心概念

Agent = 推理模型 + 规划 + 记忆 + 工具。与聊天机器人的差别在于闭环：每轮读取 Observation，再决定 Action，直到满足停止条件。Workflow 预定义路径；Agent 在部分步骤动态决策。

## 工作机制

Agent Loop：Thought → Action → Observation 循环。Memory 分短期（上下文窗口）与长期（向量库/结构化存储）。Context Engineering 管理每轮输入什么；Harness 提供可执行、可观测的运行壳。

## 工程实践

入门路径：Agent 基础 → Prompt/Context → MCP/Skills → 多 Agent → Workflow/Graph/Loop。工具注册用 JSON Schema；高危操作人工确认；长任务做 checkpoint 与上下文压缩。

## 评估与安全

用 Trace 还原每步工具调用；评测覆盖「工具选对了吗、参数对吗、是否越权」。误区：以为 Function Calling 等于 Agent；忽视 Memory 污染导致偏题。

## 延伸思考

阅读 Agent 专题时，始终带着「一次请求的生命周期」问题：入口参数如何变成上下文？工具结果如何回写？停止条件谁负责？Memory 与 RAG 各管哪段信息？把 MCP 当成工具总线、把 Skills 当成 SOP 包、把 Harness 当成运行时，三者不要混在一个 Prompt 里。面试与项目沟通时，用 Trace 截图比概念定义更有说服力。

## 实践小结

练习：选一个内部 FAQ 场景，用最小 Agent（一个检索工具 + 一个 HTTP 工具）跑通 Loop，并导出 Trace。对照专题检查 Memory 是否必要、MCP 是否过度设计。能讲清「为什么此处用 Agent 而非固定脚本」，说明 Agent 专题已入门。

## 工程检查清单

检查清单：Loop 停止条件是否明确；工具 Schema 是否完整；Observation 是否必回灌；Memory 与 RAG 边界是否文档化；MCP Server 是否最小权限；Skills 是否有触发评测；Trace 是否可按 step 回放。Agent 专题读完应能独立设计一条可观测的最小闭环，而非仅列举框架名词。

## 读者 takeaway

读者 takeaway：Agent 的价值在闭环与治理。读完专题应能画出 Loop、标注工具边界，并说明为何不用纯 Workflow——这是后端工程师转 AI 应用的关键分水岭。

## 学习建议
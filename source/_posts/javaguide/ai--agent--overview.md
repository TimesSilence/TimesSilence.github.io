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
description: "Agent 模块学习地图：Loop、Prompt/Context、Memory、MCP/Skills、多 Agent 与工程化的依赖关系与推荐学习顺序。"
---

Agent 专题的主线是"模型如何在循环中感知环境、调用工具、持续逼近目标"。这份地图把 Loop、Memory、Prompt/Context、MCP、Skills、多 Agent 与工程化串成一条学习路径。

<!-- more -->

## 模块主线

Agent 不是"会调工具的聊天机器人"，差距在闭环：每轮读取观察结果，再决定下一步动作，直到满足停止条件。围绕这条闭环，专题内容分四组：

- **基础概念**：Agent Loop、Agent 与 Workflow、Chatbot 的边界、工具调用机制。
- **喂给模型什么**：Prompt 工程管指令表达，上下文工程管在正确时机放进正确信息，Memory 管跨轮与跨任务的信息留存。
- **接入真实世界**：MCP 是工具总线，Skills 是可复用的操作手册，二者决定 Agent 能稳定触达多少真实系统。
- **走向生产**：多 Agent 解决分工与并行，Workflow/Graph/Loop 管住编排，Harness 与 Loop 工程管住执行环境、终止与恢复。

## 依赖关系

```text
Agent 基础（Loop / 工具调用）
   ├──> Prompt / Context / Memory（决定每轮输入质量）
   ├──> MCP / Skills（决定工具与能力边界）
   └──> 多 Agent / Workflow-Graph-Loop / Harness / Loop 工程（生产化）
```

Prompt 与上下文工程是后续一切的地基：上下文里放什么、工具结果怎么回写，直接决定 Loop 每轮的质量。MCP 与 Skills 解决"接得上"；多 Agent 与编排解决"拆得开"；Harness 与 Loop 工程解决"跑得稳"。

## 推荐学习顺序

1. 先读 [Agent 核心概念](/knowledge/ai/agent/agent-basis/)，建立整体认知。
2. 再读 [Prompt 工程](/knowledge/ai/agent/prompt-engineering/) 与 [上下文工程](/knowledge/ai/agent/context-engineering/)，理解指令与上下文如何共同塑造输出。
3. 读 [Agent 记忆系统](/knowledge/ai/agent/agent-memory/)，分清短期与长期记忆的边界。
4. 读 [MCP 协议](/knowledge/ai/agent/mcp/) 与 [Agent Skills](/knowledge/ai/agent/skills/)，掌握工具接入与能力封装。
5. 最后进入工程化四篇：[多 Agent 协作](/knowledge/ai/agent/multi-agent/)、[Workflow/Graph/Loop](/knowledge/ai/agent/workflow-graph-loop/)、[Harness 工程](/knowledge/ai/agent/harness-engineering/)、[Loop 工程](/knowledge/ai/agent/loop-engineering/)。

## 常见误区

- **以为 Function Calling 就是 Agent**：单次工具调用没有闭环，Agent 的核心是多轮观察与决策。
- **迷信框架名词**：读过一堆框架文档，却讲不清自己系统的停止条件与状态边界。
- **Memory 无边界**：什么都往长期记忆里塞，旧偏好污染新任务，越用越偏。
- **高危操作裸奔**：删除、发送、付款类工具没有人工确认与权限分级，事故只是时间问题。

## 适合谁读

正在做工具调用、自动化任务、多轮推理或长任务执行的工程师；准备 Agent、MCP、上下文工程相关面试的同学；以及想判断"我的场景到底要不要上 Agent"的技术负责人——最后一类人建议先读工程化四篇，很多需求用固定 Workflow 就能解决。

## 学完怎么检验

动手搭一个最小闭环：一个检索工具加一个 HTTP 工具，跑通 Loop 并导出 Trace，能说清"为什么这里用 Agent 而不是固定脚本"。再对照检查表自测：停止条件是否明确、工具 Schema 是否完整、观察结果是否必回灌、高危操作是否有人工确认、Trace 能否按步回放。能独立设计一条可观测的最小闭环，这个专题才算入门。

## 小结

- 主线是闭环：观察 → 决策 → 行动 → 反馈，其余概念都为这条链服务。
- 顺序：基础 → 上下文三件套 → MCP/Skills → 编排与工程化。
- 检验标准是做出可观测的最小闭环，而非罗列框架名词。
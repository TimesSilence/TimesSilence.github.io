---
title: "AI 工作流中的 Workflow、Graph 与 Loop：从概念到实现"
date: 2025-12-13 11:41:00
updated: 2025-12-13 11:41:00
permalink: knowledge/ai/agent/workflow-graph-loop/
categories:
  - 人工智能
tags:
  - Workflow
  - Graph
  - Loop
  - Agent
description: "AI 工作流：Workflow、Graph 与 Loop 的概念关系及选型。"
---

AI 工作流要在「可控」与「灵活」之间取平衡——Graph 定骨架，Loop 允许回溯。

<!-- more -->

## 概念关系

Workflow 是业务步骤序列；Graph 用节点与边表达分支与并行；Loop 是 Graph 上的回边，支持重试、反思、人工补料。传统 BPM 路径确定；AI Workflow 节点内可能是 LLM 或 Agent。

## AI 工作流特点

节点输入输出不确定；需 guardrail 与 fallback；Human-in-the-loop 常见。Graph 适合审批、ETL+生成混合；自由 Agent 适合探索型任务。

## 实现要点

状态机持久化；边条件可结合模型分类器或规则；Loop 上限防死循环。LangGraph 等框架本质是 Graph + Checkpoint。

## 误区

一切上 Graph 导致僵化；Loop 无退出条件；Graph 节点过大难以观测。

## 延伸思考

选型时可问：步骤是否可预先枚举？失败是否需要回到上游重试？是否需要人工审批节点？若三者多为是，用 Graph+Loop；若任务高度开放，用 Agent Loop 包在少数 Graph 节点内。实现上，Checkpoint 保存图状态与上下文快照，支持 pause/resume。观测上，每个节点独立 Span，便于看瓶颈在 LLM 还是在工具 IO。避免「巨型节点」内含十几次隐式 Loop，那样 Graph 只剩装饰。

## 实践小结

练习：用 Graph 实现「生成→审查→（不通过则回退修改）」三节点，限制 Loop 两次。对比纯 Agent 自由改写方案的可观测性与稳定性。为每个节点定义输入输出 schema，便于单测。

## 工程检查清单

检查清单：节点 I/O schema；Graph checkpoint；Loop 次数上限；Human 节点 SLA；节点级 Span；与 Agent 子图边界。Workflow 适合可枚举流程，Loop 需防无限；二者组合时避免「Graph 名义上存在、实际上单节点 Agent 黑盒」。

## 读者 takeaway

读者 takeaway：Graph 给可控，Loop 给回溯，Agent 给弹性。三者组合的关键是边界：哪些节点确定性、哪些节点允许模型决策，必须在架构图上一眼可见。

## 学习建议
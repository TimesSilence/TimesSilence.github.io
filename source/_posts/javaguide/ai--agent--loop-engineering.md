---
title: "Loop Engineering 是什么？为什么说它是新瓶装旧酒？"
date: 2025-11-08 17:13:00
updated: 2025-11-08 17:13:00
permalink: knowledge/ai/agent/loop-engineering/
categories:
  - 人工智能
tags:
  - Loop
  - ReAct
  - Workflow
  - Agent
description: "Loop Engineering：内层 Agent Loop 与外层 Workflow/Graph 的关系及工程化。"
---

Loop 不是新概念，而是把 ReAct、工作流回边、Harness 统一到可维护结构。

<!-- more -->

## 两层循环

内层 Agent Loop：单轮推理-行动-观察。外层 Loop Engineering：任务级 retry、反思、人工审批、子目标重规划。Workflow/Graph 提供可控回边；纯自由 Agent 易死循环。

## 与相关概念

ReAct 是内层模式；Context Engineering 决定每圈输入；Skills 沉淀重复流程；MCP 接工具；Harness 包住执行环境。所谓「新瓶装旧酒」指编排思想来自状态机与 DAG，只是 LLM 充当转移函数。

## 落地建议

明确停止条件（max steps、工具无进展、置信度）；死循环检测；关键节点允许 Graph 强制跳转。Skills 减少每轮重复解释 SOP。

## 误区

无限 Loop 烧 Token；无外层 Loop 导致单 Agent 承担产品级流程；把 Loop 与多 Agent 混为一谈。

## 延伸思考

外层 Loop 可承载：失败后换策略、调用 critic 模型审查、触发人工补资料、或降级为纯 RAG 问答。内层 Loop 则要严格限制工具集合与步数。Workflow 引擎里的「回边」与 Agent 的「再试一次」本质相同，只是触发条件由业务规则还是模型决定。Skills 的价值在于把外层 Loop 的常见分支写成文档，减少模型每轮重新推理 SOP 的 Token 开销。

## 实践小结

练习：用状态机实现「最多 3 次工具失败后转人工」的外层 Loop，内层仍用 ReAct。压测循环退出是否可靠，统计误触发人工比例。将 Skills 文档化一条 SOP，对比加载 Skill 前后平均步数变化。

## 工程检查清单

检查清单：外层 Loop 退出条件；内层 max steps；Graph 回边上限；Skill 是否减少重复推理；MCP 连接失败是否降级；死循环检测告警是否启用。Loop 工程的核心是可预期的终止与可恢复的状态，而非让模型「尽量多试几次」。

## 读者 takeaway

读者 takeaway：Loop 工程化的是「何时停、失败后怎么办」。内外层循环分工清晰，才能既保留 Agent 灵活性，又避免 Workflow 时代就解决的死循环问题。

## 学习建议
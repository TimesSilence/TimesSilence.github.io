---
title: "AI Agent 面试题总结"
date: 2026-02-27 11:51:00
updated: 2026-02-27 11:51:00
permalink: knowledge/ai/interview-questions/agent-interview-questions/
categories:
  - 人工智能
tags:
  - 面试
  - Agent
  - MCP
  - Memory
description: "AI Agent 面试题要点：Loop、记忆、上下文、MCP 与 Harness。"
---

Agent 面试重在能否讲清闭环、工具治理与失败处理。

<!-- more -->

## 基础题

Agent 与 Workflow 区别；ReAct 流程；停止条件设计；工具 Schema 要点。Memory 短长期划分；与 RAG 边界。

## 进阶题

Prompt Injection 对 Agent 影响；多 Agent 编排；Harness 组件；Context 压缩策略。Trace 如何拆 Span。

## 设计题

设计客服 Agent：检索、工具、人工升级、评测。说明权限模型与 audit log。

## 答题技巧

用「请求进入 → Loop 第 N 步失败 → 如何降级」讲故事。误区：只谈模型不谈工程。

## 延伸思考

回答 Memory 题时可对比：短期在 window、长期在外部 store、写入策略与 TTL。MCP 题强调 Host/Server 分离与 JSON-RPC，不是替代 FC。Harness 题列举 sandbox、hook、audit。Workflow/Graph/Loop 题用「审批流 + 一次 Agent 子任务」举例。综合设计题建议模板：需求→架构→数据流→失败降级→指标→安全。避免背诵 ReAct 五步而不提停止条件与成本。

## 实践小结

练习：每类题准备一张小抄：Loop 五步、Memory 分类、MCP 组件、Harness 清单。用一次真实 Agent 请求逐步口述对应概念，形成肌肉记忆。

## 工程检查清单

检查清单：Loop/Memory/MCP/Harness/Workflow 每类 3 题；设计题是否含权限与 Trace；是否准备 tool 失败降级话术；是否对比 Agent vs Workflow。答案务必落到「线上怎么保障」，而非概念定义。

## 读者 takeaway

读者 takeaway：Agent 面试答「工程保障」加分：停止条件、权限、Trace、Badcase。准备一条真实 Loop 日志比背 ReAct 五步更有说服力。

## 学习建议
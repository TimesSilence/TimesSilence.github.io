---
title: "多 Agent 协作系统设计：任务拆分、状态共享、冲突处理与失败恢复"
date: 2025-12-30 13:55:00
updated: 2025-12-30 13:55:00
permalink: knowledge/ai/agent/multi-agent/
categories:
  - 人工智能
tags:
  - 多 Agent
  - 协作
  - 编排
description: "多 Agent 系统设计：任务拆分、编排模式、并行与冲突处理。"
---

多 Agent 适合角色分工明确、子任务可并行的复杂流程，而非默认架构。

<!-- more -->

## 何时使用

单 Agent + 好工具往往足够。多 Agent 适用于：规划/执行/审查角色分离、并行检索多数据源、专业域模型分工。多阶段 Prompt Chain 是线性流水线；多 Agent 强调状态共享与动态委派。

## 设计要点

先定编排：Supervisor、Peer、Hierarchical。子任务契约化（输入/输出 Schema、超时、重试）。并行需幂等与冲突合并策略；共享黑板或消息总线传递状态。

## 失败恢复

子 Agent 失败：降级、换路、人工介入。避免「电话游戏」式长链传递丢信息。Trace 按 agent_id 分 Span。

## 误区

Agent 数量越多越好；无统一状态导致重复劳动；忽视 Token 成本翻倍。

## 延伸思考

静态角色（Planner/Worker/Critic）适合流程稳定；动态委派适合任务类型事先未知。并行子任务要定义聚合器：何时合并结果、冲突字段听谁的、是否投票。共享状态推荐版本化 document，避免并发写覆盖。失败恢复可设「监督者 Agent」只做路由与重试，不参与业务生成，降低循环依赖。评测多 Agent 系统时，除最终答案，还要统计子 Agent 调用次数与总 Token，防止成本线性膨胀。

## 实践小结

练习：设计 Planner+Worker 两 Agent 处理「生成周报」：Planner 列提纲，Worker 并行查三块数据。定义 JSON 契约与合并规则。模拟 Worker 超时，验证 Supervisor 重试与部分结果降级展示。

## 工程检查清单

检查清单：子任务 JSON 契约；并行幂等；冲突合并规则；Supervisor 超时；总 Token 预算；跨 Agent Trace 关联 ID；失败 partial result 展示策略。多 Agent 先证明比单 Agent+好工具 更优，再投入编排复杂度。

## 读者 takeaway

读者 takeaway：多 Agent 是组织复杂性的工具，不是默认架构。先证明单 Agent 不够，再引入角色拆分，并监控总 Token 与协调开销，避免「八个 Agent 做一件事」。

## 学习建议
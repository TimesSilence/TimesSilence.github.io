---
title: "Harness 是什么？Harness Engineering 六层架构与 Agent 工程实践"
date: 2025-12-22 12:48:00
updated: 2025-12-22 12:48:00
permalink: knowledge/ai/agent/harness-engineering/
categories:
  - 人工智能
tags:
  - Harness
  - Agent
  - 工程化
description: "Harness 工程：Agent = Model + Harness，六层架构与执行环境设计。"
---

模型负责想，Harness 负责跑——权限、沙箱、重试、校验都在 Harness。

<!-- more -->

## 核心公式

Agent = Model + Harness。Harness 包含工具运行时、策略钩子、状态持久化、人机协同中断、评测探针等。瓶颈常在 Harness：模型升级 10%，Harness 成熟度决定能否上线。

## 六层架构（概念）

接口层（CLI/IDE/API）→ 编排层（Loop/Graph）→ 上下文层（检索/Memory）→ 工具层（MCP/FC）→ 治理层（权限/审计/限流）→ 观测层（Trace/Metrics）。各层职责清晰，避免 Prompt 里堆叠业务逻辑。

## 实践要点

Hooks 在工具前后做校验；沙箱执行代码；失败可恢复 checkpoint；长任务支持 interrupt/resume。上下文压缩策略放在 Harness，而非指望模型自觉总结。

## 误区

只换更强模型不补 Harness；工具无权限分级；无 Trace 无法复盘 Badcase。

## 延伸思考

成熟 Harness 通常包含：会话状态存储、工具执行隔离、策略 Hook（before/after tool）、人类审批队列、结构化日志与 Trace 导出。Cursor/Claude Code 类产品差异往往不在模型，而在 Harness 是否支持 checkpoint、是否限制 shell 权限、是否记录 diff。自建 Harness 时可参考「六层」做模块拆分，但不必一次做全——优先 observability 与 permission，再补 multi-agent 与复杂 Graph。

## 实践小结

练习：为本地 Agent CLI 加 before_tool hook：拦截 rm、curl 内网、读写 .env。再加 run_id 日志与失败重试。体会 Harness 改动如何不改变模型却显著提升安全性——这比换模型更立竿见影。

## 工程检查清单

检查清单：工具前后是否有 hook；代码执行是否沙箱；是否支持 interrupt/resume；checkpoint 存储是否可靠；权限是否 RBAC；日志是否含 run_id；评测探针是否可插拔。Harness 成熟度决定 Agent 能否进生产，而不是模型 benchmark 分数。

## 读者 takeaway

读者 takeaway：Harness 决定 Agent 能否上线。优先投资权限、沙箱、checkpoint 与 hook，再追求多 Agent 花哨编排——生产事故 rarely 来自模型不会推理，而来自工具失控。

## 学习建议
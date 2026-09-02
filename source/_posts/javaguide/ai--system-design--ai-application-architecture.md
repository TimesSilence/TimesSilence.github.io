---
title: "AI 应用系统设计：从 Prompt Demo 到生产级架构"
date: 2026-01-14 15:09:00
updated: 2026-01-14 15:09:00
permalink: knowledge/ai/system-design/ai-application-architecture/
categories:
  - 人工智能
tags:
  - 系统设计
  - AI 架构
  - RAG
  - Agent
description: "AI 应用生产架构：分层、编排、网关与三类上下文隔离。"
---

生产架构要把「一次聊天」变成可治理、可扩展的任务流水线。

<!-- more -->

## 分层

入口（鉴权、限流、会话）→ 编排（Agent/Workflow）→ 能力（RAG/Memory/Tools）→ 模型网关 → 观测与存储。Demo 常缺编排与治理层。

## 三类上下文

RAG 知识（只读、带来源）；Memory（用户态、可写）；Tool 结果（ ephemeral、需摘要）。勿混在一个 blob Prompt 里。

## 交互模式

同步适合低延迟短答；流式改善体验；异步队列适合长 Agent 任务 + 回调/Webhook。

## 误区

Prompt 硬编码在代码；无 idempotency；单模型无 fallback。

## 延伸思考

入口层除鉴权外，还应做 prompt injection 初筛、请求大小限制、会话 fixation 防护。编排层持久化 run state，支持 cancel。Prompt 管理用 Git+配置中心，版本与发布绑定。RAG/Memory/Tools 三个 context builder 独立模块，最后 merge 时做 token budget。异步模式用 outbox 保证任务至少一次执行。缓存可对相同 query+index_version 的检索结果短 TTL 缓存，注意 invalidation。

## 实践小结

练习：把现有 Demo 拆成入口/编排/能力/网关四层部署图。标记同步改异步的候选长任务。定义 context builder 接口草案。

## 工程检查清单

检查清单：四层分离；context 三类隔离；异步队列；Prompt 版本；idempotency。架构评审应能指出 Demo 缺口清单。

## 读者 takeaway

读者 takeaway：生产架构的核心是分层与解耦。Prompt Demo 拼在一个文件里可以，上线前必须拆层，否则每次迭代都是全链路赌博。

## 学习建议
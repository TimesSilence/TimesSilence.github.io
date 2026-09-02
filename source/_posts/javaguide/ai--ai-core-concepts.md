---
title: "AI 核心概念总览：LLM、Agent、RAG、MCP 与系统设计"
date: 2025-01-09 09:07:00
updated: 2025-01-09 09:07:00
permalink: knowledge/ai/ai-core-concepts/
categories:
  - 人工智能
tags:
  - AI
  - LLM
  - Agent
  - RAG
  - MCP
description: "AI 核心概念串联：Token、结构化输出、Agent Loop、RAG、MCP 与评测安全。"
---

核心概念的价值是把分散术语放到同一条请求链路上理解。

<!-- more -->

## 链路视角

用户问题 →（可选 RAG 检索）→ 上下文组装 → LLM 推理 →（可选 FC/MCP 工具）→ 结构化/自然语言输出 → 日志与评测。Token 与上下文窗口决定成本与记忆；采样参数影响确定性。

## 关键机制

结构化输出分 JSON Mode、Schema 约束、Structured Outputs 三层。Agent Loop 连接工具反馈。Embedding 支撑语义检索；GraphRAG 补关系推理。网关统一模型路由；安全层防注入与越权。

## 工程取舍

长上下文 vs RAG；微调 vs 检索；单 Agent vs 多 Agent；同步 vs 流式。按延迟、成本、可解释性选型。

## 误区

术语堆砌无链路；忽视评测与引用溯源；把 Demo 架构当生产架构。

## 延伸思考

串联概念时，可画一张请求路径：用户输入经网关鉴权，编排层决定是否 RAG、是否启用 Agent，上下文层合并 Memory 与检索片段，模型层产出文本或 tool call，工具层经 MCP/FC 执行，结果经校验后返回并写 Trace。安全与评测横切全链路。理解这张图的收益是：新术语出现时可快速定位它属于哪一层，避免「堆概念却无架构」。

## 实践小结

练习：白板默画 LLM→RAG→Agent→网关→安全 的数据流，标出 Token 计量点与权限检查点。向同事讲解一次，能答「Memory 与 RAG 区别」「MCP 解决什么」即达标。

## 工程检查清单

检查清单：能否口述完整请求链；Token/成本点是否标识；结构化输出层级是否清楚；RAG 与 Memory 分工；MCP/FC 关系；网关与安全横切点。核心概念笔记的价值在于一张链路图串联术语，面试与架构评审时快速定位讨论层级。

## 读者 takeaway

读者 takeaway：术语多不可怕，可怕的是没有一条请求链路把它们串起来。掌握链路后，新 buzzword 只是某层的替换件，学习速度会明显提升。

## 学习建议
---
title: "大模型基础面试题总结"
date: 2026-03-25 15:19:00
updated: 2026-03-25 15:19:00
permalink: knowledge/ai/interview-questions/llm-interview-questions/
categories:
  - 人工智能
tags:
  - 面试
  - LLM
  - API
  - 评测
description: "大模型基础面试题：运行机制、API 工程、结构化输出与评测。"
---

LLM 面试要同时答清原理与调用链路上的工程细节。

<!-- more -->

## 运行机制

Token 化、上下文窗口、注意力与成本；temperature/top_p 影响；输入输出 Token 计费；Prompt Cache 适用场景。

## API 工程

流式 SSE、重试幂等、超时、限流、结构化返回校验。JSON 漂移处理三层约束。

## 评测

Golden Set、自动指标 + 人工、线上采样与灰度。公开 benchmark 与业务集差异。

## 误区

只背 Transformer；不讲失败重试；忽视结构化输出生产实践。

## 延伸思考

API 题准备：SSE 事件格式、客户端断连、服务端 cancel、幂等键设计。结构化输出题画三层约束并说明 parse 失败重试策略。评测题区分 offline/online metric，提及 human eval 采样率。综合场景如「账单摘要」：强调 PII 脱敏、JSON schema、audit log。运行机理题别忽略：长上下文推理未必更准，中间 lost-in-the-middle 现象可主动提及，体现深度。

## 实践小结

练习：手写 SSE 事件流示例与 JSON schema 校验伪代码。解释 TTFT 与 TPOT 指标。准备「结构化输出失败」的线上处理剧本。

## 工程检查清单

检查清单：Token/采样/API/结构化/评测五块各 3 题；SSE 异常是否掌握；JSON 校验重试是否讲清；公开 benchmark 与业务集差异是否说明。LLM 面试要原理与工程并排。

## 读者 takeaway

读者 takeaway：LLM 面试=机理 + API 生产实践 + 评测。能讲清一次失败调用的排查（超时/截断/JSON 错）即显示真实经验。

## 学习建议
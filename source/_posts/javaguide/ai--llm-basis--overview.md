---
title: "大模型基础专题：运行机制、API 调用、结构化输出与评测"
date: 2025-03-23 11:21:00
updated: 2025-03-23 11:21:00
permalink: knowledge/ai/llm-basis/overview/
categories:
  - 人工智能
tags:
  - LLM
  - API
  - 评测
  - 结构化输出
description: "大模型基础专题导读：运行机制、API 调用、结构化输出与评测。"
---

大模型基础是 AI 应用的「操作系统层」——不懂机制就容易在成本与安全上踩坑。

<!-- more -->

## 专题范围

运行机制（Token、窗口、采样）；API 工程（流式、重试、限流）；结构化输出与 Function Calling；评测体系（Golden Set、灰度）。

## 学习顺序

先机制后 API；先同步后流式；先 JSON 契约后工具调用；先离线评测后线上监控。与 Agent/RAG 专题交叉阅读。

## 实践建议

用同一套小任务对比不同 temperature 与 max_tokens；压测流式 TTFT；建立 50 条 Golden Case。

## 误区

跳过机制直接调 SDK；不做结构化校验；无成本监控。

## 延伸思考

动手实验建议：同一问题扫 temperature 0~1 观察稳定性；对比 stream vs 非 stream 的 TTFT；用 invalid schema 测试重试逻辑。Structured output 与 FC 应在小项目里串起来：模型输出 JSON→校验→调 HTTP 工具→结果回写。评测从 30 条核心 case 起步，覆盖拒答、工具、格式、安全。专题读完应能画出「一次生产调用」的时序图，而不只是列举 API 参数名。

## 实践小结

练习：用 curl 或 SDK 各调一次 sync/stream，记录 TTFT。跑 small Golden Set 评测不同 temperature。列出你项目中最该先补的 LLM 基础短板一项并排期。

## 工程检查清单

检查清单：机制/API/结构化/评测四篇是否串联；是否动手测 stream 与 schema；是否有 Golden Set v0。基础专题目标是独立设计一次生产级 chat 调用时序。

## 读者 takeaway

读者 takeaway：大模型基础是一切的上层建筑。机制理解帮助控成本，API 工程保证可靠，评测保证迭代有方向——三者缺一，Agent/RAG 都是空中楼阁。

## 学习建议
---
title: "AI 可观测性与 Trace：如何还原 Agent 的完整执行过程"
date: 2026-02-13 09:37:00
updated: 2026-02-13 09:37:00
permalink: knowledge/ai/system-design/ai-observability/
categories:
  - 人工智能
tags:
  - 可观测
  - Trace
  - Agent
  - OpenTelemetry
description: "AI 可观测性：Metrics/Logs/Trace/Evaluation 与 Agent Span 设计。"
---

AI 应用成功返回不等于正确——需要 Trace 还原推理与工具链。

<!-- more -->

## 信号分层

Metrics：QPS、延迟、Token、错误率。Logs：结构化事件。Trace：跨服务调用树。Evaluation：离线/在线质量。Audit：合规与 tool 调用。

## ID 层级

Session（用户会话）→ Run（一次任务）→ Trace → Span（LLM/检索/tool）→ Attempt（重试）。Agent 请求拆多 Span 才可定位偏题步。

## 实践

OpenTelemetry 传播 context；头部采样 + 错误尾部必留；关联 prompt_version、model、retrieval_ids。Dashboard 看 TTFT 与 tool 失败率。

## 误区

只 log 最终答案；无 retrieval id 无法查「召回了什么」；采样率 100% 存不下。

## 延伸思考

Agent Span 命名规范示例：llm.chat、retrieval.search、tool.execute、memory.read。Attributes 存 model、prompt_version、retrieval_ids、tool_name、latency_ms、token_in/out。Tail sampling 保留 error 与高 latency trace。Evaluation 信号可回流：低分 trace 自动进标注队列。Audit 与 Trace 分离存储，满足合规 retention。OpenTelemetry 尚未完全统一 GenAI semantic convention，团队可先定内部 schema 再逐步对齐标准。

## 实践小结

练习：为一次 Agent 请求手工写期望 Span 树。接 OpenTelemetry 导出到 Jaeger 试查一条 trace。定义 3 个 SLI：TTFT、tool_error_rate、grounded_rate。

## 工程检查清单

检查清单：Span 规范；tail sampling；eval 回流；audit 分离；GenAI attribute 对齐计划。不可观测的 Agent 不可运维。

## 读者 takeaway

读者 takeaway：AI 可观测性要把「模型想了什么、检索到了什么、工具做了什么」串成 Trace。没有 Span 级证据，Badcase 复盘只能猜。

## 学习建议
---
title: "大模型 API 调用工程实践：流式输出、重试、限流与结构化返回"
date: 2025-05-09 13:35:00
updated: 2025-05-09 13:35:00
permalink: knowledge/ai/llm-basis/llm-api-engineering/
categories:
  - 人工智能
tags:
  - LLM
  - API
  - 流式
  - 网关
description: "大模型 API 工程：流式协议、重试幂等、限流与结构化返回。"
---

生产级 LLM 调用是分布式系统工程，不是单次 HTTP POST。

<!-- more -->

## 调用阶段

鉴权 → 路由 → 组装 Prompt → 请求模型 → 流式/同步消费 → 校验 → 持久化 → 计费埋点。每阶段需超时与可观测。

## 流式选型

SSE 简单、单向，适合 Chat；WebSocket 双向，适合语音/协作；chunked HTTP 兼容性好。注意 Nginx 缓冲关闭、代理超时、客户端断连取消。

## 可靠性

幂等 Key 防重复扣费；指数退避重试；熔断与 fallback 模型。流式异常：断连、TTFT 超时、中途错误帧。

## 误区

默认缓冲导致「假流式」；无 cancel 泄漏资源；结构化输出不校验就入库。

## 延伸思考

Spring AI 等框架封装了 ChatClient，但生产仍需自管：连接池、超时、断路器、bulkhead。流式场景在模型输出 Markdown 代码块时，注意 SSE 事件边界解析，避免半行 JSON 被截断。重试仅对 idempotent 读操作或带幂等键的写操作；对「已扣费但客户端超时」要有对账任务。限流按 tenant+model 维度，防止单客户拖垮集群。结构化返回建议 jsonschema validate + 业务 rule validate 两道门。

## 实践小结

练习：实现带幂等键的 chat 接口与 json validate 中间件。模拟 502 重试与客户端断连 cancel。检查 Nginx/proxy 是否缓冲 SSE。

## 工程检查清单

检查清单：幂等/重试/超时/限流/流式 cancel/结构化校验是否齐备；代理缓冲是否关闭；计费埋点是否分 input/output。API 层是 AI 服务 SRE 的主战场。

## 读者 takeaway

读者 takeaway：调用 LLM 的标准与调用任何关键下游无异：超时、重试、幂等、限流、观测。流式体验的上限，往往卡在网关与代理配置而非模型本身。

## 学习建议
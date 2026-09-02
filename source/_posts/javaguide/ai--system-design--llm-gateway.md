---
title: "大模型网关详解：多模型路由、Fallback、限流与成本控制"
date: 2026-01-30 17:23:00
updated: 2026-01-30 17:23:00
permalink: knowledge/ai/system-design/llm-gateway/
categories:
  - 人工智能
tags:
  - 网关
  - LLM
  - 路由
  - 成本
description: "大模型网关：多模型路由、Fallback、限流与成本控制。"
---

网关把模型调用从业务代码里剥离成基础设施。

<!-- more -->

## 职责

统一 API、鉴权、路由（按任务/租户/语言）、fallback、限流、缓存、计费、日志。Router 偏策略；Gateway 偏策略+策略执行+策略存储。

## 路由策略

简单问答小模型；复杂推理强模型；失败降级；A/B 与 canary。成本：强模型仅走 escalation 规则。

## 与 RAG/Agent

网关不替代 RAG，位于模型调用边界。Agent 多次调用更依赖网关聚合计费与 timeout。

## 误区

网关层过厚拖延迟；无 fallback 单点；所有请求最强模型成本爆炸。

## 延伸思考

网关可内置 semantic cache（相似 query 命中），注意 privacy 分区。Fallback 链：主模型→备用模型→规则回复。Rate limit 支持 token bucket 与并发数双限。成本报表按 team/model/day 聚合，驱动 routing 策略。与 Service Mesh 关系：网关是 L7 AI 专用，Mesh 管通用 mTLS 与流量。自建 vs 商用（Portkey、LiteLLM 等）权衡运维成本与功能深度。

## 实践小结

练习：配置主备模型 fallback 路由规则。按 team 设 rate limit。出一份 model 单价对照表驱动 routing policy。

## 工程检查清单

检查清单：routing/fallback/ratelimit/cost report/cache policy。网关是模型治理中枢，应独立于业务迭代发布。

## 读者 takeaway

读者 takeaway：网关把模型调用变成可治理的基础设施。routing、fallback、成本报表集中后，业务团队才能专注编排而不用各自对接多家 API。

## 学习建议
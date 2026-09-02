---
title: "AI 语音技术详解：从 ASR、TTS 到实时语音 Agent 的工程化落地"
date: 2026-01-22 16:16:00
updated: 2026-01-22 16:16:00
permalink: knowledge/ai/system-design/ai-voice/
categories:
  - 人工智能
tags:
  - 语音
  - ASR
  - TTS
  - 实时 Agent
description: "AI 语音工程：ASR、TTS 与实时语音 Agent 架构要点。"
---

语音 Agent 是 ASR + 对话内核 + TTS 的低延迟闭环，工程难点在打断与流式。

<!-- more -->

## 链路

麦克风 → VAD → 流式 ASR → 文本 Agent/LLM → 流式 TTS → 播放。全双工需 echo cancel 与 barge-in（用户打断）。

## ASR/TTS 选型

ASR：云端 API vs 本地；流式 vs 批式。TTS：神经 vocoder、情感、多说话人。延迟预算拆段监控。

## 与文本 Agent 差异

口语更短、更噪；上下文需对话轮次压缩；工具调用仍经 FC/MCP。WebSocket 常见。

## 误区

忽视网络 jitter；TTS 未流式导致首字延迟高；无打断体验差。

## 延伸思考

实时语音需端到端延迟预算：ASR partial result、LLM 首 token、TTS 首包。VAD 减少无效识别。打断时取消进行中的 LLM/TTS 请求，避免「说话重叠」。噪声环境与口音影响 ASR，需 fallback 文本输入。合规场景录音需告知与留存策略。与文本 Agent 共用编排层，但应独立 scaling ASR/TTS worker，GPU/CPU 画像不同。

## 实践小结

练习：画语音链路时序，标打断点。测 ASR 在噪声样本上的字错率。评估 TTS 首包延迟是否满足产品目标。

## 工程检查清单

检查清单：E2E 延迟预算；barge-in；ASR 噪声 fallback；录音合规；资源隔离。语音是实时系统，容错设计不同于文本 Chat。

## 读者 takeaway

读者 takeaway：语音 Agent 是实时系统工程，延迟与打断体验决定产品成败。文本 Agent 的经验不能原样照搬，需单独预算与监控 ASR/TTS 链路。

## 学习建议
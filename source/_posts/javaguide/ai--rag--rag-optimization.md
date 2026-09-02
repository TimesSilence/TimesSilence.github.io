---
title: "RAG 优化：从召回、重排到上下文工程"
date: 2025-09-17 12:38:00
updated: 2025-09-17 12:38:00
permalink: knowledge/ai/rag/rag-optimization/
categories:
  - 人工智能
tags:
  - RAG
  - 重排
  - 召回
  - 优化
description: "RAG 优化闭环：数据治理、召回、重排与上下文工程。"
---

RAG 优化先修数据，再调检索，最后才换大模型。

<!-- more -->

## 优化闭环

标注 Badcase → 定位层（解析/Chunk/召回/重排/生成）→ 改策略 → Golden 回归。指标：Recall@K、MRR、答案 grounded 率、人工分。

## 召回层

混合检索 BM25 + 向量；Query 改写/HyDE；多路召回合并。重排用 cross-encoder 或小模型。

## 上下文

去重、排序、长度预算；引用格式约束；拒答当检索分低时。

## 误区

一上来换 GPT-4；忽视 Metadata 过滤；无标注集盲目调参。

## 延伸思考

Badcase 分类示例：未召回（调 chunk/混合检索）、召回了但排序靠后（调 rerank）、上下文太长模型忽略（压缩/重排）、生成了未在片段中的事实（加强引用约束与拒答）。数据治理包括：去重、敏感信息脱敏、过期文档下架。A/B 可对比 reranker 有无、top_k 大小、query rewrite 策略。优化顺序切忌跳步——没有标注集就无法证明改动有效。

## 实践小结

练习：标注 20 条 Badcase 分层。只改 rerank top_k 观察指标。建立 weekly retrieval quality review 例会模板。

## 工程检查清单

检查清单：Badcase 标注流程；rerank/rewrite 实验记录；数据治理；指标 dashboard。优化必须闭环，否则是随机调参。

## 读者 takeaway

读者 takeaway：RAG 优化是数据驱动的迭代循环，不是玄学调参。先标注 Badcase 分层，再改策略，用 Golden Set 证明有效——这条纪律比任何 trick 都重要。

## 学习建议
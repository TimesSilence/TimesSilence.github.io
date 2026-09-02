---
title: "RAG 面试题总结"
date: 2026-04-01 16:26:00
updated: 2026-04-01 16:26:00
permalink: knowledge/ai/interview-questions/rag-interview-questions/
categories:
  - 人工智能
tags:
  - 面试
  - RAG
  - 向量检索
  - GraphRAG
description: "RAG 面试题：索引、Chunk、优化、GraphRAG 与知识库更新。"
---

RAG 面试重点在召回链路而非「向量库名词」。

<!-- more -->

## 基础

RAG 阶段：离线索引与在线检索生成；Embedding 与相似度；混合检索；幻觉与引用。

## 进阶

Chunk 策略、Parent-Child、重排、Query 改写；权限过滤在召回前；增量更新与 embedding 版本一致。

## GraphRAG

何时补图结构；多跳 vs 向量 Top-K；成本权衡。

## 排查题

「答非所问」从解析、Chunk、召回、重排、Prompt 五层查。误区：只会说 Milvus 不会说评测闭环。

## 延伸思考

Chunk 题比较固定长、递归、语义、Parent-Child 适用场景。优化题说闭环：Badcase 标注→定位层→改策略→回归。更新题强调 embedding 版本一致与 delete-then-insert。GraphRAG 题说何时值得：多跳、全局摘要、关系密集域。排查「胡编」先查检索是否空、引用是否匹配、模型是否忽略 context。准备混合检索公式：BM25 召回 + 向量召回 + RRF 合并 + cross-encoder 重排。

## 实践小结

练习：对一条「答非所问」样本做五层排查笔记。口述混合检索与 RRF 思路。准备 GraphRAG 与向量 RAG 成本对比的一分钟版本。

## 工程检查清单

检查清单：索引/Chunk/混合检索/重排/更新/GraphRAG 是否覆盖；排查五层是否熟；权限过滤时机是否强调。RAG 题答「用了 Milvus」不够，要说召回链路与指标。

## 读者 takeaway

读者 takeaway：RAG 面试重在召回链路与指标，而非向量库品牌。准备一条「答非所问」的五层排查故事，比背 ten 种索引算法更实用。

## 学习建议
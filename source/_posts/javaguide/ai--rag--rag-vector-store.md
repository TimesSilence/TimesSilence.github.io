---
title: "RAG 向量索引算法和向量数据库"
date: 2025-08-25 10:24:00
updated: 2025-08-25 10:24:00
permalink: knowledge/ai/rag/rag-vector-store/
categories:
  - 人工智能
tags:
  - RAG
  - 向量数据库
  - Embedding
  - HNSW
description: "RAG 向量索引：Embedding、相似度度量、ANN 算法与库选型。"
---

向量库解决「百万级语义近邻搜索」，不是简单的 key-value。

<!-- more -->

## Embedding 与检索

文本→稠密向量；Query 同空间近邻即语义相似。需同一模型、同一维度。相似度常用 cosine/IP，距离用 L2。

## 为何专用库

高维 ANN（HNSW、IVF）在延迟与 recall 间权衡；需过滤（metadata）、副本、持久化。小数据 Faiss/pgvector 够用；大规模 Milvus/ES 向量场。

## 索引选择

精确 NN 小数据；HNSW 低延迟；IVF 大规模。参数影响 recall 与 build 时间。

## 误区

只向量不做关键词；维度过高未归一化；不设 ef/search 参数调优。

## 延伸思考

pgvector 适合已有 Postgres 团队；Milvus/Qdrant 适合大规模；ES 适合同时要 BM25 的场景。HNSW 参数 M、efConstruction 影响 build 时间与 recall。过滤查询（tenant_id、acl）应在 ANN 前或与支持 metadata filter 的引擎结合。冷热分层：热库 SSD、冷库对象存储+按需加载。监控 p99 查询延迟与 recall 抽样，索引 rebuild 需蓝绿切换避免查询中断。

## 实践小结

练习：在 pgvector 或本地 Faiss 建 1 万条索引，压测 p99。试 metadata filter 查询。记录 HNSW ef_search 对 recall 的影响曲线。

## 工程检查清单

检查清单：ANN 参数；metadata filter；p99 监控；索引蓝绿；冷热分层。向量库选型匹配规模与团队运维能力即可。

## 读者 takeaway

读者 takeaway：向量库是性能与运维的 tradeoff，没有银弹。匹配团队规模选型，持续监控 p99 与 recall 抽样，比追逐最新 DB 品牌更务实。

## 学习建议
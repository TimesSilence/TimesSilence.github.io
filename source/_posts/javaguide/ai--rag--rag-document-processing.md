---
title: "RAG 文档处理与切分策略：从解析、清洗、Chunking 到多模态内容处理"
date: 2025-07-30 08:10:00
updated: 2025-07-30 08:10:00
permalink: knowledge/ai/rag/rag-document-processing/
categories:
  - 人工智能
tags:
  - RAG
  - Chunk
  - 文档解析
description: "RAG 文档处理：解析、清洗、Chunking 策略与多模态要点。"
---

上传前半段决定 RAG 上限——Garbage In, Garbage Out。

<!-- more -->

## 处理链路

格式解析（PDF/HTML/Office）→ 去噪 → 结构识别（标题/table）→ Chunk → 元数据（来源、页码、ACL）→ Embedding。

## Chunk 策略

固定长度简单但断语义；递归字符保段落；语义切分贵；按标题/结构切边界清晰；Parent-Child 小 chunk 召回、大 parent 生成。重叠缓解边界截断。

## 多模态

图/表需 OCR 或专用模型；表格转 Markdown 保结构。代码库按函数/类切分。

## 误区

不清洗 HTML 噪声；统一 chunk size；无元数据无法过滤与溯源。

## 延伸思考

PDF 解析优先保结构：标题层级、列表、表格单元格边界。代码文档按函数切分并保留 import 上下文。FAQ 可整段为 chunk。重叠 size 通常 10%-20% chunk length。Metadata 至少含 source_id、page、section、acl、lang、updated_at，供过滤与展示引用。多模态 pipeline 还要考虑 OCR 置信度低时人工审核队列，否则脏文本进入索引后很难排查。

## 实践小结

练习：对同一 PDF 试固定长与按标题两种 Chunk，比较 Recall@5。记录 metadata 字段设计。处理一份含表格样本，观察解析质量。

## 工程检查清单

检查清单：解析质量；Chunk 策略 A/B；metadata 完整；表格/OCR 特殊处理；脏数据隔离。文档处理是 RAG ROI 最高投入点之一。

## 读者 takeaway

读者 takeaway：Chunk 策略是 RAG 的 hidden lever。同一套 embedding 与模型，换 Chunk 可能带来最大幅度的 Recall 提升，且成本远低于换 GPT 版本。

## 学习建议
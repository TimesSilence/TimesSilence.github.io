---
title: "RAG 知识库文档如何更新：增量更新、版本控制、去重与全量重建"
date: 2025-08-12 09:17:00
updated: 2025-08-12 09:17:00
permalink: knowledge/ai/rag/rag-knowledge-update/
categories:
  - 人工智能
tags:
  - RAG
  - 知识库
  - 增量更新
description: "RAG 知识库更新：增量、版本、去重与全量重建策略。"
---

知识库不是一次索引就结束，更新策略决定答案是否过时。

<!-- more -->

## 核心问题

新增/修改/删除如何同步；embedding 模型变更需全量重嵌；版本与 doc_id 一致性；去重防重复 chunk。

## 元数据设计

doc_id、version、hash、updated_at、source、acl。修改：删旧 vector + 写新。删除：软删标记 + 过滤。

## 增量 vs 全量

增量适合日常；全量适合模型切换、索引 corruption、大规模重构。定时对账校验 count/hash。

## 误区

只 append 不删改；换 embedding 模型不重建；无版本导致旧新片段同时召回矛盾。

## 延伸思考

增量 pipeline 可监听对象存储事件或 CMS webhook，消息体带 doc version。embedding 模型升级时，计划维护窗口跑全量 re-embed，双写索引后切换 alias。去重用 content hash，同 hash 跳过。删除要传播到向量库与 BM25 索引。对账任务每日比较源系统文档数与索引条目数。灾难恢复保留快照与重建脚本，避免单点索引损坏无退路。

## 实践小结

练习：模拟 doc 修改触发 delete+reindex，验证旧 vector 不可检索。文档 embedding 版本字段。写 disaster rebuild runbook 大纲。

## 工程检查清单

检查清单：doc version；delete 传播；embedding 变更 rebuild；对账任务；快照恢复。更新失败会产生「幽灵 chunk」误导回答。

## 读者 takeaway

读者 takeaway：知识库是活数据，更新策略与初次索引同等重要。版本、hash、delete 传播、re-embed 计划缺一不可，否则用户会看到过期或矛盾答案。

## 学习建议
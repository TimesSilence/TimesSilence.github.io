---
title: "AI 应用评测体系：从 Golden Set 构建到线上灰度闭环"
date: 2025-05-28 14:42:00
updated: 2025-05-28 14:42:00
permalink: knowledge/ai/llm-basis/llm-evaluation/
categories:
  - 人工智能
tags:
  - 评测
  - LLM
  - Golden Set
  - 质量
description: "AI 应用评测：Golden Set 构建、分层覆盖与线上灰度闭环。"
---

没有评测的 AI 功能只能叫实验，不能叫产品。

<!-- more -->

## 为何自建 Golden Set

公开 benchmark 与业务分布脱节；需要覆盖权限、拒答、工具、多轮、边界输入。每条 case：输入、期望行为、评分 rubric、标签分层。

## 构建方法

从日志采样 + 人工标注 Badcase；合成数据补长尾；分层（核心/扩展/对抗）。100–300 条核心集可启动迭代；持续增补。

## 闭环

离线回归 → 预发 shadow → 灰度指标（准确率、引用率、人工接管）→ 全量。版本绑定 Prompt、检索索引、模型 id。

## 误区

只看 BLEU/ROUGE；无对抗用例；Golden Set 不维护导致腐化。

## 延伸思考

Golden case 字段可含：input、expected_tools、expected_citations、forbidden_content、difficulty tag。扩展覆盖可用 mutation：改写法、加噪声、换语言、注入恶意片段。分层时核心集挡回归，扩展集测泛化，对抗集测安全。线上灰度看：answer grounded rate、用户 thumbs、人工复核队列深度。公开 benchmark 可借鉴题型，但指标必须映射到业务 KPI，否则优化方向会偏离。

## 实践小结

练习：从生产日志脱敏采样 50 条建 v0 Golden Set，定义 rubric。跑一版自动评分 + 5 条人工复核。设定灰度门禁：低于阈值自动 rollback prompt 版本。

## 工程检查清单

检查清单：Golden 分层；对抗集；版本绑定；灰度门禁；人工复核采样；Badcase 回流。无评测的模型升级等于盲飞。

## 读者 takeaway

读者 takeaway：评测是把 AI 从 demo 推向产品的转换器。Golden Set 是资产，需持续投资；没有评测的优化都是主观感受。

## 学习建议
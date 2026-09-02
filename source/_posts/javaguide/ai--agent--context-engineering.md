---
title: "上下文工程(Context Engineering) 是什么？和 Prompt Engineering 有什么区别？"
date: 2025-10-29 16:06:00
updated: 2025-10-29 16:06:00
permalink: knowledge/ai/agent/context-engineering/
categories:
  - 人工智能
tags:
  - Context Engineering
  - Prompt
  - Agent
description: "上下文工程：与 Prompt 工程的区别、失效原因、加载策略与评估方法。"
---

同样模型与 Prompt，差在「每轮看见什么」——这就是 Context Engineering。

<!-- more -->

## 与 Prompt Engineering 的差别

Prompt 定角色、格式与约束；Context 定证据、工具结果、记忆与检索片段的组装顺序与预算。Prompt 写一次；Context 每轮动态变化。只优化 Prompt 不管理上下文，Agent 跑三轮就可能丢目标。

## 失效机制

窗口溢出截断关键指令；检索噪声淹没要点；工具返回过长未摘要；多源内容顺序不当导致模型跟错重点。中间位置信息利用弱是已知现象，重要约束应靠近首尾。

## 工程实践

分层：系统指令 / 任务状态 / 检索证据 / 工具输出 / 用户输入。设 Token 预算与优先级；预检索 + 运行时按需加载；对工具结果做结构化摘要。评估用固定任务集对比「换上下文策略」的 success rate。

## 误区

上下文越多越好；把所有 MCP Resource 一次性塞入；不做来源标注导致模型混淆用户输入与外部网页。

## 延伸思考

预检索往往不够，因为用户追问会改变信息需求。运行时 Context 应支持按轮次增量加载：先任务摘要，再按需拉 RAG 片段，再按需展开工具详情。对代码 Agent，还应控制目录树深度与文件片段长度，必要时用 ripgrep 结果代替整文件。评估 Context 策略时，除了成功率，还要看平均 Token 与 P95 延迟，避免「准确率上升但成本不可接受」。

## 实践小结

练习：固定同一 Prompt，只替换 Context 策略（全量 RAG top10 / 重排 top3 / 摘要后 top5），在 Golden Set 上比较准确率与成本。记录哪种策略在「追问型对话」中更稳，沉淀为团队默认模板。

## 工程检查清单

检查清单：Token 预算是否分模块；系统指令是否防截断；检索片段是否去重排序；工具输出是否摘要后再注入；追问场景是否增量加载而非重复全量 RAG；是否有 context 策略 A/B 指标。Context 失效往往表现为「突然偏题」，Trace 里对比前后两轮 context diff 最有效。

## 读者 takeaway

读者 takeaway：Context 是每轮动态拼装的证据包。优化 Context 往往比换模型更便宜有效；用 Trace 对比两轮 context diff，是定位偏题最高效的方法。
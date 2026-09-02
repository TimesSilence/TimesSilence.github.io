---
title: "大模型提示词工程（Prompt Engineering）是什么？提示词技巧有哪些？"
date: 2025-11-26 09:27:00
updated: 2025-11-26 09:27:00
permalink: knowledge/ai/agent/prompt-engineering/
categories:
  - 人工智能
tags:
  - Prompt
  - CoT
  - Few-shot
  - 大模型
description: "提示词工程：四要素框架、常用技巧与迭代方法。"
---

Prompt 是把模糊意图翻译成模型可稳定执行的指令契约。

<!-- more -->

## 四要素

角色（谁在说）、任务（做什么）、上下文（依据什么）、格式（怎么输出）。缺格式易漂移；缺角色易风格混乱。别把 Prompt 写成万字说明书——优先清晰约束与反例。

## 常用技巧

Few-shot 给 1–3 个示范；CoT 要求分步推理；Self-consistency 多采样投票；结构化输出配合 JSON Schema。角色扮演适合风格，不适合替代 factual 检索。

## 迭代方法

建立小评测集；每次只改一处；记录 version 与指标。生产 Prompt 放配置中心或模板库，与代码分离。

## 误区

Prompt 万能论；忽视温度与 top_p；不做失败样例回归。

## 延伸思考

四要素之外，还应考虑「负向约束」：不要做什么、遇到不确定如何拒答。CoT 在数学与逻辑题有效，但在强工具场景可能诱导冗长推理，可改用「先列检查清单再行动」。Prompt 版本要与模型版本绑定回归——换模型后旧 Prompt 可能失效。企业环境建议 Prompt 模板化，变量仅填业务字段，核心安全策略放在 System 层且尽量短，降低被用户覆盖的概率。

## 实践小结

练习：同一任务写 v1/v2 Prompt，仅改格式约束，在 20 条样本上 A/B。加入 2 条 CoT 示例观察步数与准确率。建立 Prompt changelog，换模型时强制回归，避免 silent regression。

## 工程检查清单

检查清单：四要素是否齐全；输出格式是否可机读；负向约束是否写明；Few-shot 是否精简；Prompt 版本是否绑定回归；换模型是否重测。生产 Prompt 变更应走发布流程，与代码同等级别。

## 读者 takeaway

读者 takeaway：Prompt 是接口契约的一部分，应版本化与回归。四要素 + 负向约束 + 少量高质量示例，通常优于万字说明书；与 Context、Harness 配合才稳定。

## 学习建议
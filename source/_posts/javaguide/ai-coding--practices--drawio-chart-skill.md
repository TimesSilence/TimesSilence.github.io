---
title: "JavaGuide 专属 draw.io 绘图 Skill 开源：用 Agent 自动生成可编辑的 draw.io 技术图"
date: 2026-05-24 15:29:00
updated: 2026-05-24 15:29:00
permalink: knowledge/ai-coding/practices/drawio-chart-skill/
categories:
  - AI 编程
tags:
  - Skills
  - draw.io
  - 架构图
description: "用 Agent Skill 生成可编辑 draw.io 技术图，而非一次性 PNG。"
---

技术配图应保留源文件以便迭代，Skill 化后可重复生成架构与流程图。

<!-- more -->

## 适用场景

写设计文档、RFC、博客需要架构图/时序图；希望 Agent 输出可在 draw.io 打开的 XML，而非不可维护的截图。

## 方法与要点

Skill 定义输入（组件列表、交互、风格）与输出（.drawio/.xml）。Agent 按模板填充节点与边，人微调布局。比 Mermaid 更适合非开发读者编辑。与文档仓库同 PR 提交源文件。

## 工作流

需求摘要 → 触发 Skill → 生成 drawio → 人审语义 → 导出 PNG 可选 → 文档引用源链。更新架构时改 XML 再导出，避免重画。

## 风险

图与代码漂移；XML 手工合并冲突；Skill 生成错误拓扑未审即发布。

## 检查清单

- [ ] 源文件进版本库
- [ ] 图例与命名规范一致
- [ ] 与实现 PR 联动更新
- [ ] 敏感组件可 redact 层
- [ ] CI 可选校验 XML schema

## 落地建议

把「JavaGuide 专属 draw.io 绘图 Skill 开源」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。

最后，用可回滚的小步提交与自动化测试把 AI 产出纳入常规工程纪律；没有测试与审查护栏的「快」，往往在集成阶段加倍偿还。
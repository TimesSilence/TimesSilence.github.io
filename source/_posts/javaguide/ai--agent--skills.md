---
title: "Agent Skills 是什么？和 Prompt、MCP 到底差在哪？"
date: 2025-12-05 10:34:00
updated: 2025-12-05 10:34:00
permalink: knowledge/ai/agent/skills/
categories:
  - 人工智能
tags:
  - Skills
  - Agent
  - MCP
  - Prompt
description: "Agent Skills：与 Prompt、MCP、Function Calling 的差异及 SKILL.md 结构。"
---

Skill 是可按需加载的能力包，把 SOP、约束与工具说明从主上下文剥离。

<!-- more -->

## 概念边界

Prompt 是一次性指令；MCP 是工具协议；FC 是调用格式；Skill 是「何时用、怎么用、检查什么」的打包文档 + 可选脚本。模型通过 description 匹配 Skill，再加载完整 SKILL.md。

## 结构实践

SKILL.md 含：适用场景、步骤、禁止项、输出格式、示例。配合 Rule/Flow/Use For 元数据。TDD 式 Skill：先写期望行为再补步骤。

## 工程价值

减少每轮重复塞长 Prompt；团队共享最佳实践；版本化与 prune 避免 Skill 爆炸。

## 误区

Skill 越多越好导致选择困难；Skill 与 MCP Tool 职责重叠未清理；无评测验证 Skill 真被正确触发。

## 延伸思考

SKILL.md 写作应回答：何时触发、输入输出、步骤顺序、失败怎么办、示例对话。Rule 适合硬约束，Flow 适合分支流程，Use For 帮助 router 匹配。Skill 与 MCP Tool 分工：Tool 是能力接口，Skill 是使用手册。定期 prune 低频 Skill，避免 router 选择空间过大导致误触发。评测时可统计 skill_trigger_rate 与 task_success 的交叉表，删除从未成功过的 Skill 或改写 description。

## 实践小结

练习：为一个代码审查场景写 SKILL.md（触发词、检查清单、输出模板）。测试误触发率：用 10 条无关请求统计是否错误加载。与裸 Prompt 比 token 与一致性，验证 Skill 是否值得维护。

## 工程检查清单

检查清单：SKILL.md 是否含 Use For；与 MCP Tool 是否 dedupe；低频 Skill 是否 prune；误触发率是否监控；Skill 版本是否 Git 管理；加载后 token 增量是否可接受。Skills 是知识管理问题，不是文件越多越好。

## 读者 takeaway

读者 takeaway：Skills 把隐性 SOP 显性化，降低每轮推理成本。维护 Skills 要像维护 API 文档：精悍、可测、可 prune，避免 Skill 库变成第二个混乱的 Prompt 堆。

## 学习建议
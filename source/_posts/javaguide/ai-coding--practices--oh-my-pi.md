---
title: "oh-my-pi 开源终端 AI 编码代理体验"
date: 2026-06-09 08:50:00
updated: 2026-06-09 08:50:00
permalink: knowledge/ai-coding/practices/oh-my-pi/
categories:
  - AI 编程
tags:
  - oh-my-pi
  - 终端 Agent
  - LSP
description: "oh-my-pi 终端 Agent 的 Hashline 补丁、LSP 集成与多模型路由体验。"
---

oh-my-pi 通过 Hashline 精细补丁与 LSP 集成，适合希望终端 Agent 更「编辑器化」的用户。

<!-- more -->

## 适用场景

想要 Claude Code 之外的终端 Agent；重视增量 patch 而非整文件覆盖；需要 LSP 跳转/诊断辅助 Agent。

## 方法与要点

Hashline 按行哈希应用补丁，减少冲突。内置工具链可接 GitHub issue。多模型路由为 planner/coder/reviewer 分角色。首次配置 provider 与 web search 策略。Kimi 等第三方按文档接入。

## 工作流

初始化选模型 → 绑定 repo → issue 驱动任务 → Hashline 应用 → LSP 报错反馈循环。大任务拆 role 切换而非单模型硬扛。

## 风险

Hashline 与本地未保存编辑冲突；多模型路由成本不透明；LSP 大项目索引慢。

## 检查清单

- [ ] provider 密钥环境变量化
- [ ] patch 前工作区 clean
- [ ] 角色-模型映射 documented
- [ ] issue 范围与分支一致
- [ ] 与主 Agent 栈职责划分清晰

## 落地建议

把「oh-my-pi 开源终端 AI 编码代理体验」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
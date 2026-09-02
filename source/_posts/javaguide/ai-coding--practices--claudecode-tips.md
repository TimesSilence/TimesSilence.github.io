---
title: "Claude Code 使用指南：配置、工作流与进阶技巧"
date: 2026-05-07 12:08:00
updated: 2026-05-07 12:08:00
permalink: knowledge/ai-coding/practices/claudecode-tips/
categories:
  - AI 编程
tags:
  - Claude Code
  - MCP
  - 工作流
description: "Claude Code 配置、权限、MCP、Skills 与日常后端工作流实践。"
---

稳定使用 Claude Code 的关键是权限边界、规则文件与 MCP 工具的可预期组合。

<!-- more -->

## 适用场景

新团队落地 Claude Code；需要从补全升级到 Agent 化改库、跑测试、接 Issue tracker。

## 方法与要点

配置分层：用户级默认、项目级 CLAUDE.md、本地 `.claude/settings`。权限默认最小，逐步放开 bash/git_write。MCP 接 JIRA/DB 只读先行。Sub-agent 读大仓库，主 agent 写 patch。Plan mode 用于 unfamiliar 模块。

## 工作流

晨会列任务 → 开 plan 会话探路 → 实现会话小 commit → verify → PR。遇错贴完整 stderr，而非「失败了帮我修」。定期 `/compact` 或新会话 handoff 摘要。

## 风险

过度授权导致 `rm -rf` 类事故；MCP 写库无审计；Sub-agent 结果未验证即合并。

## 检查清单

- [ ] 权限矩阵文档化
- [ ] MCP 工具只读/读写分级
- [ ] 关键目录 protected
- [ ] handoff 模板含未决问题
- [ ] 版本升级后回归 smoke test

## 落地建议

把「Claude Code 使用指南」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
---
title: "Claude Code Hooks 详解：生命周期钩子与自动化工作流"
date: 2026-07-11 14:32:00
updated: 2026-07-11 14:32:00
permalink: knowledge/ai-coding/principles/claude-code-hooks/
categories:
  - AI 编程
tags:
  - Hooks
  - Claude Code
  - 自动化
description: "用 Hooks 在工具调用前后注入格式化、测试与安全拦截。"
---

Hooks 把软提示变成可审计的自动化，适合团队级一致动作。

<!-- more -->

## 适用场景

每次改完必须跑 formatter/linter；阻止 Agent 修改 secrets 路径；提交前自动单测；Slack 通知长任务完成。

## 方法与要点

生命周期：PreToolUse/PostToolUse/Stop 等（以当前版本文档为准）。Handler 可为 command 或 prompt。输入输出 JSON 可 block 或 modify。典型：PostEdit 跑 prettier；PreBash 拦截 `curl | sh`。失败应 fail open 或 closed 由团队定。

## 工作流

hooks.json 进 repo → CI 校验 schema → 本地 claude 触发 smoke → 渐进上线 block 规则。与 CLAUDE.md 互补：Hooks 强制执行，规则文件指导行为。

## 风险

Hook 脚本无 timeout 卡死；fail closed 阻断合法操作；secret 打进 hook 日志。

## 检查清单

- [ ] Hook 脚本 idempotent
- [ ] 超时与错误处理
- [ ] 阻断规则有例外流程
- [ ] 版本升级回归 hook
- [ ] 审计日志不含敏感数据

## 落地建议

把「Claude Code Hooks 详解」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
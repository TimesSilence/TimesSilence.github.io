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
description: "Claude Code 日常实战技巧：/clear 与上下文控制的时机、小步提交的 Git 协作节奏、权限模式的分层配置与成本意识。"
---

Claude Code 用得不顺，多半不是模型问题，而是会话、上下文、权限和节奏这些工程习惯没跟上。

<!-- more -->

## 会话管理：什么时候该 /clear

一个会话里混着聊需求、排错、重构，Claude 很容易带着上个话题的惯性做下一件事。两个信号提示该 `/clear`：任务目标变了；或者同一处错误纠正三次仍不对——说明上下文已积累太多错误假设，不如重开一局写清目标、证据和禁止动作。跨会话交接别依赖记忆，长任务结束前让它输出 handoff 摘要（已完成改动、未决问题、下一步验证命令），新会话带摘要开工。

## 上下文控制：先诊断，再压缩

会话变长、开始遗忘约束时，先 `/context` 看占用来源，确认值得继续再带保留清单压缩：

```bash
/compact 只保留当前重构目标、已完成改动、剩余 TODO、关键约束
```

裸跑 `/compact` 容易把仍在用的约束压掉；压缩后子目录规则不一定马上回来，继续前让它复述目标和剩余风险。源头治理更重要：`CLAUDE.md` 只写"删掉就会犯错"的规则，低频流程沉淀成 Skill 按需加载。

## Git 工作流：小步快跑

别让 Claude 一次交付一大坨改动。拆成一个 commit 只做一件事，提交前要求给出 diff 摘要、验证命令和剩余风险，自己再过一遍 `git diff --stat`——它说"只改了认证逻辑"不算数，亲眼看到的 diff 才算数。多任务并行用 `claude --worktree feature-auth` 开独立目录和分支，互不踩踏。

## 权限模式：分层放开

默认逐项确认是安全网，熟悉执行习惯前别嫌烦，之后按风险分层：

```json
{
  "permissions": {
    "allow": ["Bash(git status*)", "Bash(rg *)"],
    "deny": ["Read(./.env)", "Bash(rm -rf *)"]
  }
}
```

关键：权限由客户端执行层拦截，Prompt 里写"不要读 .env"只是建议，deny 才是硬约束。交互中用 `Shift+Tab` 切模式比把高权限写进脚本稳妥；`--dangerously-skip-permissions` 只考虑容器等隔离环境。

## 成本意识

长会话、`/loop` 轮询、多后台会话都在持续烧 Token。长任务前后用 `/usage` 看消耗，`/statusline` 把上下文占用和成本常驻状态栏；循环任务务必设上限轮次，只读巡检默认只汇报不动手。

## 小结

- 话题切换或纠正三次无果就 `/clear`，交接用书面摘要。
- `/context` 先诊断，`/compact` 带保留清单，规则文件保持精简。
- 小步提交、Worktree 隔离，diff 亲眼看；权限分层，硬约束交给 deny；循环任务设上限。
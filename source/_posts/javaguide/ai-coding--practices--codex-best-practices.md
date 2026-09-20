---
title: "Codex 使用指南：配置、AGENTS.md 与 Agentic 工作流"
date: 2026-05-18 14:22:00
updated: 2026-05-18 14:22:00
permalink: knowledge/ai-coding/practices/codex-best-practices/
categories:
  - AI 编程
tags:
  - Codex
  - AGENTS.md
  - OpenAI
description: "OpenAI Codex CLI 实战：与 Claude Code 的定位差异、审批模式与沙箱机制、AGENTS.md 约定文件的写法与分层。"
---

Codex 更像一个能自己读仓库、改文件、跑命令再回来交差的工程助手。用好它的前提是先把工作台摆好：任务边界、权限、项目规则和验收标准。

<!-- more -->

## 定位：与 Claude Code 差在哪

两者能力面高度重叠——计划阶段、Subagents、Hooks、定时任务都有对应物，只是命名不同。真正的差异在约定文件：`CLAUDE.md` 是 Claude Code 专属入口，`AGENTS.md` 则是面向 coding agents 的开放格式，Codex 官方支持，Cursor 等工具也在跟进。团队混用多款工具时，通用规则沉淀到 `AGENTS.md`，工具专属要求各自保留，`CLAUDE.md` 里用 `@AGENTS.md` 直接引用即可，避免双份维护导致的规则漂移。

## 审批模式与沙箱：执行层的硬边界

安全控制落在 `config.toml` 的 sandbox 与 approval 两层。沙箱决定"能碰到什么"：`read-only` 只读不写，适合先做分析；`workspace-write` 允许在工作区改文件、跑验证，是日常合理默认；`danger-full-access` 不隔离文件系统，只该出现在容器等隔离环境。审批策略决定"何时停下来问人"：`on-request` 越界时请求确认，`never` 全程不问，前提是环境已隔离好。

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

两个细节：项目级 `.codex/config.toml` 只有项目被标记 trusted 后才加载，别人仓库的配置不能默认全信；`AGENTS.md` 只是软提醒，沙箱和审批才是硬约束——"不要执行 `rm -rf`"写进指令模型可能忘，配成 Rules 的 forbidden 才会真正拦截。

## AGENTS.md：写给 Agent 的工作说明

它不该是第二份 README，只放 Agent 真会用到的信息：容易猜错的规则、代码里读不出的约定、构建与测试命令、验收标准。判断标准就一句——删掉后 Codex 会不会更容易犯错？会就留，不会就删。

规模上来后做渐进式披露：根目录文件保持短小（OpenAI 自己的约 100 行），充当索引指向 `docs/` 详细文档；子目录放局部约定；`AGENTS.override.md` 用于临时覆盖。注意合并后的项目指令默认有 32 KiB 上限，文件越胖关键规则越容易被淹没。`/init` 生成的初稿只能当草稿，人工删一轮再提交。

## 工作流要点：让它证明改对了

任务描述带四要素：目标、上下文、约束、完成标准，Done when 写成可验证证据而非"功能正常"。高风险改动先进计划阶段，只读分析后由人确认再执行。收尾固定要三样东西：`/diff` 改动清单、跑过的命令与结果、没覆盖的风险点；测试先红后绿。Codex 的总结永远不能代替你自己看 diff。

## 小结

- 通用规则进 `AGENTS.md`，工具专属要求各自保留，单一来源防漂移。
- 日常用 `workspace-write` + `on-request`，更宽权限只给隔离环境。
- `AGENTS.md` 保持短小做索引；验证证据写进任务，diff 必须亲眼看。
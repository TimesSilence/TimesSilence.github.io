---
title: "Claude Code 核心命令详解：code-review、loop、goal、batch、run、verify"
date: 2026-05-01 11:01:00
updated: 2026-05-01 11:01:00
permalink: knowledge/ai-coding/practices/claudecode-commands/
categories:
  - AI 编程
tags:
  - Claude Code
  - 命令
  - 自动化
description: "把重复 Prompt 固化成自定义斜杠命令：项目级与用户级命令文件的组织、参数与 front matter 写法、常用命令设计示例及与内置命令的搭配。"
---

斜杠命令把反复使用的 Prompt 固化成可调用入口。Claude Code 除内置命令外，还允许用 Markdown 文件自定义命令，把团队约定沉淀进仓库。

<!-- more -->

## 为什么固化成命令

同一个要求手写三遍以上，就该做成命令。口头描述每次都有出入：今天让模型检查事务边界，明天可能就忘了提。写成命令后，检查项、输出格式、禁止动作全部固定，结果稳定且可审计；命令文件进 Git，团队跑的是同一套标准，调用只需 `/` 加几个字符。

## 命令文件的组织

自定义命令是 Markdown 文件，文件名即命令名，目录决定作用范围：

```text
.claude/commands/review.md    → 项目级 /review，随仓库共享
~/.claude/commands/review.md  → 用户级，仅自己生效
.claude/commands/fe/lint.md   → /fe/lint，子目录即命名空间
```

同名时项目级优先。新版本 custom commands 已并入 Skills：`.claude/commands/deploy.md` 与 `.claude/skills/deploy/SKILL.md` 都会生成 `/deploy`，新内容更推荐按 Skill 组织。

## 参数与 front matter

正文用 `$ARGUMENTS` 接收调用参数，front matter 声明元信息：

```markdown
---
description: 审查当前 diff 的事务边界
allowed-tools: Read, Grep, Bash(git diff*)
---
审查 $ARGUMENTS 的变更，按严重级别输出问题，只报告不改代码。
```

`allowed-tools` 把命令约束在最小工具集——审查类命令不给写权限，误操作风险直接降一档。

## 常用命令设计示例

- **fix-issue**：固定"读 issue → 定位 → 先补复现测试 → 改实现 → 贴测试结果"的流程。
- **commit**：约定一个 commit 只做一件事，生成 message 前先输出 diff 摘要。
- **nightly-check**：封装只读巡检 Prompt，交给 `/loop` 定时触发。

设计原则只有一条：写模型容易漏掉的约束，不复述它本来就会做的事。

## 与内置命令的分工

自定义命令管流程，内置命令管通用能力：`/code-review` 查正确性，`/simplify` 做清理，`/verify` 跑构建检查，`/loop` 定时重复，`/goal` 按验收条件持续推进，`/batch` 并行多模块改动。把内置命令当积木，编进自己的命令文件即可。

## 小结

- 重复三遍的 Prompt 固化成命令：项目级共享，用户级放个人偏好，子目录自动成命名空间。
- `$ARGUMENTS` 接参数，front matter 收紧工具权限；自定义命令编排流程，内置命令提供通用能力。
---
title: "Claude Code Skills 技术实现细节与运行方式"
date: 2026-07-21 16:46:00
updated: 2026-07-21 16:46:00
permalink: knowledge/ai-coding/principles/claude-code-skills/
categories:
  - AI 编程
tags:
  - Skills
  - Claude Code
  - 实现原理
description: "Skills 是按需加载的工作流包：平时只暴露名称和描述，命中时才加载正文。本文讲清 SKILL.md 的结构与发现机制、与自定义命令的关系、渐进式披露设计，以及编写好技能的要点。"
---

代码审查清单、PR 总结流程、线上排查步骤——这些流程有用但不是每轮任务都需要，全塞进 `CLAUDE.md` 只会变成常驻的上下文成本。Skills 的答案是按需加载：平时只让模型知道「有这项能力」，真正命中时才展开完整说明。

<!-- more -->

## Skills 是什么

Skill 可以理解为一份按需打开的操作手册。与几类相邻机制的分工是：`CLAUDE.md` 放每轮都要遵守的常驻规则，Skill 放特定任务才用的流程，Subagent 解决「谁来做」的任务委派，Plugin 负责把 Skills、Agents、Hooks 打包分发。判断标准很朴素：如果你开始反复复制同一段提示词，或 `CLAUDE.md` 里某一节长到读起来像手册，它就该变成 Skill 了。

## 定义与加载

一个 Skill 是一个目录，核心是 `SKILL.md`：

```text
.claude/skills/
  pr-summary/
    SKILL.md
    scripts/
      collect-pr-info.sh
    references/
      review-checklist.md
```

`SKILL.md` 由两部分组成：YAML frontmatter 描述元数据，Markdown 正文是真正发给模型的操作说明。最小例子：

```markdown
---
name: pr-summary
description: Summarize a pull request and list key risks
allowed-tools: Bash(gh *)
---

Read the pull request diff and comments, then summarize:

1. Main changes
2. Risky files
3. Missing tests
```

常用字段里，`description` 最关键——模型靠它判断何时自动使用；`allowed-tools` 收窄该 Skill 可用的工具范围；`context: fork` 让长流程在子代理上下文里运行；`disable-model-invocation` 则禁止模型自动调用、只允许手动 `/skill-name`。大多数 Skill 只需要 `description`、`allowed-tools` 和正文，别一上来堆满字段。

发现路径上，用户级放 `~/.claude/skills/` 对所有项目生效，项目级放 `.claude/skills/` 随仓库共享；此外还有组织统一下发、内置（如 `/code-review`、`/debug`）和插件提供的来源。支持参数替换：`$ARGUMENTS` 取全部参数，`$0`、`$1` 按位置取值。

## 与自定义命令的关系

自定义命令已经并入 Skills 体系：`.claude/commands/deploy.md` 和 `.claude/skills/deploy/SKILL.md` 现在都能创建 `/deploy`，旧目录保持兼容。区别在于能力上限——普通命令只是一段提示词模板，Skill 还能声明工具权限、绑定子代理上下文、携带脚本与参考文件。新写能力建议直接用 `SKILL.md` 形式。

## 渐进式披露设计

这是 Skills 省上下文的核心机制，分三层：

1. **元数据常驻**：启动时只加载名称、描述等 frontmatter 信息，模型据此知道有哪些能力可用；
2. **正文按需**：用户执行 `/skill-name` 或模型判断相关时，才把 Markdown 正文渲染成 prompt——参数替换、内嵌只读命令的执行都发生在这一步，模型看到的是渲染结果而非命令本身；
3. **材料再下沉**：长清单、模板、脚本说明放进 `scripts/`、`references/`、`templates/`，正文里只写「什么情况下读哪个文件」，用得到才读。

所以 `SKILL.md` 不适合写成超长 README（建议控制在数百行内），正文优先写：什么时候用、按什么顺序做、哪些情况别做、失败怎么兜底。Skill 的价值在按需加载，不是换个目录继续堆规则；描述写太泛导致频繁误触发，它就反过来成了额外开销。

## 编写好技能的要点

- **触发写准**：`description` 清楚描述适用场景，必要时用 `when_to_use` 补充；只想手动调用的加 `disable-model-invocation`。
- **正文写骨架**：步骤、顺序、禁区、兜底；长材料放 supporting files，正文用 `${CLAUDE_SKILL_DIR}` 引用脚本路径，移动目录也不容易坏。
- **动态上下文只读**：内嵌命令（如 `git status --short`）只用于收集材料，别把改文件、提交、删除这类有副作用的命令写进去。
- **权限收窄**：`allowed-tools` 只放行必需的工具；长流程、重调研用 `context: fork` 跑在子代理里，主会话只收结果。
- **安全视同 CI 脚本**：Skill 里的脚本会以当前用户权限执行。安装第三方 Skill 前至少通读 `SKILL.md` 和脚本，确认没有危险命令和过宽权限；企业环境可用 `strictPluginOnlyCustomization` 限制扩展来源。

## 小结

1. Skills 把可复用流程从常驻上下文里拆出来，靠「元数据常驻、正文按需、材料下沉」三层渐进披露节省窗口。
2. `SKILL.md` = frontmatter 元数据 + Markdown 操作说明；`description` 决定自动触发质量，`allowed-tools` 与 `context: fork` 控制执行边界。
3. 自定义命令已并入 Skills；Skill 解决「怎么做」，Subagent 解决「谁来做」。
4. 好技能的标准：触发准确、正文是骨架、动态上下文只读、权限最小化、第三方来源先审计再启用。
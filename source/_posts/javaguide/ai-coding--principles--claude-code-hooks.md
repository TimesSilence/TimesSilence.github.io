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
description: "Hooks 把提示词里的软约束变成生命周期节点上的确定性动作：格式化、危险命令拦截、权限审计与通知。本文讲清事件模型、配置方式、输入输出契约与三个最小可用示例。"
---

「改完代码记得格式化」「不要碰 `.env`」这类写在规则文件里的要求，任务一长就可能被漏掉。Hooks 的思路是把它们从提示词里拿出来，挂到 Agent 生命周期的关键节点上自动执行——把软约束变成可审计、可复用的确定性卡点。

<!-- more -->

## Hooks 解决什么问题

提示词约束依赖模型的遵从度，天然不可靠。Hooks 与 pre-commit、CI、lint-staged 是同一类思路：把固定动作写进流程，留下可检查的执行结果，不依赖模型「记得做」。区别只在挂载点——Hooks 挂在 Claude Code 的生命周期事件上：会话开始、用户提交 Prompt、工具调用前后、权限决策、响应结束、上下文压缩等。

一个 Hook 配置由事件和 handler 组成：事件决定什么时候触发，handler 拿到当时的输入并完成动作。handler 有五类：

| 类型 | 做什么 | 适合场景 |
| --- | --- | --- |
| `command` | 执行 shell 命令 | 格式化、拦截、通知、日志 |
| `http` | 把事件 JSON POST 到 URL | 团队审计、远程策略 |
| `mcp_tool` | 调用已连接的 MCP 工具 | 复用现有 MCP 能力 |
| `prompt` | 一次模型判断返回结构化结果 | 轻量语义检查 |
| `agent` | 启动子代理做验证 | 需要读文件跑命令的检查 |

能写成确定脚本的规则优先用 `command`——可脱离 Claude Code 单独测试、可进代码审查；只有语义判断无法写成确定规则时才考虑 `prompt` 或 `agent`。注意不同事件支持的 handler 类型有差异，配置前对照当前版本文档确认。

## 配置方式

Hooks 写在 settings 文件里：`~/.claude/settings.json` 管个人全局，`.claude/settings.json` 随仓库共享给团队，`.claude/settings.local.json` 放本机私有配置。一个最小配置：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

三层结构：事件名 `PostToolUse` 表示工具调用成功后触发；`matcher` 是过滤条件，`Edit|Write` 表示只在改文件工具之后触发（省略或留空等于每次触发都执行）；`hooks` 数组里是真正执行的 handler。matcher 要贴着实际输入写窄——检查 shell 风险就匹配 `Bash`，别让无关调用都启动脚本。

## 输入输出契约

Hook 触发时，事件上下文以 JSON 传给 handler（`command` 走 stdin）。公共字段包括 `session_id`、`cwd`、`hook_event_name` 等，工具相关事件还带 `tool_name` 和 `tool_input`。脚本里用 `jq` 解析，别用 grep 拼字段。

输出侧的规则容易踩坑：

- 想返回结构化决策（如 `PreToolUse` 的 allow/deny），用 `exit 0` 并让 stdout 只输出一个 JSON 对象；
- 想阻断，大多数事件用 `exit 2`，原因写 stderr；
- `exit 1` 最容易误用——对多数事件它只是非阻断错误，流程照常继续；
- stdout 别混调试日志，否则 JSON 解析失败，调试信息一律走 stderr 或日志文件。

同一事件命中多个 Hook 时会并行执行再合并结果：`PreToolUse` 里多个决策取更严格的那个，但一个 Hook 返回 deny 不会阻止旁边的 Hook 写日志——每个有副作用的 Hook 都该自己判断是否执行。

## 典型用例

**自动格式化（PostToolUse）**：上面的最小配置就是。实际项目建议把命令写成独立脚本，按文件后缀分发到 prettier、ruff、google-java-format 等项目已有工具，不为 Hook 新造格式化体系。

**危险命令与敏感文件拦截（PreToolUse）**：工具执行前检查 `tool_name` 和 `tool_input`，命中风险即 `exit 2` 阻断：

```bash
#!/usr/bin/env bash
set -euo pipefail
input="$(cat)"
tool="$(jq -r '.tool_name // empty' <<<"$input")"
cmd="$(jq -r '.tool_input.command // empty' <<<"$input")"
file="$(jq -r '.tool_input.file_path // empty' <<<"$input")"

if [[ "$tool" == "Bash" ]] && [[ "$cmd" =~ rm[[:space:]]+-rf ]]; then
  echo "Blocked risky command: $cmd" >&2
  exit 2
fi
if [[ "$tool" == "Edit" || "$tool" == "Write" ]]; then
  case "$file" in
    *.env|*/.git/*|*id_rsa*) echo "Blocked sensitive file: $file" >&2; exit 2 ;;
  esac
fi
exit 0
```

黑名单只能识别写出来的形式，路径限制、权限配置、Sandbox 和人工 review 仍要保留，不能因为加了 Hook 就删掉。

**通知（Notification）**：等待权限确认时弹系统通知，几乎不碰代码、风险最低，适合作为第一个配置的 Hook。

## 落地建议

按 Notification → PostToolUse → PreToolUse 的顺序渐进接入：先用通知验证配置加载和 matcher 命中，再把格式化接到项目已有工具上，最后再上线会阻断工具调用的规则——从日志观察误拦情况，逐步收紧。Hook 脚本必须幂等、带超时与错误处理；调试时先运行 `/hooks` 确认配置已加载，再把脚本拿出来用模拟 JSON 单独跑，一次只启用一个。

## 小结

1. Hooks 在生命周期节点自动执行确定性逻辑，补上提示词保证不了的那一段；与规则文件是「强制执行」与「指导行为」的互补关系。
2. 配置 = 事件 + matcher + handler；输出契约里 `exit 0` + JSON 做决策、`exit 2` 做阻断、`exit 1` 不阻断，stdout 只放 JSON。
3. 三个起步用例：PostToolUse 自动格式化、PreToolUse 拦截危险操作、Notification 权限提醒；安全规则宁可收紧慢补，也别一上来全局自动批准。
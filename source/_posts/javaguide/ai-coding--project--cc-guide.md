---
title: "在 IDEA 中使用 Claude Code 和 Codex：CC GUI 上手指南"
date: 2026-07-30 08:00:00
updated: 2026-07-30 08:00:00
permalink: knowledge/ai-coding/project/cc-guide/
categories:
  - AI 编程
tags:
  - IDEA
  - CC GUI
  - Codex
description: "CC GUI 是 MIT 开源的 JetBrains 插件，为 Claude Code 与 Codex 提供可视化界面。本文按 v0.4.7 快照讲清安装、认证、Diff 工作流与 Qoder 的选型差异。"
---

CC GUI 是一款 MIT 协议的开源 JetBrains 插件，为 Claude Code 和 OpenAI Codex 这两个终端 Agent 补上图形界面：会话、diff 审查、MCP 配置都在 IDEA 内完成。本文以 v0.4.7 为快照介绍安装、认证与典型用法，插件迭代较快，细节以项目 README 为准。

<!-- more -->

## 背景：它解决什么问题

Claude Code、Codex 这类 CLI Agent 能力强，但看 diff、贴截图、管理会话在终端里都不够直观。JetBrains 体系内有两条补齐路线：

- **ACP 路线**：IDE 内置 Agent 集成、ACP Registry 中的 Agent、手动配置的 ACP Agent，复用 JetBrains 的 AI Chat 与 Diff 能力。这三者是不同层次的能力，不能统称"官方插件"，可用范围随 IDE 版本与账户变化。
- **CC GUI 路线**：独立社区插件，专为 Claude Code/Codex 做会话管理、图片输入、Agent 与 MCP 的 GUI 封装。

两条路线不冲突，按偏好选择即可。以 v0.4.7 为基准，CC GUI 提供的能力包括：双引擎支持（供应商设置中切换）、可视化对话（`@file` 引用、图片发送、对话回退）、Agent 与 Slash 命令、IDEA 内的 Diff 对比（支持文件导航与代码跳转）、会话历史管理与导出。

## 安装与配置

### 第一步：装插件与 SDK

**Settings → Plugins** 搜索 **CC GUI** 安装，之后 IDEA 右侧工具栏会出现入口。首次使用按提示安装 Claude Code/Codex SDK，这是 Agent 运行的基础。

**黑屏问题**：部分环境（如 IDEA 2026.1）打开面板会黑屏。可先清除 IDE 内置浏览器缓存；无效的话，社区 Issue 中有人通过 **Help → Edit Custom VM Options** 添加以下参数绕过：

```bash
-Dide.browser.jcef.out-of-process.enabled=false
-Dide.browser.jcef.gpu.disable=true
```

注意这只是部分 JCEF/显卡环境下有效的 workaround，关联 Issue 尚未关闭，且参数可能影响 JCEF 隔离与硬件加速，不应视为确定修复。

### 第二步：配置模型供应商

插件当前支持的认证方式各有适用边界：

- **Claude.ai OAuth 登录**：Claude 订阅用户通过账户授权使用 Claude Code；
- **Anthropic API Key**：来自 Anthropic Console，按用量单独计费——订阅不会自动附带 API Key；
- **复用 CLI 登录态**：若当前版本支持，可复用既有 OAuth 状态，但这不等于插件会去读 `settings.json`；
- **导入本地 Provider 配置或 cc-switch 配置**：导入前确认插件实际读取的字段与密钥存储方式；
- **第三方代理端点**：可自定义，但兼容性、数据处理与密钥安全由代理服务决定。

Codex 侧官方支持 ChatGPT 登录与 API Key 两种途径，套餐与计费不同，插件是否支持对应流程以当前版本为准。

## 核心用法：以批量代码审查为例

一个高频场景是"审查已有代码是否符合规范并批量修复"——手动做极其枯燥。CC GUI 支持 Skill（斜杠命令），可把审查流程整理成可复用入口。例如配置好一个包含 Java 与 Spring Boot 审查规则的 `java-coding-standards` Skill 后，在对话框输入：

```text
/java-coding-standards 检查一下 @infrastructure 下的代码
```

Skill 加载审查规则，`@infrastructure` 指定范围。一次演示中 Agent 读取了目录下 14 个 Java 文件，输出按严重度分级的结构化报告：日志只记 `e.getMessage()` 丢失堆栈、自定义异常缺少错误码、返回 `Map<String, Object>` 而非专用 DTO、资源未用 try-with-resources 等。随后让它逐文件生成候选修复，在 Diff 面板逐项审查。这次演示涉及 9 个文件、20 多处改动，从审查到编译验证不到五分钟——耗时只代表该样例，代码规模与验收要求不同结果会不同。

Skill 的价值在于把"审什么、按什么步骤审"固化下来，提高检查口径的一致性；但它不能保证跨模型、跨上下文结果完全一致，团队标准仍要落在可版本化的规则、静态检查与 Review 流程里。

此外插件还内置使用统计（Token 消耗、费用与趋势）、Commit AI（按 diff 生成提交说明）、自定义智能体、提示词库与 MCP 服务器管理，历史消息支持搜索与删除。

## CC GUI 和 Qoder 怎么选

两者定位不同，简要对比：

| 维度 | CC GUI | Qoder |
| --- | --- | --- |
| 定位 | Claude Code / Codex 的 GUI 壳 | 独立的 AI 编程 Agent |
| 开源 | MIT，完全开源 | 闭源 |
| 模型 | Claude Code + Codex，以版本为准 | 内置及当前可选模型 |
| 上下文 | `@file` 引用 + 图片输入 | `@database` + `@file` |
| 适合场景 | 已有 CLI 工作流想搬进 JetBrains | 想要开箱即用的一体化 Agent |
| Java 优化 | 通用 | 对 Java 生态有针对性优化 |

建议：已有 Claude Code/Codex 工作流的，可以评估 CC GUI，但先确认插件支持的认证方式与功能映射——GUI 不保证完整继承 CLI 的全部能力；不想折腾 API 配置的选 Qoder；两个都装也不冲突，按场景切换。

## 小结

- CC GUI 的核心价值是补齐 JetBrains 用户的可视化工作流，把终端、截图工具、文件管理器里分散的操作压回 IDE 内。
- 安装链路：插件 → SDK → 供应商认证；黑屏等环境问题先查缓存与 JCEF 参数 workaround。
- 典型用法是"Skill + @目录"的批量审查与小粒度 diff 验收；与 Qoder 按"GUI 壳还是一体化 Agent"来区分选型。
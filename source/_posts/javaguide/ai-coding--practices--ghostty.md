---
title: "比 iTerm2 更适合 Claude Code/Codex 的终端，我换成 Ghostty 了"
date: 2026-05-29 16:36:00
updated: 2026-05-29 16:36:00
permalink: knowledge/ai-coding/practices/ghostty/
categories:
  - AI 编程
tags:
  - Ghostty
  - 终端
  - Claude Code
description: "Ghostty 终端在 AI CLI 工作流中的安装、分屏与集成配置要点。"
---

CLI Agent 长时间占用终端，渲染性能与分屏能力直接影响并行排查效率。

<!-- more -->

## 适用场景

日常在终端跑 Claude Code/Codex；需要多分屏对照日志、vim 与 agent 输出；macOS/Linux 寻求轻量替代 iTerm2。

## 方法与要点

Ghostty GPU 渲染降低大日志滚动卡顿。配置字体（Nerd Font）、主题、Quick Terminal 呼出。分屏快捷键固定布局：左 agent、右测试。Shell Integration 保留 cwd 与命令状态。SSH 远程开发时注意 locale 与键位。

## 工作流

本机 Ghostty + tmux/zellij 可选；每 agent 会话一 pane；Starship 提示符显示 git 分支。更新配置热加载，减少重启中断长任务。

## 风险

远程 SSH 配色/字体缺失；分屏过细看不清 diff；与 tmux 键位冲突。

## 检查清单

- [ ] 等宽字体与 ligature 关闭
- [ ] 分屏布局文档化
- [ ] Quick Terminal 不挡 agent 输入
- [ ] SSH  config 同步
- [ ] 升级前备份配置路径

## 落地建议

把「比 iTerm2 更适合 Claude Code/Codex 的终端，我换成 Ghostty 了」相关的动作写进团队 Wiki 或 CLAUDE.md，并在两次 Sprint 里刻意练习：一次只用 IDE 路径，一次只用 CLI 路径，对比 PR 大小、缺陷率与 review 耗时。记录哪些步骤必须人工签核、哪些可以交给 Agent 自治，比争论工具优劣更能沉淀可复用经验。
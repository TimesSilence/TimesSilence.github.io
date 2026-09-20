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
description: "Ghostty 终端的定位与特点、与 iTerm2/Alacritty 的对比、安装配置要点，以及与 Claude Code 等 AI CLI 工具的搭配方式。"
---

跑 Claude Code、Codex 这类 CLI Agent 时，终端就是你的工作台：Agent 输出、测试、日志、Git 挤在同一个窗口里。Ghostty 的思路是把终端模拟器这一件事做好——GPU 渲染、原生分屏、可读的纯文本配置，下载下来就基本能用。

<!-- more -->

## 定位与特点

Ghostty 不内置 AI，也不做服务器管理，只做终端模拟器。它的几个特点恰好踩在 AI CLI 工作流的需求上：

- **GPU 渲染**：Agent 长时间输出大段日志和 diff 时，滚动卡顿明显更少。
- **原生分屏与标签页**：不依赖 tmux 就能把 Agent、测试、日志摆进一个窗口。
- **默认即好用**：内置 JetBrains Mono 和 Nerd Fonts 能力，大多数人不配字体也能直接用，省去 iTerm2 那种漫长的调校过程。
- **配置可读**：纯文本 `key = value` 格式，改完可热加载，不会打断正在跑的长任务。

## 与 iTerm2、Alacritty 的对比

iTerm2 是 macOS 上的老牌全能选手，分屏、Profile、触发器一应俱全，但要调到顺手通常得花不少时间配字体、主题和快捷键。Alacritty 和 Ghostty 一样走 GPU 渲染的极简路线，但功能克制得多——长期不提供原生分屏和标签页，多窗口管理通常要搭配 tmux。Ghostty 介于两者之间：保持轻快，又把分屏、标签页、主题这些日常刚需直接内置。

| 维度 | Ghostty | iTerm2 | Alacritty |
| --- | --- | --- | --- |
| 渲染 | GPU | 常规 | GPU |
| 分屏/标签页 | 原生内置 | 原生内置，功能最全 | 不提供，依赖 tmux |
| 配置 | 纯文本 key=value，量少 | 图形界面，选项繁多 | 纯文本，选项极简 |
| 上手成本 | 默认即可用 | 需要花时间调校 | 需要自己拼装周边 |

## 安装与配置要点

macOS 用 Homebrew 一条命令，也可以去官网下 `.dmg`：

```bash
brew install --cask ghostty
```

装完确认版本：

```bash
ghostty +version
```

配置文件是 `key = value` 格式，推荐文件名 `config.ghostty`：

```text
~/.config/ghostty/config.ghostty
~/Library/Application Support/com.mitchellh.ghostty/config.ghostty
```

两个路径同时存在时，macOS 的 Application Support 路径后加载，冲突项会覆盖前面的值——配置不生效先查这里。常用检查命令：

```bash
ghostty +list-fonts
ghostty +list-themes
ghostty +validate-config
```

一份够用的最小配置：

```ini
font-family = "JetBrainsMono Nerd Font Mono"
font-size = 14
theme = Catppuccin Mocha
window-padding-x = 12
window-padding-y = 10
shell-integration = detect
copy-on-select = false
clipboard-paste-protection = true
```

几个要点：中文不要直接当中文字体塞第二个 `font-family`，用 `font-codepoint-map` 把中文码位单独交给中文字体，避免英文落入中文字体导致字距怪异；`clipboard-paste-protection` 建议留着，从网页粘贴多行命令时多一道确认；macOS 下改完配置按 `Cmd + Shift + ,` 热加载，透明度这类窗口项不生效就重启。

分屏记住三个键就够：`Cmd + D` 向右分屏，`Cmd + Shift + D` 向下分屏，`Cmd + Shift + Enter` 临时放大当前分屏。`shell-integration = detect` 建议开启，新分屏会继承当前目录，不会跳回 home。

## 与 AI CLI 工具的搭配

推荐的三块布局：`Cmd + D` 先左右分屏，光标移到右侧再 `Cmd + Shift + D` 上下分——左边跑 Claude Code，右上跑测试，右下看日志或 Git。Agent 输出刷屏时按 `Cmd + Shift + Enter` 放大细看，看完恢复。这个布局不用 tmux 也不用拖多个窗口。

两个容易踩的坑：一是字体名以 `ghostty +list-fonts` 的实际输出为准，写了没安装的字体名会触发 fallback，英文落到中文字体上字距就会变怪；二是 SSH 到远程主机后，对方可能不认识 Ghostty 的 terminfo，Neovim、htop 这类 TUI 出现显示异常时，再考虑在 `shell-integration-features` 里加上 SSH 相关项，没问题时少加一层包装。

想让 prompt 显示 Git 分支和命令耗时，可以叠一个 Starship：

```bash
brew install starship
```

在 `~/.zshrc` 末尾加一行初始化即可。Starship 模块别全开，目录、Git 分支、Git 状态、耗时够用，信息太满每次回车都要多算一截。Quick Terminal（从屏幕上方滑下的临时终端）适合临时跑命令，但它没有默认快捷键，需要自己绑定，也别拿它承载整天的主工作流。

## 小结

- Ghostty 定位是「把终端模拟器做好」：GPU 渲染、原生分屏、默认好用、配置可读。
- 相比 iTerm2 省去大量调校，相比 Alacritty 多了原生分屏与标签页，取舍介于两者之间。
- 配置先跑默认值，再按实际问题改字体、主题和快捷键；配置不生效先查两个加载路径，再跑 `+validate-config`。
- 搭配 AI CLI 的核心动作是固定分屏布局：左 Agent、右上测试、右下日志，长输出时单屏放大。
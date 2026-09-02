---
title: "LLM/Agent 安全实战：从 Prompt Injection、工具越权到沙箱隔离"
date: 2026-02-06 08:30:00
updated: 2026-02-06 08:30:00
permalink: knowledge/ai/system-design/llm-security/
categories:
  - 人工智能
tags:
  - 安全
  - Prompt Injection
  - Agent
  - 沙箱
description: "LLM/Agent 安全：注入、越权、检索权限与沙箱隔离。"
---

Agent 能执行工具时，安全面从「说错话」扩展到「做错事」。

<!-- more -->

## 威胁模型

Prompt Injection（直接/间接）；Jailbreak；工具越权；检索泄露未授权文档；供应链（恶意 Skill/MCP）。

## 防护

信任分区：系统指令 vs 用户 vs 外部检索。检索前 ACL；外部 HTML 先提取再入上下文；工具最小权限；写操作确认；沙箱跑代码。

## System Prompt 局限

「忽略恶意指令」不可靠——需输入过滤、输出策略、工具 allowlist。记录 audit 便于追责。

## 误区

认为 RAG 私有就安全；MCP 连上即信任；无 human-in-the-loop 高危操作。

## 延伸思考

间接注入常来自检索到的网页、邮件、PDF——攻击指令藏在正文里。缓解：检索结果 summarization 前先 strip 指令样式文本；工具参数白名单；输出 filter。多租户 RAG 必须在向量查询 filter 中带 tenant_id+acl，不能检索后再过滤——否则泄露已发生。Skill/MCP 供应链要做签名与来源审查。红蓝对抗演练：定期用注入样本打 Golden Set，监控 tool 越权尝试次数。

## 实践小结

练习：构造 5 条注入样本打测试环境，记录 tool 是否被误触发。检查 RAG 检索 SQL/DSL 是否在向量查询前带 acl。写高危 tool 人工确认流程。

## 工程检查清单

检查清单：注入样本集；检索 ACL 前置；tool allowlist；Skill 供应链；红蓝演练频率。Agent 安全默认 deny，而非默认全能。

## 读者 takeaway

读者 takeaway：Agent 时代安全是「行动安全」，不是「内容安全」 alone。默认 deny、最小权限、审计与红队演练，应与其他后端服务同级对待。

## 学习建议
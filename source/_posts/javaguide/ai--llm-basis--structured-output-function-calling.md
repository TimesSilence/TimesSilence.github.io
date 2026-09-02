---
title: "大模型结构化输出：从 JSON 契约到 Function Calling 落地"
date: 2025-06-15 15:49:00
updated: 2025-06-15 15:49:00
permalink: knowledge/ai/llm-basis/structured-output-function-calling/
categories:
  - 人工智能
tags:
  - 结构化输出
  - Function Calling
  - JSON Schema
description: "结构化输出与 Function Calling：JSON 契约、三层约束与工具安全。"
---

「请返回 JSON」不是工程方案，契约必须在生成与解析两侧 enforce。

<!-- more -->

## 三层约束

JSON Mode 保语法；JSON Schema 定字段；Structured Outputs 在生成期约束。仍建议服务端 parse + 校验 + 重试。

## Function Calling

模型输出 tool name + arguments；业务侧执行并回传。与 MCP 配合：FC 是意图，MCP 是通道。工具描述要准，减少错选。

## 安全分层

只读查询 / 写操作 / 高危操作分级；参数白名单；人工确认；沙箱执行。记录每次 tool call 审计。

## 误区

解析失败直接 500；工具权限过大；Schema 过复杂模型填不对。

## 延伸思考

JSON 漂移表现：多余 markdown 围栏、中文标点、缺字段、类型错（字符串数字）。工程契约应在服务端定义 Pydantic/Zod 模型，失败时带错误信息重试一次，仍失败则降级模板或人工。Function Calling 工具描述要含「何时不要用」。并行 tool call 需考虑依赖关系与事务性。安全上，读库与写库工具分离；写操作二次确认；对 URL fetch 类工具做 SSRF 防护。

## 实践小结

练习：定义业务 schema，故意让模型输出错误类型，验证重试逻辑。实现一个只读 tool 与一个写 tool，权限分离。记录 tool call audit 日志字段设计。

## 工程检查清单

检查清单：三层 JSON 约束；parse 重试；tool 权限分级；SSRF 防护；audit log。结构化与工具是 Agent 安全的地基。

## 读者 takeaway

读者 takeaway：结构化输出与工具调用是 Agent 的地基。契约在服务端 enforce，工具在权限上分级——这样模型创造力才不至于变成生产破坏力。

## 学习建议
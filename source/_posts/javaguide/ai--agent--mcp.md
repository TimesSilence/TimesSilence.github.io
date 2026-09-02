---
title: "什么是 Model Context Protocol (MCP)？和 Function Calling、Agent 什么关系？"
date: 2025-11-17 08:20:00
updated: 2025-11-17 08:20:00
permalink: knowledge/ai/agent/mcp/
categories:
  - 人工智能
tags:
  - MCP
  - Function Calling
  - Agent
  - 工具协议
description: "Model Context Protocol：与 Function Calling、Agent 的关系及 JSON-RPC 调用模型。"
---

MCP 统一工具与资源的接入协议，降低 N×M 集成成本。

<!-- more -->

## 定位

Function Calling 是模型侧「输出调用意图」的能力；MCP 是 Host 与 Server 之间的标准协议，暴露 Tools、Resources、Prompts 等。Agent 通过 MCP Client 发现能力并调用，Server 可独立部署与版本化。

## 调用流程

Host 启动 → 连接 Server → list_tools / list_resources → 模型选中 tool → JSON-RPC 请求 → Server 执行 → 结果返回 Host → 写入上下文。Roots 限定文件范围；Sampling 允许 Server 反向请求模型。

## 工程实践

一能力一 Server 便于权限隔离；敏感工具默认关闭；记录 call_id 审计。与 FC 配合：模型仍走 FC 格式，Host 映射到 MCP 调用。

## 安全误区

MCP 不自带鉴权——必须自己做 OAuth、scope、网络隔离。勿把「能连上 MCP」等于「生产可用」。

## 延伸思考

生产部署 MCP Server 时，建议独立进程 + 最小网络暴露，Host 侧维护 allowlist。Resources 适合只读上下文（文件、配置片段），Tools 适合有副作用的操作，Prompts 适合 reusable 模板。JSON-RPC 的错误码应映射到业务可重试/不可重试。与 Function Calling 并存时，Host 负责把 model 输出的 function 名映射到 MCP tool，并校验 arguments schema，避免「模型说调用了、实际未执行」的断层。

## 实践小结

练习：写一个最小 MCP Server 暴露只读文件 Tool，Host 侧做路径 allowlist。抓包 JSON-RPC 请求，理解 list_tools 与 call_tool 时序。尝试把同一能力用原生 FC 与 MCP 各实现一遍，对比集成成本。

## 工程检查清单

检查清单：Server 是否独立部署与鉴权；Host allowlist；JSON-RPC 错误映射；Resources 只读边界；Tools 副作用分级；Sampling 是否需用户同意；版本兼容策略。MCP 解决接入标准化，不替代安全评审与网络隔离。

## 读者 takeaway

读者 takeaway：MCP 降低工具集成摩擦，不降低安全要求。标准化之后，更要把鉴权、审计、网络隔离做到位，否则只是把风险打包成 JSON-RPC。

## 学习建议
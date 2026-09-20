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
description: "讲透 MCP：如何把工具接入从 N×M 降为 N+M、Host/Client/Server 的角色分工、Tools/Resources/Prompts 三种原语、与 Function Calling 的关系及安全边界。"
---

MCP（Model Context Protocol）用一套标准协议统一了 AI 应用接入外部工具与数据源的方式，把集成复杂度从 N×M 降到 N+M。本文讲清它解决的问题、Host/Client/Server 三个角色的分工、Tools/Resources/Prompts 三种原语、与 Function Calling 的关系，以及上线前必须自己补齐的安全边界。

<!-- more -->

## 它解决什么问题

没有 MCP 之前，工具接入是一个乘法问题：同一个 Git 工具要接进 Claude Desktop、Cursor 和你自建的 Agent 平台，就得写三套适配层；工具的参数格式、鉴权方式一变，N 个客户端全要跟着改。N 个 AI 应用乘 M 个工具，集成成本是 N×M，且每一格都是私有约定，无法复用。

MCP 的思路与 USB-C 相同：定义一个标准接口，工具方按协议实现一次 Server，所有支持该协议的 AI 应用都能即插即用；反过来，应用方实现一次 Client，就能接入整个 Server 生态。集成成本从 N×M 降为 N+M，这就是它存在的全部理由。

需要划清的边界是：MCP 只管「能力怎么被发现、怎么被调用」，不管「模型什么时候决定调用、任务怎么编排」——后者仍是 Function Calling 与 Agent 的职责。

## 核心原理

### 三个架构角色

- **Host（宿主）**：用户直接使用的 AI 应用，如 Claude Desktop、IDE 插件、自建 Agent 平台。它承载用户交互和模型调用。
- **Client（客户端）**：位于 Host 内部的协议组件，与每个 Server 维持一对一的会话，负责收发协议消息。
- **Server（服务端）**：能力的提供方，由开发者编写，把文件读取、数据库查询、工单系统等能力按协议暴露出去。Server 背后的真实数据源不属于协议角色。

一次完整调用前还有一步容易被忽略的握手：Client 先发送 `initialize` 请求，双方交换支持的协议版本与能力清单，确认后进入可用状态。很多「Server 配好了但工具不出现」的问题，根源就在初始化协商失败。

### 通信机制：JSON-RPC 2.0

MCP 底层采用 JSON-RPC 2.0——工具调用天然是「执行某个方法」而非「操作某个资源」，所以方法调用风格的 JSON-RPC 比资源风格的 REST 更贴合。一次工具调用的报文大致是：

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": { "path": "/repo/README.md" }
  },
  "id": 1
}
```

传输层有两种主流方式：本地 Server 用 stdio，Host 把它作为子进程启动，经标准输入输出交换消息，零网络成本；远程 Server 用 Streamable HTTP，认证、网关、负载均衡可以复用普通 HTTP 服务的整套运维设施。

## 深入机制

### 三种原语：Tools、Resources、Prompts

Server 对外暴露的能力分三类，区别不仅在功能，还在「由谁决定使用」：

| 原语 | 提供什么 | 由谁触发 | 典型例子 |
| --- | --- | --- | --- |
| Tools | 可执行的动作，可能有副作用 | 模型自主决策 | 查数据库、发消息、创建工单 |
| Resources | 只读上下文数据 | 应用或用户选择 | 文件内容、日志片段、库表 Schema |
| Prompts | 可复用的提示词模板 | 用户在界面选择 | 「按团队规范做代码审查」 |

简单记忆：Resources 是「给你看的材料」，Tools 是「替你做的动作」，Prompts 是「约定好的任务入口」。会改变外部状态的能力必须放进 Tools，只读数据放 Resources，这个划分直接影响后续的权限分级。

此外 Client 侧还能向 Server 提供反向能力：Roots 告知 Server 当前会话授权的文件根目录范围，Sampling 允许 Server 反向请求 Host 的模型做一次生成（如读到日志后请求摘要）。这些属于可选能力，取决于 Host 是否实现。

### 与 Function Calling 的关系：意图与传输

这是最容易混淆的一组概念。Function Calling 是**模型侧的能力**：模型输出「调用 read_file，参数是这个路径」这样的结构化意图，但它自己不会也无法真的去读文件。MCP 是**应用侧的协议**：负责把这个意图翻译成对远端 Server 的标准请求、执行、并把结果带回来。

一条典型链路是：模型通过 Function Calling 产生调用意图 → Host 校验参数 Schema → Host 内的 MCP Client 把调用路由到对应 Server → Server 执行并返回 → 结果写入模型上下文 → Agent 决定下一步。Function Calling 产生命令，MCP 传递命令，Agent 决定何时继续、何时结束——三者各居一层，互不替代。

## 工程实践

一个最小 MCP Server（官方 Python SDK）只需要几行：

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("weather-server")

@mcp.tool()
def get_weather(city: str) -> str:
    """获取指定城市的天气。用户询问天气、气温、是否下雨时使用。"""
    return f"{city} 今天晴，25°C"

if __name__ == "__main__":
    mcp.run()
```

写生产级 Server 时有几条经验：工具按业务动作拆分（`get_user_by_id`、`list_active_orders`），不要提供 `execute_sql` 这类万能接口——参数越自由，模型误用和越权的空间越大；工具的 `description` 要写清适用与禁用场景，它直接影响模型的选择质量；大文件结果先返回摘要与可读取范围，按需分块，避免一次响应塞爆上下文；调试期用 MCP Inspector 模拟 Host 发请求，初始化、能力发现、参数校验问题都能提前暴露。

## 对比与权衡

| 维度 | MCP | Function Calling | 私有插件/直连 API |
| --- | --- | --- | --- |
| 层级 | 应用间通信协议 | 模型输出格式能力 | 各写各的适配层 |
| 能力发现 | 协议内置（list_tools 等） | 由应用手工注入工具描述 | 无标准，各自实现 |
| 跨宿主复用 | 一次实现，处处接入 | 不可复用 | 不可复用 |
| 部署形态 | 本地子进程或远程服务 | 无（模型内） | 随应用耦合 |
| 安全责任 | 协议不兜底，自行补齐 | 无 | 自行补齐 |

## 安全边界

必须明确：**MCP 协议本身不解决安全问题**。协议标准化了接入，鉴权、审计、隔离全部要自己补：

- **鉴权与授权**：远程 Server 接 OAuth 或等价机制，按 scope 限制可调用工具；「能连上」绝不等于「生产可用」。
- **参数不可信**：模型生成的参数一律视为不可信输入。文件读写在路径规范化后校验目录边界，SQL 必须参数化，命令执行要白名单。
- **提示词注入面扩大**：Server 的 description、返回内容都可能夹带恶意指令，第三方 Server 上线前要审源码、依赖与权限范围。
- **写操作分级**：删除、修改、发送类操作默认收紧，加人工确认与审计日志；返回数据中的密钥、手机号要脱敏。
- **Roots 不是沙箱**：它只是范围提示，Server 侧仍要自己做越界检查和系统级隔离。

## 面试视角

**MCP 解决了什么核心问题？** 工具接入的 N×M 问题：没有标准协议时，N 个 AI 应用接 M 个工具要写 N×M 套适配；MCP 让工具方实现一次 Server、应用方实现一次 Client，复杂度降为 N+M，能力得以跨宿主复用。

**Host、Client、Server 各自负责什么？** Host 是面向用户的 AI 应用，承载交互与模型调用；Client 是 Host 内的协议组件，与每个 Server 维持一对一的会话；Server 是能力提供方，把工具、资源、提示词模板按协议暴露。一个 Host 可同时连多个 Server。

**Tools、Resources、Prompts 怎么区分？** Tools 是可执行动作（有副作用，模型自主调用），Resources 是只读上下文（应用或用户选择附加），Prompts 是可复用模板（用户显式触发）。划分标准是「谁决定使用」和「是否改变外部状态」。

**MCP 和 Function Calling 是什么关系？** Function Calling 是模型输出结构化调用意图的能力，MCP 是把意图送达外部系统并取回结果的协议；前者产生命令，后者传递命令。实际系统中两者串联：模型走 FC 格式，Host 负责映射到 MCP 调用并校验参数。

**MCP 上生产要补哪些安全功课？** 鉴权与 scope 授权、参数严格校验（路径遍历、SQL 注入）、写操作人工确认与审计、返回数据脱敏、第三方 Server 供应链审查、限流与调用链追踪。协议只标准化接入，不降低任何安全要求。

## 小结

1. MCP 的本质是把工具接入从 N×M 的私有适配变成 N+M 的标准协议，价值在复用而非新能力。
2. Host 管交互、Client 管会话、Server 管能力；Tools/Resources/Prompts 三原语按「谁触发、有无副作用」划分。
3. 它与 Function Calling 是传输与意图的串联关系，不是替代关系。
4. 协议不附带安全：鉴权、校验、审计、隔离每一项都要自己落实，否则只是把风险打包成了 JSON-RPC。
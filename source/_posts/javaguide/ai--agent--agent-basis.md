---
title: "AI Agent 核心概念：Agent Loop、Plan-and-Execute、A2A、Agentic Workflows、Tools 注册"
date: 2025-10-09 14:52:00
updated: 2025-10-09 14:52:00
permalink: knowledge/ai/agent/agent-basis/
categories:
  - 人工智能
tags:
  - Agent
  - ReAct
  - Workflow
  - Function Calling
description: "讲透 AI Agent 的本质：LLM 驱动的感知-决策-行动循环、ReAct 模式与工具调用闭环，以及 Agent 与 Workflow 的选型分界和典型失败模式。"
---

AI Agent 的本质不是"更会聊天的模型"，而是一个由 LLM 驱动的感知-决策-行动循环。这篇教程讲清 Agent Loop 的运转机制、ReAct 模式、工具调用闭环，以及 Agent 与 Workflow 的选型分界和典型失败模式。

<!-- more -->

## 它解决什么问题

纯聊天模型只会"给建议"。问它"user-service 今天早上为什么变慢"，它能列出一份漂亮的排查清单，但不会自己去查监控、翻日志、把结论发给负责人。这类任务的难点在于：下一步做什么取决于上一步拿到的证据——监控显示 CPU 飙高，接下来该捞慢 SQL；监控显示内存 OOM，接下来就该看 Heap Dump。执行路径无法预先写死，固定代码和预设流程图都接不住。

Agent 要补上的正是这段"连续的决策与执行"：理解自然语言意图后，在运行中根据实时反馈动态选择动作，直到任务完成或命中停止条件。反过来也成立：路径可以完全枚举的任务（订单扣库存、支付状态流转），交给 Agent 只会平白增加延迟和不确定性。先判断"路径是否可枚举"，是后续一切架构选择的前提。

## 核心原理

一个可运行的 Agent 通常拆成四块：LLM 负责意图理解与决策，Planning 负责任务拆解与下一步规划，Memory 保存对话历史与长期信息，Tools 负责对外部世界的读写操作。把它们串起来的，是 Agent Loop：

1. **感知**：LLM 读取当前上下文——系统指令、用户任务、历史消息、工具描述、上一轮的执行结果。
2. **决策**：模型在"直接给出最终答案"与"发起一次工具调用"之间做选择，后者附带结构化的工具名与参数。
3. **行动**：宿主程序真正执行工具，把返回结果追加回上下文，成为下一轮决策依据的 Observation（观察）。

循环往复，直到模型不再请求工具，或触发停止条件（最大轮次、Token 预算耗尽）。一个最小实现只有几十行：

```python
def agent_loop(task, tools, llm, max_steps=10):
    messages = [system_msg(tools.describe()), user_msg(task)]
    for _ in range(max_steps):
        reply = llm.chat(messages, tools=tools.schemas())
        if not reply.tool_calls:
            return reply.content          # 模型判断任务完成，输出答案
        for call in reply.tool_calls:
            result = tools.execute(call)  # 真正执行外部操作
            messages.append(tool_msg(call.id, result))  # 结果回写上下文
    raise MaxStepsExceeded("任务未在限定轮次内收敛")
```

LangChain、LlamaIndex、Spring AI 等框架的封装各不相同，底层都绕不开这条循环。框架解决的是接口差异、状态管理和流式输出，Loop 本身没有魔法。

## 深入机制

### ReAct：推理与行动显式交替

ReAct（Reasoning + Acting）要求模型在每次行动前先输出一段思考（Thought），再给出动作（Action），随后读取环境反馈（Observation），三者交替推进。以排障任务为例，一条典型轨迹是：

```text
Thought: 先确认资源层面是否异常，查 user-service 早上的监控
Action: query_metrics(service="user-service", window="09:00-09:30")
Observation: CPU 峰值 98%，同时段出现大量慢 SQL 告警
Thought: 瓶颈指向数据库，去捞具体的慢 SQL
Action: query_slow_sql(service="user-service", time_range="09:00-09:30")
Observation: 一条未命中索引的全表扫描，耗时 8s
Thought: 根因已明确，查负责人并发送报告
Action: send_email(to="owner@corp.com", subject="user-service 慢查询排查结论")
```

ReAct 的价值在于每一步都可被证据修正：如果监控显示的是 OOM，第二个 Action 就会转向 Heap Dump 分析而非慢 SQL。相比"一次性生成完整方案"，交替式执行减少了脱离环境的臆断，且每步决策都有据可查。代价是多轮调用叠加延迟，Token 消耗也成倍增长。

### 工具调用的闭环

模型看不到函数实现，只认结构化描述。工具注册依赖 JSON Schema 声明名称、用途、参数类型与必填项，其中 `description` 是模型判断"调不调、参数怎么填"的主要依据——好的描述要同时写清适用条件与不适用条件（例如慢 SQL 工具应明确排除网络与内存类问题），否则选错工具、参数幻觉会频繁出现。

闭环的最后一环是结果回写：工具返回必须追加进上下文，模型才能据此修正方向。工程上常见三种断裂：描述含糊导致误调用、参数由模型臆造、结果被截断后丢失关键字段。定位 badcase 时，先查这三处。

### 能力边界与失败模式

工具约束的是行动边界，不是推理质量——模型仍可能在 Thought 里做出错误判断。典型失败模式包括：多步推理陷入局部最优，看似在推进实则已经偏题；工具返回异常后反复重试同一调用，烧光轮次预算；长任务中早期上下文被截断导致"失忆"；网页、邮件、工具返回值里夹带的恶意指令触发注入。这些都无法靠换更强的模型根除，只能靠工程手段兜底。

## 工程实践

一个最小可用的 Agent 系统至少三层：**工具层**（Schema 定义、鉴权、幂等与沙箱）、**编排层**（Loop 驱动、max_iterations 通常设在 10~20 轮、按 Token 消耗的熔断）、**观测层**（每轮记录 intent、tool_name、arguments、observation、token_usage 的结构化事件）。有了逐轮事件流，才能把"突然跑偏"定位到具体是选错工具、参数错误还是 Observation 误导。

与 Workflow 混合是更常见的形态：主流程中确定的部分用 DAG 节点固定，只有路径不可预知的局部嵌入 Agent 子循环，并为子循环单独设轮次上限。上线前用对抗样本压测两类场景——参数被诱导乱填、同一工具被重复调用，观察系统能否体面地失败而非失控。

## 对比与权衡

| 维度 | 传统编程 | Workflow | 纯 Agent | Agentic Workflow |
| --- | --- | --- | --- | --- |
| 路径决策方 | 程序员写死 | 流程图预设分支 | 模型运行时决策 | 全局固定 + 局部模型决策 |
| 适合任务 | 逻辑固定且高频 | 路径清晰、需审计 | 步骤依赖中间证据 | 长流程含少量不确定环节 |
| 可观测性 | 高，日志精确到行 | 高，问题落到具体节点 | 低，需自建 Trace | 中，子循环内部仍需 Trace |
| 失败代价 | 低，行为确定 | 低，可重放 | 高，可能跑偏或死循环 | 可控，不确定部分被圈定 |
| 成本结构 | 低 | 低 | 高，多轮 Token 叠加 | 介于两者之间 |

选型一句话：执行路径写得出来就用 Workflow，写不出来再上 Agent，两者皆有就用 Agentic Workflow。注意一个常见错觉——很多号称"路径不确定"的需求，认真拆解后会发现大部分节点其实是确定的，真正需要模型动态决策的只是少数环节。

## 面试视角

**Agent 和 Workflow 的分界是什么？** 看谁决定执行路径：路径能预先枚举就用 Workflow 或代码，路径依赖运行时证据才用 Agent。判断失误的代价不对称——该用 Workflow 的地方用了 Agent，换来的是延迟、成本和调试难度的全面上升。

**ReAct 相比一次性生成好在哪里？** 它把推理与行动显式交替，每一步动作都建立在真实工具反馈之上，决策可追溯、方向可被证据修正；代价是延迟与 Token 成倍增加，且效果依赖工具与描述的可靠性。

**为什么工具描述会直接影响 Agent 表现？** 模型只通过 name、description、参数 Schema 认识工具，description 是它与工具之间的全部"契约"。描述没写清适用与禁止条件，错选工具和参数幻觉就会成为主要 badcase 来源。

**Agent 死循环怎么防？** 三道防线：max_iterations 或 Token 预算硬熔断；检测重复调用同一工具相同参数并中断；工具返回错误时给出结构化反馈引导模型换路径，而非让它盲目重试。

**上 Multi-Agent 之前要先做什么？** 先把单 Agent 的 Loop、工具闭环和评测集跑稳。多 Agent 引入的通信、契约、并行冲突与调试成本会翻倍，单体闭环都没观测清楚时上多体，故障将无从定位。

## 小结

1. Agent 的本质是 LLM 驱动的感知-决策-行动循环，不是更强的聊天机器人；选型的第一问是"执行路径能否预先枚举"。
2. Agent Loop 的关键在每轮把工具结果写回上下文，形成闭环；框架只是封装，Loop 没有魔法。
3. ReAct 用 Thought-Action-Observation 交替换取可追溯与可纠错，代价是延迟与 Token。
4. 工具闭环的薄弱环节是 description 与结果回写；失败模式（死循环、失忆、注入、局部最优）要靠轮次上限、观测与沙箱兜底。
5. 工程上先搭工具层、编排层、观测层三层结构，用结构化事件流支撑 badcase 定位，再谈多 Agent 等进阶形态。
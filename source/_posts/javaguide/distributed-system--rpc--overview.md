---
title: "RPC 远程过程调用专题：原理、调用流程、序列化、服务发现、Dubbo 与 gRPC"
date: 2023-03-10 16:36:00
updated: 2023-03-10 16:36:00
permalink: knowledge/distributed-system/rpc/overview/
categories:
  - 分布式系统
tags:
  - RPC
  - 服务调用
  - Dubbo
description: "RPC 专题导读：远程调用流程、序列化、注册发现与 Dubbo/gRPC 生态。"
---

服务间调用是微服务血脉。RPC 专题梳理从 stub 代理到服务治理的完整链路，并指出与 HTTP API 的边界分工。

<!-- more -->

## 要解决什么问题

拆分后进程间需像本地方法一样调用远程服务，涉及序列化、寻址、负载均衡、超时重试、熔断和 tracing。裸 HTTP+JSON 能通但缺少稳定 IDL、服务发现和治理策略，团队会在每个项目重复造轮子。

## 核心原理

RPC 链路：Client stub→序列化→网络→Server 反序列化→执行→返回。注册中心维护 provider 列表；客户端 LB 选实例；框架统一 timeout、retry、filter 链。Dubbo 偏 Java 生态私有协议；gRPC 用 HTTP/2+Protobuf 跨语言。与 HTTP REST 比，RPC 更重契约和性能，REST 更重通用性和缓存语义。

## 方案权衡

内部高频调用倾向 RPC；对外公开 API 倾向 REST/GraphQL。HTTP/3 和 gRPC 演进中，选型看语言栈和网关能力。过度细粒度 RPC 导致 chatty interface 和级联延迟，需 batch 或 BFF 聚合。

## 落地要点

IDL 版本化；非幂等 method retries=0；传递 trace metadata；注册中心 health check 与优雅下线。压测 thread pool 和 queue。先理解 rpc-intro 原理（若可读）再读 Dubbo 题集。定义 SLA 和 fallback 返回值。

## 常见误区

误区：RPC=HTTP；无 timeout；对所有错误重试；接口无 backward compatible 演进策略。忽视 serialization 兼容性（Java 类变更）导致线上 ClassNotFound。

## 小结

RPC 专题建议从"调用链"入手：序列化、寻址、治理、观测四块缺一不可。内部服务选 RPC 是为性能与契约，对外仍要 REST/HTTP 开放。控制链路过长是微服务通病，RPC 层应配合 timeout、bulkhead 和 BFF 聚合，而不是无限细粒度接口。 可以把一次完整的 RPC 调用画成时序图：DNS/注册发现→LB 选实例→序列化→网络→反序列化→业务→返回，并在每个环节标注可能失败的超时设置。新人 onboarding 时先讲这张图，再讲具体框架，理解成本更低。对外 API 仍建议 HTTP 语义清晰，RPC 留在信任域内。
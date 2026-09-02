---
title: "Dubbo 面试题总结：架构原理、SPI、负载均衡、服务治理与集群容错"
date: 2023-07-07 08:00:00
updated: 2023-07-07 08:00:00
permalink: knowledge/distributed-system/rpc/dubbo/
categories:
  - 分布式系统
tags:
  - Dubbo
  - RPC
  - SPI
description: "Dubbo 架构分层、服务暴露与引用、SPI 扩展、负载均衡与集群容错策略。"
---

Dubbo 是国内 Java RPC 代表框架之一。本文整理调用链、SPI 扩展点与负载/容错策略，便于面试和排查线上 RPC 异常。

<!-- more -->

## 要解决什么问题

面试常问 Dubbo 一次调用经过哪些层、SPI 如何加载扩展、random 和 leastactive 区别、failfast 和 failsafe 适用场景。只会 xml/yml 配置而不懂 Invoker 链，排查超时和串包会很被动。

## 核心原理

分层：business→rpc→remoting→cluster→registry。Export 打开 server port 注册；Refer 订阅 Directory 得 Invoker 列表。Cluster 合并 Invoker，LB 选 one，Filter 链拦截。SPI：META-INF/dubbo 下 key→impl，Adaptive 注解生成代理。Dubbo 3 推应用级服务发现和 Triple 协议。

## 方案权衡

Dubbo 治理能力强，跨语言弱于 gRPC。注册中心 ZK vs Nacos 影响 metadata 推送模型。GenericService 方便网关泛化调用但有类型安全代价。与 Spring Cloud OpenFeign 比，Dubbo 性能更好但 HTTP 生态互通性强。

## 落地要点

生产：timeout、threads、queues 压测调优；provider warmup；telnet invoke 谨慎禁用；serialization 选 hessian2/kryo 并测兼容性。consumer 侧 mock 降级验证。升级 2.x→3.x 关注 service discovery 模型变化和 metadata report。

## 常见误区

误区：所有方法 retries>0；忽略 actives 限流；SPI 自定义破坏 singleton；混淆 dubbo protocol 端口与 rest 端口。async 调用未处理 Context 导致 ThreadLocal 丢失也是经典坑。

## 小结

Dubbo 面试准备应画一张 Invoker 链：从 Proxy 到 Cluster、LoadBalance、Filter 再到 Netty。SPI 是扩展核心，理解 Adaptive 机制才能读懂框架源码。上线前对关键接口做 chaos 测试：随机延迟 provider、kill 实例，验证 consumer 容错是否符合预期。 排查 Dubbo 超时时，沿着 consumer 日志中的 remote addr、timeout、retry 与 provider 线程池队列一并查看。Generic 调用和泛化签名错误是升级常见坑，CI 中应保留接口兼容性测试。对于跨机房调用，要单独评估 serialization 开销与 MTU 限制，必要时启用压缩。

一句话总结：Dubbo 把 RPC 调用链标准化，SPI 让治理策略可插拔，是 Java 微服务治理的参考实现之一。

定期审查 Dubbo 接口 SLA 与 timeout 配置是否匹配下游 P99，是预防级联超时最有效的治理手段之一。
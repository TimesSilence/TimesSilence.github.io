---
title: "Spring Cloud Gateway 面试题总结：路由、Predicate、Filter、限流熔断与工作原理"
date: 2023-07-16 09:07:00
updated: 2023-07-16 09:07:00
permalink: knowledge/distributed-system/spring-cloud-gateway-questions/
categories:
  - 分布式系统
tags:
  - Spring Cloud Gateway
  - 网关
  - 面试题
description: "Spring Cloud Gateway 路由模型、Predicate/Filter 链、限流熔断与 Reactive 原理考点。"
---

Spring Cloud Gateway 是 Spring 栈网关首选。本文归纳路由匹配、过滤器链、限流熔断与 Reactive 模型等面试考点及生产注意事项。

<!-- more -->

## 要解决什么问题

面试问 Gateway 与 Zuul 差异、Route 组成、GlobalFilter 顺序、如何实现鉴权限流、为何不要阻塞 Netty event loop。生产上还遇到路由动态刷新失败、CORS 重复、StripPrefix 配置错误导致 404 等实际问题。

## 核心原理

Route=Id+URI+Predicate+Filter。Predicate 组合 match；GatewayFilter 作用于 route，GlobalFilter 全局。基于 WebFlux+Netty 事件驱动。RequestRateLimiter 结合 Redis；Resilience4j 做 circuit breaker。LoadBalancerClientFilter 把 lb://service 解析为真实 host。Order 决定 filter 链顺序。

## 方案权衡

Reactive 高并发好，团队需熟悉 Mono/Flux。阻塞调用需 schedulers boundedElastic 或改架构。与 Kong 比，Java 统一栈运维简单，极端 QPS 需压测。复杂 BFF 聚合不宜全放 Gateway。

## 落地要点

JWT GlobalFilter 解析后传 Header；动态路由 Nacos/Redis 监听；限流 keyResolver 区分用户/IP；注意 OPTIONS 预检 Filter 顺序。logging 采样避免 IO 瓶颈。集成 Sleuth/OTel 传递 trace context。灰度路由 WeightRoutePredicateFactory。

## 常见误区

误区：Filter 里 jdbc 阻塞；Route 顺序错误先匹配 catch-all；忘记 StripPrefix 导致路径双前缀；限流未区分登录用户与匿名爬虫。WebFlux 异常未 custom ErrorWebExceptionHandler 导致明文 stack 泄露。

## 小结

Gateway 面试与生产一体：理解 Route 匹配顺序、Filter Order 和 reactive 非阻塞约束。限流熔断要与下游容量联动，而不是固定阈值。动态路由变更要有审计和回滚；JWT 解析后只传必要 claims 给后端，避免 Header 过大。压测时关注 event loop 阻塞和 log 采样率。 建议在测试环境搭建最小 Gateway+两个 downstream，亲手配置 Predicate 与 Filter 顺序，观察错误配置如何导致 404 或 CORS 失败。生产变更路由时使用灰度实例验证，并保留上一版路由快照。与团队安全同事确认 JWT 校验算法、密钥轮换与 Gateway 缓存策略一致。

一句话总结：Gateway 是 Spring 微服务的统一流量治理入口，路由与 Filter 设计决定安全与性能上限。
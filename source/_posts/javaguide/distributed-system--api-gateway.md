---
title: "API 网关详解：核心功能、工作原理与 Spring Cloud Gateway / Kong / APISIX 选型"
date: 2023-03-20 17:43:00
updated: 2023-03-20 17:43:00
permalink: knowledge/distributed-system/api-gateway/
categories:
  - 分布式系统
tags:
  - API网关
  - 微服务
  - Spring Cloud Gateway
description: "微服务为什么需要统一入口：网关的路由、认证、限流、聚合与观测能力拆解，Nginx/OpenResty、Spring Cloud Gateway、Kong、APISIX 的扩展模型对比，以及网关自身的高可用治理。"
---

客户端直连几十个微服务会发生什么？认证逻辑遍地重复、内部拓扑完全暴露、改一次限流策略要逐服务发版。本文从统一入口的价值讲起，拆解网关的核心能力边界，对比 Nginx/OpenResty、Spring Cloud Gateway、Kong、APISIX 的性能与扩展模型，最后讨论网关自身的高可用与性能治理。

<!-- more -->

## 它解决什么问题

微服务拆分之后，每个服务都需要认证鉴权、限流熔断、访问日志、监控埋点这类横切能力。如果没有统一入口，同样的逻辑要在几十个服务里各写一遍：策略不一致只是时间问题，更现实的风险是变更成本——大促前要把全站 QPS 阈值下调，没有网关就意味着逐服务改配置、逐服务发版，改错一台就是一次事故。

客户端直连还有结构性问题。内部服务的地址、端口、版本拓扑全部对外可见，攻击面被无限放大；Web、App、第三方开放平台需要的协议和裁剪方式各不相同，这些适配逻辑被迫塞进领域服务。网关的本质是把"南北向"流量的公共治理收敛到一处，让业务服务只处理业务，让 RPC 框架专心管"东西向"的内部调用。

## 核心原理

网关干的事情归纳起来只有两类：请求转发与请求过滤。转发侧包括按规则路由到目标服务、在多个实例间做负载均衡、必要时做协议转换（如 HTTP 转 Dubbo/gRPC）；过滤侧是在请求到达后端前后插入拦截逻辑——身份认证、权限校验、限流、熔断、参数校验、日志与指标采集。落到实现上，绝大多数网关都是"路由匹配 + 过滤器/插件链"模型：先按 Host、Path、Header 等条件匹配路由，再依次执行链上的处理器，最后由代理组件把请求转发给下游并回写响应。

一个必须厘清的分工是网关与 RPC 的边界：网关处理的是外部不可信流量进入系统的第一道关卡，强调安全、限流、协议适配；RPC 框架处理的是内部服务间调用，强调序列化效率、超时重试与服务发现。两者会在网关内部汇合——网关常常以 RPC 客户端的身份调用后端——但职责上不应互相侵占。

## 深入机制

### 能力清单与边界

一份生产级网关的能力清单通常包括：动态路由、负载均衡、认证鉴权（Token 校验、RBAC）、限流（令牌桶/漏桶，key 可分 IP、用户、接口）、熔断降级、响应缓存、灰度发布（按 Header、权重分流）、协议转换、SSL 证书集中终结、请求日志与指标、异常包装。其中容易越界的是"响应聚合"：简单拼接可以做，但复杂的跨服务字段映射与编排应该放到 BFF 或 GraphQL 层，否则业务编排逻辑沉淀进基础设施，网关会膨胀成第二个单体，任何业务变更都要动网关、过一遍基础设施的发布流程。

### 主流实现的扩展模型

**Nginx/OpenResty**：Nginx 本身是事件驱动、多进程的高性能代理，但 C 模块开发门槛高。OpenResty 把 LuaJIT 嵌进 Nginx 的请求处理阶段（rewrite、access、content 等），用脚本语言就能获得接近 C 的执行效率，这是 Kong、APISIX 的地基。它的定位偏"流量网关"：SSL 终结、WAF、全局限流、黑白名单。

**Spring Cloud Gateway**：基于 Spring WebFlux + Netty 的异步非阻塞模型，少量事件循环线程即可支撑高并发连接。核心抽象是 Route、Predicate（路径、方法、Header 等匹配条件，逻辑与组合）、Filter（请求前后修改请求/响应）。它与 Spring Cloud 生态（Eureka/Nacos、Config、Resilience4j）集成最顺，内置 `RequestRateLimiter`（Redis 令牌桶）和 CircuitBreaker 过滤器，路由可写在 YAML，也可通过 `RouteDefinitionRepository` 接外部存储实现动态刷新。代价是响应式编程模型对团队有要求——Filter 里写一段阻塞 JDBC 调用就能拖垮整个事件循环。

**Kong**：OpenResty 之上的 Lua 应用，插件在请求生命周期各阶段执行，生态成熟，还支持 Go、Python、JS 的 PDK 开发插件。部署形态分传统数据库模式（PostgreSQL 存配置）、DB-less 声明式模式、Hybrid（控制面存库、数据面不连库）与 K8s Ingress 模式。传统模式要多运维一个数据库层的高可用，DB-less 与 Ingress 模式则轻得多。

**APISIX**：同样基于 OpenResty，但配置存储换成 etcd，路由和插件变更通过 etcd watch 毫秒级热推到所有数据面节点，不需要 Reload；插件支持热加载，也可用 Java/Go/Python 的 Plugin Runner 或 Wasm 扩展，绕开 Lua 学习成本（性能略损）。架构上天然控制面与数据面分离，适合多集群、多租户场景。

### 网关自身的高可用

引入网关就多了一跳，也多了一个潜在单点。标准做法：网关无状态多实例部署，前面再架一层负载均衡——云 LB、Nginx 或 LVS+Keepalived；会话与限流计数放 Redis 等外部存储，不绑实例。性能瓶颈治理上，网关的敌人通常是"插件链过长 + 阻塞调用 + 全量请求体日志"，每一条都在 P99 延迟上加码。

## 工程实践

- 分层部署：中大型体系常见双层网关——边缘流量网关（APISIX/Kong/Envoy，管 SSL、WAF、DDoS、全局限流）+ 内网业务网关（Spring Cloud Gateway，管鉴权、灰度、参数校验）；小规模系统单层即可，别过早拆。
- 灰度路由：按 Header（如 `X-User-Tag: gray`）或权重把流量切到新版本服务，配合注册中心的元数据做版本隔离。
- 可观测：网关是天然的观测点，traceId 在入口生成或透传，统一接入 Prometheus 指标与访问日志，做全站流量大盘。
- 压测口径：选型时用 wrk2、k6、vegeta 按真实流量画像复测，重点看 P99/P999、错误率与资源占用，而不是厂商口径的裸 QPS；路由数量、插件链长度、TLS 开关都会显著改变结果。
- 变更治理：动态路由配置纳入 CI/CD 与审批，避免控制台手改直接生效。

## 对比与权衡

| 维度 | Nginx/OpenResty | Spring Cloud Gateway | Kong | APISIX |
| --- | --- | --- | --- | --- |
| 底层模型 | 事件驱动多进程 + LuaJIT | WebFlux/Netty 事件循环 | OpenResty + 插件生命周期 | OpenResty + etcd watch |
| 性能 | 很高 | 高 | 很高 | 很高 |
| 动态配置 | 需自建（Reload 或 Lua） | YAML / 路由仓库热刷新 | Admin API / DB-less / CRD | etcd 毫秒级热推、插件热加载 |
| 扩展语言 | Lua | Java/Kotlin | Lua、Go、Python、JS | Lua、Plugin Runner（Java/Go 等）、Wasm |
| 生态定位 | 流量网关、边缘代理 | Spring Cloud 业务网关 | 云原生、多语言插件生态 | 云原生、高性能、控制面分离 |
| 运维依赖 | 无 | JVM + 可选 Redis | 可选 PostgreSQL | etcd 集群 |
| 学习曲线 | 陡（Lua/Nginx 阶段模型） | 平缓到中（响应式模型） | 中到陡 | 中到陡 |

选型建议：纯 Java/Spring Cloud 栈优先 Spring Cloud Gateway；追求极致吞吐、多语言团队或需要细粒度多租户插件体系，选 APISIX 或 Kong；边缘层抗流量、做安全边界，Nginx/OpenResty 系仍是主流；Zuul 1.x 已进维护模式，存量系统应规划迁移。

## 面试视角

**为什么需要 API 网关？** 微服务拆分后认证、限流、日志等横切能力若在每个服务重复实现，策略难统一、变更成本高；客户端直连还暴露内部拓扑。网关把南北向流量的公共治理收敛到统一入口，业务服务只关注业务逻辑。

**Spring Cloud Gateway 为什么比 Zuul 1.x 快？** Zuul 1.x 是同步阻塞 Servlet 模型，每请求一个线程，并发受线程数限制；Gateway 基于 WebFlux + Netty 异步非阻塞，事件循环线程处理海量连接，吞吐高、延迟低。但 Filter 中混入阻塞调用会直接卡住事件循环，这是生产常见坑。

**Kong 和 APISIX 的核心差异？** 两者都基于 OpenResty。差异在配置模型：Kong 传统模式用 PostgreSQL 存配置（也有 DB-less/Hybrid），APISIX 用 etcd，变更通过 watch 毫秒级推送到所有节点且插件热加载，动态性和控制面分离做得更彻底。

**网关如何做高可用？** 网关本身无状态、多实例部署，前置云 LB 或 Nginx/LVS+Keepalived；限流计数等状态放 Redis 外置；此外要治理插件链长度、避免阻塞调用，防止网关自身成为性能瓶颈。

**哪些逻辑不该放网关？** 强业务规则校验、复杂字段映射、长事务编排、细粒度数据级授权。这些放网关会让基础设施和业务发布耦合，正确位置是 BFF、GraphQL 层或领域服务。

## 小结

- 网关的价值是把认证、限流、路由、观测等横切能力收敛到统一入口，代价是多一跳转发和一个新的高可用责任点。
- 核心模型都是"路由匹配 + 过滤器/插件链"，选型真正要比的是动态配置能力、扩展语言生态与运维依赖。
- Spring Cloud Gateway 赢在 Spring 生态，Kong/APISIX 赢在性能与插件生态，APISIX 的 etcd 热推在动态性上更进一步。
- 网关应承载协议级、通用型、跨服务的能力；业务编排沉进网关是最常见的腐化路径。
- 网关集群必须无状态多活、前置负载均衡，并对插件链与阻塞调用做持续性能治理。
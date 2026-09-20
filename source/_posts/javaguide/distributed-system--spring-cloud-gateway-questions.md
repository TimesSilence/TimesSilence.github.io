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
  - 面试
description: "Spring Cloud Gateway 面试题深解：Route/Predicate/Filter 模型、过滤器链顺序、lb 负载均衡、动态路由、限流熔断与响应式非阻塞约束。"
---

Spring Cloud Gateway 是 Spring 技术栈网关的事实标准，面试围绕路由模型、过滤器链与响应式原理三条线展开，且高频与生产事故绑定。本文按定位、路由、过滤器、治理四条主线整理考点。

<!-- more -->

## 考察地图

- **定位与原理**：Gateway 是什么、为什么取代 Zuul、整体工作流程。考察对响应式网关的基本认知。
- **路由模型**：Route、Predicate、Filter 三者的关系与匹配顺序。
- **过滤器体系**：GatewayFilter 与 GlobalFilter 的分工、执行顺序、`lb://` 的解析机制。
- **治理与生产问题**：动态路由、限流、全局异常处理、阻塞调用的禁区。
- 建议自行查阅：CORS 预检配置、WebSocket 路由、灰度权重路由的实现细节——多为配置题，过一遍官方文档即可。

## 定位与工作原理

### Spring Cloud Gateway 是什么？为什么取代了 Zuul？

**结论**：Spring Cloud Gateway 是 Spring 官方基于 Spring WebFlux + Netty 构建的 API 网关，提供路由、过滤、限流、熔断等统一流量治理能力；它取代 Zuul 的根本原因是 I/O 模型——Zuul 1.x 是 Servlet 阻塞模型，每请求一线程，高并发下线程数先被打爆。

**原理**：Zuul 1.x 跑在 Tomcat 的线程池上，一个请求占住一个线程直到下游返回，下游变慢时线程池迅速耗尽。Gateway 基于 WebFlux（Reactor 响应式模型）与 Netty 事件循环，少量线程通过非阻塞 I/O 支撑海量并发连接，线程不再随请求数线性增长。Zuul 2.x 虽然也改成了 Netty 非阻塞架构，但发布跳票多年，Spring Cloud 始终未将其纳入官方体系，生态重心早已倒向 Gateway。

**延伸**：选型对比要带出视野：Kong、APISIX 基于 OpenResty/NGINX，性能上限更高且语言无关，适合跨技术栈的统一网关层；Gateway 胜在与 Spring 生态无缝（配置体系、注册中心、安全框架），Java 团队运维心智成本低。

> 追问：响应式模型在什么情况下反而没有优势？提示：下游全是阻塞调用、QPS 不高时，Reactor 的编程复杂度换不来性能收益。

### Spring Cloud Gateway 的完整工作流程是怎样的？

**结论**：请求先经 Handler Mapping 做路由断言匹配，命中路由后进入 Web Handler 的过滤器链，过滤器「前段」处理完转发给真实服务，响应再反向穿过滤器的「后段」返回客户端。

**原理**：具体五步：一、请求到达后由 `RoutePredicateHandlerMapping` 遍历路由表，用各 Route 的 Predicate 依次判断，取第一条全部命中的路由；二、路由对应的 GatewayFilter 与全局 GlobalFilter 按 Order 排序组装成一条链（`FilteringWebHandler` 负责）；三、请求沿链向下传播，此阶段各 Filter 执行 pre 逻辑（鉴权、改写路径、限流）；四、链尾的 `NettyRoutingFilter` 通过 Netty HttpClient 把请求转发到目标服务；五、响应沿链反向传播，各 Filter 执行 post 逻辑（改写响应头、记录指标）后写回客户端。pre 与 post 不是两类过滤器，而是同一段代码在 `chain.filter(exchange)` 调用前后的两个半区。

**延伸**：理解「反向穿过」是回答顺序类问题的钥匙：Order 越小的 Filter，pre 阶段越先执行、post 阶段越后执行，恰好包裹住下游——类似洋葱模型。

> 追问：Filter 里不做 `chain.filter(exchange)` 直接返回会怎样？提示：短路——常用于鉴权失败直接返回 401，后续 Filter 与下游服务都不会执行。

## 路由模型

### Route、Predicate、Filter 三者是什么关系？多个路由同时匹配时选谁？

**结论**：Route 是路由规则的载体，由唯一 ID、目标 URI、一组 Predicate 和一组 Filter 构成；Predicate 决定「请求走不走这条路由」，Filter 决定「走这条路由时对请求响应做什么加工」。多路由同时命中时，按 Order（或定义顺序）取第一条。

**原理**：一个 Route 可挂多个 Predicate，请求必须满足全部断言（逻辑与）才命中该路由。内置断言工厂覆盖常见维度：`Path=/api/order/**` 匹配路径，`Method=GET` 匹配方法，`Header`、`Query`、`Cookie`、`After`（时间点后才生效，做定时发布）等，都支持组合。匹配胜出是「赢家通吃」：路由表按顺序扫描，第一个全命中的 Route 接管请求，后面的不再考虑——所以宽泛的兜底路由（catch-all）必须放在最后，配错顺序是路由 404 类事故的头号原因。命中后，该 Route 的 Filter 与全局 Filter 合并排序执行。

**延伸**：断言与过滤器的边界常被混淆：判断条件（时间窗、Header 值）放 Predicate；加工行为（去前缀、加请求头、限流）放 Filter。把条件判断写进 Filter 会让路由表失去表达力。

> 追问：`StripPrefix=1` 和 `RewritePath` 有什么区别？提示：StripPrefix 只按段数裁剪路径前缀，RewritePath 用正则做任意重写，后者灵活但更容易写错。

## 过滤器体系

### GatewayFilter 和 GlobalFilter 有什么区别？执行顺序怎么控制？

**结论**：GatewayFilter 挂在指定路由上，只对该路由生效；GlobalFilter 对所有路由生效，框架内置的负载均衡、转发等核心能力都是 GlobalFilter。两类 Filter 合并进同一条链，按各自的 `@Order` 值统一排序，值越小越靠前。

**原理**：`GatewayFilter` 通常由 Filter 工厂通过配置声明，写在具体路由的 `filters:` 下；`GlobalFilter` 是一个 Spring Bean 接口，实现后自动全局生效，典型的如 `LoadBalancerClientFilter`（解析 `lb://`）、`NettyRoutingFilter`（真正发起下游请求，Order 是 `Integer.MAX_VALUE`，永远在最末端）。组装时 `FilteringWebHandler` 把路由级 Filter 适配后与 GlobalFilter 混排，Order 相同时 GlobalFilter 有固定优先级规则。自定义 Filter 时显式实现 `Ordered` 接口并给出一个刻意避开内置占位的值，是避免顺序玄学的好习惯。

**延伸**：按生命周期又可以分 pre/post 两段看：Order 小的 Filter 包在外层。常见约定是把鉴权类 GlobalFilter 设为高优先级（如 -100），保证在任何路由逻辑之前先拦掉非法请求。

> 追问：怎么快速验证线上 Filter 顺序是否符合预期？提示：打开 `logging.level.org.springframework.cloud.gateway=TRACE`，日志会打印组装后的完整链。

### `lb://service-name` 是怎么被解析成真实地址的？

**结论**：这是服务发现与客户端负载均衡的组合：`LoadBalancerClientFilter` 拦截 `lb://` 前缀的 URI，向注册中心查询该服务的实例列表，用负载均衡策略挑一个实例，把 URI 重写为真实 host:port 后再交给转发过滤器。

**原理**：配置 `uri: lb://order-service` 时，请求到达 `LoadBalancerClientFilter`（默认 Order 10150），它通过 `LoadBalancerClient` 调用 DiscoveryClient（Nacos/Eureka 客户端，本地维护实例缓存）拿到可用实例，默认按轮询策略选出其一，将 exchange 中的目标 URI 替换为 `http://10.0.1.5:8080`，随后 `NettyRoutingFilter` 按新地址发起请求。实例列表变化靠注册中心推送与本地缓存定时刷新共同保证，所以下线实例到网关停止转发之间存在秒级窗口。

**延伸**：这个窗口是「优雅停机为什么要先注销再 sleep」的直接原因；负载均衡策略可替换为加权响应时间等算法，Spring Cloud LoadBalancer 已取代停更的 Ribbon 成为默认实现。

> 追问：实例下线后网关还在转发怎么排查？提示：查注册中心缓存刷新间隔、Ribbon/LoadBalancer 的缓存 TTL，以及下线方是否做了主动注销。

## 治理与生产问题

### 如何实现动态路由，避免改配置就重启网关？

**结论**：把路由定义从静态配置文件挪到外部配置中心（Nacos Config、Apollo），网关监听变更事件并调用路由定义仓库的增删接口热更新，全程不重启。

**原理**：Gateway 的路由存储抽象是 `RouteDefinitionRepository`，默认实现基于内存。配置中心的推送机制（Nacos 长轮询、Apollo 长连接）拿到新配置后，反序列化为 `RouteDefinition` 列表，调 `save/delete` 更新仓库，再发布 `RefreshRoutesEvent` 事件——`RouteRefreshListener` 收到后触发路由表重建，新请求立即按新表匹配。spring-cloud-alibaba 的 Nacos Config 集成已封装好这段管道，只需按约定格式把路由 JSON 写进指定的 dataId。生产上还要加两道工序：变更审计（谁改的、改了什么）与版本快照，路由配置错误要能一键回滚。

**延伸**：动态路由的威力与风险同源——它等价于运行时修改系统行为，务必配合发布评审与灰度实例验证；路由级元数据（metadata）还能驱动灰度发布，按权重或 Header 把流量切到新版本服务。

> 追问：配置中心挂了网关会怎样？提示：已加载的路由在内存中继续生效，但无法变更——所以配置中心要高可用，本地还要兜底快照。

### Spring Cloud Gateway 怎么做限流？自带的 RedisRateLimiter 够用吗？

**结论**：自带 `RequestRateLimiter` 过滤器基于 Redis + Lua 实现令牌桶，开箱即用但维度单一；生产上常用 Sentinel 网关适配模块，支持按路由、自定义 API 分组、来源等多维度限流，且规则可动态下发。

**原理**：`RedisRateLimiter` 的核心是一段 Lua 脚本，在 Redis 单线程内原子完成「取令牌、扣减、记录时间戳」，令牌桶参数为 replenishRate（每秒填充速率）与 burstCapacity（桶容量）。必须显式配置 `KeyResolver` 决定按什么维度限流——按用户 ID、按 IP、按接口，没配 KeyResolver 启动直接报错。内置方案的短板：规则写在配置文件里，改阈值要重启或走动态配置；缺少热点参数限流与集群流控。Sentinel 适配层把网关 route 与自定义 API 定义成资源，控制台实时改规则秒级生效，还能与熔断降级规则统一管理。

**延伸**：限流阈值不是拍脑袋的固定值，应与下游服务的容量水位联动——下游扩容了网关配额就该上调，否则网关会成为扩容的隐形天花板。

> 追问：令牌桶和漏桶在网关限流上的行为差异？提示：令牌桶允许 burstCapacity 内的突发，漏桶严格匀速——秒杀场景选错会导致真实用户被误伤。

### 为什么 `@RestControllerAdvice` 在 Gateway 里不生效？全局异常怎么统一处理？

**结论**：`@RestControllerAdvice` + `@ExceptionHandler` 是 Spring MVC 的异常处理机制，Gateway 跑在 WebFlux 技术栈上，请求不经过 DispatcherServlet，这套机制根本不参与。正确姿势是实现 `ErrorWebExceptionHandler` 接口。

**原理**：WebFlux 的异常由 `ExceptionHandlingWebHandler` 委托给 `ErrorWebExceptionHandler` 链处理，默认实现 `DefaultErrorWebExceptionHandler` 输出 Whitelabel 错误页或 JSON。自定义方案是声明一个 `@Order(-1)` 的 Bean 实现该接口，在 `handle(exchange, ex)` 里把异常翻译成统一错误体（业务码 + 提示 + traceId），写回响应：

```java
@Order(-1)
@Component
public class GlobalErrorHandler implements ErrorWebExceptionHandler {
    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        return response.writeWith(
            Mono.just(response.bufferFactory().wrap(buildBody(ex).getBytes())));
    }
}
```

**延伸**：生产事故的高发点恰恰是漏配这一步——下游超时、路由不存在时把带堆栈的默认错误页直接抛给外部调用方，既泄露内部信息又破坏 API 契约。注意 Order 要比默认实现（-1 附近）更靠前才能接管。

> 追问：Filter 里抛的异常谁能接住？提示：沿 WebFlux 异常链冒泡到 ErrorWebExceptionHandler，所以 Filter 内不要 try-catch 吞掉异常，交给全局处理统一出口。

### 为什么 Filter 里绝对不能写阻塞调用？绕不开怎么办？

**结论**：Gateway 的请求由 Netty EventLoop 线程驱动，阻塞调用（JDBC、RestTemplate、`Thread.sleep`）会占住 EventLoop，让该线程上所有并发连接全部停摆——一个慢查询拖垮整个网关的并发能力。

**原理**：Netty 的 EventLoop 数量约等于 CPU 核数 ×2，设计前提是处理逻辑「快进快出」：事件到达→非阻塞处理→注册回调→立即返回。一旦在 EventLoop 上执行阻塞 I/O，这个事件循环上绑定的成千上万个连接的读写事件都无法被处理，表现为全局延迟飙升、连接超时。Reactor 提供了逃生通道：确实绕不开的阻塞逻辑（如必须调用的老 SDK）用 `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())` 调度到专门的弹性线程池执行，把 EventLoop 解放出来。但 boundedElastic 的线程数有上限，滥用等于把线程模型改回 Zuul 1.x。

**延伸**：这解释了网关层的技术选型约束：鉴权校验用 Redis 响应式客户端而非同步 Jedis；配置加载放启动期而非请求期；日志输出要异步且采样。判断一段代码能否进 Filter 的标准只有一个——它是否非阻塞。

> 追问：怎么发现线上 EventLoop 被阻塞了？提示：开 BlockHound 在测试期直接抛异常，生产上看 eventLoop 线程的延迟探针与慢日志。
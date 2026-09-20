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
description: "Dubbo 核心角色与 Invoker 调用链路、SPI 扩展机制、六种集群容错策略、四种负载均衡算法，以及 Dubbo3 应用级服务发现的演进动机。"
---

Dubbo 是 Java 生态里最有代表性的 RPC 框架，面试和线上排障都绕不开它。本文沿着一次调用的真实路径展开：Provider、Consumer、Registry 如何协作，Invoker 链路怎么走，SPI 如何撑起整个可扩展体系，以及集群容错、负载均衡和 Dubbo3 应用级服务发现背后的设计动机。

<!-- more -->

## 核心角色与调用链路

Dubbo 架构中有五个角色：**Container**（服务运行容器，负责启动和加载 Provider）、**Provider**（服务提供方，启动时把接口地址注册到注册中心）、**Consumer**（服务消费方，订阅所需服务并在本地缓存地址列表）、**Registry**（注册中心，负责地址注册与变更推送）、**Monitor**（监控中心，统计调用次数与耗时）。其中 Registry 和 Monitor 都不是存活的必要条件：注册中心宕机后，Consumer 凭本地缓存的地址列表仍可直连 Provider，只是感知不到实例上下线。

理解 Dubbo 必须先理解 Invoker——它是对"一次可被调用的服务"的统一抽象。Provider 暴露服务时把实现类包装成 Invoker 再执行 export 打开端口；Consumer 引用服务时拿到的则是经过集群层包装后的 Invoker。一次调用的完整链路大致是：

```text
业务代码
  → Proxy（动态代理，屏蔽远程细节）
  → Cluster Invoker（Directory 取列表 → Router 路由 → LoadBalance 选实例）
  → Filter 链（监控、限流、上下文透传）
  → Protocol（Dubbo/Triple 协议封装 Invocation）
  → Exchange（请求-响应模型，同步转异步）
  → Transport（Netty 收发字节）
  → Serialize（Hessian2 等序列化）
```

这条链路里 Cluster 层最容易被忽视：Consumer 看到的永远只有一个 Invoker，背后是 Directory 维护的可用提供者列表、Router 的路由规则和 LoadBalance 的单实例挑选，集群容错也在这一层生效。读懂这条链，排查超时、串包、路由不生效才有方向。

## SPI：可扩展体系的根

Dubbo 没有直接使用 JDK 的 ServiceLoader，而是自研了 ExtensionLoader，原因很实际：

- JDK SPI 会一次性实例化全部实现类，ExtensionLoader 按需加载，用不到的不初始化；
- `@Adaptive` 自适应扩展：运行时根据 URL 参数动态决定使用哪个实现，由框架生成代理类，例如 Protocol 的自适应逻辑按 URL 里的 protocol 值分发；
- `@Activate` 按条件自动激活，内置 Filter 就是这样成批挂进调用链的；
- 实现类可以是 Wrapper，对其他实现做 AOP 式包装（如 ProtocolFilterWrapper 负责组装 Filter 链），扩展实例还能被注入其他扩展点，相当于一个极简 IoC。

自定义一个负载均衡策略只需两步：实现接口，然后在 `META-INF/dubbo/` 下以接口全限定名命名文件登记实现类：

```java
public class GrayLoadBalance extends AbstractLoadBalance {
    @Override
    protected <T> Invoker<T> doSelect(List<Invoker<T>> invokers, URL url, Invocation invocation) {
        // 自定义选择逻辑，例如按流量标记路由
    }
}
```

```text
# META-INF/dubbo/org.apache.dubbo.rpc.cluster.LoadBalance
gray=com.example.GrayLoadBalance
```

这种微内核加插件的设计让协议、序列化、注册中心、路由、负载均衡全部可替换，Dubbo 内核只负责组装。想换掉序列化或注册中心实现，成本永远是一个扩展点加一个配置文件。

## 集群容错：调用失败之后怎么办

Consumer 侧调用失败时，Cluster 层决定后续动作。内置策略各有明确的适用边界：

| 策略 | 行为 | 适用场景 |
| --- | --- | --- |
| Failover（默认） | 失败后自动切换其他实例重试，默认重试 2 次 | 读操作、幂等写 |
| Failfast | 只调用一次，失败立即抛异常 | 非幂等写：下单、扣款 |
| Failsafe | 失败时吞掉异常，返回空结果 | 写审计日志等允许丢失的调用 |
| Failback | 失败后记录请求，定时任务稍后重发 | 消息通知类，接受最终一致 |
| Forking | 并行调用多个实例，取最先成功的返回 | 实时性要求极高的读，用资源换延迟 |
| Broadcast | 逐个调用所有实例，任一失败即报错 | 刷新提供者本地缓存、推送配置 |

最常见的线上事故是把非幂等接口留在默认 Failover 下：超时后框架悄悄换一台实例重试，下游被扣了两次库存。写接口要么显式 `retries=0` 或改用 Failfast，要么在服务端用幂等号兜底，二者至少要占一条。

## 负载均衡：选中哪一台

- **Random（默认）**：按权重做加权随机。把各实例权重铺在区间上取随机数落点，调用量越大分布越准；配合 warmup 参数可让刚启动的实例权重随时间爬坡，避免冷启动瞬间被打满。
- **RoundRobin**：平滑加权轮询。权重大的实例在一个周期内被分散命中而不是连续命中，分布比随机更均匀，代价是小流量下收敛慢。
- **LeastActive**：挑当前活跃调用数最少的实例。活跃数由 RpcStatus 按"服务+方法"维度统计，请求开始加一、结束减一，活跃数少意味着处理快。适合提供者性能不均的场景，并列时退化为加权随机。
- **ConsistentHash**：让携带相同参数的请求恒定落到同一实例，配合虚拟节点缓解数据倾斜。适合需要会话亲和的场景，实例上下线时只有相邻哈希区间受影响。

## Dubbo3：为什么改成应用级服务发现

Dubbo2 是接口级服务发现：注册中心里存的是"接口 → 地址列表"。一个应用暴露 50 个接口、部署 100 个实例，注册中心就要维护并推送 5000 条地址记录；实例每次上下线，全量接口地址都要重新计算和下发。在阿里这个量级的集群里，注册中心的推送风暴和 Consumer 端地址缓存的内存占用都成了硬瓶颈，也解释了为什么超大规模场景下接口级模型难以为继。

Dubbo3 把注册粒度从接口收窄到应用：注册中心只存"应用名 → 实例地址"，接口到应用的映射交给独立的元数据中心（或 Provider 暴露的 MetadataService）按需查询。推送数据量从 O（接口数×实例数） 降到 O（实例数），模型与 Spring Cloud、Kubernetes Service 对齐，也为接入服务网格铺平了路。配套的 Triple 协议基于 HTTP/2，天然能穿透网关和代理，补上了私有 TCP 协议在跨语言、跨网关场景下的短板。

## 工程实践

- 超时分级设置：方法级优先于接口级，Consumer 端配置优先于 Provider 端；缺省 1 秒对慢接口普遍偏紧，要按下游 P99 对齐。
- Provider 侧配置 warmup 与延迟暴露，实例注册后先预热再接满流量；优雅停机依赖先从注册中心摘流量再关停进程。
- 序列化默认 Hessian2；跨语言或字段演进频繁时评估 Protobuf。类结构变更必须保持向后兼容：只加字段、不改语义、不删方法。
- 2.x 升级 3.x 重点验证服务发现模型切换和元数据上报，可通过双注册平滑过渡，回滚方案要提前演练。

## 面试视角

**一次 Dubbo 调用经过哪些层？** 从动态代理出发，经 Cluster 层（Directory 取列表、Router 路由、LoadBalance 选实例、容错策略包裹），过 Filter 链后由 Protocol 封装请求，Exchange 处理同步转异步，最终由 Netty 发送序列化字节；服务端反向解包后交给具体 Invoker 调用真实实现。能画出 Invoker 链并点明 Cluster 内部结构是明显加分项。

**Failover 和 Failfast 怎么选？** 本质是幂等性问题：读接口和幂等写用 Failover 换成功率；非幂等写用 Failfast 或 retries=0，把重试决策交回业务层并配合幂等号。只背"默认重试 2 次"答不到点上。

**Dubbo3 为什么要做应用级服务发现？** 接口级注册的数据量随接口数与实例数乘积膨胀，超大规模集群下注册中心推送和客户端内存都扛不住；应用级注册只维护实例粒度的地址，接口映射下沉到元数据中心，顺带与云原生服务模型对齐。

## 小结

- Dubbo 的一切都围绕 Invoker 展开：Proxy 屏蔽远程细节，Cluster 合并集群视图，容错与负载均衡都发生在 Cluster 层。
- SPI（ExtensionLoader + @Adaptive + Wrapper）是可扩展性的根基，协议、序列化、注册中心、负载均衡全部可插拔。
- 集群容错的选型本质是幂等性问题；负载均衡默认 Random，性能不均用 LeastActive，亲和场景用 ConsistentHash。
- Dubbo3 的应用级服务发现把注册粒度从接口收到应用，解决超大规模下的推送风暴；Triple 协议补齐云原生与跨语言能力。
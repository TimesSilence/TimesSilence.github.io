---
title: "TCP Keepalive 和 HTTP Keep-Alive 有什么区别？"
date: 2018-05-29 14:12:00
updated: 2018-05-29 14:12:00
permalink: knowledge/cs-basics/network/tcp-keepalive-vs-http-keepalive/
categories:
  - 计算机基础
tags:
  - 计算机网络
  - TCP
  - HTTP
description: "两个机制只是名字撞车：HTTP Keep-Alive 管连接复用，TCP Keepalive 管空闲连接的存活探测。本文对比两者的层次、报文形态、默认行为与回收策略，并澄清常见混淆。"
---

TCP Keepalive 与 HTTP Keep-Alive 除了名字相似，没有任何关系：前者是传输层内核对空闲连接做的存活探测，后者是应用层让多个 HTTP 请求复用同一条 TCP 连接的机制。一个回答"对端还在吗"，一个回答"这条连接能不能接着用"。

<!-- more -->

## 问题的本质：不同层次解决不同问题

两者处于协议栈的不同层，目标完全不同：

| 维度 | HTTP Keep-Alive | TCP Keepalive |
| --- | --- | --- |
| 层次 | 应用层（HTTP） | 传输层（TCP） |
| 目的 | 复用连接，省掉重复握手/挥手 | 探测死连接，回收内核资源 |
| 默认行为 | HTTP/1.1 起默认开启 | 默认关闭，需 `SO_KEEPALIVE` 显式打开 |
| 控制方 | Web 服务器/客户端配置 | 操作系统内核 |
| 关闭策略 | 到超时或次数上限即可主动关 | 对端能回 ACK 就一直维持 |

## HTTP Keep-Alive：连接复用

HTTP/1.0 默认短连接：一次请求/响应结束就关闭 TCP。一个网页几十个资源各建一次连接，三次握手和慢启动的开销非常可观。HTTP/1.1 把长连接（Persistent Connection）设为默认，无需显式声明；想关闭才需要 `Connection: close`。

服务器通过头部参数控制回收时机：

```text
Connection: keep-alive
Keep-Alive: timeout=5, max=100
```

`timeout` 表示空闲多少秒后可关，`max` 表示这条连接最多服务多少个请求。注意这是服务器单方面的权利：到阈值就关，不管客户端此刻是否还想复用；客户端若恰好拿着刚被关闭的旧连接发请求，就会撞上失败重试。Nginx 对应配置是 `keepalive_timeout`（默认 75 秒）和 `keepalive_requests`（默认 1000）。

版本演进上，HTTP/2 改用多路复用并直接禁用 `Connection` 等连接级头部；HTTP/3 基于 QUIC/UDP，连接管理全由 QUIC 负责。

## TCP Keepalive：内核级存活探测

它要解决的问题是"半打开"死连接：对端断电、断网、崩溃后，本端无从知晓，连接一直占着内核资源。机制本身是一套内核定时器：

```text
空闲超过 keepalive_time（默认 7200s）
  → 内核发送探测报文（无数据的 ACK 段）
  → 对端正常：回 ACK，计时器重置
  → 无回应：每 keepalive_intvl（默认 75s）重探，
            累计 keepalive_probes（默认 9 次）失败
  → 判定连接死亡，回收资源
```

探测报文由两端 TCP 协议栈直接应答，应用进程完全不参与。探测后三种结局：对端在线则回 ACK，一切照旧；对端重启过、连接上下文丢失，则回 RST，本端立即关闭；对端失联或网络中断，重试耗尽后由内核判定死亡并回收。按 Linux 默认值，从空闲到判死最长约 7200 + 75×9 ≈ 7875 秒，超过两小时。

查看与调整参数：

```bash
sysctl net.ipv4.tcp_keepalive_time
sysctl net.ipv4.tcp_keepalive_intvl
sysctl net.ipv4.tcp_keepalive_probes
```

## 常见混淆点澄清

- **"开了 HTTP Keep-Alive 就能保活连接"**：错。它只管复用，不做任何探测；而且到点服务器会主动关闭。
- **"TCP Keepalive 证明应用健康"**：错。ACK 是对端内核回的，只能证明内核协议栈活着，应用线程池卡死、数据库挂掉它一概不知。
- **"探测包能及时发现问题"**：默认两小时后才开始首次探测，而 NAT、防火墙的空闲超时往往只有几分钟，中间表项早被清掉，探测包根本到不了对端。
- **回收气质相反**：TCP Keepalive 是被动回收，对端能回 ACK 就一直维持；HTTP Keep-Alive 是主动回收，到点就关。

## 实践要点

空闲连接的真实保活链路是分层的：连接池管理复用与空闲驱逐；NAT/负载均衡的空闲超时决定多久无流量会被中间层遗忘；TCP Keepalive 兜底清理死连接；需要快速发现故障或感知应用状态时，必须在应用层做心跳（WebSocket Ping/Pong、gRPC keepalive、业务自定义心跳）。配置时要让各层超时有明确的大小关系——心跳间隔必须小于 NAT 空闲超时，否则心跳失去意义；应用心跳也要配套断线重连与幂等恢复。

## 小结

- HTTP Keep-Alive 是应用层的连接复用机制，HTTP/1.1 默认开启，服务器按超时和次数上限主动回收。
- TCP Keepalive 是内核的存活探测，默认关闭且默认参数极慢，只认对端内核的 ACK，感知不到应用状态，也无法在对端在线时主动回收。
- 生产环境两者各司其职：复用归 HTTP/连接池，探活归应用层心跳，TCP Keepalive 只做兜底。
---
title: "J2EE 基础知识"
date: 2022-06-20 09:27:00
updated: 2022-06-20 09:27:00
permalink: knowledge/system-design/j2ee/
categories:
  - 系统设计
tags:
  - 系统设计
  - J2EE
description: "从 Servlet 规范的奠基讲起，梳理 J2EE 各规范（JSP、EJB、JPA、JMS）的兴衰、Spring 取代 EJB 的原因，以及 Jakarta EE 在云原生时代的定位。"
---

J2EE 这个名字已经作古——先改名 Java EE，如今叫 Jakarta EE——但它定义的 Servlet 模型至今仍是 Java Web 框架的地基。理解这段演进史，就理解了 Spring 生态为什么长这样。

<!-- more -->

## Servlet：一切的地基

九十年代末动态网页靠 CGI：每请求 fork 一个进程，开销巨大。Sun 于 1996 年发布 Servlet，用一个 JVM 进程内的多线程取而代之，由容器把请求分发给 Servlet 实例。

这个规范做了三件影响深远的事：定义**请求-响应模型**（`HttpServletRequest` 进、`HttpServletResponse` 出，容器管协议解析）；定义**生命周期**（`init()` 一次、`service()` 每次请求、`destroy()` 一次，少量实例被多线程并发调用，故实例字段不能放请求状态）；定义**容器契约**（Tomcat、Jetty 都能跑同一个应用）。

今天 Spring MVC 的 `DispatcherServlet`、各类网关的核心仍是 Servlet——抽象足够简单稳定，才能活近三十年。

## J2EE 规范版图的兴衰

1999 年 J2EE 发布，试图给企业级开发提供全套标准答案，各规范命运迥异：

- **JSP（衰）**：把 Java 嵌进 HTML 简化视图，结果逻辑与页面纠缠成灾，前后端分离后彻底边缘化。
- **EJB（亡）**：想让容器托管事务、安全、远程调用，但实体 Bean 笨重、描述符繁琐、离开容器无法测试。其教训——业务对象不该背框架的包袱——直接催生了 Spring。
- **JPA（存，主角换了）**：2006 年随 EJB 3.0 吸收 Hibernate 设计成为 ORM 标准接口；实现仍是 Hibernate，JPA 是统一门面。
- **JMS（存，场景收窄）**：为消息中间件定了统一 API，是 ActiveMQ 时代的标准；如今 Kafka、RocketMQ 各有原生客户端。

规律清晰：管"代码怎么组织"的规范多被淘汰，管"对接外部资源"的规范以 API 契约存活。

## Spring 为什么取代 EJB

EJB 的野心没错，错在实现：业务类必须实现框架接口、靠 JNDI 找协作者、离开容器跑不起测试。

Spring 用两个朴素思想翻盘：一是 **POJO 编程**，业务类就是普通 Java 对象，new 出来就能单测；二是 **依赖注入**，JNDI 查找变成一个构造器参数。再配上 AOP 声明式事务，轻量容器兑现了 EJB 承诺的几乎一切。Java EE 5/6 虽反过来吸收这些思想（CDI、注解取代 XML）但为时已晚；Spring Boot 又终结了打 WAR 包部署的时代。

## 从 J2EE 到 Jakarta EE

名字变迁本身就是历史：J2EE（1999）→ Java EE（2006 去掉"2"）→ Jakarta EE（Oracle 移交 Eclipse 基金会，因商标限制包名从 `javax.*` 迁往 `jakarta.*`）。这是罕见的破坏性变更：不改包名就跑不了 Tomcat 10 之后的新容器。

## 云原生时代的定位

Jakarta EE 仍在演进，MicroProfile 补充配置、健康检查、容错等微服务能力。但云原生主角是 Spring Boot/Cloud、Quarkus、Micronaut：面向容器与 K8s，支持 GraalVM 原生镜像，启动毫秒级。

Jakarta EE 的现实际遇是：**作为编程模型被框架生态超越，作为规范遗产无处不在**——Servlet、JPA、Bean Validation 仍埋在框架底层。与其追规范名词，不如吃透 Servlet 请求模型、IoC、ORM 三块地基。

## 小结

- Servlet 奠定"容器 + 请求-响应模型"的地基，至今是 Spring MVC 底层。
- 管代码组织的规范（EJB、JSP）多被淘汰，管资源对接的（JPA、JMS）以 API 存活。
- Spring 以 POJO + IoC 取代 EJB；更名 Jakarta EE 后规范退居底层，框架成为主角。
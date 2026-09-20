---
title: "Spring 中的设计模式详解"
date: 2022-08-08 14:02:00
updated: 2022-08-08 14:02:00
permalink: knowledge/system-design/framework/spring/spring-design-patterns-summary/
categories:
  - 系统设计
tags:
  - 系统设计
  - 总结
description: "从设计模式视角拆解 Spring：BeanFactory 的工厂模式、Bean 作用域的单例、AOP 的代理、JdbcTemplate 的模板方法、事件机制的观察者与 HandlerAdapter 的适配器。"
---

「Spring 中用到了哪些设计模式」是面试常客，但只背名词没有意义。本文把六个最高频的模式实例拆开，每个都回答两个问题：它出现在框架的什么位置，以及它解决了什么设计问题。

<!-- more -->

## 工厂模式：BeanFactory 与 ApplicationContext

**框架中的位置**：IoC 容器本身就是一个大工厂。`BeanFactory` 是最基础的工厂接口，`getBean()` 按名称或类型返回实例；`ApplicationContext` 在其上扩展了事件发布、国际化、资源加载等企业能力，并在启动阶段预实例化非懒加载的单例 Bean。

**解决的设计问题**：把对象「怎么创建」与「怎么使用」分开。业务类不再 `new` 依赖、不关心构造参数与初始化顺序，创建逻辑集中在容器内；替换实现只需调整 Bean 定义，而不必改动所有调用点。这正是工厂模式对开闭原则的支撑。

## 单例模式：Bean 的默认作用域

**框架中的位置**：Bean 默认作用域是 singleton，容器通过 `DefaultSingletonBeanRegistry` 中以 `ConcurrentHashMap` 为核心的单例注册表保证同名 Bean 全局唯一。

**解决的设计问题**：Service、Dao 这类无状态对象反复创建纯属浪费，单例省去重复实例化开销，也减轻 GC 压力。值得注意的是，Spring 的单例是「容器范围内唯一」而非「JVM 全局唯一」——边界由容器控制，测试时另起一个容器即可获得全新实例，规避了手写全局单例难以隔离的通病。

## 代理模式：AOP 的根基

**框架中的位置**：声明式事务、`@Async`、`@Cacheable` 都建立在 AOP 代理之上：目标类实现了接口就用 JDK 动态代理，否则用 CGLIB 生成子类代理，方法调用先经过拦截器链再转发给真实对象。

**解决的设计问题**：事务、日志、权限这类横切逻辑与业务无关却散落各处。代理让增强逻辑收敛到切面中，业务代码保持纯净，调用方拿到的是接口一致的代理对象，对增强无感知。代价也直接来自代理机制本身：同类自调用、final 方法、非 public 方法都绕不过拦截规则——使用层面几乎所有「注解失效」都能追溯到这一点。

## 模板方法模式：JdbcTemplate

**框架中的位置**：`JdbcTemplate`、`RestTemplate`、`JmsTemplate` 等 Template 家族把「获取资源、执行、异常转换、释放资源」的骨架固定在模板里，易变的部分交给回调接口。

**解决的设计问题**：JDBC 操作九成是样板——拿连接、建 Statement、try-catch、关资源，真正变化的只有 SQL 与结果集映射。Spring 没有用继承式模板方法，而是让回调（`RowMapper`、`PreparedStatementSetter`）与模板组合，既复用骨架又避免子类泛滥：

```java
List<User> users = jdbcTemplate.query(
        "SELECT id, name FROM user WHERE age > ?",
        (rs, rowNum) -> new User(rs.getLong("id"), rs.getString("name")),
        18);
```

资源泄露防护与 `SQLException` 到 `DataAccessException` 的统一转换，都由模板兜底。

## 观察者模式：事件机制

**框架中的位置**：三个角色分工明确——`ApplicationEvent` 是事件，`ApplicationListener`（或 `@EventListener` 方法）是观察者，`ApplicationEventPublisher` 是发布者，底层由 `ApplicationEventMulticaster` 完成广播。容器自身的生命周期通知（`ContextRefreshedEvent` 等）也走同一套机制。

**解决的设计问题**：「订单创建后要发短信、清缓存、加积分」这类一个动作触发多个后续行为的场景，直接调用会让订单服务的依赖越滚越多。事件机制把「已经发生了什么」广播出去，关心的人自行订阅，发布方与订阅方互不知晓，实现真正的模块解耦。

## 适配器模式：MVC 的 HandlerAdapter

**框架中的位置**：`DispatcherServlet` 并不直接调用 Controller，而是从 `HandlerMapping` 拿到 Handler 后，挑选匹配的 `HandlerAdapter` 代为执行。

**解决的设计问题**：Spring MVC 的 Handler 形态不一——`@RequestMapping` 注解方法、`Controller` 接口实现、函数式端点，调用约定各不相同。没有适配器，中央调度器就得写一串 `instanceof` 分支，每新增一种 Handler 类型都要改核心代码，违反开闭原则。适配器把差异收敛到各自的实现里，新增 Handler 类型只需注册一个新 Adapter。AOP 侧同理：各类 Advice 通过 `AdvisorAdapter` 统一适配成 `MethodInterceptor`，才能进入同一条拦截器链。

## 小结

模式在 Spring 中不是点缀而是骨架：工厂负责创建、单例管理共享、代理承载增强、模板固化流程、观察者解耦通知、适配器抹平差异。读源码时先找「稳定接口」与「可变实现」的接缝，那里多半就站着一个经典模式。
---
title: "IoC & AOP详解（快速搞懂）"
date: 2022-07-29 13:55:00
updated: 2022-07-29 13:55:00
permalink: knowledge/system-design/framework/spring/ioc-and-aop/
categories:
  - 系统设计
tags:
  - 系统设计
  - AOP
description: "拆解 Spring 两大基石：IoC 容器的 Bean 生命周期与三级缓存循环依赖解法，AOP 的两种动态代理选型，以及 @Transactional 失效的典型场景。"
---

IoC 把对象的创建与装配权从业务代码移交给了容器，AOP 则把日志、事务这类横切逻辑从业务方法里剥离成独立切面——两者共同构成 Spring 框架的地基。本文沿 Bean 生命周期、三级缓存、代理选型到事务失效场景逐层展开。

<!-- more -->

## 它解决什么问题

先看没有 IoC 的世界：`UserService` 依赖 `UserDao`，最常见的写法是在 Service 内部 `new UserDaoImpl()`。功能能跑，但代价是编译期就绑死了具体实现——一旦要换成 `UserCacheDaoImpl`，所有 new 过它的地方都得改；单元测试想换成 Mock 实现，更是无从下手。IoC 的回答很直接：对象不再自己制造依赖，而是声明「我需要什么」，由容器在启动时统一实例化并按需注入。创建权从代码反转到容器，这就是「控制反转」的字面含义。

AOP 面对的是另一类问题：权限校验、事务边界、访问日志、耗时统计，这些逻辑与具体业务无关，却被迫散落在每个方法的首尾。它们被称为横切关注点（cross-cutting concerns）。AOP 的做法是把这类逻辑收敛到切面里，运行时由代理对象在目标方法前后织入，业务代码只保留一行注解甚至完全无感知。

## 核心原理

IoC 是一种设计思想，DI（依赖注入）是它最主流的落地方式。Spring 的 IoC 容器（`BeanFactory` 及其增强版 `ApplicationContext`）本质上维护了一张 Bean 定义表和一张单例缓存表：启动时读取配置元数据（XML、注解、JavaConfig）生成 `BeanDefinition`，再按定义逐个实例化、填充、初始化，最终产出就绪的单例 Bean。

AOP 在 Spring 中基于动态代理实现：容器在 Bean 初始化的尾声，用 `BeanPostProcessor` 判断该 Bean 是否命中切点，命中就把原始对象包装成代理对象注册进容器。此后外部拿到的都是代理，方法调用先经过代理的拦截链，再到达目标方法。事务、缓存、异步这些声明式能力，全部建立在这条代理链之上。

## 深入机制

### Bean 生命周期全流程

一个单例 Bean 从定义到销毁大致经历以下节点，顺序必须记牢：

1. **实例化**：`createBeanInstance`，通过构造器或工厂方法分配对象，此时属性全是默认值；
2. **属性填充**：`populateBean`，处理 `@Autowired`、`@Value` 等注入点；
3. **Aware 回调**：依次调用 `BeanNameAware`、`BeanFactoryAware`、`ApplicationContextAware` 等，让 Bean 感知容器环境；
4. **前置增强**：`BeanPostProcessor#postProcessBeforeInitialization`，所有注册的 BPP 逐个执行；
5. **初始化**：先 `@PostConstruct` 注解方法，再 `InitializingBean#afterPropertiesSet`，最后自定义 `init-method`；
6. **后置增强**：`postProcessAfterInitialization`——AOP 代理就是在这一步生成的，`AbstractAutoProxyCreator` 在此返回代理对象替换原始 Bean；
7. **就绪使用**，直到容器关闭时执行销毁：`@PreDestroy` → `DisposableBean#destroy` → 自定义 `destroy-method`。

理解这条链的意义在于定位问题：属性为 null 多半是填充阶段没匹配到注入点；代理没生效要查后置处理器；初始化顺序纠纷要看 Aware 与 BPP 的先后。

### 三级缓存与循环依赖

假设 A 依赖 B、B 又依赖 A（setter 注入）。Spring 在 `DefaultSingletonBeanRegistry` 里放了三层结构来解开这个死结：

| 缓存 | 名称 | 存什么 |
| --- | --- | --- |
| 一级 | `singletonObjects` | 走完整生命周期的成品单例 |
| 二级 | `earlySingletonObjects` | 已实例化但未填充的「半成品」早期引用 |
| 三级 | `singletonFactories` | 生成早期引用的 `ObjectFactory`，lambda 里包着 `getEarlyBeanReference` |

流程是：A 实例化后立刻把自己的 `ObjectFactory` 塞进三级缓存，然后去填充属性时发现需要 B；B 开始创建，填充时发现需要 A，于是从三级缓存拿到 A 的工厂并调用——关键点来了，工厂内部会经过 `SmartInstantiationAwareBeanPostProcessor#getEarlyBeanReference`，如果 A 需要被代理，此时返回的就是 A 的代理对象，保证 B 持有的和最终容器里的 A 是同一个对象。B 完成后放入一级缓存，A 接着拿到 B 完成填充。

为什么不能用两级缓存？如果直接把半成品对象暴露出去，AOP 场景下别的 Bean 会注入到原始对象而非代理，与容器最终的代理不一致；把代理创建提前到实例化阶段虽然可行，但违背了「在初始化之后才生成代理」的设计约定，会打乱所有 BPP 的执行时机假设。三级缓存用工厂把「是否提前生成代理」的决策推迟到真正被依赖的那一刻，是规范性与正确性之间的平衡点。

注意它的边界：只对**单例 + setter/字段注入**有效。构造器注入的循环依赖在实例化阶段就互相等待，三级缓存无能为力，会直接抛 `BeanCurrentlyInCreationException`；prototype 作用域同样不解决。

### 两种动态代理的选择逻辑

Spring AOP 的运行时增强只有两条技术路线：

- **JDK 动态代理**：基于 `java.lang.reflect.Proxy`，要求目标类至少实现一个接口，代理类与目标实现同一接口，调用统一走 `InvocationHandler#invoke`；
- **CGLIB**：基于 ASM 字节码生成目标类的子类，通过方法拦截器 `MethodInterceptor` 织入，不要求接口，但无法代理 `final` 类与 `final` 方法。

Spring Framework 默认策略是「有接口用 JDK，无接口用 CGLIB」；而 Spring Boot 2.0 起把 `spring.aop.proxy-target-class` 默认值改为 `true`，即一律使用 CGLIB，想回到接口代理需显式配置为 `false`。Boot 这么做的现实原因是：注入时按接口声明的代码在 JDK 代理下正常，但很多人习惯按实现类注入，CGLIB 对两种写法都兼容，能减少一类隐蔽的 `ClassCastException`。

### @Transactional 失效的常见场景

事务注解的本质是 AOP 代理，因此一切「绕过代理」或「代理规则不满足」的写法都会让事务静默失效：

1. **自调用**：同类中 `this.methodB()` 调用带注解的方法，没走代理，事务不启动。解法是拆分到另一个 Bean、注入自身代理，或用 `AopContext.currentProxy()`（需开启 `exposeProxy`）；
2. **非 public 方法**：Spring 的声明式事务默认只拦截 public 方法；
3. **异常被吞**：`try-catch` 把异常吃掉不往外抛，代理感知不到回滚信号；
4. **异常类型不匹配**：默认只对 `RuntimeException` 和 `Error` 回滚，抛出受检异常需显式 `rollbackFor = Exception.class`；
5. **存储引擎不支持**：MySQL 的 MyISAM 表没有事务能力，注解再正确也是空谈；
6. **跨线程调用**：事务通过 `ThreadLocal` 绑定连接，新线程里执行的 SQL 不在原事务中；
7. **代理被 final 挡下**：CGLIB 模式下 final 方法无法被拦截增强。

## 工程实践

- **优先构造器注入**：依赖在构造期就齐备，对象天生不可变，且循环依赖会在启动时立刻暴露而不是被三级缓存掩盖——发现循环依赖的正确反应是重划职责，而不是加 `@Lazy` 续命；
- **依赖注入面向接口声明**，字段上写接口类型，替换实现与 Mock 测试都从容；
- **切面只做稳定的横切能力**（日志、事务、权限、限流），业务规则不要藏进切面，否则控制流对阅读者隐形；
- 事务方法保持 public、入口在 Service 边界，内部细粒度方法不要指望注解生效；涉及多数据源或异步编排时，先想清楚事务边界的真实范围。

## 对比与权衡

| 维度 | JDK 动态代理 | CGLIB 代理 | AspectJ 织入 |
| --- | --- | --- | --- |
| 前提 | 目标实现接口 | 类与方法非 final | 引入 AspectJ 织入器 |
| 增强时机 | 运行时 | 运行时 | 编译期 / 类加载期 |
| 自调用是否增强 | 否 | 否 | 是（改写字节码，无代理） |
| 调用开销 | 反射调用略高 | 方法索引调用略低 | 接近原生 |
| 典型场景 | 面向接口的常规服务 | Boot 2.x 默认、无接口类 | 切面数量多、需字段级织入 |

选型上，普通业务项目跟着 Spring Boot 默认的 CGLIB 走即可；切面数量庞大或需要拦截构造器、字段访问时，才考虑引入 AspectJ 的编译期/加载期织入。

## 面试视角

**三级缓存每一级分别存什么？** 一级 `singletonObjects` 存初始化完成的成品单例；二级 `earlySingletonObjects` 存从三级工厂取出的早期引用；三级 `singletonFactories` 存 `ObjectFactory`，内部封装 `getEarlyBeanReference`，负责在循环依赖发生时按需生成（可能是代理的）早期对象。

**为什么构造器注入的循环依赖解不了？** 三级缓存生效的前提是「先实例化、再填充」，构造器注入把依赖的获取提前到了实例化阶段，A 还没 new 出来就需要 B 的成品，而 B 同样需要 A 的成品，双方连半成品都拿不出，缓存自然无处安放。

**JDK 动态代理和 CGLIB 怎么选？** 有接口且面向接口注入可用 JDK 代理；没有接口、或团队习惯按实现类注入时用 CGLIB。Spring Boot 2.0 之后默认强制 CGLIB（`proxy-target-class=true`），注意 final 方法与自调用两种失效边界。

**@Transactional 为什么会在自调用时失效？** 事务由代理对象在方法入口开启、出口提交或回滚；同类内部 `this.foo()` 直接调用目标对象本身，绕过了代理的拦截链，事务切面根本没有执行机会。

**BeanPostProcessor 和 BeanFactoryPostProcessor 的区别？** 前者作用于 Bean 实例，在每个 Bean 初始化前后回调，AOP 代理即由此产生；后者作用于 `BeanDefinition` 元数据，在 Bean 实例化之前修改定义，`ConfigurationClassPostProcessor` 解析 `@Configuration` 就是典型例子。

## 小结

- IoC 的本质是把对象装配权交给容器，DI 是落地手段，收益是解耦与可测试性；
- Bean 生命周期记住「实例化 → 填充 → Aware → BPP 前置 → 初始化 → BPP 后置 → 销毁」，AOP 代理诞生在最后那个后置节点；
- 三级缓存用「工厂延迟决策」解决单例 setter 循环依赖，同时守住代理一致性，但救不了构造器注入；
- 代理是 Spring 声明式能力的总开关：绕过代理（自调用）或挡住代理（final、非 public），事务就会静默失效。
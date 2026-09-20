---
title: "Spring常见面试题总结"
date: 2022-08-17 15:09:00
updated: 2022-08-17 15:09:00
permalink: knowledge/system-design/framework/spring/spring-knowledge-and-questions-summary/
categories:
  - 系统设计
tags:
  - 系统设计
  - 总结
description: "Spring 高频面试题深度解析：IoC 与依赖注入、Bean 作用域与生命周期、AOP 代理、MVC 请求链路、循环依赖三级缓存与声明式事务。"
---

Spring 面试题覆盖面很广，但真正高频的考点集中在 IoC、Bean、AOP、MVC、循环依赖和事务六条主线上。本文把每条主线最值得深挖的题目挑出来，按「结论—原理—延伸—追问」逐一展开。

<!-- more -->

## 考察地图

- **框架全景**：Spring、Spring MVC、Spring Boot 的关系。考察对生态边界的理解。
- **IoC 与 Bean**：IoC 解决什么问题、`@Component` 与 `@Bean`、`@Autowired` 与 `@Resource`、注入方式选型、作用域与线程安全、生命周期。Spring 面试的主战场。
- **AOP**：动态代理机制，以及 Spring AOP 与 AspectJ 的对比。
- **Spring MVC**：一次请求的完整处理链路。
- **循环依赖**：三级缓存的工作机制与能力边界。
- **事务**：传播行为与 `@Transactional` 回滚规则。
- 建议自行查阅：Spring 模块清单、五种通知类型、JPA 审计注解、Spring Security 权限方法列表——偏记忆或偏实战，面试中很少深挖。

## 框架全景

### Spring、Spring MVC、Spring Boot 是什么关系？

**结论**：Spring 是提供 IoC、AOP 等基础能力的核心框架；Spring MVC 是构建在其上的 Web 模块；Spring Boot 是简化配置与部署的脚手架，三者是地基、楼层与装修的关系。

**原理**：Spring Framework 由一组模块构成：core、beans、context 组成容器核心，负责 Bean 的定义、创建、注入与生命周期；aop、jdbc、tx、web 等模块都建立在容器之上。Spring MVC 是 web 模块中的 MVC 实现，用 `DispatcherServlet` 统一接收并分发请求。Spring Boot 不替代其中任何一个，而是通过自动装配、条件注解和 Starter 依赖管理，把原本需要手写的 XML/Java 配置变成约定优于配置，再内嵌容器让应用以 jar 形式直接运行。

**延伸**：常见误区是把 Spring Boot 当成 Spring 的替代品或升级版。实际上离开 Spring 容器，Boot 的自动配置没有依附对象；回答时主动点破这一层，能体现对生态结构的理解。

> 追问：Spring Boot 的自动配置为什么不会覆盖你手动声明的同名 Bean？提示：从 `@ConditionalOnMissingBean` 等条件注解的评估时机切入。

## IoC 与 Bean

### 什么是 IoC？它解决了什么问题？

**结论**：IoC（控制反转）是把对象的创建与依赖组装交给容器的设计思想，DI（依赖注入）是它最常见的实现方式。

**原理**：传统写法中 A 依赖 B 就要在 A 内部 `new B()`，依赖关系硬编码在代码里：B 的实现一换，所有引用点都得改。引入容器后创建权反转为容器持有，A 只声明「我需要一个 B 类型的协作方」，由容器在启动期完成实例化与注入。收益有两层：对象之间只依赖接口而非具体实现，耦合度下降；实例的创建、作用域与销毁集中管理，单例、懒加载等能力开箱即用。

**延伸**：IoC 是原则而非某项具体技术。事件回调、模板方法里的「好莱坞原则」体现的是同一种思想——不要主动调用框架，框架会在合适的时机调用你。

> 追问：构造注入、Setter 注入、字段注入分别发生在 Bean 创建的哪一步？提示：回想实例化与属性填充的先后顺序。

### @Component 和 @Bean 有什么区别？

**结论**：`@Component` 标在类上，靠类路径扫描自动注册；`@Bean` 标在配置类的方法上，由方法体显式产出实例，自定义程度更高。

**原理**：`@Component`（及 `@Service`、`@Repository`、`@Controller` 等派生注解）由组件扫描发现，实例化权完全交给容器，适合开发者自己写的类。`@Bean` 则把「如何创建对象」写在方法体里，容器只负责调用方法并管理返回值。注册第三方库的类时——源码不在手里、没法加注解——`@Bean` 几乎是唯一选择；需要按条件返回不同实现时，方法里可以写任意分支：

```java
@Configuration
public class StorageConfig {

    @Bean
    public StorageService storageService(Environment env) {
        String type = env.getProperty("storage.type", "local");
        return "oss".equals(type) ? new OssStorageService() : new LocalStorageService();
    }
}
```

**延伸**：`@Configuration` 类中直接调用另一个 `@Bean` 方法拿到的仍是同一个单例，因为配置类被 CGLIB 增强，方法调用会被拦截转为查容器；换成普通 `@Component` 标注的配置类就没有这个保证。

> 追问：既然组件扫描更省事，为什么多数 Starter 仍用 `@Bean` 注册组件？提示：条件装配与显式构造参数的可控性。

### @Autowired 和 @Resource 有什么区别？

**结论**：`@Autowired` 是 Spring 原生注解，按类型注入；`@Resource` 是 JSR-250 规范注解，默认按名称注入，名称落空再退化为按类型。

**原理**：`@Autowired` 先按字段或参数的类型找候选：恰好一个直接注入；多个候选时尝试用属性名匹配 Bean 名，仍无法区分就抛 `NoUniqueBeanDefinitionException`，需要 `@Qualifier` 显式指定：

```java
@Autowired
@Qualifier("smsServiceImpl1")
private SmsService smsService;

@Resource(name = "smsServiceImpl1") // 一步到位
private SmsService smsService2;
```

`@Resource` 的默认行为是把字段名当 Bean 名去查，查不到再按类型找，类型候选超过一个同样抛异常。另外 `@Autowired` 支持构造器、方法、字段和参数，`@Resource` 只支持字段与方法。

**延伸**：`@Resource` 属于 Java 标准，能降低业务代码与 Spring 的耦合；`@Autowired` 配合构造器注入则能表达「必需依赖 + 不可变」。两者各有适用面，团队统一风格比纠结选型更重要。

> 追问：容器里有两个同类型 Bean 且都没显式命名，`@Resource` 不指定 name 会怎样？提示：byName 落空退回 byType，多个候选直接抛异常。

### 构造函数注入和 Setter 注入怎么选？

**结论**：必需依赖用构造函数注入，可选依赖用 Setter 注入；字段注入只图省事，不建议出现在生产代码里。

**原理**：构造器注入在对象创建时就收齐全部依赖，带来四个实际收益：依赖完整，不存在半初始化对象；字段可声明为 `final`，对象不可变、天然线程安全；职责可视——构造器参数膨胀到十几个时，说明类承担了太多职责；测试友好，不启动容器也能 `new` 出来传入 mock：

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentClient paymentClient;

    public OrderService(OrderRepository orderRepository, PaymentClient paymentClient) {
        this.orderRepository = orderRepository;
        this.paymentClient = paymentClient;
    }
}
```

Setter 注入允许对象先建好后补齐依赖，适合有合理默认值的可选依赖。字段注入的问题是依赖被隐藏、无法置 final，单元测试必须借助容器或反射。

**延伸**：Spring 4.3 起，类只有一个构造器时可以省略 `@Autowired`；配合 Lombok 的 `@RequiredArgsConstructor` 能进一步消除样板代码。

> 追问：两个 Bean 都用构造器互相依赖会发生什么？提示：实例化阶段就需要对方，无解，直接抛 BeanCurrentlyInCreationException。

### Bean 有哪些作用域？单例 Bean 线程安全吗？

**结论**：常用作用域是 singleton（容器内唯一，默认）和 prototype（每次获取新建），Web 环境另有 request、session、application、websocket。单例 Bean 是否线程安全取决于它有没有可变状态，而非作用域本身。

**原理**：singleton 在整个容器中只有一份实例，由单例注册表缓存；prototype 每次 `getBean` 都新建。Service、Dao 这类无状态 Bean（只有方法、没有可变成员变量）被多线程共享没有问题——竞争只发生在共享可变数据上。真正的隐患是有状态单例，例如把请求数据存进成员变量。处理思路按优先级有三条：把 Bean 设计成无状态，状态通过方法参数传递；必须持有状态时用 `ThreadLocal` 隔离到线程；实在绕不开再加 `synchronized`，但要接受吞吐量的损失。

**延伸**：把 prototype Bean 注入单例 Bean 时，由于注入只发生一次，拿到的永远是同一个 prototype 实例——需要 `@Lookup` 或 `ObjectProvider` 才能每次获取新实例。

> 追问：request 作用域的 Bean 注入单例 Controller 为什么能正常工作？提示：注入的是作用域代理，调用时才解析到当前请求的真实实例。

### Bean 的生命周期是怎样的？

**结论**：整体四步——实例化、属性填充、初始化、销毁；初始化阶段内部还嵌套 Aware 回调、`BeanPostProcessor` 前后置处理与 init 方法。

**原理**：容器读取 Bean 定义后，先通过反射调用构造器创建实例（实例化）；再处理 `@Autowired`、`@Value` 等完成依赖注入（属性填充）；随后进入初始化：实现了 `BeanNameAware`、`BeanFactoryAware` 等接口的先回调注入容器资源；接着执行所有 `BeanPostProcessor` 的 `postProcessBeforeInitialization`；再调用 `InitializingBean#afterPropertiesSet` 和自定义 `init-method`；最后执行 `postProcessAfterInitialization`——AOP 代理、`@Async` 代理大多在这一步前后生成。容器关闭时，对实现了 `DisposableBean` 或声明了 `destroy-method`、`@PreDestroy` 的单例执行销毁回调。

**延伸**：死记接口名不如记住「实例化 → 填充 → 初始化 → 销毁」的骨架，再把扩展点逐个挂进去。源码入口是 `AbstractAutowireCapableBeanFactory#doCreateBean`，依次调 `createBeanInstance`、`populateBean`、`initializeBean`，对照走一遍胜过背十遍。

> 追问：`@PostConstruct` 标注的方法处在生命周期的哪个位置？提示：由 `CommonAnnotationBeanPostProcessor` 在 afterPropertiesSet 之前触发。

## AOP

### Spring AOP 的实现原理是什么？和 AspectJ 有什么区别？

**结论**：Spring AOP 基于运行期动态代理——目标实现接口用 JDK 动态代理，否则用 CGLIB 生成子类代理；AspectJ 基于编译期或类加载期的字节码织入，能力更强但接入更重。

**原理**：JDK 动态代理通过 `Proxy.newProxyInstance` 生成实现相同接口的代理类，调用统一进入 `InvocationHandler`，因此要求目标必须有接口。CGLIB 用字节码技术生成目标类的子类并重写方法织入增强，无法代理 final 类和 final 方法，对 static、private 方法同样无效。Spring AOP 只支持方法级连接点、只作用于容器管理的 Bean；AspectJ 还支持构造器调用、字段访问等连接点，可作用于任意对象，运行期没有代理调用开销。

**延伸**：选型很直接——常规业务增强（事务、日志、监控）用 Spring AOP 足够且零接入成本；需要增强非容器对象、final 方法或追求极限性能时，才引入 AspectJ 的编译期织入或 LTW。

> 追问：同类中 `this.method()` 调用为什么不会触发增强？提示：调用没有经过代理对象——这也是 `@Async`、`@Transactional` 失效的共同根因。

## Spring MVC

### Spring MVC 处理一次请求的完整流程是怎样的？

**结论**：`DispatcherServlet` 统一入口，经 `HandlerMapping` 找到处理器，由 `HandlerAdapter` 适配执行，返回值经 `HttpMessageConverter` 或 `ViewResolver` 处理后响应。

**原理**：请求到达 `DispatcherServlet` 后：第一步，遍历 `HandlerMapping` 链按 URL 匹配到 Handler（通常是 `@RequestMapping` 方法），并组装上拦截器；第二步，按 Handler 类型选择 `HandlerAdapter` 执行——注解方法由 `RequestMappingHandlerAdapter` 负责参数解析、数据绑定与校验；第三步，Handler 返回后，`@RestController` 场景直接由 `HttpMessageConverter` 把返回值序列化为 JSON 写出，传统视图场景才把 `ModelAndView` 交给 `ViewResolver` 解析渲染。流程中抛出的异常统一进入 `HandlerExceptionResolver` 链，`@ControllerAdvice` 加 `@ExceptionHandler` 的全局异常处理就挂在这一环。

**延伸**：前后端分离项目里 `ViewResolver` 基本退场，返回纯数据成为常态；但映射、适配、异常解析三段流程不变，掌握它们足以定位绝大多数 MVC 层问题。

> 追问：`@ExceptionHandler` 是靠 AOP 代理实现的吗？提示：不是，异常解析器按异常类型匹配注册表，继承距离最近的方法胜出。

## 循环依赖

### Spring 是怎么用三级缓存解决循环依赖的？

**结论**：针对单例 Bean 的 Setter/字段注入循环依赖，Spring 用「提前暴露半成品对象」打破死循环，三级缓存分别存放成品、半成品和对象工厂。

**原理**：以 A 依赖 B、B 又依赖 A 为例。A 先实例化（此时属性为空），立即把一个 `ObjectFactory` 放入三级缓存 `singletonFactories`，其 `getObject()` 能返回 A 的早期引用——若 A 需要 AOP，这里返回的就是代理对象。A 填充属性时发现要 B，转去创建 B；B 填充属性时要 A，一二缓存都没有，于是调三级缓存中的工厂拿到 A 的早期引用，工厂随即从三级缓存移除、结果升入二级缓存 `earlySingletonObjects`。B 顺利完成初始化，作为成品进入一级缓存 `singletonObjects`，A 拿到 B 后也走完流程。之所以要三级而非两级，是为了把「是否生成代理」的判断延迟到真正发生循环依赖时，并保证多次获取早期引用返回同一个代理。

**延伸**：机制边界同样明确：构造器循环依赖在实例化阶段就死锁，无解；prototype 每次都要新建，缓存无意义，同样不支持。Spring Boot 2.6 起默认禁止循环依赖，本质是在提醒：循环依赖是设计缺陷，能重构就别依赖框架兜底。

> 追问：`@Lazy` 为什么能解开构造器循环依赖？提示：注入点先给一个延迟解析的代理，真正调用方法时才创建目标 Bean。

## 事务

### 事务传播行为有哪些？@Transactional 默认对哪些异常回滚？

**结论**：传播行为共七种，最常用 `REQUIRED`（有事务就加入、没有就新建）、`REQUIRES_NEW`（挂起当前、独立新建）和 `NESTED`（嵌套）；`@Transactional` 默认只对 `RuntimeException` 与 `Error` 回滚。

**原理**：传播行为解决的是「事务方法调用另一个事务方法」时边界如何合并。`REQUIRED` 是默认值，内外方法同属一个事务，内层异常会把整个事务标记回滚；`REQUIRES_NEW` 让内层拥有物理独立的事务，适合「主流程失败也要落审计日志」；`NESTED` 基于数据库 savepoint，内层回滚只退到保存点、不拖累外层。回滚规则方面，Spring 视受检异常为「可预期的业务结果」，默认不回滚，需要显式声明：

```java
@Transactional(rollbackFor = Exception.class)
public void placeOrder() { ... }
```

**延伸**：声明式事务同样建立在代理上，自调用、非 public、final 方法都会让事务静默失效。「内层 `REQUIRED` 捕获了异常却不重抛」是另一个经典坑：事务已被标记 rollback-only，提交时反而抛 `UnexpectedRollbackException`。

> 追问：`REQUIRES_NEW` 的内层事务提交后，外层再回滚，内层写入的数据还在吗？提示：两个事务物理独立——这正是它适合审计场景的原因。
---
title: "SpringBoot 自动装配原理详解"
date: 2022-09-06 17:23:00
updated: 2022-09-06 17:23:00
permalink: knowledge/system-design/framework/spring/spring-boot-auto-assembly-principles/
categories:
  - 系统设计
tags:
  - 系统设计
  - 实现原理
description: "从 @EnableAutoConfiguration 的导入机制出发，讲清 spring.factories 到 AutoConfiguration.imports 的演进、@Conditional 条件装配族，并手写一个可运行的自定义 Starter。"
---

自动装配是 Spring Boot 的灵魂：引入一个 Starter、加几行配置就能获得一整套开箱即用的 Bean。其底层是 `@Import` 导入机制、SPI 候选清单与 `@Conditional` 条件评估三者的协作。本文从组合注解拆到源码流程，最后手写一个完整 Starter 收尾。

<!-- more -->

## 它解决什么问题

在没有 Spring Boot 的年代，给一个 Spring 项目接入 Web MVC，需要手写 `ViewResolver`、Jackson 视图等一串 JavaConfig，再配一份 `spring-servlet.xml` 声明组件扫描与注解驱动；接入 Redis、JPA、MQ 同样要重复这套「查文档、抄配置、调版本」的仪式。配置本身没有业务价值，却消耗大量时间，还极易因版本错配而启动失败。

自动装配要消除的正是这种重复：框架按「约定」准备好各个技术栈的默认配置类，按条件筛选出当前类路径与配置下真正需要的那部分，自动注册进容器；用户一旦定义了同类 Bean，默认实现主动退让。一句话概括——**约定优于配置，条件决定装配，用户定义优先**。

## 核心原理

一切从启动类上的 `@SpringBootApplication` 说起，它是三个注解的组合体：

```java
@SpringBootConfiguration   // 本质是 @Configuration，标记启动类即配置类
@EnableAutoConfiguration   // 开启自动装配，本文主角
@ComponentScan             // 扫描启动类所在包及其子包下的组件
public @interface SpringBootApplication {
}
```

`@ComponentScan` 只负责扫「自己项目」的包，第三方 jar 里的配置类扫不到，这就要靠 `@EnableAutoConfiguration` 出场：

```java
@AutoConfigurationPackage   // 把启动类所在包登记为自动配置的基准包
@Import(AutoConfigurationImportSelector.class)   // 导入选择器，批量引入配置类
public @interface EnableAutoConfiguration {
    Class<?>[] exclude() default {};
    String[] excludeName() default {};
}
```

核心是 `@Import` 导入的 `AutoConfigurationImportSelector`。`@Import` 支持三种导入方式：普通配置类、`ImportSelector`（接口方法返回一批要注册的全限定类名）、`ImportBeanDefinitionRegistrar`（直接编程式注册 BeanDefinition）。`AutoConfigurationImportSelector` 实现的是 `DeferredImportSelector`，意味着它会推迟到所有常规 `@Configuration` 处理完之后才执行——这个「最后登场」的顺序是「用户定义优先」能够成立的前提。

候选配置类从哪里来？这经历了注册机制的演进：

- **Spring Boot 2.6 及更早**：候选清单写在各 jar 包的 `META-INF/spring.factories` 中，以 `EnableAutoConfiguration` 为 key，由 `SpringFactoriesLoader` 合并加载类路径下所有同名文件；
- **Spring Boot 2.7**：引入新文件 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，每行一个全限定类名，与旧机制并行兼容；
- **Spring Boot 3.0**：彻底移除通过 `spring.factories` 的 `EnableAutoConfiguration` key 注册自动配置的支持（该文件的其他用途不受影响），`.imports` 成为唯一入口，自动配置类推荐改用 `@AutoConfiguration` 标注。

## 深入机制

### 筛选流程：从全量候选到按需生效

`AutoConfigurationImportSelector#selectImports` 的核心动作在 `getAutoConfigurationEntry` 中，流程固定为六步：

1. 检查开关 `spring.boot.enableautoconfiguration`，关闭则直接返回空；
2. 读取注解上的 `exclude` / `excludeName`，得到用户显式排除的名单；
3. 调用 `getCandidateConfigurations` 读取 `.imports`（旧版为 `spring.factories`）拿到全部候选类名，以 Redis 为例会拿到 `RedisAutoConfiguration` 等；
4. 去重、剔除排除项；
5. 通过 `AutoConfigurationImportFilter`（如 `OnClassCondition`、`OnWebApplicationCondition`）做批量条件预筛——类路径下没有 `JedisConnection` 或 `RedisOperations`，Redis 的自动配置在这一步就被刷掉；
6. 触发 `AutoConfigurationImportEvent`，把最终名单交给配置类解析器。

通过预筛的配置类进入常规解析后，还要过方法级的 `@Conditional` 评估，每个 `@Bean` 方法上的条件都满足才真正注册。所以「几百个候选」最终生效的往往只有几十个，这正是自动装配不是「全量装配」的原因。

### @Conditional 条件装配族

条件体系全部建立在 Spring Framework 的 `@Conditional` 之上，Boot 提供了一组面向常见场景的派生注解：

| 注解 | 生效条件 | 典型用途 |
| --- | --- | --- |
| `@ConditionalOnClass` / `@ConditionalOnMissingClass` | 类路径存在/不存在指定类 | 判断用户是否引入了某依赖 |
| `@ConditionalOnBean` / `@ConditionalOnMissingBean` | 容器中已有/没有指定 Bean | 实现默认实现的「退让」 |
| `@ConditionalOnProperty` | 配置属性匹配指定值 | 功能开关，如 `spring.aop.auto` |
| `@ConditionalOnWebApplication` / `@ConditionalOnNotWebApplication` | 当前是否 Web 环境 | 区分 Servlet/Reactive 装配 |
| `@ConditionalOnSingleCandidate` | 指定类型只有一个候选或有首选 | 注入 `DataSource` 等单例依赖 |
| `@ConditionalOnExpression` | SpEL 表达式为真 | 复杂组合判断 |

其中 `@ConditionalOnMissingBean` 是理解 Boot 设计哲学的钥匙：官方自动配置里的 `RedisTemplate`、`ObjectMapper` 等默认 Bean 几乎都挂着它——只要你自己声明了同类型 Bean，默认实现就不再注册。这就是为什么「自己写一个就生效」不需要任何额外开关。

### 排查手段

条件判断失败是自动装配最常见的问题面。三个实用工具：启动加 `debug=true` 打印条件评估报告，按「Positive matches / Negative matches」分组列出每个配置类的匹配结论；Actuator 环境下访问 `/actuator/conditions` 端点；需要编程式断言时用 `ConditionEvaluationReport` 直接取报告对象。

## 工程实践：手写一个 Starter

以一个输出格式化组件为例，完整走一遍自定义 Starter 的标准结构（面向 Spring Boot 2.7+ / 3.x）。

第一步，定义属性类，承载可配置项并指定前缀：

```java
@ConfigurationProperties(prefix = "demo.format")
public class FormatProperties {
    /** 输出前缀，默认值保证零配置可用 */
    private String prefix = "[demo]";
    public String getPrefix() { return prefix; }
    public void setPrefix(String prefix) { this.prefix = prefix; }
}
```

第二步，编写核心服务与自动配置类，用条件注解圈定生效边界：

```java
public class FormatTemplate {
    private final String prefix;
    public FormatTemplate(String prefix) { this.prefix = prefix; }
    public String wrap(String body) { return prefix + " " + body; }
}

@AutoConfiguration
@ConditionalOnClass(FormatTemplate.class)
@EnableConfigurationProperties(FormatProperties.class)
public class FormatAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public FormatTemplate formatTemplate(FormatProperties properties) {
        return new FormatTemplate(properties.getPrefix());
    }
}
```

第三步，注册候选清单。在 autoconfigure 模块的 `resources` 下新建 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，每行一个类名：

```text
com.example.format.FormatAutoConfiguration
```

若需兼容 Spring Boot 2.6 及更早版本，则改为在 `META-INF/spring.factories` 中写 `org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.example.format.FormatAutoConfiguration`。

第四步，组织模块与验证。惯例是把 Starter 做成聚合依赖的空壳（pom 里引入 autoconfigure 模块与必要运行库），自动配置代码独立成模块；业务方引入 Starter 后，直接用 `ApplicationContextRunner` 测试三类组合——无配置默认生效、设置 `demo.format.prefix` 后属性被绑定、用户自定义 `FormatTemplate` 后默认 Bean 退让。三类场景都通过，才算一个合格的 Starter。

## 对比与权衡

| 维度 | 显式 `@Import`/JavaConfig | 自动装配 |
| --- | --- | --- |
| 接入成本 | 每个组件手写配置 | 引依赖即用 |
| 可控性 | 完全显式，所见即所得 | 决策部分推迟到运行时条件评估 |
| 升级风险 | 配置随代码评审演进 | 类路径或属性变化可能静默切换实现 |
| 排查成本 | 低 | 需要读条件评估报告 |

实践建议：自动装配只负责提供「合理默认值」，Starter 不应替业务做不可逆决定；覆盖默认 Bean 优先用属性开关，其次才是自定义 Bean 顶掉——后者依赖框架内部实现细节，版本升级时更容易失效。升级 Boot 大版本前后，对比两次的条件报告比「应用能启动」更能暴露问题。

## 面试视角

**自动装配的整体流程是什么？** `@SpringBootApplication` 中的 `@EnableAutoConfiguration` 通过 `@Import` 引入 `AutoConfigurationImportSelector`；容器处理配置类时，它以 `DeferredImportSelector` 身份最后执行，读取 `.imports`（旧版 `spring.factories`）候选清单，经过去重、排除、`@Conditional` 条件评估后，把存活的自动配置类注册进容器。

**spring.factories 和 AutoConfiguration.imports 有什么区别？** 前者是 Properties 格式、以 `EnableAutoConfiguration` 为 key 的多用途 SPI 文件，2.6 及更早版本使用；后者是 2.7 引入的专用清单文件，一行一个类名，3.0 起成为自动配置的唯一注册方式，加载性能更好且职责单一。

**为什么自动配置能实现「用户优先」？** 两个机制叠加：`AutoConfigurationImportSelector` 作为 `DeferredImportSelector` 在用户配置之后处理，此时用户 Bean 的定义已存在；自动配置里的默认 Bean 又普遍标注 `@ConditionalOnMissingBean`，检测到已有同类型定义便放弃注册。

**怎么排查某个自动配置没生效？** 首选启动参数加 `debug=true`，在条件评估报告的 Negative matches 里找该类，报告会写明是哪个条件不满足（缺类、缺 Bean 还是属性不匹配）；也可检查 `exclude` 配置与依赖树，确认 jar 真的在类路径上。

**手写 Starter 的关键步骤？** 属性类（`@ConfigurationProperties`）+ 自动配置类（`@AutoConfiguration` + 条件注解 + `@ConditionalOnMissingBean` 默认 Bean）+ `.imports` 注册文件三步缺一不可，最后用 `ApplicationContextRunner` 覆盖「默认、配属性、用户覆盖」三种组合做测试。

## 小结

- `@SpringBootApplication` = `@SpringBootConfiguration` + `@ComponentScan` + `@EnableAutoConfiguration`，前两者管「自己人」，后者管「第三方」；
- 自动装配 = `@Import` 导入候选清单 + `@Conditional` 条件筛选，`DeferredImportSelector` 的延后执行顺序保证了用户定义优先；
- 注册机制已从 `spring.factories` 演进到 `AutoConfiguration.imports`，面向 3.x 的新代码只写后者；
- 排查思路围绕条件评估报告展开，自定义 Starter 的核心纪律是「只给默认值，可覆盖，可关闭」。
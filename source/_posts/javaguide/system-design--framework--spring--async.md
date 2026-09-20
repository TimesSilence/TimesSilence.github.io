---
title: "Async 注解原理分析"
date: 2022-07-19 12:48:00
updated: 2022-07-19 12:48:00
permalink: knowledge/system-design/framework/spring/async/
categories:
  - 系统设计
tags:
  - 系统设计
  - 异步
description: "Spring @Async 的原理与落地：动态代理与 @EnableAsync 的启用方式、线程池配置、自调用等失效场景、异常处理与 Future/CompletableFuture 返回值设计。"
---

`@Async` 让方法在另一个线程中执行，一行注解背后却藏着代理、线程池、异常与上下文四个容易踩坑的点。本文按「原理、启用与线程池、失效场景、返回值、异常处理」梳理一遍。

<!-- more -->

## @Async 是怎么生效的

`@Async` 没有任何线程魔法，本质是 AOP 代理。开启后，Spring 的后置处理器为标注了 `@Async` 的 Bean 生成代理；外部调用进入代理的拦截器后，方法被封装成 `Callable` 提交给 `Executor`，调用方立即拿到 `Future` 或 `null` 返回，真正的方法体在线程池的工作线程里执行。理解了「代理 + 线程池」这两个关键词，后面的失效场景和异常行为都能自行推导出来。

源码层面的链路也值得过一遍：`@EnableAsync` 通过 `@Import` 引入 `AsyncConfigurationSelector`，默认 PROXY 模式下注册 `ProxyAsyncConfiguration`；后者向容器放入 `AsyncAnnotationBeanPostProcessor` 这个后置处理器，它在 Bean 初始化完成后检查类与方法上的 `@Async` 注解，命中就为其创建代理。代理内的 `AnnotationAsyncExecutionInterceptor` 负责真正的拦截：先按注解的 `value` 解析目标线程池（没有指定就用默认执行器），再把方法调用包装成任务提交出去。所以 `@Async` 的一切行为——池子选哪个、异常往哪走、什么方法拦不住——都取决于这条代理链。

## 启用方式与线程池配置

启用只需两步：配置类上加 `@EnableAsync`，方法（或类）上加 `@Async`：

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean("mailExecutor")
    public ThreadPoolTaskExecutor mailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("mail-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
```

必须显式配置线程池。不指定时 Spring 会先在容器里找 `TaskExecutor`，找不到就退化为 `SimpleAsyncTaskExecutor`——它每次任务都新建线程、完全不复用，并发一高就能把应用拖垮。生产环境推荐 `ThreadPoolTaskExecutor`，并按任务类型拆分线程池（邮件、报表、通知各一个），通过 `@Async("mailExecutor")` 指定 Bean 名，避免慢任务占满公共池拖累快任务。有界队列和明确的拒绝策略也要一并配置，别让「不拒绝」演变成长时间排队与内存膨胀。

## 失效场景

`@Async` 失效几乎都源于「调用没经过代理」或「代理生成不了」：

1. **同类自调用**：`this.asyncMethod()` 走的是原始对象引用，拦截器不会触发，方法同步执行。解法是把异步方法挪到另一个 Bean，或者注入自身代理再调用。
2. **非 public 方法**：默认的代理配置只拦截 public 方法，加在 private、protected 方法上不生效。
3. **static / final 方法**：JDK 代理基于接口、CGLIB 基于子类重写，两者都无法拦截静态方法；final 方法不能被子类重写，同样增强不了。
4. **类不受 Spring 管理**：手动 `new` 出来的对象没有代理，注解形同虚设。
5. **忘记 `@EnableAsync`**：异步功能默认关闭，少了这个开关一切静默失效——不报错，只是不异步。

## 返回值：void、Future 与 CompletableFuture

异步方法的返回类型只有两类有意义：

- **void**：调用方不关心结果，异常无法传回调用线程，只能靠全局异常处理器兜底；
- **`CompletableFuture`**（或 `Future`）：调用方可用 `get()` 阻塞取结果，或用 `thenCompose`、`exceptionally` 编排后续动作：

```java
@Async("mailExecutor")
public CompletableFuture<String> renderReport(Long id) {
    // 耗时渲染
    return CompletableFuture.completedFuture("report-" + id);
}

// 调用方编排
reportService.renderReport(id)
        .thenAccept(name -> log.info("done: {}", name))
        .exceptionally(ex -> { alert(ex); return null; });
```

注意方法体里直接 `return CompletableFuture.completedFuture(x)` 即可——真正的异步调度已由代理完成，不需要也不应该再向 `commonPool` 提交一次。若把返回类型写成 `String` 等普通类型，调用方拿到的永远是 `null`。

## 异常处理

异常行为按返回类型分两套：

- **返回 Future 系**：异常被封装进 Future，在 `get()` 时以 `ExecutionException` 抛出，或在 `CompletableFuture` 的 `exceptionally`、`handle` 中消费——链路清晰，推荐使用；
- **返回 void**：异常无人接收，默认只打一条日志。可实现 `AsyncConfigurer` 注册 `AsyncUncaughtExceptionHandler` 统一兜底：

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
                log.error("async method {} failed, params={}", method.getName(), params, ex);
    }
}
```

## 实践提醒

线程切换意味着 `ThreadLocal`、安全上下文与当前事务都不会传到异步线程。异步方法需要事务时要在方法上单独标注（通常配 `REQUIRES_NEW`），且不能假设「调用方事务提交的数据对异步线程可见」——有先后要求的场景，改用 `@TransactionalEventListener` 在事务提交后发布事件再触发异步逻辑。最后，只有可丢失的短任务适合裸用 `@Async`；重要任务请落库或走消息队列，进程重启时内存里的任务不会等人。
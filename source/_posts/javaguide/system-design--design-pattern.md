---
title: "设计模式常见面试题总结"
date: 2022-06-10 08:20:00
updated: 2022-06-10 08:20:00
permalink: knowledge/system-design/design-pattern/
categories:
  - 系统设计
tags:
  - 系统设计
  - 设计模式
description: "按创建、结构、行为三类讲透工程价值最高的设计模式：单例线程安全演进、工厂辨析、代理/装饰器/适配器对比、观察者、策略、模板方法与责任链。"
---

设计模式不是 23 个名词的背诵清单，而是针对"对象怎么创建、怎么组合、怎么协作"三类变化给出的隔离方案。本文按这三条线挑出没工程中最值钱的几种，每种给出意图、真实框架中的应用和精简代码。

<!-- more -->

## 怎么分类：按变化方向

记 23 种模式的入口只有一句话：哪个维度会变，就用对应模式把它隔离出去。

- 创建型：对象的**创建过程**会变——单例、工厂方法、抽象工厂、建造者。
- 结构型：对象的**组合方式**会变——代理、装饰器、适配器。
- 行为型：对象之间的**协作逻辑**会变——观察者、策略、模板方法、责任链。

## 创建型：控制对象怎么来

### 单例：线程安全的演进

意图：全局只有一个实例，并控制它的创建时机。这条演进路线本身就是一部并发编程简史：

1. **饿汉式**：类加载即创建，天然线程安全，但无法延迟初始化。
2. **懒汉式 + synchronized**：延迟了，但每次获取实例都加锁，性能差。
3. **双重检查锁（DCL）**：既延迟又只在首次加锁：

```java
public class Singleton {
    private static volatile Singleton instance; // volatile 禁止指令重排
    private Singleton() {}

    public static Singleton getInstance() {
        if (instance == null) {                 // 第一次检查：已创建则免锁
            synchronized (Singleton.class) {
                if (instance == null) {         // 第二次检查：防并发重复创建
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

`volatile` 不能省：`new` 一个对象分"分配内存、初始化、引用赋值"三步，重排序可能让其他线程拿到尚未初始化完成的引用。更优雅的方案还有两种：

```java
// 静态内部类：JVM 保证类加载线程安全，且只有调用 getInstance 才触发加载
public class Singleton {
    private Singleton() {}
    private static class Holder { static final Singleton INSTANCE = new Singleton(); }
    public static Singleton getInstance() { return Holder.INSTANCE; }
}

// 枚举单例：天然防反射攻击和反序列化生成新实例
public enum Singleton { INSTANCE }
```

框架应用：Spring 容器默认的 singleton 作用域（注意 Spring 单例是"每个容器一个"，JVM 单例是"每个类加载器一个"）、`Runtime.getRuntime()`、MyBatis 的 `SqlSessionFactory`。单例的副作用也要说得出：隐藏依赖关系、全局状态难以测试、集群环境下"单例"只在单进程内成立。

### 工厂方法 vs 抽象工厂

意图：把 `new` 从业务代码里挪走，创建逻辑集中管理。两者的分水岭在产品数量：

- **工厂方法**：一个工厂生产一种产品，新增产品就新增工厂子类，符合开闭原则。
- **抽象工厂**：一个工厂生产**一族配套产品**（如某 UI 主题下的按钮 + 滚动条 + 输入框），换整套产品只需换一个工厂。

```java
interface NotificationFactory {
    Notification create();
}
class SmsFactory implements NotificationFactory {
    public Notification create() { return new SmsNotification(); }
}
```

框架应用：`Calendar.getInstance()`、Spring 的 `FactoryBean`、SLF4J 的 `LoggerFactory`。判断用哪个的标准很直接：变化的是"单个产品"还是"一整套产品组合"。

### 建造者

意图：构造参数多、可选参数多且有约束时，用链式调用代替重叠构造器（telescoping constructor），让对象构建过程可读、可校验。`build()` 方法是统一的校验入口，非法组合在这里集中拒绝。

框架应用：Lombok 的 `@Builder`、Netty 的 `ServerBootstrap`、OkHttp 的 `Request.Builder`。判断标准：构造参数超过四五个且大部分是可选的，就值得引入 Builder。

## 结构型：包一层的三种动机

### 代理、装饰器、适配器的辨析

三者都是"用一个新类包住原对象"，差别只在动机，面试中最爱考的对比：

| 模式 | 动机 | 与原对象接口 | 典型应用 |
| --- | --- | --- | --- |
| 代理 | 控制访问（懒加载、鉴权、横切增强） | 完全相同 | Spring AOP、MyBatis MapperProxy、RPC stub |
| 装饰器 | 动态叠加能力，可层层嵌套 | 相同且可组合 | Java IO 的 `BufferedInputStream` |
| 适配器 | 转换不兼容的接口 | 不同 | `Arrays.asList()`、日志门面适配层 |

一句话记法：代理是"我不让你直接碰它"，装饰器是"我给它加点料"，适配器是"两边说不到一块儿，我来翻译"。

```java
// 装饰器：每层只关心自己新增的能力，可以无限套娃
InputStream in = new GZIPInputStream(
                     new BufferedInputStream(
                         new FileInputStream("a.gz")));
```

MyBatis 的 Mapper 接口没有实现类却能执行 SQL，正是 JDK 动态代理的功劳——`MapperProxy` 拦截方法调用，转换成 `SqlSession` 的 `selectOne`/`insert` 等操作。

## 行为型：封装协作中的变化

### 观察者：事件驱动解耦

意图：状态变化时自动通知订阅者，发布者不知道也不必关心谁在听。它把"我变了，你们看着办"从主动挨个调用变成被动订阅，是事件驱动架构的最小内核。

框架应用：Spring 的 `ApplicationEvent`/`ApplicationListener`、Guava EventBus、ZooKeeper 的 Watcher、JDK 自带的 `Observable`（已废弃，侧面说明手写观察者不如用成熟实现）。

```java
// 发布者与监听者通过事件对象解耦，互不知道对方存在
publisher.publishEvent(new OrderCreatedEvent(orderId));

@EventListener
public void onOrderCreated(OrderCreatedEvent e) { /* 发积分、发通知各自独立 */ }
```

代价要清楚：调用时序不透明、异常传播链断裂、排查问题得靠追踪 ID；异步事件还要考虑丢失与重放。

### 策略 + 工厂：消灭 if-else

意图：把可互换的算法封装成策略对象，再用工厂或注册表按 key 取用，业务代码里不再出现按类型分发的长串分支。

```java
interface PayStrategy { void pay(long amount); }

@Component("WECHAT")
class WechatPay implements PayStrategy { /* ... */ }

// Spring 启动时把所有策略实现按 bean 名注入 Map，天然就是策略工厂
Map<String, PayStrategy> strategies;
strategies.get(channel).pay(amount);
```

新增支付方式只需新增一个 `@Component`，不改任何既有代码。框架应用：JDK 的 `Comparator`、Spring 的 `ResourceLoader`、各类规则引擎。这是业务代码里投入产出比最高的模式组合。

### 模板方法：固定骨架，放开步骤

意图：父类用 `final` 方法定义算法骨架，可变步骤留给子类重写。

```java
public abstract class AbstractImporter {
    public final void importData() {   // 骨架：final 防止子类破坏流程
        validate();
        parse();
        save();
    }
    protected abstract void parse();   // 可变步骤交给子类
}
```

框架应用：`JdbcTemplate`（execute 骨架 + RowMapper 回调）、`AbstractList`、Servlet 的 `HttpServlet.service()` 分发到 `doGet/doPost`。注意 Spring 更偏爱"组合 + 回调接口"（如 `RowMapper`）而不是强制继承，因为组合不受单继承限制。

### 责任链：请求沿链传递

意图：把处理器串成链，每个节点处理后决定放行还是短路。请求不需要知道链上有谁、谁会处理它，发送方与处理方彻底解耦。框架应用：Servlet `FilterChain`、Spring Security 过滤器链、Netty `ChannelPipeline`、MyBatis 的插件拦截链（多个 `Interceptor` 层层代理）。

```java
void doFilter(Request req, Response res, FilterChain chain) {
    // 前置处理
    chain.doFilter(req, res);  // 放行给下一个节点；不调用则整条链短路
    // 后置处理（响应回程时执行）
}
```

工程要点：链上节点顺序敏感，配置即语义；每个节点要么放行要么终止，不能有模糊第三态；拦截逻辑尽量幂等，因为链可能被重入或重试。

## 小结

- 单例的考点在并发与创建时机：DCL 的 `volatile`、静态内部类、枚举是三个递进答案。
- 工厂系列看产品维度：一个产品用工厂方法，一族产品用抽象工厂。
- 代理/装饰器/适配器看动机：控制、增强、转换，接口是否一致是最快的判别点。
- 行为型看变化点：事件通知用观察者，算法切换用策略 + 工厂，流程固定步骤可变用模板方法，请求要多级处理用责任链。
- 模式的价值是隔离变化，而每种模式都付出间接层的代价：策略多了类文件，观察者模糊了时序，代理藏起了真实调用。回答"去掉它会付出什么具体成本"比背诵定义更能证明你真的需要它。
- 代码里只有一种实现、一个分支、一条路径时，不抽象就是正确答案。
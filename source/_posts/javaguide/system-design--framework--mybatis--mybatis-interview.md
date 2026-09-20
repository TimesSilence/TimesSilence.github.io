---
title: "MyBatis常见面试题总结"
date: 2022-08-27 16:16:00
updated: 2022-08-27 16:16:00
permalink: knowledge/system-design/framework/mybatis/mybatis-interview/
categories:
  - 系统设计
tags:
  - 系统设计
  - 面试
description: "MyBatis 高频面试题深度解析：#{}与${}、Mapper 动态代理、一级二级缓存、执行链路、分页插件原理，每题给结论、原理与追问。"
---

MyBatis 面试题集中在四条线：参数绑定（`#{}` 与 `${}`）、代理机制（Mapper 为什么没有实现类）、缓存体系（一级与二级）、扩展点（插件与分页）。吃透这几条链路，比零散背三十道题更有用。

<!-- more -->

## 考察地图

- **参数与 SQL**：`#{}` vs `${}`——安全红线所在，必考。
- **代理机制**：Mapper 接口为什么不需要实现类、方法能否重载——动态代理的经典应用。
- **执行链路**：一条查询从接口方法到 JDBC 的完整路径——串起所有组件。
- **缓存**：一级缓存的作用域与失效、二级缓存的生产困境。
- **扩展机制**：分页插件原理、插件拦截的四大对象。
- 建议自行查阅：动态 SQL 标签清单、`resultMap` 子标签、`useGeneratedKeys` 用法、Batch 执行器的批处理细节——属于记忆类内容，面试官很少展开深问。

## 参数与 SQL

### `#{}` 和 `${}` 有什么区别？

**结论**：`#{}` 生成 JDBC 预编译占位符 `?`，参数由 `PreparedStatement` 绑定，天然防注入；`${}` 是文本替换，直接拼进 SQL 字符串，存在注入风险。

**原理**：MyBatis 解析映射语句时把 `#{}` 转成 `ParameterMapping` 和 `?`，执行期由 `ParameterHandler` 调用 `setXxx()` 赋值——参数作为"数据"传给数据库，不参与 SQL 语法解析。`${}` 则在 `SqlSource` 生成 `BoundSql` 的阶段就被替换掉，等价于字符串拼接：

```xml
WHERE name = #{name}      <!-- 安全：name 作为参数绑定 -->
ORDER BY ${orderBy}       <!-- 危险：orderBy 直接进入 SQL 文本 -->
```

**延伸**：`${}` 并非一无是处——表名、列名、排序方向这些无法预编译的位置只能用它，但必须在 Java 侧做白名单映射（前端传 `createTime`，服务端映射为固定列名 `create_time`），绝不能让外部输入原样进 SQL。

> 追问：`LIKE '%${key}%'` 这种写法有什么问题？提示：既有注入风险又容易踩语法坑，正确做法是 `LIKE CONCAT('%', #{key}, '%')`。

### Mapper 接口的方法可以重载吗？

**结论**：Java 语法允许声明，但 MyBatis 不支持，实际项目不要用。

**原理**：MyBatis 用"接口全限定名 + 方法名"作为 `MappedStatement` 的唯一 ID，**不包含参数签名**；XML 里同一 `namespace` 也不允许两个相同 `id` 的语句。重载方法找不到区分依据，参数解析还会互相干扰。JDK 的编译期重载决议与 MyBatis 的运行期语句查找是两套逻辑，别混为一谈。

> 追问：不同 Mapper XML 里的语句 `id` 能重复吗？提示：能，完整 ID 是 `namespace + id`，`namespace` 不同就不冲突。

## 代理机制

### Mapper 接口为什么不需要实现类？

**结论**：MyBatis 用 JDK 动态代理在运行期为接口生成代理对象，方法调用被统一拦截后，按约定路由到对应的 SQL 语句。

**原理**：调用链是 `MapperProxy` → `MapperMethod` → `SqlSession`。`MapperProxy` 实现 `InvocationHandler`，拦截方法后拼出"接口全限定名.方法名"作为 Statement ID，再按返回值类型（单个对象/集合/void）转调 `sqlSession.selectOne()`、`selectList()`、`insert()` 等方法。配置加载阶段，XML 或注解已经被解析成 `Configuration` 里的 `MappedStatement`，运行期只是按 ID 查出后交给 `Executor` 执行。所以约定极其严格：`namespace` 必须等于接口全限定名，方法名必须等于语句 `id`。

**延伸**：这也是 Spring 能"注入一个接口"的原因——`MapperFactoryBean` 返回的正是这个代理对象。JDK 代理要求目标必须是接口，而 Mapper 恰好全是接口，堪称天作之合。

> 追问：为什么不用 CGLIB？提示：代理目标本来就是接口，JDK 原生代理零依赖、生成更快；CGLIB 留给没有接口的场景，比如延迟加载的实体代理。

## 执行链路

### MyBatis 执行一条查询的完整流程是什么？

**结论**：分两段——启动期把 XML/注解解析成 `MappedStatement` 注册进 `Configuration`；运行期走"代理拦截 → 生成 BoundSql → Executor 查缓存 → JDBC 执行 → 结果映射"。

**原理**（运行期五步）：

1. **代理拦截**：`MapperProxy` 按"接口名 + 方法名"定位 `MappedStatement`。
2. **生成 SQL**：`SqlSource` 结合实参产出 `BoundSql`（最终 SQL + 参数映射列表）。
3. **执行**：`Executor` 先查一级缓存，未命中则由 `StatementHandler` 创建 `PreparedStatement`，`ParameterHandler` 绑定参数。
4. **映射**：`ResultSetHandler` 按 `resultMap` 或自动映射把 `ResultSet` 转成 Java 对象。
5. **返回前**：结果写入一级缓存；若开启二级缓存，事务提交后再写入 namespace 缓存。

**延伸**：插件（`Interceptor`）可以包裹 `Executor`、`StatementHandler`、`ParameterHandler`、`ResultSetHandler` 四大对象，分页、加解密、SQL 审计都是在这条链路上"插队"。

> 追问：`SqlSession` 为什么不能做成单例？提示：它持有连接、事务、一级缓存等可变状态，非线程安全；Spring 注入的 Mapper 背后是线程安全的 `SqlSessionTemplate`，按当前事务取会话。

## 缓存

### 一级缓存是什么？什么情况下会失效？

**结论**：`SqlSession` 级别的本地缓存，同一会话内"相同语句 + 相同参数"的查询直接返回缓存；默认开启、不可关闭。

**原理**：缓存 key 由 Statement ID、最终 SQL、参数值、分页参数（`RowBounds`）、环境标识等共同拼成。失效时机有四种：执行任意 `insert/update/delete`、显式调用 `clearCache()`、`commit/rollback/close`、语句配置 `flushCache="true"`。把 `localCacheScope` 设为 `STATEMENT` 可让缓存只在单次执行内有效。Spring 场景的常见误会：没有事务时每次 Mapper 调用都是新会话，"一级缓存不生效"其实是会话根本没复用。

> 追问：一级缓存会导致读到旧数据吗？提示：会——同一会话首次查询后，若其他事务改了库，再查仍返回缓存中的旧对象。

### 二级缓存是什么？为什么生产环境慎用？

**结论**：namespace 级别、可跨会话共享的缓存；默认关闭，需要 `<cache/>` 显式开启。慎用，因为它解决不了"别人改了数据我不知道"的问题。

**原理**：二级缓存按 Mapper 的 `namespace` 组织，查询结果在**事务提交后**才写入，该 namespace 下任何增删改都会清空整个缓存。问题在于：跨 namespace 操作同一张表时互相感知不到；其他应用或脚本直连改库，MyBatis 更无从得知；多实例部署时各节点缓存独立、无法同步；Join 查询涉及多表，任一表变更都会让缓存过期。

**延伸**：真正需要跨实例共享缓存时，业界通行做法是在业务层用 Redis/Caffeine，以数据库为唯一权威源。二级缓存只适合读极多、写极少、单表无 Join 的字典类数据。

> 追问：`useCache` 和 `flushCache` 各控制什么？提示：前者控制本条查询是否使用/写入缓存，后者控制执行后是否清空缓存。

## 扩展机制

### 分页插件的原理是什么？`RowBounds` 为什么不行？

**结论**：分页插件通过 `Interceptor` 拦截 `Executor`/`StatementHandler`，在执行前按数据库方言改写 SQL、追加 `LIMIT` 并生成 COUNT 查询。`RowBounds` 是内存分页——查出全量结果再跳过 offset，大表深分页必死。

**原理**：MyBatis 插件机制基于 JDK 动态代理：实现 `Interceptor` 接口，用 `@Intercepts` + `@Signature` 声明拦截目标（四大对象的某个方法），组件创建时被 `pluginAll()` 包上代理。分页插件拦截 `Executor.query()`，从 ThreadLocal（如 `PageHelper.startPage()`）取分页参数，改写 `BoundSql` 中的 SQL 并调整参数映射，再放行原逻辑：

```java
@Intercepts(@Signature(type = Executor.class, method = "query",
    args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}))
public class PageInterceptor implements Interceptor {
    public Object intercept(Invocation inv) throws Throwable {
        // 读取分页参数 → 方言改写 BoundSql → 放行
        return inv.proceed();
    }
}
```

**延伸**：深分页（`LIMIT 1000000, 20`）即使有 `LIMIT` 也要扫描并丢弃百万行，正确解法是游标分页：`WHERE id > #{lastId} ORDER BY id LIMIT 20`，前提是排序键稳定且有索引。

> 追问：`startPage()` 为什么只对紧随其后的第一条查询生效？提示：分页参数存在 ThreadLocal 里，被消费一次后就清除，避免污染后续查询。

## 小结

- `#{}` 走预编译参数绑定，`${}` 走文本拼接；后者只能用于白名单控制下的结构片段。
- Mapper 不需要实现类，靠的是 JDK 动态代理 + "接口全限定名.方法名"的 Statement ID 约定。
- 一级缓存跟随会话、默认开启；二级缓存跨会话但有一致性硬伤，生产上大多用业务层缓存替代。
- 分页插件是插件机制的最佳样本：拦截 `Executor`，方言改写 SQL；深分页请改用游标。
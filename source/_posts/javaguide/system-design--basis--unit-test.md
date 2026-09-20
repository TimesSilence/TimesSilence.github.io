---
title: "单元测试到底是什么？应该怎么做？"
date: 2022-06-01 17:13:00
updated: 2022-06-01 17:13:00
permalink: knowledge/system-design/basis/unit-test/
categories:
  - 系统设计
tags:
  - 系统设计
  - 单元测试
description: "单元测试的核心收益是秒级反馈与重构信心；本文讲清 FIRST 原则、测试金字塔、Mock 边界、JUnit 5 要点、覆盖率的正确理解与 TDD 的现实适用边界。"
---

单元测试的价值不是"证明代码没有 bug"，而是用秒级反馈给重构兜底、让改动老代码不再靠胆量。本文梳理 FIRST 原则、测试金字塔、Mock 边界、JUnit 5 用法、覆盖率的正确理解，以及 TDD 的现实适用边界。

<!-- more -->

## 核心概念：单元测试解决什么问题

单元测试针对"可独立验证的最小行为单元"——可以是一个方法，也可以是协作完成一条业务规则的几个类，不必机械等同于单个函数。它解决三个问题：一是反馈速度，整套单测应在秒级跑完，改完代码立刻知道有没有破坏既有规则；二是重构信心，有测试网兜底才敢动遗留代码；三是可测试性倒逼设计，写不出单测的代码往往耦合过重。也要认清边界：单测只验证局部逻辑，接口契约、数据库、事务、网络这类接缝问题，要靠集成测试和端到端测试发现。

## 实践要点

### FIRST 原则

- Fast（快）：慢测试没人愿意跑，全量应在秒级完成。
- Independent（独立）：测试之间不共享可变状态，执行顺序不影响结果。
- Repeatable（可重复）：不依赖网络、当前时间、随机数，任何环境结果一致。
- Self-validating（自验证）：断言自动判定成败，不靠人肉检查输出。
- Timely（及时）：与生产代码同步编写，而不是项目收尾时集中补。

### 测试金字塔

单测数量最多、速度最快，负责覆盖业务规则的分支；集成测试验证数据库、消息、外部接口的接缝；端到端测试只保留少量主链路。一旦失衡成"倒金字塔"（大量 E2E、几乎没有单测），套件会又慢又脆、失败难定位。实践上以单测承载分支覆盖，E2E 只回答一个问题：系统真的连起来了吗。

### Mock 的边界

Mock 只用于隔离不可控的外部依赖：数据库、RPC、消息队列、时钟。值对象、领域实体这类纯内存对象应当直接 `new` 出来用——mock 它们只会让测试变成实现的复读机，方法签名一改测试全红，却测不出任何真实行为。一个判断标准：断言的是"结果"还是"交互"？如果测试通篇在 verify 某方法被调了几次，多半已经越界。

### JUnit 5 要点

```java
class DiscountPolicyTest {

    @Test
    void should_apply_vip_discount_when_user_is_vip() {
        DiscountPolicy policy = new DiscountPolicy();
        Order order = new Order(BigDecimal.valueOf(100), UserType.VIP);

        BigDecimal actual = policy.calculate(order);

        assertEquals(BigDecimal.valueOf(80), actual);
    }

    @ParameterizedTest
    @CsvSource({"99, false", "100, true", "101, true"})
    void should_check_free_shipping_threshold(long amount, boolean expected) {
        assertEquals(expected, ShippingPolicy.isFree(BigDecimal.valueOf(amount)));
    }
}
```

要点：`@ParameterizedTest` 批量覆盖边界值；`assertThrows` 验证异常路径；测试命名描述"场景与预期"而不是 `test1`；断言聚焦可观察结果，不依赖私有方法与内部状态。

### 覆盖率：有用但不能迷信

行覆盖率高只说明"这些代码被执行过"，不说明断言有效——把断言全删掉，覆盖率照样可以是 100%。更有参考价值的是分支覆盖率，以及变异测试的思路：改掉一行生产代码，测试会不会红？覆盖率适合用来发现"完全没被测到的盲区"，不适合当 KPI 强压，为凑数字补出来的测试往往是假测试。

## 常见误区

- 为覆盖率达标给 getter/setter 写测试，数字好看了，风险一点没降。
- 滥用 Mock：连值对象都 mock，重构一次测试崩一半。
- 用 `Thread.sleep` 等异步结果，又慢又不稳定；应改用可注入的时钟或轮询式断言。
- 把 TDD 当教条："红-绿-重构"适合需求明确、可分解为任务的规则型代码；探索性原型、纯胶水代码先写实现再补关键测试更划算，强行先测只会拖慢探索。TDD 的门槛很大程度在任务分解，而不在测试本身。

## 小结

- 单测的核心收益是快速反馈与重构信心，FIRST 是衡量测试质量的底线。
- 金字塔分层、Mock 止步于外部依赖、断言看结果而非交互。
- 覆盖率用于发现盲区而非考核，TDD 用在边界清晰的业务规则上回报最高。
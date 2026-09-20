---
title: "Java 24 新特性概览"
date: 2022-03-06 08:10:00
updated: 2022-03-06 08:10:00
permalink: knowledge/java/new-features/java24/
categories:
  - Java
tags:
  - Java新特性
  - Java24
description: "JDK 24 重点：Stream Gatherers 转正、紧凑源文件与实例 main 第四次预览、虚拟线程在 synchronized 中不再固定平台线程、安全管理器永久禁用。"
---

JDK 24（2025 年 3 月）是 JDK 25 之前的最后一个非 LTS 版本，角色很明确：把一批酝酿已久的特性转正或推到转正前的最后阶段。Stream Gatherers 结束预览是最大亮点，虚拟线程的 pinning 问题也在这个版本得到解决。

<!-- more -->

## 版本定位

非 LTS 版本，官方支持期六个月，紧接着就是长期支持版 JDK 25。因此 JDK 24 的意义不在于"值得部署"，而在于"提前看清 JDK 25 的样子"——在这里转正的特性，大概率就是你下一个生产基线里的标准能力。

## Stream Gatherers 转正

经过 JDK 22、23 两轮预览，`Stream.gather(Gatherer)` 在 JDK 24 正式成为标准 API。它补上了 Stream 生态长期缺失的一块：自定义**中间**操作。`filter`、`map` 是无状态的，`collect` 只能收尾，而滑动窗口、按规则去重、固定批量切分这类"带着状态往后传"的转换，过去很难优雅表达，现在可以自己实现 `Gatherer` 接口串进管道：

```java
var result = Stream.of("a", "bb", "cc", "ddd")
                   .gather(Gatherer.ofSequential(
                       HashSet::new,
                       (seen, s, downstream) -> {
                           if (seen.add(s.length())) {
                               return downstream.push(s);
                           }
                           return true;
                       }))
                   .toList();
// [a, bb, ddd]：按字符串长度去重
```

转正意味着签名冻结、可以放心用于生产，这是 JDK 24 里最值得评估引入的特性。

## 紧凑源文件与实例 main 方法（第四次预览）

这个特性从 JDK 21 开始一路预览，目标是让"Hello World"回到一行能写完的水平：`main` 不再需要 `public static` 和 `String[] args`，类声明都可以省略：

```java
void main() {
    System.out.println("Hello, World!");
}
```

JDK 24 是它的第四次预览，名称也从"未命名类"演进为"紧凑源文件与实例 main 方法"，语义更贴合实际形态。它降低的是入门和脚本化场景的门槛，对大型工程没有影响；仍是预览特性，教学、原型、JShell 之外慎用。

## 虚拟线程：synchronized 中不再固定平台线程

这是 JDK 24 对并发模型最重要的一次修补。此前虚拟线程一旦进入 `synchronized` 块并发生阻塞，会"固定（pinning）"在承载它的平台线程上，平台线程被占住，其他虚拟线程只能排队，高并发下可能直接拖垮吞吐量。JDK 24 改进了调度机制，虚拟线程在 `synchronized` 中阻塞时通常可以释放平台线程。

存量代码无需修改即可受益，意味着大量基于 `synchronized` 的老库（而非 `ReentrantLock`）终于能安全地跑在虚拟线程上——此前这是迁移虚拟线程时最需要规避的坑。

## 并发新 API 继续打磨，安全管理器谢幕

结构化并发与作用域值在 JDK 24 进入第四次预览，设计已经多轮收敛，转正临近，建议此时开始跟进学习。同时 JDK 24 永久禁用了 Security Manager：即使显式传 `-Djava.security.manager` 也无法启用，这个复杂度极高、使用率极低的旧机制正式进入移除流程，还在依赖它的老系统需要尽早规划替代方案。

## 升级建议

生产环境继续留在 LTS 上，但建议在 CI 中用 JDK 24 跑一遍测试集：一来 Stream Gatherers 转正后可以开始试点，二来 `synchronized`  pinning 的修复值得用真实负载验证虚拟线程的表现，为升级到 JDK 25 积累数据。

## 小结

- Stream Gatherers 转正，Stream 支持自定义有状态中间操作。
- 紧凑源文件与实例 main 第四次预览，入门门槛继续降低。
- 虚拟线程在 `synchronized` 中阻塞不再固定平台线程，老代码可安全迁移。
- 结构化并发、作用域值第四次预览；Security Manager 永久禁用。
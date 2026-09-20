---
title: "Java 常见并发容器总结"
date: 2020-10-22 15:59:00
updated: 2020-10-22 15:59:00
permalink: knowledge/java/concurrent/java-concurrent-collections/
categories:
  - Java
tags:
  - Java并发
  - 并发容器
description: "按解决的问题分组梳理 JUC 并发容器：并发 Map、阻塞与非阻塞队列、写时复制容器、同步工具类，附选型对比表。"
---

JUC 的并发容器不是零散的工具集合，每个类都在解决一个具体的并发痛点。本文按「解决的问题」把它们分成四组——并发 Map、阻塞与非阻塞队列、写时复制容器、同步工具类，选型时先问自己要解决什么问题，再找对应的类。

<!-- more -->

## 并发 Map：线程安全与并发度兼得

`HashMap` 线程不安全，`Hashtable` 和 `Collections.synchronizedMap` 又用一把全局锁把所有操作串行化。并发 Map 这一组要解决的就是「安全」与「并发度」的矛盾。

**ConcurrentHashMap**：JDK 8 起采用「数组 + 链表/红黑树」结构，写操作时桶为空用 CAS 直接插入，桶非空只 `synchronized` 锁定桶头节点，读操作完全不加锁——锁粒度从全表收敛到单个桶。典型场景：高并发读写的本地缓存、注册表、计数统计。注意复合操作要用 `compute`、`merge` 保证原子性。

**ConcurrentSkipListMap**：解决并发环境下 key 还要有序的问题。底层用跳表（多层有序链表），增删只涉及局部节点，不需要全局调整，查询 O(log n)。典型场景：并发排行榜、需要有序遍历的索引。

## 队列：生产者与消费者之间的缓冲带

### 阻塞队列 BlockingQueue

解决的问题：生产者-消费者模型的解耦与背压——队列满则阻塞生产者，队列空则阻塞消费者。核心机制是 `ReentrantLock` 加 `notFull/notEmpty` 两个条件队列实现等待与唤醒。

- **ArrayBlockingQueue**：数组实现的有界队列，一把锁，容量创建后不可变，可选公平策略。
- **LinkedBlockingQueue**：链表实现，读写各一把锁所以吞吐更高；不传容量就是伪无界（`Integer.MAX_VALUE`），生产上必须显式指定容量。
- **PriorityBlockingQueue**：按优先级出队的无界队列，底层小顶堆；`put` 永不阻塞，警惕任务堆积导致 OOM 和低优先级任务饥饿。
- **DelayQueue**：元素实现 `Delayed` 接口，到期才能被取走，用于延迟任务调度。
- **SynchronousQueue**：不存储元素，`put` 与 `take` 必须配对成功，是「直接交接」而非缓冲——`CachedThreadPool` 正是靠它把任务直接推给线程。

典型场景：线程池任务队列、异步日志、延迟任务。

### 非阻塞队列 ConcurrentLinkedQueue

解决的问题：不需要阻塞语义、只追求高吞吐的安全队列。核心机制是纯 CAS 无锁算法，`offer/poll` 均为非阻塞操作。典型场景：高并发事件收集、无锁消息缓冲。

## 写时复制：读多写少的极致优化

**CopyOnWriteArrayList** 解决的问题：读操作远多于写操作时，连读写锁的开销都嫌浪费。核心机制是写时复制——修改时拷贝底层数组、改完整体替换引用；读完全无锁，迭代器遍历的是修改前的快照，天然弱一致，也不支持迭代中增删。

典型场景：监听器列表、路由表、配置集合——读频繁、写极少、允许短暂读到旧值。反过来，写多则每次写都整表拷贝，内存和 CPU 双输，绝对不要用。同思路的还有 `CopyOnWriteArraySet`。

## 同步工具类：线程间的协调信号

这一组不是容器，而是线程协作的「信号装置」：

- **CountDownLatch**：一次性倒数闩锁，计数归零后 `await` 的线程全部放行。解决「主流程等 N 个准备事件就绪」。
- **CyclicBarrier**：可循环使用的栅栏，固定数量的线程互相等待、到齐后一起进入下一阶段。解决「分阶段并行计算，每轮对齐一次」。
- **Semaphore**：许可池，`acquire/release` 控制同时访问某资源的线程数。解决「单机限流、连接池配额」。
- **Phaser**：多阶段栅栏，支持动态注册与注销参与者。解决「参与方数量不固定的多阶段协同」，最灵活也最复杂。

## 对比选型表

| 需求 | 首选 | 关键权衡 |
| --- | --- | --- |
| 高并发读写 Map | ConcurrentHashMap | 复合操作用 compute/merge 保证原子 |
| 并发且 key 有序 | ConcurrentSkipListMap | 跳表以空间换时间 |
| 生产者-消费者缓冲 | ArrayBlockingQueue / LinkedBlockingQueue | 必须有界，拒绝默认无界 |
| 任务直接交接不缓冲 | SynchronousQueue | 吞吐取决于消费速度 |
| 延迟任务 | DelayQueue | 元素需实现 Delayed |
| 优先级任务 | PriorityBlockingQueue | 无界，防堆积与饥饿 |
| 读多写极少的 List | CopyOnWriteArrayList | 写一次拷贝一次，写多即灾难 |
| 一次性等待多个事件 | CountDownLatch | 不可复位 |
| 多阶段线程对齐 | CyclicBarrier / Phaser | 一方中断全体 Broken |
| 控制并发访问数 | Semaphore | 无所有权，可跨线程释放 |

一句话总结：先想清楚「我要解决什么问题」——是并发读写、是缓冲背压、是读多写少、还是线程间对齐——答案会直接指向对应的类，而不是反过来。
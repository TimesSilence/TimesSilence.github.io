---
title: "Disruptor常见问题总结"
date: 2023-11-12 11:31:00
updated: 2023-11-12 11:31:00
permalink: knowledge/high-performance/message-queue/disruptor-questions/
categories:
  - 高性能
tags:
  - 高性能
description: "Disruptor 高频面试题深度解析：RingBuffer 预分配与缓存局部性、CAS 序号无锁协调、伪共享与缓存行填充、SequenceBarrier 依赖图、等待策略与 BlockingQueue 性能差距成因。"
---

Disruptor 是 LMAX 开源的 JVM 进程内高性能事件队列，面试常围绕 RingBuffer、无锁序号协调、伪共享与等待策略四块展开。本文整理八道高频题，把它「为什么快」讲到底层。

<!-- more -->

## 考察地图

- **定位与边界**：Disruptor 是什么、与 Kafka 的层级差异。
- **数据结构**：RingBuffer 为什么快。考察预分配内存与 CPU 缓存局部性。
- **并发设计**：无锁序号协调、SequenceBarrier 与消费者依赖图。考察 CAS 与内存屏障的实战理解。
- **缓存优化**：伪共享与缓存行填充。考察对 MESI 缓存一致性协议的认识。
- **消费端策略**：WaitStrategy 的延迟与 CPU 权衡，与 BlockingQueue 的差距成因。
- 建议自行查阅：DSL 用法（`handleEventsWith`、`then`）、`EventTranslator` 等 API——属使用层，面试很少追问。

## 定位与边界

### Disruptor 是什么？解决什么问题？

**结论**：Disruptor 是英国外汇交易公司 LMAX 开源的高性能内存事件队列，目标是让线程间传递事件做到极低延迟、极高吞吐，同时保证「无锁且有界」。

**原理**：JDK 自带的线程安全队列有一个两难：`ArrayBlockingQueue` 有界但靠 `ReentrantLock`，高竞争下锁开销明显；`ConcurrentLinkedQueue` 用 CAS 无锁但无界，生产失控有 OOM 风险。Disruptor 用固定大小的环形数组加一组单调递增序号，把「有界、无锁、线程安全」同时做到，LMAX 的撮合核心单线程每秒处理百万级订单靠的就是它。

**延伸**：它只管进程内通信，不持久化、不跨机器——把它当分布式 MQ 用是最常见的认知错误。Log4j2 异步日志、Storm 节点内通信、HBase 写路径都是知名用户。

> 追问：哪些业务不适合 Disruptor？提示：事件需要落库、跨服务投递或回放历史消息的场景。

### Kafka 和 Disruptor 有什么区别？

**结论**：两者不在一个层级：Kafka 是跨进程、可持久化、可回放的分布式消息系统；Disruptor 是单 JVM 内的线程间事件队列，不持久化、不重放。

**原理**：Kafka 解决「服务与服务之间可靠传消息」，链路包含网络、磁盘、副本与消费组协调，延迟在毫秒级。Disruptor 解决「进程内把事件从 I/O 线程交给业务线程」，零网络零磁盘，延迟可到微秒级。两者常组合使用：网关进程内部用 Disruptor 搭流水线，对外投递仍走 Kafka。

**延伸**：更有说服力的讲法是落到组件：Log4j2 为什么用 Disruptor 而不是 `BlockingQueue`——日志事件高频且不能阻塞业务线程，进程内队列的延迟与 GC 压力直接决定方案可行性。

> 追问：Disruptor 不持久化，进程宕机丢数据怎么办？提示：入口侧先写 WAL 或落库再投递，或业务本身接受丢失。

## 数据结构：RingBuffer

### RingBuffer 为什么快？

**结论**：RingBuffer 是一个启动时就把事件对象全部预分配好的固定容量环形数组：运行时只复用不分配，内存连续带来缓存局部性，槽位定位只是一次位运算。

**原理**：三个加速点。其一，零分配：发布事件是「取到已存在的空对象、填字段」而非 new 新对象，几乎不制造 GC 压力。其二，缓存局部性：数组元素引用连续，硬件预取器会把相邻槽位一起加载，类似顺序扫数组与跳遍历链表的差距。其三，定位廉价：`sequence & (capacity - 1)` 即得下标，所以容量必须取 2 的幂。

**延伸**：环形结构还有个红利——批量处理：消费者一次拿到整段已发布事件，批量处理完再一次性推进序号，摊薄协调成本。写满后生产者等待最慢消费者确认而非覆盖，这是它与普通环形缓冲的关键区别。

> 追问：RingBuffer 满了生产者会怎样？提示：`next()` 阻塞等待可用序号，`tryNext()` 立即失败。

## 并发设计

### Disruptor 的无锁协调是怎么实现的？

**结论**：核心是「每个角色持有一根单调递增的 Sequence，用 CAS 声明进度、用 volatile 与内存屏障保证可见性」：生产者 CAS 抢占可写序号，消费者比较序号判断能读到哪。

**原理**：多生产者用 CAS 把 cursor 从 N 推到 N+1 抢号；抢到号只代表拿到写入权，事件字段可能还没填完，所以还有 `availableBuffer` 数组做「发布标记」，消费者只认已标记的序号。单生产者没有竞争者，直接推进 cursor，连 CAS 都省了。可见性靠内存屏障：先写数据、storeFence、再发布序号；消费者读到序号后 loadFence 再读数据。

**延伸**：这套设计把「队列锁」降级为「序号比较」，是理解 Disruptor 的总钥匙，也能顺带回答 `LongAdder` 等并发组件的设计动机——把互斥改成可比较声明。

> 追问：为什么 CAS 抢到号还不够，还要 `availableBuffer`？提示：CAS 只解决「谁写哪个槽位」，不解决「槽位数据是否填完」。

### SequenceBarrier 是干什么的？消费者依赖怎么组织？

**结论**：SequenceBarrier 是消费者的闸门：`waitFor(n)` 返回当前允许消费到的最大序号，取值是「RingBuffer 的 cursor」与「前置依赖消费者序号」中的最小者。

**原理**：消费者不直接盯 cursor。若 B 必须等 A 先处理（A 校验、B 落库），B 的 barrier 挂到 A 的 sequence 上，最多消费到 `min(cursor, A.sequence)`。用 `handleEventsWith(A).then(B)` 声明依赖后，Disruptor 构造出消费者 DAG；末端消费者的序号汇总成 gating sequence，反过来限制生产者不能覆盖最慢消费者还没处理的槽位。

**延伸**：依赖图加序号比较让多阶段流水线零锁协作，也统一支撑两种消费模式：多消费者各自读全部事件（广播），以及 WorkerPool 竞争消费（一条事件只被处理一次）。

> 追问：依赖配成环会怎样？提示：序号互相等待形成死锁，DSL 的链式声明在结构上避免了这种情况。

## CPU 缓存优化

### 什么是伪共享？Disruptor 怎么解决？

**结论**：伪共享是「两个线程各改各的变量，但变量落在同一缓存行，导致缓存行在核间反复失效」；Disruptor 给高频竞争字段前后各填充 56 字节，让它独占一条 64 字节缓存行。

**原理**：CPU 缓存以缓存行（通常 64 字节）为最小单位，MESI 协议下任何一个核改了行内任意字节，其他核持有的整行副本都会失效——哪怕它们用的是行内不同变量。Disruptor 的 `Sequence` 通过 `LhsPadding`、`Value`、`RhsPadding` 继承链，在值字段前后各垫 7 个 long，保证 cursor 独占一行，避免生产者与消费者序号互相踢失效。

**延伸**：JDK 8 的 `@Contended` 注解干同样的事，自定义类需加 `-XX:-RestrictContended` 才生效。填充的代价是浪费内存，只值得用在竞争最激烈的字段上——所以它叫优化而非默认做法。

> 追问：关掉缓存行填充性能会掉多少？提示：取决于核数与竞争强度，多核高频写场景可能差出一个数量级。

## 消费端策略与性能对比

### WaitStrategy 有哪些？怎么选？

**结论**：等待策略决定「没有事件可消费时消费者怎么等」，本质是延迟与 CPU 占用的权衡：默认 `BlockingWaitStrategy` 最稳，忙等延迟最低但烧 CPU，折中用 `SleepingWaitStrategy`。

**原理**：`BlockingWaitStrategy` 用锁加 `Condition`，最省 CPU、延迟最差，是默认值。`SleepingWaitStrategy` 三段式：自旋、`yield`、睡眠，Log4j2 默认用它。`YieldingWaitStrategy` 自旋后让出 CPU。`BusySpinWaitStrategy` 死循环自旋，延迟最低但把核打满，只适合独占机器的撮合场景。`PhasedBackoffWaitStrategy` 提供可配置的四段退避。

**延伸**：在共享业务机器上用忙等策略会把同机服务的 CPU 抢光。正确姿势是先压测出延迟分布，确认瓶颈在等待策略，再决定是否牺牲 CPU。

> 追问：等待策略影响生产者吗？提示：只作用于消费者侧；生产者等可用槽位由 Sequencer 处理。

### 相比 BlockingQueue，性能差距到底来自哪里？

**结论**：差距来自四个叠加因素：CAS 序号代替互斥锁、预分配对象消除分配与 GC、连续数组对齐缓存与预取、缓存行填充消除伪共享。

**原理**：`ArrayBlockingQueue` 的锁在竞争下让线程挂起，挂起与唤醒都涉及上下文切换；`notEmpty`、`notFull` 条件队列在高压下还会引发唤醒风暴。元素方面，阻塞队列的节点是堆里独立分配的对象，指针跳转破坏硬件预取。Disruptor 逐条替换：固定数组、序号 CAS、批量推进、缓存行隔离。官方延迟直方图里，同等负载下 Disruptor 的长尾延迟远低于 `ArrayBlockingQueue`。

**延伸**：差距有前提——消费逻辑本身要轻。消费者里调慢 SQL，再快的队列也会被下游拖住；性能收益永远要用压测验证。

> 追问：CAS 一定比锁快吗？提示：不一定，竞争白热化时 CAS 空转同样烧 CPU，无锁省掉的是挂起与唤醒的调度成本。
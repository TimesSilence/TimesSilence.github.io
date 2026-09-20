---
title: "ArrayBlockingQueue 源码分析"
date: 2019-03-13 09:17:00
updated: 2019-03-13 09:17:00
permalink: knowledge/java/collection/arrayblockingqueue-source-code/
categories:
  - Java
tags:
  - Java集合
  - 并发
  - BlockingQueue
description: "深入 ArrayBlockingQueue 源码：环形数组、单 ReentrantLock 派生双 Condition 的阻塞设计、put/take 等待唤醒全流程与公平锁取舍，并对比 LinkedBlockingQueue 与 SynchronousQueue。"
---

`ArrayBlockingQueue` 是 JUC 中结构最经典的有界阻塞队列：一块定长数组、一把 `ReentrantLock`、两个 `Condition`，就构成了完整的生产者-消费者模型。它的价值不在复杂，而在于用极简的结构把「队满阻塞生产者、队空阻塞消费者」做到线程安全且内存可控。

<!-- more -->

## 它解决什么问题

生产者与消费者速度不匹配是多线程协作的常态。如果让双方直接交互，缓冲、等待、唤醒、背压都要自己处理，代码脆弱且易错。阻塞队列把「缓冲区 + 线程协调」封装成容器：生产者调用 `put`，队列满了就挂起等待；消费者调用 `take`，队列空了就挂起等待，双方只面向队列编程。`ArrayBlockingQueue` 是这个抽象下最朴素的实现：数组有界、内存可预估，天然适合作为线程池这类资源受限组件的缓冲层。

## 核心原理

### 环形数组

存储结构是定长的 `Object[] items`，配合三个游标：`putIndex` 指向下一次入队位置，`takeIndex` 指向下一次出队位置，`count` 记录元素个数。`putIndex` 自增到数组末尾时回绕到 0，`takeIndex` 同理，数组在逻辑上首尾相接成一个环。出队腾出的槽位无需搬移任何元素，入队直接复用，头尾操作都是 O(1)。`count` 的存在还化解了环形数组的经典歧义——两个游标相等时无法区分空与满，现在判满看 `count == items.length`、判空看 `count == 0` 即可。

### 一把锁，两个条件

并发控制只有一把 `ReentrantLock`，但从锁上派生了两个 `Condition`：`notEmpty` 与 `notFull`。这与 `synchronized` 的单一等待队列形成鲜明对照——锁虽然只有一个，等待集合却有两个：生产者在 `notFull` 上等「不满」，消费者在 `notEmpty` 上等「不空」，唤醒互不打扰，避免了 `notifyAll` 式的惊群。构造时可用 `fair` 参数选择公平锁，默认非公平。

## 深入机制

### put：队满则等

```java
public void put(E e) throws InterruptedException {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();           // 可中断地获取锁
    try {
        while (count == items.length)   // 队满则挂起，等 notFull
            notFull.await();
        enqueue(e);
    } finally {
        lock.unlock();
    }
}

private void enqueue(E e) {
    final Object[] items = this.items;
    items[putIndex] = e;
    if (++putIndex == items.length)     // 写指针环绕
        putIndex = 0;
    count++;
    notEmpty.signal();                  // 唤醒一个等待的消费者
}
```

两个细节值得咀嚼。其一，等待用 `while` 而非 `if`：`await` 返回时「队不满」这一前提未必成立（可能有多个生产者同时被唤醒），必须重新校验，这是 `Condition` 使用的标准范式。其二，`signal` 在锁内调用：它只把等待线程从条件队列挪到锁的同步队列，并不移交锁，被唤醒的消费者要等 `put` 的 `finally` 释放锁后才能继续。

### take：队空则等

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == 0)
            notEmpty.await();           // 队空则挂起，等 notEmpty
        return dequeue();
    } finally {
        lock.unlock();
    }
}

private E dequeue() {
    final Object[] items = this.items;
    E x = (E) items[takeIndex];
    items[takeIndex] = null;            // 置空，帮助 GC
    if (++takeIndex == items.length)
        takeIndex = 0;
    count--;
    if (itrs != null)
        itrs.elementDequeued();         // 同步迭代器状态
    notFull.signal();                   // 唤醒一个等待的生产者
    return x;
}
```

与 `enqueue` 严格对称。槽位置 `null` 是为了让数组尽快释放引用，避免已出队元素被数组长期持有造成内存滞留。生产与消费就这样通过两个条件的「挂起—唤醒」首尾咬合，构成闭环。`offer(e, timeout, unit)` 与 `poll(timeout, unit)` 只是把循环里的 `await` 换成 `awaitNanos`：每次醒来用返回的剩余纳秒扣减预算，耗尽即返回 `false`/`null`。

### 公平锁的差异

默认非公平锁允许新到线程插队抢锁，吞吐更高，但个别线程可能长期抢不到而饥饿。`fair = true` 时锁严格按等待顺序授予，消除饥饿，代价是每次交接都伴随线程唤醒与上下文切换，整体吞吐明显下降。注意公平性只影响锁的授予顺序，元素出队顺序永远是 FIFO，两者无关。只有对处理顺序敏感的链路才值得开公平锁。

## 工程实践

- **线程池工作队列**：`ThreadPoolExecutor` 在核心线程占满后把任务压入 `workQueue`。选 `ArrayBlockingQueue` 等于给系统装上容量闸门——队列满后触发非核心线程扩容，再满则走拒绝策略，防止任务无界堆积拖垮内存，这正是它比默认无界的 `LinkedBlockingQueue` 更适合生产环境的原因。
- **方法选择**：能容忍丢弃用 `offer` 快速失败；必须送达用 `put` 施加背压；调用方有时效要求用超时版本。切忌在消费侧用 `poll()` 忙轮询，那是在烧 CPU。
- **容量评估**：数组构造时一次性分配。定小了成为吞吐瓶颈，定大了浪费内存，还会拉长 `contains`、`remove(Object)`、迭代这类 O(n) 扫描操作的耗时。

## 对比与权衡

| 维度 | ArrayBlockingQueue | LinkedBlockingQueue | SynchronousQueue |
| --- | --- | --- | --- |
| 存储结构 | 定长数组（环形） | 单向链表节点 | 不存元素，直接交接 |
| 容量 | 必须有界 | 默认 Integer.MAX_VALUE，可指定 | 逻辑容量为 0 |
| 锁设计 | 单 ReentrantLock，读写互斥 | takeLock/putLock 双锁分离，count 用 AtomicInteger | TransferQueue/TransferStack 无锁交接 |
| 并发能力 | 生产消费互斥 | 入队出队可并行，吞吐更高 | 一次 put 必须配对一次 take |
| 内存特征 | 预分配，无节点对象开销 | 每元素一个 Node，GC 压力更大 | 无缓冲 |
| 典型用途 | 有界线程池队列 | 高吞吐流水线 | newCachedThreadPool 的直接移交 |

单锁是 `ArrayBlockingQueue` 最受争议的设计：读写不能并发，极端并发下锁竞争明显。`LinkedBlockingQueue` 用双锁把两端的临界区切开，只在「队空时入队」「队满时出队」这两个瞬间通过共享的 `AtomicInteger count` 做条件化 `signal` 相互感知，换取更高吞吐。但数组的内存局部性、零节点开销、强制有界三个优点，让 `ArrayBlockingQueue` 在资源可控的中小型缓冲场景仍是更稳的选择。`SynchronousQueue` 则走向另一个极端：取消缓冲、生产消费直接握手，适合「任务必须立刻被线程接走」的调度策略。

## 面试视角

**底层结构是什么？** 定长数组加 `putIndex`/`takeIndex` 两个游标组成环形队列，`count` 记录元素个数；并发控制是一把 `ReentrantLock` 派生 `notEmpty`、`notFull` 两个 `Condition`，队满时生产者等 `notFull`，队空时消费者等 `notEmpty`。

**为什么等待条件要用 while 而不是 if？** `await` 可能因被唤醒后锁竞争失败、或假唤醒而返回，返回时前提条件未必成立。`while` 保证每次醒来重新校验；`if` 只查一次，可能出现向满队列写入或从空队列读取的越界错误。

**put 和 take 为什么不能并发执行？** 它们共用同一把锁，任一时刻只有一个线程在临界区内。虽然入队出队作用于不同槽位，但游标和 `count` 是共享变量，作者选择了最简单且足够正确的单锁方案；要读写并行请换双锁的 `LinkedBlockingQueue`。

**公平锁开关影响什么？** 仅影响锁的授予顺序。非公平锁允许插队，吞吐高但可能饥饿；公平锁严格 FIFO 授予，消除饥饿但每次交接多一次线程唤醒切换，吞吐下降。元素出队顺序恒为 FIFO，与锁公平性无关。

**signal 放在锁内调用不会有问题吗？** 不会。`Condition.signal` 要求调用方持有锁，它只把等待线程从条件队列转移到锁的同步队列，并不立即移交锁；被唤醒者要等当前线程 `unlock` 后才参与竞争，因此不存在两个线程同时操作数组的窗口。

## 小结

- 定长数组 + `putIndex`/`takeIndex` 环绕 + `count`，构成 O(1) 的环形缓冲，判满判空只看 `count`。
- 单 `ReentrantLock` 派生 `notEmpty`/`notFull` 两个条件，`await`/`signal` 闭环实现「满则等、空则等」，是 `Condition` 分队列等待的教科书用法。
- 有界是它最大的工程价值：配线程池时能兜底流量；代价是读写互斥，并发上限低于双锁的 `LinkedBlockingQueue`。
- 默认非公平锁换吞吐；限时 `offer`/`poll` 用 `awaitNanos` 控制预算；出队即置 `null` 防止内存滞留。
---
title: "AQS 详解"
date: 2020-09-24 12:38:00
updated: 2020-09-24 12:38:00
permalink: knowledge/java/concurrent/aqs/
categories:
  - Java
tags:
  - Java并发
  - AQS
description: "拆解 AQS 的 state 与 CLH 变体队列，走读独占/共享模式的获取释放流程、ReentrantLock 公平与非公平实现及条件队列，理解 JUC 为何大半建于其上。"
---

AQS（AbstractQueuedSynchronizer）是 JUC 并发包的底座：一个 volatile int 的 state 表达同步语义，一条 CLH 变体双向队列接管排队线程的阻塞与唤醒，模板方法留给子类定制。ReentrantLock、Semaphore、CountDownLatch 看似功能迥异，内核都是这套「state + 队列 + 模板方法」的组合。

<!-- more -->

## 它解决什么问题

手写一个锁有多难？要保证互斥语义、要把抢不到锁的线程挂起来、要在释放时精确唤醒该唤醒的人、要处理中断与超时、还得控制上下文切换成本。每个同步器各写一遍，正确性无从谈起。

AQS 把这些**与具体同步语义无关的脏活**全部收进一个抽象类：线程如何排队、何时 park、被谁 unpark、取消怎么传播，通通是框架职责；子类只需回答一个问题——「state 是什么含义，获取/释放时怎么改它」。ReentrantLock 把 state 当重入次数，Semaphore 当剩余许可数，CountDownLatch 当倒数计数。同步器的多样性被压缩成对 state 的不同解释，这就是 AQS 的设计精髓。

## 核心原理

### state：同步语义的载体

AQS 内部只有一个状态字段：

```java
private volatile int state;
```

volatile 保证可见性与相关重排约束，配套三个 final 方法：`getState()`、`setState()`、`compareAndSetState()`。框架用 CAS 改 state 来保证并发安全，子类不可覆写这三个方法，只能在 `tryAcquire` 等钩子里调用它们。state 的具体含义完全由同步器定义，这是 AQS「以不变应万变」的第一块基石。

### CLH 变体队列：排队与唤醒的骨架

抢不到资源的线程被封装成 `Node` 挂进一条 FIFO 双向队列。Node 记录线程引用、前驱 prev、后继 next 和 `waitStatus`。它源自 CLH 自旋锁队列，但做了两处关键改造：

1. **自旋 + 阻塞混合**：纯 CLH 让线程盯着前驱状态空转，竞争激烈时烧 CPU。AQS 只在「前驱恰是 head」时给一次立刻重试的机会，其余情况通过 `LockSupport.park` 挂起，把 CPU 让出来。
2. **单向改双向**：增加 next 指针，释放锁时可直接顺藤摸瓜唤醒后继，取消节点时也能前后绕行。

`waitStatus` 是队列运转的状态机：`0` 是入队初始值；`SIGNAL(-1)` 表示「我释放后要负责唤醒后继」；`CANCELLED(1)` 表示线程因中断或超时放弃；`CONDITION(-2)` 表示节点在条件队列里；`PROPAGATE(-3)` 专供共享模式，保证唤醒信号在并发时序下不丢失。判断习惯是 `> 0` 即取消，`< 0` 即正常待唤醒。

head 节点是**虚拟节点**——它不代表任何等待线程，只是「当前持锁者」退位后的队首占位，真正排队的从 head.next 开始。

### 模板方法：留给子类的五个钩子

```java
protected boolean tryAcquire(int arg)        // 独占获取
protected boolean tryRelease(int arg)        // 独占释放
protected int tryAcquireShared(int arg)      // 共享获取：负数失败，0 成功无剩余，正数成功有剩余
protected boolean tryReleaseShared(int arg)  // 共享释放
protected boolean isHeldExclusively()        // 是否独占持有，Condition 需要
```

AQS 的 `acquire()`、`release()`、`acquireShared()` 等入口都是 final 的，流程骨架不可更改；可变部分全在这五个钩子里。这是模板方法模式的教科书应用。

## 深入机制

### 独占模式：acquire 的完整路径

以 ReentrantLock 非公平锁为例走一遍 `acquire`：

```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```

三步拆解：

1. **tryAcquire**：先尝试抢锁。非公平实现的逻辑是——state 为 0 就 CAS 抢，发现持有者是自己就重入累加 state，否则返回 false。
2. **addWaiter**：抢失败，把当前线程包成独占 Node 入队。入队先快路径 CAS 设置 tail，失败或队列未初始化则进 `enq()` 自旋，首次会 CAS 创建虚拟 head 再挂尾，全程靠 CAS 保证并发安全。
3. **acquireQueued**：入队后进入自旋-阻塞循环：前驱是 head 就再 tryAcquire 一次（刚入队可能正好赶上释放）；否则 `shouldParkAfterFailedAcquire` 把前驱状态置为 SIGNAL——含义是「你释放时记得叫我」——然后 `parkAndCheckInterrupt` 真正挂起。被唤醒后回到循环头再次尝试，拿到锁就把自己设为新的 head 出队。

释放路径 `release` 对称而简洁：`tryRelease` 把 state 减去（ReentrantLock 里减到 0 才清空持有线程、返回 true），成功后若 head 状态非 0 就 `unparkSuccessor` 唤醒后继。唤醒时若发现后继为 null 或已取消，会从 tail 向前扫描找最近的正常节点——因为入队时 prev 先于 next 赋值，从后往前扫才不会漏掉「半入队」节点。

### ReentrantLock 的公平与非公平

两者只在 tryAcquire 上差一行：

```java
// FairSync.tryAcquire 的关键差异
if (!hasQueuedPredecessors() &&
    compareAndSetState(0, acquires)) {
    setExclusiveOwnerThread(current);
    return true;
}
```

公平锁在 CAS 前多问一句 `hasQueuedPredecessors()`：队列里有比我等得更久的线程，就老老实实去排队，保证 FIFO。非公平锁不问这句，锁刚释放的瞬间，新来的线程可以直接插队抢走。

为什么默认非公平？线程从被唤醒到真正运行有一段调度延迟，期间锁是闲置的。非公平锁允许刚巧在场的线程直接拿锁干活，省掉一次「唤醒-等待运行」的交接，整体吞吐明显更高；代价是排队线程可能被反复插队，理论上存在饥饿。除非业务必须严格按申请顺序分配（如某些资源池），否则用默认即可。

### 共享模式：CountDownLatch 与 Semaphore

共享模式的入口是 `acquireShared`，骨架与独占相同，差异在两处：

- `tryAcquireShared` 返回 int 而非 boolean，用正负和零表达「失败 / 成功但无剩余 / 成功且有剩余」；
- 获取成功后调 `setHeadAndPropagate`：若还有剩余资源，**继续唤醒后继**，形成传播式唤醒，让多个线程同时拿到许可。

`CountDownLatch` 把 state 初始化为 N，`countDown()` 走共享释放把 state 减到 0，`await()` 就是共享获取：`getState() == 0 ? 1 : -1`，归零瞬间所有等待者沿队列传播唤醒。`Semaphore` 把 state 当许可数，`acquire()` 减、`release()` 加，减不动就入队阻塞——注意是排队阻塞而非自旋等待。传播唤醒在极端并发时序下可能出现信号丢失，`PROPAGATE` 状态正是为此打的补丁（历史 bug JDK-6801020）。

### 条件队列：Condition 的第二队列

AQS 内部其实有**两种队列**：同步队列管锁竞争，条件队列（`ConditionObject`）管 `await/signal`。条件队列是单向链表，节点用 `nextWaiter` 链接，waitStatus 固定为 CONDITION，每个 Condition 实例独立一条。

`await()` 的流程：当前线程包成 CONDITION 节点进条件队列，**完全释放**持有的锁（连重入次数一起，记为 savedState），然后 park。`signal()` 把条件队列首节点的状态改回 0、转移到同步队列尾部，从此参与正常的锁竞争；被唤醒抢到锁后，`acquireQueued` 会按 savedState 恢复重入深度。一把 Lock 可挂多个 Condition，这正是它比 `synchronized` 的单一等待集灵活的地方，ArrayBlockingQueue 的 notEmpty/notFull 就是双条件的经典用法。

## 工程实践

```java
public class OneShotLatch {
    private static final class Sync extends AbstractQueuedSynchronizer {
        @Override
        protected int tryAcquireShared(int unused) {
            return getState() == 1 ? 1 : -1;
        }
        @Override
        protected boolean tryReleaseShared(int unused) {
            setState(1);
            return true;
        }
    }
    private final Sync sync = new Sync();

    public void open() { sync.releaseShared(1); }
    public void await() throws InterruptedException {
        sync.acquireSharedInterruptibly(1);
    }
}
```

三十行实现一个一次性门闩：state 从 0 到 1 表示开门，等待者走共享获取，开门后传播唤醒全员。不用关心排队、阻塞、中断的任何细节——这就是 AQS 对业务的价值。需要自定义同步组件（限流器、资源闸门、二元锁）时，继承 AQS 几乎总是比从 wait/notify 手写更短、更对。

## 对比与权衡

| 维度 | 独占模式 | 共享模式 |
| --- | --- | --- |
| 并发度 | 同一时刻一个持有者 | 多个持有者可共存 |
| 入口方法 | `acquire` / `release` | `acquireShared` / `releaseShared` |
| 钩子返回值 | boolean | int（含剩余量信息）/ boolean |
| 唤醒策略 | 释放时唤醒一个后继 | 有剩余即传播唤醒后续 |
| state 语义举例 | 重入次数（ReentrantLock） | 许可数（Semaphore）、计数（CountDownLatch） |
| Node 标识 | `Node.EXCLUSIVE` | `Node.SHARED` |

## 面试视角

**AQS 的核心结构是什么？** 一个 volatile int 的 state 表达同步语义，一条 CLH 变体双向队列管理等待线程，外加 tryAcquire 等五个模板方法给子类定制。state 的 CAS 更新和队列的 CAS 入队是并发安全的两个支点。

**acquire 失败后线程经历了什么？** 封装成 Node 入队（CAS 操作 tail）；进入 acquireQueued 循环，前驱是 head 就再抢一次，否则把前驱置为 SIGNAL 后 park 挂起；被前驱释放时唤醒，抢到锁后自己成为新 head 出队。

**公平锁和非公平锁差在哪？** 只差 tryAcquire 里的 `hasQueuedPredecessors()` 判断。公平锁看到队列有人就排队，非公平锁允许新线程在锁刚释放时插队。非公平省去唤醒交接的调度空窗，吞吐更高，所以是默认。

**CountDownLatch 为什么用共享模式实现？** await 等待的不是互斥资源而是「计数归零」这个事件，归零后所有等待线程都该通过。共享模式的传播唤醒恰好支持一个信号唤醒整条队列，语义天然契合。

**为什么 JUC 大半建立在 AQS 上？** 因为锁、信号量、门闩、读写锁的差异只在「state 怎么解释」，排队、阻塞、唤醒、中断处理是公共逻辑。AQS 用模板方法把公共部分固化成 final 骨架，让每个同步器只需写几十行业务语义，正确性与性能都由框架统一兜底。

## 小结

- AQS = volatile state + CLH 变体双向队列 + 模板方法，同步语义全部压缩进对 state 的解释。
- 独占与共享共享同一套入队、阻塞、唤醒骨架，差异只在钩子返回值与是否传播唤醒。
- ReentrantLock 的公平性只在 `hasQueuedPredecessors()` 一行，默认非公平是为吞吐。
- 条件队列是 AQS 的第二队列，await 全量放锁、signal 转回同步队列，支持一把锁挂多个等待集。
---
title: "Java 锁详解：互斥锁、读写锁、自旋锁与 synchronized 锁优化"
date: 2020-11-09 17:13:00
updated: 2020-11-09 17:13:00
permalink: knowledge/java/concurrent/java-lock/
categories:
  - Java
tags:
  - Java并发
  - 锁
description: "从 monitorenter 与 Mark Word 讲起，拆解 synchronized 锁升级路径、ReentrantLock 对比、读写锁与 StampedLock 乐观读，并给出锁选型决策思路。"
---

Java 的锁工具看似名目繁多——synchronized、ReentrantLock、ReentrantReadWriteLock、StampedLock——但背后只回答两个问题：线程如何互斥地进入临界区，以及拿不到锁时付出什么代价。本文从 JVM 实现一路讲到 JUC 工具，最后给出一张可落地的选型决策树。

<!-- more -->

## 它解决什么问题

锁保护的不是某段代码，而是代码背后的共享可变状态。`count++` 只有一行，却包含读、加、写三个步骤，两个线程交错执行就会丢更新。锁把这段可能交错的区域压成串行：进入前获取，退出时释放。

有一个前提容易被忽略：锁约束的是「访问协议」，而不是对象本身。`synchronized(account)` 并不会让 `account` 自动安全，如果另一段代码绕过这把锁直接改字段，互斥就形同虚设。所有访问同一状态的路径都必须走同一把锁，这套约定才真正生效。也正因为锁是约定，锁粒度成了工程上最难的部分：一把大锁省心但并发度低，多把小锁吞吐好却要管理锁顺序和死锁。

## 核心原理：synchronized 如何落地

`synchronized` 可以修饰实例方法、静态方法或代码块。字节码层面有两种表现：同步方法在方法访问标志上打 `ACC_SYNCHRONIZED`，同步代码块则编译出 `monitorenter` 与 `monitorexit` 两条指令。二者语义一致——进入并持有某个对象的 monitor，退出时释放。JVM 会为异常路径也生成 `monitorexit`，所以无论正常返回还是抛出异常，锁都会被释放，这是它与显式 Lock 最大的差异之一。

Java 内存模型在 monitor 上附加了 happens-before 规则：线程释放锁之前的所有写入，对之后获取同一把锁的线程可见。所以 synchronized 同时提供互斥与可见性，不只是「排队」。另外它可重入：同一线程重复进入同一 monitor 时，JVM 只增加计数，退出时逐层递减，避免了方法间互相调用时的自我死锁。

monitor 的状态记录在对象头里。HotSpot 中每个对象头包含 Mark Word 与类型指针，Mark Word 是一块复用存储：无锁时存哈希码和 GC 分代年龄，加锁后被改写成锁状态标志与指向锁记录或重量级 monitor 的指针。锁的全部状态机就编码在这几十比特里。

## 深入机制：锁升级与重量级实现

JDK 6 起 HotSpot 为 synchronized 设计了随竞争强度递进的四种状态：

1. **无锁**：Mark Word 未被任何线程关联。
2. **偏向锁**：假设锁总被同一线程获取，首次进入时把线程 ID 写入 Mark Word，之后该线程进出临界区无需任何原子操作。一旦出现第二个线程竞争，偏向锁撤销。
3. **轻量级锁**：线程在栈帧中开辟锁记录（Lock Record），用 CAS 把 Mark Word 替换为指向该记录的指针，成功即持锁；失败说明存在竞争，短暂自旋后再膨胀。它针对的是「线程交替进入但几乎不撞车」的场景。
4. **重量级锁**：Mark Word 指向 ObjectMonitor，未抢到锁的线程进入其等待队列并被操作系统挂起，涉及用户态与内核态切换，成本最高。

这条「无锁→偏向→轻量→重量」的链是单向的，只能升级不能降级（偏向撤销除外）。需要强调的是版本差异：JEP 374 让偏向锁从 JDK 15 起默认禁用，JDK 18 起相关参数被彻底废弃，因为现代应用里「锁只被单线程访问」的假设越来越少，维护收益抵不过复杂度。学习这条升级链的价值在于理解 HotSpot 的优化思路——按竞争强度逐级加码，而不是背一条现代 JDK 已不完全适用的口诀。

## 工程实践：JUC 显式锁

### ReentrantLock：把控制权交给你

```java
public class Counter {
    private final ReentrantLock lock = new ReentrantLock();
    private int count;

    public void increment() {
        lock.lock();
        try {
            count++;
        } finally {
            lock.unlock();
        }
    }
}
```

`try/finally` 配对是硬性要求，漏掉 `unlock()` 锁就永远不释放。相比 synchronized，它换来四项能力：公平锁（按排队顺序授予，吞吐略降）、`tryLock()` 超时获取、`lockInterruptibly()` 响应中断、以及多个 `Condition` 条件队列。底层是 AQS：一个 `state` 字段表示占用状态，抢不到的线程进入 FIFO 队列由 `LockSupport.park` 挂起。Semaphore、CountDownLatch 等工具都复用这套框架。

### ReentrantReadWriteLock：读读共享

读写锁把访问分成共享的读锁与独占的写锁，规则是读读不互斥、读写互斥、写写互斥。它只在「读远多于写、临界区短」时才优于互斥锁；写频繁时读写在队列里互相阻塞，维护两套状态的开销反而拖累性能。它支持锁降级（持有写锁时再获取读锁，随后释放写锁），但不支持升级——多个持读锁线程同时请求写锁会互等造成死锁。

### StampedLock：乐观读

```java
public class Point {
    private final StampedLock sl = new StampedLock();
    private double x, y;

    double distanceFromOrigin() {
        long stamp = sl.tryOptimisticRead();
        double cx = x, cy = y;
        if (!sl.validate(stamp)) {      // 期间发生过写入，回退到悲观读
            stamp = sl.readLock();
            try { cx = x; cy = y; }
            finally { sl.unlockRead(stamp); }
        }
        return Math.hypot(cx, cy);
    }
}
```

乐观读不阻塞写线程，先取一个邮戳，读完再校验期间有无写发生，失败则升级为悲观读重读。代价是：读到的字段可能是中间状态（所以先拷到局部变量再校验）、锁不可重入、使用不当容易死锁。它适合坐标、配置这类读极多写极少的短读场景。

## 对比与权衡

| 维度 | synchronized | ReentrantLock | ReentrantReadWriteLock | StampedLock |
| --- | --- | --- | --- | --- |
| 释放方式 | JVM 自动，异常安全 | 手动 unlock | 手动 unlock | 手动 unlock( stamp ) |
| 公平性 | 非公平 | 可选 | 可选 | 不支持公平 |
| 可中断/超时 | 否 | 支持 | 支持 | 支持（带超时的 try 系列） |
| 条件队列 | 单一 wait/notify | 多 Condition | 多 Condition | 支持 |
| 重入 | 是 | 是 | 是 | 否 |
| 乐观读 | 无 | 无 | 无 | 有 |

选型决策树可以按四个问题走：

1. 只是保护一小段进程内状态？→ 优先 **synchronized**，语法最短、JIT 优化成熟、异常安全。
2. 需要超时、中断、公平锁或多个条件队列？→ **ReentrantLock**。
3. 读多写少且读操作短？→ **ReentrantReadWriteLock**；若读极多且能接受校验重读，再上 **StampedLock**。
4. 只是更新单个计数或引用？→ 别用锁，用 Atomic 原子类或 LongAdder。

## 面试视角

**synchronized 的锁升级过程是怎样的？** 无锁状态下首个线程进入时升级为偏向锁，把线程 ID 记入 Mark Word；出现第二个线程竞争则撤销偏向，升级为轻量级锁，线程通过 CAS 把 Mark Word 替换为指向栈上锁记录的指针，失败则自旋重试；自旋超过阈值或竞争加剧后膨胀为重量级锁，Mark Word 指向 ObjectMonitor，线程被挂起。注意 JDK 15 起偏向锁默认关闭。

**synchronized 和 ReentrantLock 怎么选？** 两者都是可重入互斥锁。synchronized 由 JVM 管理，异常时自动释放，代码简洁，JDK 6 后性能已大幅优化，是默认选择；需要公平性、可中断获取、超时获取或多个 Condition 条件队列时才用 ReentrantLock，且必须手动配对 lock/unlock。

**为什么读写锁不支持锁升级？** 锁升级要求从读锁直接变写锁，但读锁是多线程共享的：若两个持读锁线程同时申请写锁，都要等对方释放读锁，形成死锁。ReentrantReadWriteLock 只支持降级——持有写锁时获取读锁再释放写锁，这是安全的，因为写锁本就独占。

**StampedLock 的乐观读为什么要先读局部变量再 validate？** 乐观读期间写线程可能正在修改字段，直接边读边计算会用到撕裂的中间状态。正确姿势是先把字段拷入局部变量，再调 `validate(stamp)` 检查期间有无写入，失败则回退到悲观读锁重读，保证拿到一致快照。

## 小结

- 锁保护的是访问共享状态的协议，所有路径走同一把锁，约定才成立。
- synchronized 经 monitorenter/monitorexit 进入对象 monitor，锁状态编码在 Mark Word 中；JDK 6 的偏向→轻量→重量升级链是按竞争强度逐级加码的优化史，JDK 15 起偏向锁已默认关闭。
- 日常互斥优先 synchronized；需要中断、超时、公平、多条件队列换 ReentrantLock；读多写少用读写锁，读极多且能容忍校验重读再用 StampedLock。
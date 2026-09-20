---
title: "Java并发常见面试题总结（中）"
date: 2021-01-04 13:55:00
updated: 2021-01-04 13:55:00
permalink: knowledge/java/concurrent/java-concurrent-questions-02/
categories:
  - Java
tags:
  - Java并发
  - 面试
description: "Java 并发面试（中）深度解析：volatile 语义与 DCL 单例、synchronized 底层原理与锁升级、CAS 与 ABA 问题、ReentrantLock 与读写锁。"
---

并发面试的中篇进入机制层：volatile 的可见性与有序性边界、synchronized 从字节码到锁升级的完整链路、CAS 的原理与三大缺陷、ReentrantLock 相对 synchronized 的工程价值。这一篇是拉开候选人差距的分水岭。

<!-- more -->

## 考察地图

- **volatile 与内存语义**：可见性实现、原子性边界、DCL 单例、happens-before 传递性。考察对 JMM 的理解深度。
- **synchronized**：三种用法与锁对象、monitor 底层、锁升级。考察对 JVM 锁实现的掌握。
- **乐观锁与 CAS**：悲观乐观的取舍、CAS 底层实现、ABA 与自旋开销。考察无锁编程的边界意识。
- **Lock 体系**：ReentrantLock 对比 synchronized、读写锁的升级与降级。考察 API 层的选型能力。
- 建议自行查阅：JMM 主存/工作内存抽象模型、synchronized 与 volatile 对比表、Atomic 原子类、StampedLock 乐观读——中篇重心在 volatile/synchronized/CAS 主线。

## volatile 与内存语义

### volatile 是如何保证可见性的？

**结论**：JMM 规定对 volatile 变量的写 happens-before 于后续对同一变量的读，读线程必然能看到写线程已提交的结果；实现上靠插入内存屏障约束缓存行为与重排序，而不是「禁用 CPU 缓存」。

**原理**：JMM 的「主内存/工作内存」只是抽象模型，真实硬件靠缓存一致性协议（MESI 等）。JVM 在 volatile 写前后插 StoreStore/StoreLoad 屏障、读后插 LoadLoad/LoadStore 屏障，使写入尽快对其他处理器可见、读取拿到最新值，且屏障两侧指令不得越界重排：

```java
private volatile boolean running = true;

public void stop() { running = false; } // 写：对其他线程立即可见

public void work() {
    while (running) { /* 循环体内一定能感知 stop() */ }
}
```

**延伸**：典型用途是状态标志位与一写多读的配置发布；注意可见性是「点到点」的，读完之后别人又改掉防不住，复合决策仍需锁。

> 追问：没有 volatile 时，为什么循环里读 flag 可能永远看不到新值？提示：除缓存外，JIT 还可能做循环不变量提升，把读取优化出循环体。

### volatile 能保证原子性吗？

**结论**：不能。volatile 只保证可见性与有序性，`inc++` 这类读-改-写复合操作依然会丢更新。

**原理**：`inc++` 编译后是 getfield、iadd、putfield 三条字节码。volatile 只保证 putfield 的结果对他人可见，却不阻止两个线程在 getfield 时读到同一个旧值——各自加一写回，两次自增只剩一次的效果。实测 5 个线程各自增 500 次，结果几乎必然小于 2500。修复任选其一：

```java
synchronized void increase() { inc++; }   // 互斥
AtomicInteger inc = new AtomicInteger();
inc.getAndIncrement();                    // CAS 无锁
lock.lock(); try { inc++; } finally { lock.unlock(); }
```

**延伸**：volatile 单次读写本身原子，包括 long/double（JLS 禁止拆成两个 32 位操作）。「写引用加读引用」的安全发布用 volatile 足够，「先检查再更新」不行。

> 追问：`volatile boolean` 上做 `flag = !flag` 安全吗？提示：不安全，取反是读-改-写复合操作，只有与旧值无关的单次赋值才安全。

### 双重检查锁单例为什么必须加 volatile？

**结论**：去掉 volatile，`instance = new Singleton()` 可能被重排成「分配内存 → 引用赋值 → 初始化」，其他线程在第一次 null 检查时拿到未初始化的对象，使用时触发诡异 NPE。

**原理**：逻辑步骤是：1) 分配内存；2) 构造器初始化；3) 引用指向该内存。JMM 允许 2、3 重排（单线程内结果不变），但多线程下 T1 刚执行完 1、3，T2 判断非 null 直接返回「有地址、字段全是默认值」的半成品。加 volatile 后步骤 3 成为 volatile 写，其前的 StoreStore 屏障保证初始化先于引用发布可见，重排被禁止：

```java
private volatile static Singleton instance;

public static Singleton getInstance() {
    if (instance == null) {                 // 第一次检查：避免每次加锁
        synchronized (Singleton.class) {
            if (instance == null) {         // 第二次检查：防并发重复创建
                instance = new Singleton();
            }
        }
    }
    return instance;
}
```

**延伸**：嫌 DCL 啰嗦可用静态内部类单例——类初始化由 JVM 保证线程安全（JLS 12.4.2），天然免锁免 volatile；枚举单例还顺带防反射与序列化破坏。

> 追问：两次 null 检查各自能省掉吗？提示：省第一次则每次都抢锁；省第二次，两个线程先后拿到锁会创建出两个实例。

### volatile 与 happens-before 是什么关系？

**结论**：volatile 变量规则本身就是 happens-before 的一条——写 volatile happens-before 后续对它的读；配合程序次序规则与传递性，volatile 能「顺带」保障其前后普通变量的可见性。

**原理**：串一条链就明白了：

```java
int a = 0;
volatile boolean flag = false;

// 线程 A：a = 1; flag = true;
// 线程 B：if (flag) { 读取 a; }
```

A 线程内 `a = 1` happens-before `flag = true`（程序次序）；`flag = true` happens-before B 读到 true（volatile 规则）；B 读到 true happens-before 其后的 `读 a`（程序次序）。传递性收尾：B 看到 flag 为 true 时，a 一定等于 1。这就是 volatile 标志位能安全「发布」一组普通变量修改的原因。

**延伸**：常用规则要能一口气背出：程序次序、监视器锁、volatile、线程 start、线程 join、传递性——它是判断并发代码正确性的裁判标准，比背「volatile 三个特性」高一个段位。

> 追问：final 字段的安全发布语义了解吗？提示：构造器内对 final 的写 hb 于构造完成后对引用的读，这是不可变对象免锁发布的依据（JLS 17.5）。

## synchronized

### synchronized 的三种用法分别锁什么？

**结论**：修饰实例方法锁当前对象 this；修饰静态方法锁当前类的 Class 对象；修饰代码块锁括号里指定的对象。锁对象不同，互斥关系就不同。

**原理**：互斥与否只看「是不是同一把锁」。静态同步方法拿 `Xxx.class`，实例方法拿 this，两把锁互不干扰。代码块最灵活，可自定义粒度更细的锁对象：

```java
synchronized void m1() {}         // 锁 this
static synchronized void m2() {}  // 锁当前类的 Class 对象
void m3() {
    synchronized (lockObj) {}     // 锁指定对象
}
```

**延伸**：两个工程警告：不要 `synchronized("字符串")`——常量池会让看似私有的锁变成全局共享；也不要锁 `Integer` 等包装类，缓存区间内外 `==` 结果不同，锁身份不可控。构造方法不能用 synchronized 修饰，构造期对象天然线程封闭。

> 追问：锁用私有 `new Object()` 字段与直接用 this 有何取舍？提示：私有锁防止外部代码持同一把锁干扰，缩小死锁与恶意阻塞的攻击面。

### synchronized 的底层是怎么实现的？

**结论**：同步代码块靠 `monitorenter`/`monitorexit` 字节码指令，同步方法靠 `ACC_SYNCHRONIZED` 访问标志；两者本质都是竞争对象关联的监视器 monitor。

**原理**：对同步块 `javap -c` 能看到一个 monitorenter 配两个 monitorexit——多出的为异常路径准备，保证抛异常时也释放。monitorenter 竞争锁对象的 monitor：计数器为 0 则获取并置 1，自己持有则计数加一（可重入的基础），被他人持有则进入 BLOCKED；monitorexit 减一，归零即释放。monitor 对应 C++ 的 ObjectMonitor——wait/notify 必须在同步块内调用，正因为它们直接操作其等待集合。

**延伸**：同步方法没有这两条指令，靠方法表 access_flags 里的 `ACC_SYNCHRONIZED` 标记，调用时由 JVM 隐式完成 enter/exit。

> 追问：为什么同步块编译出两个 monitorexit？提示：正常退出一个、异常退出一个，异常表确保任何路径下计数器都归零。

### synchronized 做了哪些优化？锁升级了解吗？

**结论**：JDK 6 起引入偏向锁、轻量级锁、自旋、锁消除、锁粗化等优化，锁随竞争按「无锁 → 偏向 → 轻量级 → 重量级」单向升级；JDK 15 起偏向锁默认关闭，JDK 18 彻底废弃。

**原理**：核心思路是「没有竞争时尽量别走内核互斥」。锁状态记在对象头 Mark Word：单线程反复进出时偏向它，连 CAS 都省；出现第二个线程则撤销偏向、升级轻量级锁，靠自旋 CAS 抢锁，成功就不挂起线程；自旋失败说明竞争加剧，膨胀为重量级锁，走 ObjectMonitor 和 OS 互斥量。自适应自旋、锁消除、锁粗化则是 JIT 层的进一步压缩。

**延伸**：锁只升级不降级。偏向锁废弃的官方理由（JEP 374）：撤销需全局安全点、开销大且侵入性强，而「单线程反复进出 Hashtable」的红利场景在现代代码中越来越少。主动提版本变迁，说明你的知识在更新。

> 追问：锁消除和锁粗化各自的触发条件？提示：前者靠 JIT 逃逸分析证明锁对象线程私有；后者合并相邻同步块以减少 enter/exit 次数。

## 乐观锁与 CAS

### 悲观锁和乐观锁分别适合什么场景？

**结论**：悲观锁假设冲突必发生，先加锁再操作（synchronized、ReentrantLock、数据库行锁）；乐观锁假设冲突少，先操作、提交时再校验（CAS、版本号）。读多写少用乐观，写多竞争激烈用悲观。

**原理**：悲观锁开销固定（加解锁加可能的阻塞与上下文切换），冲突越激烈越划算；乐观锁无锁无阻塞，但冲突时作废重试，写冲突一多 CPU 就被自旋烧穿。Java 乐观锁的代表是 atomic 包与 LongAdder——后者把热点值拆成 Cell 数组分段竞争：

```java
LongAdder counter = new LongAdder();
counter.increment();      // 高并发计数优于 AtomicLong
long v = counter.sum();   // 汇总瞬间有并发修改时是近似值
```

**延伸**：数据库侧对应物：乐观锁是带 version 条件的 UPDATE，悲观锁是 `SELECT ... FOR UPDATE`。校验失败后的重试是业务行为：重试几次、失败后如何降级，写代码前就要想清楚。

> 追问：LongAdder 为什么比 AtomicLong 快，`sum()` 有什么语义坑？提示：Cell 分散 CAS 热点；sum 不是原子快照，只适合监控类的宽松场景。

### CAS 的底层是怎么实现的？

**结论**：CAS 对应一条 CPU 原子指令（x86 上是 `lock cmpxchg`），Java 通过 Unsafe 的 native 方法暴露语义，HotSpot 将其内联为平台原子指令；上层原子类用「volatile 读 + CAS 自旋重试」拼出无锁更新。

**原理**：CAS 三个操作数：内存位置 V、期望值 E、新值 N；仅当 V 等于 E 才写入 N，整个「比较加交换」硬件级原子。以 AtomicInteger 为例，内部持有 volatile int value 和字段偏移量 valueOffset，自增核心逻辑：

```java
// Unsafe#getAndAddInt 的核心逻辑（JDK 8）
public final int getAndAddInt(Object o, long offset, int delta) {
    int v;
    do {
        v = getIntVolatile(o, offset); // volatile 读拿最新值
    } while (!compareAndSwapInt(o, offset, v, v + delta)); // 失败就重试
    return v;
}
```

volatile 读保证拿到最新值，CAS 保证「读到后没被人改过才写」，循环保证最终成功——三者缺一不可，这是 JUC 无锁体系的通用范式。

**延伸**：AQS 的 state、ConcurrentHashMap 的桶初始化、FutureTask 的状态流转全是这个范式的应用；JDK 9 起 VarHandle 提供了更规范的等价 API。

> 追问：`lock cmpxchg` 的 lock 前缀是干什么的？提示：经缓存一致性协议锁定缓存行，保证比较与交换期间该地址不被其他核修改（早期实现是锁总线）。

### CAS 有哪些问题？

**结论**：三大经典问题：ABA（值被改回去导致误判）、自旋开销（长时间失败空转烧 CPU）、只能保证单个变量的原子操作。

**原理**：ABA——CAS 只比较「此刻是否等于期望值」，值经历 A→B→A 后照样成功，但中间过程可能携带语义变化。解法是给值绑定版本号，JDK 提供 AtomicStampedReference（int 版本戳）和 AtomicMarkableReference（布尔标记）：

```java
AtomicStampedReference<Node> ref = new AtomicStampedReference<>(node, 0);
// 引用和版本戳都匹配才更新
ref.compareAndSet(node, newNode, 0, 1);
```

自旋开销可用指数退避、pause 指令缓解，或换 LongAdder 分散热点；一次 CAS 只能动一个内存位置，多变量不变式需用 AtomicReference 包一层不可变对象整体替换，或退回锁。

**延伸**：ABA 在纯数值场景（计数器）通常无害，在指针/引用场景才可能出 bug。判断要不要上版本戳，先问自己「值相同是否等于状态相同」。

> 追问：AtomicMarkableReference 与 AtomicStampedReference 分别适合什么场景？提示：只关心「是否被改过」用 markable，需区分「改过几次」用 stamped。

## Lock 体系

### synchronized 和 ReentrantLock 有什么区别？

**结论**：都是可重入独占锁；synchronized 是 JVM 关键字、自动释放、非公平、等待不可中断；ReentrantLock 是 API 层实现，提供可中断等待、超时尝试、公平选项和多 Condition。

**原理**：四个高级功能要能举例：`lockInterruptibly()` 让等锁线程响应中断（synchronized 抢锁阻塞时对中断无感）；`tryLock(timeout)` 限时等待，是防死锁利器；构造器传 true 得公平锁，按序发锁、防饥饿但吞吐略降；`newCondition()` 建多个等待队列做分组唤醒（如缓冲区的 notEmpty/notFull），而 synchronized 只有一个等待集合，notifyAll 无差别唤醒造成惊群：

```java
lock.lock();
try {
    while (count == 0) {
        notEmpty.await(); // 等价于 wait，但挂到专属 Condition
    }
} finally {
    lock.unlock();        // 必须手动释放，且放 finally
}
```

**延伸**：选型：能用 synchronized 就用（简单不易错、JVM 持续优化、异常时编译器保证释放），需要中断、超时、公平、多条件再上 ReentrantLock。

> 追问：公平锁为什么吞吐更低？提示：禁止插队意味着每次都走队列唤醒链，上下文切换远多于非公平的「锁刚释放被新来者抢到」。

### 读写锁的读锁能升级成写锁吗？

**结论**：ReentrantReadWriteLock 中持有读锁的线程不能直接升级为写锁（会死锁），但持有写锁可以降级获取读锁，即「可降级、不可升级」。

**原理**：推导很直接：两个线程各持读锁同时申请写锁；写锁要求独占即所有读锁释放；双方都不肯先放读锁——循环等待成立，死锁。正确姿势是释放读锁再抢写锁，且抢到后重新检查共享状态。降级则合法且常用：

```java
rw.writeLock().lock();
try {
    // 更新共享状态
    rw.readLock().lock();   // 持有写锁再拿读锁：合法的锁降级
} finally {
    rw.writeLock().unlock(); // 释放写锁，只剩读锁保护后续读取
}
```

**延伸**：降级的意义是「写完还想读、期间不能被别人改」时保持一致性。JDK 8 的 StampedLock 用乐观读缓解写线程饥饿，但不可重入、不支持 Condition。

> 追问：读多写少时写线程为什么可能饿死？提示：非公平策略下源源不断的读锁让写锁长期排队，可换公平模式或 StampedLock 缓解。
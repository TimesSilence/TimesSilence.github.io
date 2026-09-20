---
title: 零拷贝详解：mmap、sendfile 与 splice
date: 2018-10-29 13:25:00
updated: 2018-10-29 13:25:00
permalink: knowledge/cs-basics/operating-system/zero-copy/
categories:
  - 计算机基础
tags: [操作系统, 零拷贝, I/O]
description: 算清传统 read/write 的四次拷贝与四次切换，讲透 mmap、sendfile（含 SG-DMA）与 splice 的演进路线，以及 FileChannel.transferTo、Netty、Kafka/RocketMQ 中的落地。
---

传统 read/write 发送一个文件，要经历 4 次数据拷贝和 4 次用户态/内核态切换，其中两次 CPU 拷贝纯属把数据搬进用户空间又原样搬出。零拷贝是一类让数据不经过用户空间的技术统称：mmap 共享页缓存、sendfile 内核内直发、SG-DMA 抹掉最后一次 CPU 拷贝、splice 借管道传递页引用。本文把每条路线的账算清，并落到 Java NIO、Netty 与 Kafka/RocketMQ 的实践。

<!-- more -->

## 它解决什么问题

典型场景是文件下载服务：服务端把磁盘文件经 socket 发给客户端，代码只需 read 加 write 两行。但应用根本没有修改数据内容，数据却被 CPU 在内核缓冲和用户缓冲之间来回搬了两趟，外加 4 次态切换的寄存器保存恢复开销。高并发、大文件场景下，这部分纯搬运会被放大成明显的 CPU 瓶颈。零拷贝要省的就是这部分。

先约定算账口径：数据初始不在 Page Cache（需要真正读盘）、不做 TLS/压缩等用户态处理、设备支持 DMA；"切换"指用户态与内核态的模式切换，一次系统调用进出各算一次，与线程被调度器换下的线程上下文切换不是一回事。场景一变，数字就会浮动。

## 核心原理：传统路径的账

```c
while ((n = read(file_fd, buf, BUF_SIZE)) > 0)
    write(socket_fd, buf, n);
```

这两行代码背后，数据被搬了四趟：

1. read 发起系统调用，切到内核态（切换 1）；
2. DMA 控制器把数据从磁盘搬进内核读缓冲（拷贝 1，DMA）；
3. CPU 把数据从内核读缓冲拷到用户缓冲（拷贝 2，CPU），切回用户态（切换 2），read 返回；
4. write 再次切入内核（切换 3）；
5. CPU 把用户缓冲的数据拷进 socket 缓冲（拷贝 3，CPU）；
6. DMA 把 socket 缓冲的数据送往网卡（拷贝 4，DMA），切回用户态（切换 4）。

合计 **4 次拷贝（2 次 DMA + 2 次 CPU）、4 次模式切换**。磁盘到内存、内存到网卡这两段交给 DMA，不占 CPU；真正难受的是中间两次 CPU 拷贝——数据内容一字未改，只是路过用户空间打了个转。

零拷贝的"零"不是全程没有拷贝，而是指 **CPU 不再参与 payload 在内存之间的复制**，并随之减少模式切换。下面三条路线都是围绕"怎么干掉 CPU 拷贝"做文章。

## 深入机制：三条演进路线

### mmap + write

mmap 利用"多个虚拟地址可指向同一物理页"的能力，把文件 Page Cache 页同时映射进用户地址空间，内核与用户看到的是同一份数据。调用本身不搬数据，首次访问映射页才触发缺页、按需从磁盘读入。发送时 write 直接把数据从 Page Cache 拷进 socket 缓冲：省掉了"内核→用户"那次 CPU 拷贝，剩下 1 次 CPU 拷贝加 2 次 DMA。代价是建拆映射与缺页处理有固定成本，小文件可能得不偿失；映射文件被其他进程截断后再访问还会收到 SIGBUS。

### sendfile 与 SG-DMA

sendfile（Linux 2.1 引入）把"文件到 socket"收进一次系统调用，数据全程不出内核：2 次切换、3 次拷贝（2 次 DMA + 1 次 CPU）。`in_fd` 须是支持 mmap 式读取的对象（通常是普通文件），`out_fd` 在 2.6.33 之前只能是 socket。

Linux 2.4 起配合 SG-DMA（scatter-gather DMA）更进一步：CPU 不再搬数据本身，只把数据在内核缓冲里的位置描述（地址加长度，几个字节元数据）写进 socket 缓冲，网卡按描述直接从内核缓冲聚拢取数。此时 **payload 的 CPU 拷贝降为 0，全程只剩 2 次 DMA 与 2 次切换**，这才是名副其实的零拷贝。前提是网卡支持 scatter-gather，且协议栈中途不需要碰数据内容。

### splice

splice（Linux 2.6.17 引入）借管道做中转：管道缓冲区本质是一组带引用计数的页指针，"移动数据"多数时候只是复制指针、给页引用计数加一。它能在更一般的描述符之间转发（含 socket 到 socket，sendfile 做不到），但要求至少一端是管道，文件到 socket 需要两次系统调用：

```c
splice(file_fd, NULL, pipe_w, NULL, len, SPLICE_F_MOVE);   // 文件 -> 管道
splice(pipe_r, NULL, socket_fd, NULL, len, SPLICE_F_MOVE); // 管道 -> socket
```

注意这是两次 splice，进出内核态合计约 4 次切换；`SPLICE_F_MOVE` 只是给内核的提示，遇到无法移动页的场景会退化为真正的复制。

## 对比与权衡

| 方式 | CPU 拷贝 | DMA 拷贝 | 模式切换 | 适用场景 |
| --- | --- | --- | --- | --- |
| read + write | 2 | 2 | 4 | 需要处理数据内容 |
| mmap + write | 1 | 2 | 至少 2，另有缺页 | 需要读写映射区 |
| sendfile | 1 | 2 | 2 | 文件原样转发 |
| sendfile + SG-DMA | 0 | 2 | 2 | 硬件支持的纯转发 |
| splice（文件→管道→socket） | 通常 0 | 2 | 4 | 任意 fd 间转发 |

选型一句话：**要改数据用 mmap，纯转发用 sendfile，socket 对 socket 才轮到 splice**。一旦引入用户态 TLS、压缩、格式转换或内容过滤，payload 必须进用户空间处理，零拷贝路径整体退化；文件过小或访问随机时，映射与缺页的固定开销也可能吃掉收益。

## 工程实践

**Java NIO 的对应物**：`FileChannel.map` 拿到的 `MappedByteBuffer` 底层即 mmap；`transferTo`/`transferFrom` 在目标是已连接 `SocketChannel` 且平台支持时才可能走 sendfile，换成普通文件就可能退回用户态复制，别把 Java API 与 sendfile 直接画等号。

```java
FileChannel source = FileChannel.open(
        Paths.get("./in.dat"), StandardOpenOption.READ);
// socketChannel 为已连接的 SocketChannel；底层可能走 sendfile
source.transferTo(0, source.size(), socketChannel);
```

`transferTo` 不保证一次传完，必须按返回值循环补传；底层走 Linux sendfile 时单次上限约 2 GB（`0x7ffff000`），具体行为随 JDK 与平台而变。

**Netty 的零拷贝是另一个维度**：`CompositeByteBuf`、`slice`、`duplicate` 在用户态组合 buffer，避免 JVM 内的多次堆拷贝；写出时 `FileRegion` 默认走 `transferTo`。两层"零拷贝"叠加：一层省 JVM 内复制，一层省内核到用户的复制。

**Kafka**：消费拉取时把日志段文件经 `transferTo` 直接送进 socket，数据不进 JVM 堆，叠加生产端顺序写与 Page Cache 攒出高吞吐；其索引文件用的则是 mmap。一旦开 TLS 或需要消息格式转换，路径退化。

**RocketMQ**：CommitLog 用 `MappedByteBuffer` 读写，并特意设计成固定大小文件便于映射管理——因为它需要在映射区里灵活读写，而非单纯转发，恰好印证"要碰数据选 mmap"的选型标准。

## 面试视角

**零拷贝的"零"指什么？**

不是没有任何拷贝：磁盘到内存、内存到网卡两段 DMA 通常仍在。零的是 CPU 在内核缓冲与用户缓冲之间搬运 payload 的次数，以及随之减少的模式切换。

**传统 read/write 几次拷贝、几次切换？**

4 次拷贝（2 次 DMA + 2 次 CPU）、4 次用户态/内核态切换。最浪费的是两次 CPU 拷贝——应用没有改数据，却让数据在用户空间白转一圈。

**mmap 和 sendfile 的区别？**

mmap 把文件页映射进用户空间，应用能看到并修改数据，但仍需 write 完成发送；sendfile 一次系统调用在内核内完成文件到 socket 的转发，应用碰不到数据。配合 SG-DMA 时 sendfile 可实现零 CPU 拷贝。

**Kafka 为什么用 sendfile，RocketMQ 为什么用 mmap？**

Kafka 消费端把日志段原样转发，不需要看内容，`transferTo`/sendfile 正合适；RocketMQ 的 CommitLog 要在映射内存里灵活读写，mmap 更贴合。"要不要碰数据"就是选型分水岭。

**什么情况下零拷贝失效？**

用户态 TLS 加密、压缩、格式转换、内容过滤等必须读取 payload 的处理都会让数据回到用户空间；文件过小或访问随机时，建映射与缺页的固定开销也可能抵消收益。

## 小结

- 零拷贝省的是 CPU 拷贝与模式切换，DMA 搬运照常存在，算账前先定口径。
- 演进路线：mmap 省一次 CPU 拷贝 → sendfile 收进一次系统调用 → SG-DMA 干掉最后一次 CPU 拷贝 → splice 把能力扩展到任意 fd。
- Java 侧 `MappedByteBuffer` 对应 mmap、`transferTo` 对应 sendfile，Netty 还在用户态做了 buffer 组合的零拷贝。
- 选型核心看数据要不要被应用碰：透传走 sendfile，要改走 mmap。
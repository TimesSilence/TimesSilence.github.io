---
title: "Java NIO 核心知识总结"
date: 2020-06-24 12:28:00
updated: 2020-06-24 12:28:00
permalink: knowledge/java/io/nio-basis/
categories:
  - Java
tags:
  - Java IO
  - NIO
description: "讲透 Buffer 的 capacity/position/limit/mark 四要素与 flip 翻转语义、Channel 的双向性、Selector 事件驱动循环，并用极简 NIO Echo Server 对照 BIO 编程模型。"
---

NIO 把 IO 抽象从「单向流」换成 Buffer、Channel、Selector 三件套：数据先落进缓冲区，通道负责在缓冲区与文件或套接字之间双向搬运，选择器让一个线程照看成百上千条连接。本文讲清 Buffer 四要素与 flip 状态翻转、Selector 事件驱动循环，并给出一个可运行的极简 NIO Echo Server，与 BIO 编程模型逐项对照。

<!-- more -->

## 它解决什么问题

BIO 的痛点有两层。一层在资源：一连接一线程，万级连接意味着万级线程，栈内存和上下文切换先压垮机器。另一层在编程模型：流是单向、阻塞的，读不到数据线程就只能干等，无法表达「这批连接里谁有数据了我就处理谁」。NIO（Java 1.4 引入）同时回答这两个问题：面向缓冲的 API 让数据读写有了可复用、可定位的容器，Selector 则把多路复用带进 Java，让单线程管理海量连接成为现实。Netty、Kafka、各类 RPC 框架的网络层都建立在这三件套之上。

## 核心原理

### Buffer：带读写指针的数据容器

Buffer 是一块线性的同类型数据容器（最常用 ByteBuffer），所有 Channel 读写都必须经过它。理解 Buffer 只需抓住四个成员变量及其不变式 `0 <= mark <= position <= limit <= capacity`：

- **capacity**：容量，创建时固定，不可变；
- **limit**：读写边界，写模式下通常等于 capacity，读模式下等于已写入的数据量；
- **position**：下一个待读/写元素的下标，随每次 get/put 自动后移；
- **mark**：一个备忘位置，`reset()` 可把 position 拉回到它；未设置时调 reset 抛 InvalidMarkException。

Buffer 创建后处于**写模式**（position=0，limit=capacity），往里 put 数据 position 递增。写完想读，必须先 `flip()` 做一次状态翻转：`limit = position; position = 0; mark = -1`。这个翻转就是「把刚才写入的范围圈定为可读范围」。读完想再写，`clear()` 复位为 position=0、limit=capacity（数据逻辑上被清空，实际未擦除）。另外两个常用操作：`rewind()` 只把 position 归零、不动 limit，用于重读；`compact()` 把未读数据搬到数组开头后进入写模式，是处理 TCP 半包的关键动作——没读完的半个包留下来，新数据追加在后面。

### Channel：双向的传输通道

BIO 的流是单向的，读用 InputStream、写用 OutputStream；Channel 天然双向，`SocketChannel` 同时支持 read 和 write，`FileChannel` 的读写能力取决于打开方式。数据永远经由 Buffer 进出：`channel.read(buffer)` 把通道数据填进缓冲区，`channel.write(buffer)` 把缓冲区内容写进通道。常用实现有 FileChannel（文件）、SocketChannel/ServerSocketChannel（TCP）、DatagramChannel（UDP）。

### Selector：事件驱动的多路复用

Selector 把「轮询所有连接看谁就绪」交给内核完成（Linux 上是 epoll）。SelectableChannel 设为非阻塞后注册到 Selector，声明感兴趣的事件：`OP_ACCEPT`（新连接到达，ServerSocketChannel）、`OP_CONNECT`（连接建立完成）、`OP_READ`（有数据可读）、`OP_WRITE`（可写）。之后线程阻塞在 `select()` 上，有事件就绪即返回，通过 selectedKeys 拿到就绪集合逐个处理。

## 深入机制

### Buffer 状态翻转演示

```java
ByteBuffer buffer = ByteBuffer.allocate(8);       // position=0, limit=8
buffer.put((byte) 'a').put((byte) 'b').put((byte) 'c');
System.out.println(buffer.position() + "/" + buffer.limit()); // 3/8，写入了 3 个
buffer.flip();                                    // position=0, limit=3
while (buffer.hasRemaining()) {
    System.out.print((char) buffer.get());        // 输出 abc
}
buffer.clear();                                   // position=0, limit=8，可重新写
```

忘记 flip 是最经典的 NIO 错误：写完直接 get，position 停在写入末尾，读到的是缓冲区尾部的空白。判断「还有没有数据」永远用 `hasRemaining()`（即 position < limit），不要拿 position 和 capacity 比。

### 堆缓冲区与直接缓冲区

`ByteBuffer.allocate` 分配堆内缓冲区，GC 可管理，但 Channel 读写时 JVM 要先把数据在堆与本地内存之间倒一手；`allocateDirect` 分配堆外（直接）缓冲区，省去这一次中转拷贝，是 Netty 高性能的基础之一。代价是分配和回收成本高、不受 GC 直接管辖，所以直接缓冲区应当池化复用（Netty 的 PooledByteBufAllocator 干的就是这件事），而不是每次现申请。

### Selector 事件循环的细节

遍历就绪集合时有两个必须遵守的纪律：

1. **处理完的 key 必须 `iterator.remove()`**：selectedKeys 是 Selector 持有的活集合，不移除的话下次 select 返回时旧 key 还在，会被重复处理。
2. **OP_WRITE 按需注册**：只要 TCP 发送缓冲区没满，「可写」几乎总是成立，常驻注册 OP_WRITE 会让 select 立刻返回、事件循环空转烧 CPU。正确姿势是平时只监听 OP_READ，某次 write 没写完（返回写入数小于剩余量）时才注册 OP_WRITE，写完立刻改回 OP_READ。

另外 JDK 的 epoll 实现存在著名的空轮询 bug：特定情况下连接异常会让 select 立即返回但无任何就绪事件，导致 CPU 100%。Netty 的规避策略是统计空轮询次数，超过阈值就重建一个 Selector 并把全部 Channel 迁移过去。

### 极简 NIO Echo Server

```java
public class NioEchoServer {
    public static void main(String[] args) throws IOException {
        ServerSocketChannel server = ServerSocketChannel.open();
        server.bind(new InetSocketAddress(8080));
        server.configureBlocking(false);
        Selector selector = Selector.open();
        server.register(selector, SelectionKey.OP_ACCEPT);
        ByteBuffer buffer = ByteBuffer.allocate(1024); // 单线程事件循环，可安全共享

        while (true) {
            if (selector.select() == 0) {
                continue; // 无就绪事件
            }
            Iterator<SelectionKey> it = selector.selectedKeys().iterator();
            while (it.hasNext()) {
                SelectionKey key = it.next();
                it.remove(); // 处理完必须移除，否则下次重复触发
                if (key.isAcceptable()) {
                    SocketChannel client = ((ServerSocketChannel) key.channel()).accept();
                    client.configureBlocking(false);
                    client.register(selector, SelectionKey.OP_READ);
                } else if (key.isReadable()) {
                    SocketChannel client = (SocketChannel) key.channel();
                    buffer.clear();
                    int n = client.read(buffer);
                    if (n == -1) {           // 对端关闭连接
                        client.close();
                        continue;
                    }
                    buffer.flip();           // 写完转读
                    while (buffer.hasRemaining()) {
                        client.write(buffer); // 非阻塞写可能只写部分，循环兜底
                    }
                }
            }
        }
    }
}
```

整个服务器只有一个线程：accept 得到的新连接设为非阻塞并注册 OP_READ，读到的数据 flip 后原样写回。这个 demo 省略了生产必需的半包缓冲（应用侧消息边界）和 OP_WRITE 切换（发送缓冲区满时写循环会空转），但事件驱动骨架完整——真实项目请直接用 Netty。

## 工程实践

- **Buffer 不是线程安全的**：跨线程共享必须自己同步；Netty 的解法是让 Channel 终身绑定单线程的 EventLoop，串行化所有访问。
- **读事件里 -1 是对端关闭**：非阻塞 read 返回 0 表示本次没读到数据，返回 -1 才是连接终止，必须 close 通道注销 key，否则连接泄漏。
- **优先池化直接缓冲区**：高频网络读写场景下，堆外内存加池化能显著降低拷贝开销和 GC 压力。
- **大文件传输用 FileChannel.transferTo**：底层可走 sendfile 类零拷贝路径，省掉数据进出用户态的往返。
- **别在生产环境裸写 NIO**：空轮询 bug、半包粘包、内存管理都要自己扛，成熟框架已经把这些坑填平。

## 对比与权衡

| 维度 | BIO | NIO |
| --- | --- | --- |
| 数据抽象 | 单向流，读不到就等 | Buffer 容器 + 双向 Channel |
| 连接与线程 | 一连接一线程 | 单线程管理多连接 |
| 就绪检测 | 无，线程阻塞在 read 上 | Selector 批量事件通知 |
| 编程复杂度 | 低，顺序式思维 | 高，要管状态翻转与事件分发 |
| 单条连接吞吐 | 相同数据量下差异不大 | 相同数据量下差异不大 |
| 典型场景 | 低并发、短连接、内部工具 | 高并发长连接、网络中间件 |

NIO 的优势是并发连接数与线程利用率，不是让单次 IO 更快——连接少、网络快的场景，NIO 相对 BIO 没有性能红利，复杂度反而上升。

## 面试视角

**flip() 做了什么，不调会怎样？** flip 把 limit 设为当前 position、position 归零、mark 置为 -1，也就是把「已写入范围」重新定义为「可读范围」。写完不 flip 直接 get，position 停在写入末尾，读到的是缓冲区尾部的空白数据，这是 NIO 最经典的错误。

**Buffer 四要素及不变式？** capacity 是固定容量，limit 是读写边界，position 是下一个待操作位置，mark 是供 reset 回退的备忘位；四者始终满足 mark <= position <= limit <= capacity。clear 全复位回写模式，compact 保留未读数据进入写模式，rewind 只回绕 position 用于重读。

**Channel 和 Stream 的本质区别？** 流是单向、阻塞、面向字节的推拉模型；Channel 双向、可配非阻塞、面向缓冲区，读写都经由 Buffer。Channel 更贴近操作系统套接字的双向语义，这也是它能配合 Selector 做事件驱动的前提。

**遍历 selectedKeys 为什么必须 remove？** selectedKeys 是 Selector 内部持有的活集合，select 只是往里添加新就绪的 key，不会清理已处理的。不手动 remove，同一个 key 会在后续循环中被反复处理，轻则重复读写，重则对已关闭的通道操作抛异常。

**什么时候注册 OP_WRITE？** 只在一次 write 没能把数据全部写出（发送缓冲区满）时注册，等通道再次可写时继续写；写完后立即改回 OP_READ。常驻 OP_WRITE 会因为「可写几乎恒成立」导致事件循环空转，CPU 打满。

## 小结

- Buffer 四要素配合不变式工作；flip 把写入范围翻转为读取范围，忘了它就是经典 bug。
- Channel 双向、面向缓冲区，是 Selector 事件驱动的载体；流单向阻塞，两者不是简单的升级关系。
- Selector 让单线程管理海量连接，铁律是处理完 remove、OP_WRITE 按需注册。
- NIO 的价值在并发连接数而非单次 IO 速度；生产环境请站在 Netty 的肩膀上。
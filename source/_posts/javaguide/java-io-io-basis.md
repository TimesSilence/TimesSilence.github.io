---
title: "Java IO 基础知识总结"
date: 2020-05-28 09:07:00
updated: 2020-05-28 09:07:00
permalink: knowledge/java/io/io-basis/
categories:
  - Java
tags:
  - Java IO
  - 基础
description: "讲清字节流与字符流的分水岭是编码转换、节点流与处理流的装饰器结构、缓冲流提速的系统调用账、try-with-resources 的关闭顺序与 Files 工具类的现代写法。"
---

Java IO 四十多个类全部派生自 InputStream/OutputStream/Reader/Writer 四个抽象基类，看似庞杂，实则只有两条主线：字节与字符的分界是编码转换，节点与处理的分界是装饰器叠加。把握住这两条主线，再补上缓冲与资源关闭两个工程细节，日常 IO 代码就不会再踩坑。

<!-- more -->

## 它解决什么问题

磁盘和网络传输的最小单元都是字节，但程序要处理的数据形态千差万别：文本要按字符读写，对象要能整体序列化，基本类型想按 int、double 直接存取。如果每种能力都做成一个独立类，类库会立刻爆炸；如果只提供最原始的字节读写，开发者又要在每个项目里重复造解码、缓冲的轮子。Java IO 的回答是分层：底层用四个抽象基类统一「读写字节/字符」的契约，中间用装饰器把缓冲、解码、数据类型等能力做成可以自由组合的「处理流」，叠加在直接对接数据源的「节点流」之上。

## 核心原理

### 字节流与字符流：分水岭是编码转换

InputStream/OutputStream 操作字节，Reader/Writer 操作字符，两者的差别不是「读的单位大一点」这么简单，而是**字符流内部内置了编解码**。字符落到磁盘前必须按某种编码（Charset）序列化成字节，读回时按同样的编码解码，InputStreamReader 和 OutputStreamWriter 就是这座桥。Unicode 只是给每个字符分配唯一编号的字符集，UTF-8、UTF-16 才是具体的编码方式——UTF-8 下一个英文字母占 1 字节、一个汉字通常占 3 字节，编解码对不上就是乱码的物理来源。

这里埋着 Java IO 历史上最大的坑：不指定编码时，转换类使用 JVM 默认字符集。JDK 17 及更早版本，默认字符集跟随操作系统的区域设置（中文 Windows 是 GBK，Linux 服务器通常是 UTF-8），同一份代码换个环境就乱码；直到 JDK 18 的 JEP 400 才把默认字符集统一为 UTF-8。而 FileReader/FileWriter 这两个常用类，直到 JDK 11 才提供指定 charset 的构造方法，此前想控制编码只能退回 InputStreamReader。

### 节点流与处理流：装饰器模式

节点流（FileInputStream、ByteArrayInputStream）直接对接数据源，处理流（BufferedInputStream、DataInputStream、GZIPInputStream）不接触数据源，只包裹另一个流并增强能力。这是教科书级的装饰器模式：能力以「套娃」方式组合，关闭时只需关最外层，close 调用会沿包装链级联向内传播。

## 深入机制

### 缓冲流为什么快：一笔系统调用的账

无缓冲时，每调一次 `read()` 就是一次 read 系统调用，伴随着用户态到内核态的切换。切换本身的开销远高于拷贝一个字节，逐字节读一个 500MB 的文件意味着五亿次系统调用，耗时以小时计。BufferedInputStream 内部维护一个默认 8192 字节的数组，`read()` 绝大多数时候只是从数组里取一个字节，只有缓冲区耗尽时才做一次底层 read 填满它。实测复制同样的大文件，缓冲流与裸流的差距能到两个数量级。

反过来，如果你自己用 `read(byte[] buf)` 配一个 4KB 数组，性能差距就缩小到可以忽略——因为你已经手动实现了缓冲。结论是：缓冲流的价值主要在单字节读写和 `readLine()` 这类行操作（BufferedReader 独有），自己开数组批量读写时套不套 Buffered 差别不大。

```java
// 装饰器组合：FileInputStream 对接文件，BufferedInputStream 提供缓冲
try (BufferedInputStream bis = new BufferedInputStream(
        new FileInputStream("input.txt"))) {
    byte[] buf = new byte[8192];
    int len;
    while ((len = bis.read(buf)) != -1) {
        // 处理 buf[0..len)
    }
}
```

### try-with-resources 的正确关闭姿势

任何实现 AutoCloseable 的资源都可以放进 try 括号，编译器保证在块结束时**按声明的逆序**自动关闭。若关闭过程中抛异常，而 try 块里已有主异常，关闭异常会被挂到主异常的 suppressed 列表里，不会掩盖真正的故障现场。多层装饰只需声明最外层：

```java
Path path = Path.of("input.txt");
// 声明顺序：先内后外；关闭顺序自动反转：先 BufferedReader 再其内层
try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line);
    }
}
```

注意读循环的返回值约定：`read()` 返回 -1 表示 EOF，字节值本身被提升到 0–255 的 int 区间，所以 -1 不会与任何合法数据冲突；`read(byte[])` 返回实际读到的字节数，可能小于数组长度，写出去时必须用 `write(buf, 0, len)` 带上这个长度，否则会把数组尾部的旧数据写脏。

### Files 工具类的现代写法

JDK 7 的 NIO.2 引入 `java.nio.file.Files` 后，文件读写不再需要手工套流，编码参数也是一等公民：

```java
Path src = Path.of("input.txt");
// 小文件一把梭（大文件禁用，会撑爆堆）
List<String> lines = Files.readAllLines(src, StandardCharsets.UTF_8);
String content = Files.readString(src, StandardCharsets.UTF_8);   // JDK 11+
// 写文件，显式指定打开方式
Files.writeString(Path.of("out.txt"), "你好，世界", StandardCharsets.UTF_8,
        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
// 大文件逐行处理：lines 返回的 Stream 必须关闭
try (Stream<String> stream = Files.lines(src, StandardCharsets.UTF_8)) {
    stream.filter(s -> !s.isBlank()).forEach(System.out::println);
}
// 文件复制/移动，底层可走 FileChannel.transferTo，优先于手工循环
Files.copy(src, Path.of("backup.txt"), StandardCopyOption.REPLACE_EXISTING);
```

另外 JDK 9 起 InputStream 自带 `transferTo(OutputStream)`，流之间的搬运也不用再手写循环了。

## 工程实践

- **永远显式指定 UTF-8**：所有涉及字符与字节互转的地方——`new String(bytes, UTF_8)`、`getBytes(UTF_8)`、`Files.newBufferedReader(path, UTF_8)`——都别依赖默认字符集，除非你能保证运行环境至少是 JDK 18。
- **大文件禁用 readAllBytes/readString**：它们把整个文件读进堆内存，几个 GB 的文件直接 OOM，改用缓冲流或 Files.lines 分批处理。
- **别拿 available() 当协议长度**：它只返回「不阻塞可读」的字节数估计值，网络流上尤其不可靠，长度信息应该由协议头自己携带。
- **flush 语义要清楚**：缓冲输出流的 close 会先 flush，try-with-resources 场景无需手动 flush；但长连接网络流中消息写完要立即 flush，否则对方等不到数据。
- **随机读写用 RandomAccessFile**：支持 seek 定位，是断点续传、分片上传合并的基础工具；rws/rwd 模式还会把元数据/内容同步刷盘。

## 对比与权衡

| 维度 | 字节流 | 字符流 |
| --- | --- | --- |
| 基本单元 | byte | char（UTF-16 代码单元） |
| 编解码 | 不涉及 | 内置 Charset 编解码 |
| 抽象基类 | InputStream / OutputStream | Reader / Writer |
| 典型实现 | FileInputStream、ByteArrayOutputStream | InputStreamReader、FileWriter |
| 适用数据 | 图片、音视频、序列化、网络协议 | 纯文本 |
| 互转桥梁 | InputStreamReader / OutputStreamWriter | 同左 |

| 方案 | 定位 |
| --- | --- |
| 裸 FileInputStream 单字节读写 | 反面教材，系统调用风暴 |
| 缓冲流 / 自建 byte[] 缓冲 | 传统主力，适合流式大文件 |
| Files 工具类 | 现代首选，编码显式、代码最短 |
| FileChannel.transferTo | 大文件复制的性能上限（零拷贝方向） |

## 面试视角

**字节流和字符流有什么区别，怎么选？** 分水岭是编码转换：字符流在字节之上内置了 Charset 编解码，操作的是 char。图片、音视频、协议报文这类二进制数据必须走字节流，纯文本走字符流更顺手；用字节流读文本再手工 new String，本质上是把解码工作揽到自己身上。

**缓冲流为什么快？** 快在减少系统调用次数而非拷贝本身。无缓冲的单字节 read 每次都要进内核，用户态/内核态切换远贵于数据拷贝；BufferedInputStream 用默认 8192 字节的数组把成百上千次系统调用合并成一次。如果应用层自己用 read(byte[]) 批量读，缓冲流的加成就很小了。

**try-with-resources 的关闭顺序和异常处理是怎样的？** 资源按声明的逆序关闭，保证外层装饰器先于内层节点流关闭；多层包装只需声明最外层，close 会级联传播。try 块的主异常与关闭时的异常同时发生时，关闭异常以 suppressed 形式挂在主异常上，可用 getSuppressed() 取回，不掩盖现场。

**为什么 FileReader 容易乱码？** 它在 JDK 11 之前没有指定编码的构造，始终使用 JVM 默认字符集，而 JDK 17 及更早的默认字符集跟随操作系统区域设置。文件是 UTF-8、环境是 GBK 时，解码错位就是乱码。稳妥写法是 Files.newBufferedReader 或 InputStreamReader 并显式传入 UTF-8。

## 小结

- 四个抽象基类撑起整个 IO 体系：字节与字符的分界是编码转换，节点与处理的分界是装饰器叠加。
- 缓冲流的提速本质是减少系统调用；自建 byte[] 缓冲后，套 Buffered 的收益就很小了。
- try-with-resources 逆序关闭、suppressed 不丢异常，多层包装只关最外层。
- 文件操作优先 Files 工具类：编码显式、API 现代，大文件用 Files.lines 流式处理。
- 工程红线只有两条：编码永远显式指定 UTF-8，大文件绝不整读进内存。
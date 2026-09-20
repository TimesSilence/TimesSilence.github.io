---
title: "最重要的JVM参数总结"
date: 2021-07-11 13:15:00
updated: 2021-07-11 13:15:00
permalink: knowledge/java/jvm/jvm-parameters-intro/
categories:
  - Java
tags:
  - JVM
  - 参数调优
description: "按用途梳理 JVM 常用参数：堆内存、元空间、GC 日志、OOM 转储与收集器选择，附一份可直接套用的基础参数模板。"
---

JVM 参数成百上千，但日常真正要配的其实围绕五件事：堆怎么分、元空间怎么限、GC 日志怎么记、出事时现场怎么留、收集器选哪个。本文按这五个用途分组讲解，最后给出一份可直接套用的基础参数模板。

<!-- more -->

## 堆内存：-Xms、-Xmx、-Xmn

- `-Xms` 设置初始堆大小，`-Xmx` 设置最大堆大小，单位可用 `k/m/g`，如 `-Xmx4g`。
- 服务端应用的常见做法是把两者设为相同值（如 `-Xms4g -Xmx4g`），避免运行期堆动态伸缩带来的开销与抖动；代价是启动时就占住这部分内存，容器环境下要确认限额留有余量。
- `-Xmn` 用于固定年轻代大小，等效于同时设置 `-XX:NewSize` 和 `-XX:MaxNewSize`。显式设置会限制收集器的自适应调整能力，G1 官方明确不建议设置；在 Parallel 等分代收集器上，如果 GC 日志显示对象过早晋升老年代，才考虑调大。

不显式设置时，默认值由 JVM 根据可用内存和容器限制自适应计算（JDK 8u191+ 起能感知容器限额），不要再套"物理内存几分之几"的旧经验。

## 元空间：MetaspaceSize 与 MaxMetaspaceSize

JDK 8 移除永久代后，类元数据改存元空间，使用的是本地内存而非 Java 堆。

- `-XX:MaxMetaspaceSize`：元空间上限。默认不设上限，一旦动态代理、字节码生成框架失控，会持续吃掉本地内存拖垮整机。生产环境建议显式兜底（如 256m~512m），把故障降级为应用自身抛出 `OutOfMemoryError: Metaspace`。
- `-XX:MetaspaceSize`：最常见的误解是把它当成初始容量。它实际是**触发元数据 GC 的高水位阈值**，默认约 20MB（随平台而定）。应用加载类较多时，适当调大（如 128m）可以避免启动阶段频繁触发元数据 GC。

JDK 7 及以前的 `-XX:PermSize`、`-XX:MaxPermSize` 只对永久代有效，新工程里不应再出现。

## 线程栈：-Xss

`-Xss` 设置每个线程的栈大小，默认值随平台和 JVM 版本而变（Linux x64 上通常为 1MB 左右）。两个调整方向：递归调用深、报 `StackOverflowError` 时调大；线程数特别多、内存紧张时可以适度调小，用更小的单栈换更多的线程容量。没有明确症状时建议保持默认，它很少是性能瓶颈的来源。

## 垃圾收集器选择

- `-XX:+UseSerialGC`：单线程收集，适合客户端程序或非常小的堆。
- `-XX:+UseParallelGC`：吞吐优先，JDK 8 服务端模式的默认组合。
- `-XX:+UseG1GC`：兼顾吞吐与停顿，JDK 9+ 默认；常配合 `-XX:MaxGCPauseMillis=200` 设定停顿目标（软目标，不保证达成）。
- `-XX:+UseZGC`：亚毫秒级停顿的低延迟收集器，JDK 15 起生产可用，适合大堆、低延迟场景。

一般建议：JDK 8 留在 Parallel 或评估迁移 G1；JDK 11+ 直接用默认的 G1，确认有大堆低延迟诉求再上 ZGC。

## GC 日志

一切 GC 分析都从日志开始，生产环境没有理由不开。

JDK 8 及以前使用传统参数：

```bash
-XX:+PrintGCDetails -XX:+PrintGCDateStamps \
-Xloggc:/data/logs/gc-%t.log \
-XX:+UseGCLogFileRotation -XX:NumberOfGCLogFiles=10 -XX:GCLogFileSize=50M
```

JDK 9 起统一使用 `-Xlog`：

```bash
-Xlog:gc*:file=/data/logs/gc-%t.log:time,uptime,level,tags:filecount=10,filesize=50M
```

旧参数在新版本里可能被映射、弃用或直接失效，以目标 JDK 的 `java -Xlog:help` 输出为准。拿到日志后重点看三件事：Full GC 的频率、单次停顿的时长、老年代占用的增长趋势——它们分别对应"停得多不多、停得久不久、有没有漏"。

## OOM 现场保护

- `-XX:+HeapDumpOnOutOfMemoryError`：堆 OOM 时自动生成堆转储，成本为零，必开。
- `-XX:HeapDumpPath=/data/dumps/`：指定 dump 输出目录（只给目录时自动命名为 `java_pid<pid>.hprof`），注意挂载足够大的磁盘。
- `-XX:OnOutOfMemoryError="sh /data/bin/notify.sh"`：OOM 时执行指定脚本，常用于告警，用来重启进程要谨慎。
- `-XX:ErrorFile=/data/logs/hs_err_%p.log`：JVM 崩溃日志的位置，排查 native 层 crash 全靠它。

## 一份可套用的基础模板

以 4G 堆、G1、JDK 11+ 为例：

```bash
java \
  -Xms4g -Xmx4g \
  -XX:MaxMetaspaceSize=512m \
  -XX:+UseG1GC -XX:MaxGCPauseMillis=200 \
  -Xlog:gc*:file=/data/logs/gc-%t.log:time,uptime,level,tags:filecount=10,filesize=50M \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/data/dumps/ \
  -XX:ErrorFile=/data/logs/hs_err_%p.log \
  -jar app.jar
```

这套模板覆盖了内存边界、GC 可观测性和事故现场三件事。其余参数的调整都应以 GC 日志和压测数据为依据：先测量，再修改，最后验证，顺序不要反。

## 小结

- 堆：`-Xms` 与 `-Xmx` 设相同值；G1 下慎用 `-Xmn`。
- 元空间：重点是设 `MaxMetaspaceSize` 兜底；`MetaspaceSize` 是 GC 触发阈值，不是初始容量。
- GC 日志与 OOM dump 是事后排查的唯一依据，开销极低，没有理由不开。
- 收集器跟随 JDK 默认进化即可，有特殊诉求再显式指定。
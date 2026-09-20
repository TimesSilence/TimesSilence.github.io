---
title: "JDK监控和故障处理工具总结"
date: 2021-08-27 08:50:00
updated: 2021-08-27 08:50:00
permalink: knowledge/java/jvm/jdk-monitoring-and-troubleshooting-tools/
categories:
  - Java
tags:
  - JVM
  - 诊断工具
description: "明确 jps、jstat、jstack、jmap、jcmd、JConsole、VisualVM、Arthas 的分工，并按 CPU 飙高、内存泄漏、死锁三个场景串成排查工作流。"
---

JDK 自带的诊断工具常被当成零散命令来背，其实它们各有分工。本文先给每个工具一个明确定位，再按线上最高频的三个场景——CPU 飙高、内存泄漏、死锁——把它们串成可复用的排查工作流。

<!-- more -->

## 工具定位速览

### 命令行工具

- **jps**：入口工具，列出当前用户可见的 Java 进程及 pid。`jps -l` 显示主类全名或 jar 路径，`jps -v` 顺带打印 JVM 启动参数。一切排查从这里开始。
- **jstat**：轻量监控，持续观察类加载、内存、GC 的统计数据。`jstat -gcutil <pid> 1000` 每秒输出一次各代占用百分比与 GC 次数、耗时，是判断"GC 是否异常"的第一手数据；开销极小，适合在生产环境长时间挂起观察。
- **jstack**：生成线程快照，回答"每个线程此刻在干什么、在等什么锁"，用于定位死锁、线程阻塞与接口无响应。
- **jmap**：生成堆转储快照，回答"堆里到底装了什么"。`jmap -dump:live,format=b,file=heap.hprof <pid>` 会先触发一次 Full GC 再导出存活对象——对大堆意味着一次明显停顿，生产环境务必挑低峰期执行。
- **jcmd**：JDK 7 起提供的多功能入口，一条命令集成多种诊断能力：`jcmd <pid> VM.flags` 查看生效参数，`jcmd <pid> GC.heap_dump heap.hprof` 导出堆，`jcmd <pid> VM.native_memory summary` 查看本地内存（需启动时加 `-XX:NativeMemoryTracking=summary`）。记不住其他命令时，先 `jcmd <pid> help` 看它支持什么。

### 可视化工具

- **JConsole**：基于 JMX 的监控台，适合实时观察内存曲线与线程状态，线程页自带死锁检测按钮。
- **VisualVM**：多合一工具，整合监控、线程 dump、堆 dump 分析和方法级性能采样；Oracle JDK 9 起不再随包捆绑，需单独下载。
- **Arthas**：开源的在线诊断工具，attach 到运行中的进程后，无需重启即可 watch 方法入参与返回值、trace 调用链耗时、反编译查类来源，定位"这个接口为什么慢"比传统工具直接得多。常用 `dashboard` 看概览、`thread` 查线程、`trace`/`watch` 跟方法。

## 场景一：CPU 飙高

目标是找到吃 CPU 的线程，以及它在执行什么代码：

```bash
top -H -p <pid>          # 找到高 CPU 的线程号
printf "%x\n" <tid>      # 转成十六进制，jstack 里的 nid 是十六进制
jstack <pid> | grep -A 30 <nid_hex>
```

如果热点线程名字带 GC 字样，说明问题不在业务代码而是内存压力，应转去查 GC 日志；如果是业务线程反复停在同一方法上，可用 Arthas 的 `trace` 进一步看耗时分布。单次 jstack 可能错过瞬时现场，间隔几秒多打几次对比，结论更可靠。

## 场景二：内存泄漏

目标是先确认泄漏存在，再找到泄漏的对象是谁。

1. **观察趋势**：`jstat -gcutil <pid> 5s` 持续观察。老年代占用（O 列）在每次 Full GC 后都降不下去、水位不断抬升，是泄漏的典型特征。
2. **留存现场**：挑低峰期导出堆快照：

```bash
jcmd <pid> GC.heap_dump /data/dumps/heap.hprof
```

3. **离线分析**：把 dump 拉到本地，用 MAT 或 VisualVM 打开。MAT 的 Leak Suspects 报告会直接给出可疑对象与支配树（Dominator Tree），沿引用链找出谁在持有它们。
4. **对比验证**：条件允许时隔一段时间取两次 dump 对比，持续增长且始终无法回收的对象类型，基本就是泄漏源。

如果启动参数里开了 `-XX:+HeapDumpOnOutOfMemoryError`，OOM 发生时会自动留下 dump，但别等到那一天才做分析。

## 场景三：死锁

死锁的特征是相关线程全部 BLOCKED、应用 hang 住但 CPU 并不高。

jstack 会自动检测并报告死锁环：

```bash
jstack <pid> | grep -A 20 "Found.*deadlock"
```

输出会明确列出每个线程在等哪把锁、锁又被谁持有，顺着栈帧找到加锁代码即可。图形界面里，JConsole 的"检测死锁"按钮、Arthas 的 `thread -b`（找出阻塞了其他线程的线程）都能快速定位。

修复层面，绝大多数死锁源于加锁顺序不一致：给全局锁约定统一的获取顺序，或改用带超时的 `tryLock`，都能从根上规避。

## 小结

- jps 找进程，jstat 看趋势，jstack 看线程，jmap 与 jcmd 看堆，可视化工具做交互分析，Arthas 做在线深度诊断。
- 三个场景是同一个套路：先确认现象（top、jstat），再抓现场（jstack、heap dump），最后离线分析定位根因。
- 各工具的子命令随 JDK 版本演进，以目标版本的 `jcmd <pid> help` 和官方文档为准。
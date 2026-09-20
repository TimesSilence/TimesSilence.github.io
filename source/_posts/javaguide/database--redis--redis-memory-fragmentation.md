---
title: "Redis内存碎片详解"
date: 2021-04-08 13:05:00
updated: 2021-04-08 13:05:00
permalink: knowledge/database/redis/redis-memory-fragmentation/
categories:
  - 数据库
tags:
  - Redis
  - 内存碎片
description: "Redis 内存碎片的成因（jemalloc 尺寸档与释放不归还）、mem_fragmentation_ratio 解读、activedefrag 主动整理与运维处置。"
---

used_memory 看着不高，Redis 却被 OOM Killer 干掉了——多半是 RSS 悄悄膨胀。这类问题的根因是内存碎片，读懂分配器行为才能对症处理。

<!-- more -->

## 碎片从哪来

Redis 默认使用 jemalloc 分配内存。jemalloc 按固定的尺寸档（8、16、32、48 字节……）划分内存单元，申请多大就给最接近的一档：要 17 字节，实际分到 32 字节，中间 15 字节谁也用不上，这是内部碎片。另外 Redis 的 zmalloc 会在每次分配时多带一段头部空间记录分配大小，统计口径随之放大。

外部碎片来自运行期的增删改。删除 key 或 value 缩短后，释放的内存通常留在 jemalloc 手里而不还给操作系统；这些空洞大小不一、散布各处，新对象塞不进去就只能另开新页。长期高频修改大小不一的 value，物理内存里就形成"奶酪孔"式的空闲块：used_memory 降了，RSS 却纹丝不动。碎片本身不拖慢命令执行，但它实实在在抬高内存账单，并放大 fork 时写时复制的风险。

## 指标解读

```bash
redis-cli INFO memory | grep -E "used_memory:|used_memory_rss|mem_fragmentation_ratio"
```

- `used_memory`：分配器为存数据实际申请的总量。
- `used_memory_rss`：操作系统视角下进程占用的物理内存。
- `mem_fragmentation_ratio = used_memory_rss / used_memory`：碎片率。

比值在 1.0 到 1.1 附近属健康；持续超过 1.5 意味着存 2GB 数据要占 3GB 以上物理内存，值得介入。注意两点：一是 `rss - used` 的差值不全是碎片，还包含进程自身、共享库等开销；二是比值小于 1 不是"负碎片"，而是发生了 swap，比碎片严重得多，要立刻处理。碎片率高还意味着 bgsave fork 之后 COW 要复制的页更多，OOM 风险随写入量上涨。

## activedefrag 主动整理

4.0 起内置在线碎片整理，前提是使用 jemalloc。开启后在主线程里以小步快跑的方式扫描并搬移键值，把零散分配归并到紧凑的内存页，再释放空页。

```bash
config set activedefrag yes
# 碎片总量超过 100MB 才开始整理
config set active-defrag-ignore-bytes 100mb
# 碎片率超过 10% 才启动
config set active-defrag-threshold-lower 10
# 整理占用 CPU 的上下限（百分比），控制对线上延迟的影响
config set active-defrag-cycle-min 5
config set active-defrag-cycle-max 25
```

整理发生在主线程，CPU 档位给高了会出现延迟毛刺。建议先按保守阈值开启，盯紧延迟与碎片率两条曲线再逐步调。整理不是万能的：它只能搬移可移动的分配，若碎片主要来自分配器内部保留的脏页，收益有限；`active-defrag-threshold-upper`（默认 100）触发后会以最大力度整理，配置时注意别让 CPU 上限击穿延迟红线。另外 activedefrag 依赖 jemalloc 构建，自行编译换 libc malloc 的实例该功能无效。

## 运维建议

- 重启能彻底重排内存，但属于最坏的兜底手段：高可用架构下先 failover 把流量切走，再重启旧主，切勿直接重启无副本的主节点。
- 非 jemalloc 构建可试 `MEMORY PURGE` 让分配器归还脏页，但会阻塞主线程，低峰执行。
- 从源头减少：避免同一批 key 的 value 频繁在不同长度间伸缩；大 value 做压缩或拆分；升级版本享受 listpack 等紧凑编码。
- 监控同时画 used_memory 与 RSS 两条曲线并设碎片率告警，别只盯 used_memory，否则 OOM 来了都找不到原因。

## 小结

碎片 = 分配器尺寸档的内部浪费 + 释放不归还的外部空洞。mem_fragmentation_ratio 持续超 1.5 就该治理：优先 activedefrag 在线整理，重启只是兜底；比值小于 1 则去查 swap。内存告警永远 used 与 RSS 对照着看。
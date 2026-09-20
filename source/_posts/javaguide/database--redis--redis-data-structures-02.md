---
title: "Redis 3 种特殊数据类型详解"
date: 2021-03-20 11:51:00
updated: 2021-03-20 11:51:00
permalink: knowledge/database/redis/redis-data-structures-02/
categories:
  - 数据库
tags:
  - Redis
  - Bitmap
  - HyperLogLog
description: "讲透 Redis Bitmap、HyperLogLog、GEO 三种特殊类型及 Stream、布隆过滤器的适用边界：签到与在线状态、UV 统计的误差来源、GeoHash 降维原理、轻量消息队列的定位。"
---

Bitmap、HyperLogLog、GEO 是 Redis 在基本类型之上长出的三把「特种刀」：Bitmap 把布尔状态压缩到比特级，HyperLogLog 用 0.81% 的误差换 12KB 统计上亿 UV，GEO 借 GeoHash 把二维坐标塞进一维 score。再加上 Stream 和布隆过滤器插件，几乎覆盖了计数、位置、消息、判重四类边缘但高频的场景。

<!-- more -->

## 它解决什么问题

基本类型解决不了的问题往往出在「规模」上：一亿用户的签到状态用 Set 存，每个用户一年要几百字节，成本高到不可接受；精确统计 UV 要存下全部访客 ID，内存随基数线性膨胀；「附近的人」本质是二维范围查询，哈希表和跳表都不直接支持经纬度。特殊类型的共同思路是**放弃一部分精确性或通用性，换取数量级的空间节省**：Bitmap 只存 0/1，HyperLogLog 只给估计值，GEO 把二维问题降维成一维后复用 ZSet。理解每把刀「放弃了什么」，比记住命令更重要。

## 核心原理

**Bitmap** 不是独立类型，而是作用在 String 上的一组位操作：字符串是二进制安全的字节数组，把它看成比特数组，offset 就是下标。一个比特表达一个布尔状态，一亿个状态只占约 12MB。

**HyperLogLog** 是概率型基数估计算法：把每个元素哈希成均匀分布的比特串，观察前导零的最大长度——抛硬币连续抛出 k 次正面的概率是 2^-k，反过来，观测到最长连续 k 次正面，就说明大约抛过 2^k 次。Redis 用 16384 个寄存器分桶取调和平均来压低方差，稠密表示下固定约 12KB，标准误差约 0.81%。误差来源有三：哈希碰撞本身、分桶平均对极端值的敏感、小基数段改用线性计数的分段估计。所以它只能回答「大概多少」，回答不了「都有谁」。

**GEO** 基于 ZSet 实现：经纬度各是一个维度，GeoHash 把两个维度的二进制位交错拼接成一个 52 位整数，二维点就被压成了一维 score。这样「附近」就近似转化为「score 前缀相近」，范围查询复用跳表能力。边界上的点可能 GeoHash 值相差很远，所以实现时要连相邻网格一起查，这是 GeoHash 方案的经典补丁。

## 深入机制

### Bitmap：签到与在线状态

按「用户 + 月份」设计 key，日期做 offset，一个 key 表达一个用户一个月的签到轨迹：

```bash
SETBIT sign:1001:202609 2 1
GETBIT sign:1001:202609 2
BITCOUNT sign:1001:202609
```

在线状态则反过来，按日期建 key、uid 做 offset，BITCOUNT 即当日活跃数；对多天的 key 做 BITOP AND 可得连续活跃。要注意 offset 直接决定内存上限：给 offset 一亿置位，即使只有一个用户，这个 key 也要占约 12MB，稀疏场景务必先对 uid 做稠密映射。

### HyperLogLog：UV 统计

```bash
PFADD uv:article:1024 192.168.1.1 192.168.1.2
PFCOUNT uv:article:1024
PFMERGE uv:total uv:a uv:b
```

PFADD 判重、PFCOUNT 出估计、PFMERGE 可跨分片合并，三条命令就是全部 API。它适合「数量大、允许误差、只需总数」的场景；黑名单、风控名单这类要求精确判在不在的需求，HyperLogLog 完全无能为力，那是布隆过滤器的地盘。

### GEO：附近的人

```bash
GEOADD shop 116.40 39.90 "store:1" 116.41 39.91 "store:2"
GEODIST shop store:1 store:2 km
GEOSEARCH shop FROMLONLAT 116.40 39.90 BYRADIUS 3 km ASC COUNT 10
```

因为底层就是 ZSet，ZREM 可以直接删点，ZSCORE 能看到那个 52 位的 GeoHash 整数。注意 Redis 6.2 起 GEORADIUS 系列被标记废弃，新代码用 GEOSEARCH。另外 GEO 是内存方案，百万级 POI 加高频更新要评估内存与热点，专业地图检索仍应交给 GIS 引擎。

### Stream：消息队列的雏形

Stream 是为消息而生的追加日志：每条消息有全局递增 ID（毫秒时间戳 + 序号），支持消费组、ACK 和 pending 列表。

```bash
XADD mq:order * order-id 1001 amount 99
XGROUP CREATE mq:order g1 0 MKSTREAM
XREADGROUP GROUP g1 c1 COUNT 10 STREAMS mq:order >
XACK mq:order g1 1700000000000-0
XPENDING mq:order g1
```

消费者崩溃后，消息留在 pending 列表里，可用 XCLAIM/XAUTOCLAIM 把滞留消息转移给其他消费者——这正是 List 队列缺的那块可靠性。但要清醒定位：它是「雏形」，没有磁盘多副本、没有丰富生态，堆积能力与 Kafka 不在一个量级。中小业务、允许少量丢失、不想引入 MQ 依赖时用它；核心交易链路仍应选专业 MQ。

### 布隆过滤器插件

布隆过滤器用「位数组 + 多个哈希函数」回答「一定不存在或可能存在」：多个哈希位全为 1 才判存在，所以有假阳性、无假阴性，且不能删除（计数布隆除外）。Redis 官方模块 RedisBloom 提供 BF.ADD/BF.EXISTS/BF.RESERVE：

```bash
BF.RESERVE bf:user 0.01 1000000
BF.ADD bf:user 1001
BF.EXISTS bf:user 1002
```

经典用途是挡缓存穿透：查询先过布隆，判不存在直接返回，恶意构造的不存在 key 就打不到数据库。误判率由位数组大小和哈希个数决定，初始化时按预期容量和可接受误判率预留。

## 工程实践

- Bitmap 的 key 设计决定内存效率，uid 稀疏时先做映射再置位。
- HyperLogLog 的 0.81% 误差意味着 100 万 UV 可能偏差八千上下，对外报表要先和业务确认口径。
- GEO 的距离单位（m/km）和坐标系（GPS 与火星坐标）是线上事故高发区，入库前统一换算。
- Stream 消费组要定期巡检 pending 列表长度，它是消费者健康度的直接信号。

## 对比与权衡

| 结构 | 解决的问题 | 放弃了什么 | 内存特征 |
| --- | --- | --- | --- |
| Bitmap | 布尔状态、签到、在线 | 只能表达 0/1 | 每状态 1 bit |
| HyperLogLog | 大规模基数估计 | 精确值、成员枚举 | 固定约 12KB |
| GEO | 附近检索 | 精度与专业 GIS 能力 | 等同 ZSet |
| Stream | 轻量可靠消息 | 堆积规模与生态 | 随消息量增长 |
| 布隆过滤器 | 存在性预判 | 有假阳性、不可删 | 按误判率可算 |

## 面试视角

**HyperLogLog 为什么不精确？** 它不存元素本身，只存哈希值前导零最大长度的统计量，基数是从统计规律反推的估计值。误差来自哈希分布的随机性，分桶调和平均把方差压到 0.81% 的标准误差，但数学上无法归零。

**GEO 怎么把二维查询变成一维查询？** GeoHash 将经纬度的二进制位交错编码成一个整数，空间相近的点大概率共享前缀。Redis 把这个整数作为 ZSet 的 score，范围查询就近似转化为 score 区间扫描；为修正边界问题，实现上会连带搜索相邻网格。

**Stream 和 List 做队列差在哪？** List 取出即丢失，没有消费确认；Stream 有消费组、ACK、pending 列表和消息转移，崩溃可恢复。但相比专业 MQ，它缺少副本持久化与海量堆积能力，定位是轻量替代。

**布隆过滤器会误判吗？** 只会假阳性不会假阴性：判「存在」可能是别的元素哈希碰巧凑齐了位，判「不存在」一定准确。也因此它不能删除元素，删除会把别的元素的哈希位一并清掉。

## 小结

- 特殊类型的统一思想是用精确性或通用性换空间：Bitmap 换表达力，HyperLogLog 换精确度，GEO 换维度。
- HyperLogLog 的 0.81% 误差是概率算法的数学下限，工程上只需确认业务能接受。
- GEO 的核心是 GeoHash 降维，Stream 的核心是 ACK 与 pending，布隆的核心是假阳性——记住这三点，选型不会跑偏。
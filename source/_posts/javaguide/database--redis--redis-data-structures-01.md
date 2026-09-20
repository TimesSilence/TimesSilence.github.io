---
title: "Redis 5 种基本数据类型详解"
date: 2021-03-10 10:44:00
updated: 2021-03-10 10:44:00
permalink: knowledge/database/redis/redis-data-structures-01/
categories:
  - 数据库
tags:
  - Redis
  - 数据结构
description: "从真实业务场景出发，讲透 Redis String、List、Hash、Set、ZSet 五种基本类型的适用边界、核心命令与 int/embstr/raw、listpack/hashtable 等内部编码的转换逻辑。"
---

Redis 的五种基本类型不是教科书里的抽象结构，而是五个各有脾气的工具：String 管缓存与计数，List 管顺序流，Hash 管对象，Set 管去重与关系运算，ZSet 管排序。选对类型往往比写对命令更重要——选型的本质是在时间复杂度、内存占用和功能语义之间做取舍。

<!-- more -->

## 它解决什么问题

业务里最常见的需求无非几类：把数据库结果缓存起来、给页面或接口计数、维护一个「最新动态」列表、存一份可以局部修改的用户资料、统计去重后的访客、做排行榜。如果全都塞进 String 存 JSON 序列化串，计数要自己读改写、改一个字段要整体回写、排序要在应用层做，既慢又容易出并发问题。Redis 把这几类高频模式抽象成五种类型，每种类型配上原子命令，让「读-改-写」三步合并成服务端的一次操作，顺带解决了并发竞争。

更关键的是，每种类型都有「紧凑」和「标准」两套实现：数据小用省内存的紧凑编码，数据变大自动切换成读写更快的通用编码。理解这套转换，是预估内存、排查大 key 的前提。

## 核心原理

五种类型与底层结构的对应关系可以概括为一句话：**小数据用紧凑顺序结构省内存，大数据用哈希表、跳表等结构换速度**。

- String 底层是 SDS（简单动态字符串），自带长度字段，取长度 O(1)，且二进制安全，可存任意字节。
- List 在 Redis 3.2 后统一用 quicklist：宏观是双向链表，每个节点内部是一小段紧凑存储。
- Hash、Set、ZSet 都是双编码：元素少且短时走紧凑结构（Redis 7 起全面使用 listpack，此前是 ziplist），超阈值后分别转 hashtable、hashtable、skiplist+dict。
- Set 有特例：元素全是整数时先用 intset（有序整数数组），省内存还能二分查找。

listpack 取代 ziplist 的原因值得记住：ziplist 的 entry 要记录前一个 entry 的长度，中间插入变长 entry 可能引发后续长度字段连锁扩大，即级联更新；listpack 只记录当前 entry 长度并支持反向解析，根除了这个问题。定性理解即可：「小而紧凑、大而通用」的设计哲学没变。

## 深入机制

下面给每种类型一套「场景 + 命令 + 内部编码」三件套。

### String：缓存、计数、锁

典型场景是缓存对象 JSON、页面访问量计数、用 `SET key value NX EX` 抢分布式锁。

```bash
SET session:u1001 '{"name":"tom","age":24}' EX 3600
INCR article:1024:pv
SET lock:order:9 request-id NX EX 30
OBJECT ENCODING session:u1001
```

内部编码三种：`int`（值能表示为 long 的整数，直接存数字，INCR 最快）、`embstr`（短字符串，SDS 和对象头一次分配，Redis 中阈值约 44 字节）、`raw`（长字符串，两次分配）。对 embstr 执行 APPEND 这类修改会先转成 raw，所以短字符串反复追加并不占便宜。

### List：最新动态与简单队列

典型场景是「最新 N 条」信息流（LPUSH + LTRIM 固定窗口）、以及要求不高的任务队列（LPUSH + BRPOP 阻塞消费）。

```bash
LPUSH feed:u1001 "article:99"
LTRIM feed:u1001 0 99
BRPOP task:queue 5
```

编码为 quicklist（Redis 7 起节点内部用 listpack 填充），头尾操作 O(1)，但按索引定位中间元素是 O(N)，别把它当随机访问数组用。LRANGE 分页适合小范围翻看，不适合深度翻页。

### Hash：可局部修改的对象

典型场景是用户资料、商品信息、购物车——字段多但常只改其中一两个，比存整个 JSON 串省一次整体回写。

```bash
HSET user:1001 name "tom" age 24
HINCRBY user:1001 age 1
HGETALL user:1001
```

编码转换由两个配置控制：`hash-max-listpack-entries`（默认 128）和 `hash-max-listpack-value`（默认 64 字节），任一超出即从 listpack 转 hashtable。注意 HGETALL 对超大 hash 是 O(N) 操作，字段上万后应按业务拆分。

### Set：去重与集合运算

典型场景是标签、点赞名单、共同好友（SINTER 求交集）、抽奖（SPOP 不重复中奖、SRANDMEMBER 允许重复）。

```bash
SADD follow:u1 u2 u3 u4
SINTER follow:u1 follow:u5
SPOP lottery:pool 3
```

编码：全整数且元素数不超过 `set-max-intset-entries`（默认 512）用 intset；小集合在 Redis 7.2 后也可用 listpack 兜底；否则转 hashtable，member 做 key、value 置空，SISMEMBER 因此是 O(1)。

### ZSet：排行榜与延迟队列

member 唯一、按 score 排序，score 相同按 member 字典序兜底。典型场景：实时排行榜、以时间戳为 score 的延迟任务、滑动窗口限流。

```bash
ZADD rank 980 user:1001 870 user:1002
ZRANGE rank 0 9 REV WITHSCORES
ZRANGEBYSCORE delay:queue 0 1700000000 LIMIT 0 100
```

编码：元素少且短用 listpack（阈值 `zset-max-listpack-entries` 128、`zset-max-listpack-value` 64），否则转 skiplist + dict——dict 保证按 member 查 score 是 O(1)，跳表保证范围查询和排名是 O(log N)，两者各司其职。

## 工程实践

- 用 `OBJECT ENCODING key` 观察真实编码；升级大版本后阈值变化可能改变内存占用，上线前抽查热点 key。
- 对可能变大的 Hash/ZSet 提前规划拆分键（如按 uid 取模），避免单 key 成为大 key。
- List 做队列没有 ACK 语义，消费者宕机消息即丢失；要可靠投递请换 Stream 或专业 MQ。
- String 存对象前先想清楚是否需要局部更新——需要就换 Hash。

## 对比与权衡

| 类型 | 一句话场景 | 代表命令 | 紧凑编码 | 标准编码 |
| --- | --- | --- | --- | --- |
| String | 缓存、计数、锁 | SET/GET/INCR | int/embstr | raw |
| List | 最新动态、简单队列 | LPUSH/BRPOP/LRANGE | quicklist(listpack) | quicklist |
| Hash | 对象局部更新 | HSET/HINCRBY | listpack | hashtable |
| Set | 去重、交并差 | SADD/SINTER | intset/listpack | hashtable |
| ZSet | 排行、延迟、限流 | ZADD/ZRANGEBYSCORE | listpack | skiplist+dict |

## 面试视角

**String 的三种编码怎么切换？** 能解析为 long 的值用 int；短字符串用 embstr（对象头和 SDS 一次内存分配，只读友好）；超过阈值或发生修改用 raw。embstr 被修改时会先转 raw，且不可逆。

**为什么 Hash 比 String 存 JSON 更适合对象缓存？** 三个原因：字段级读写不用整体序列化反序列化；HINCRBY 等命令可原子改单字段；小对象走 listpack 比 JSON 串更省内存。代价是字段很多时 hashtable 的桶开销会反超。

**ZSet 为什么同时需要跳表和哈希表？** 跳表负责「按 score 的顺序和范围」，哈希表负责「按 member 的 O(1) 定位」。只用跳表则 ZSCORE 退化为 O(log N)，只用哈希表则范围查询无从下手。

**List 能当消息队列用吗？** 能跑但不可靠：没有消费确认和重投机制，BRPOP 取走即丢失。要 ACK、pending 列表、消费组，应该用 Stream。

## 小结

- 五种类型对应五类高频业务模式，选型先看语义匹配，再看时间复杂度。
- 每种类型都有紧凑编码兜底小数据，Redis 7 起 ziplist 全面被 listpack 替代，核心是消除级联更新。
- 编码阈值由配置控制，用 OBJECT ENCODING 验证而不是凭印象。
- ZSet 的 skiplist+dict 双结构是「一种数据两种视图」的经典设计，值得反复体会。
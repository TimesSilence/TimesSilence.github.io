---
title: "Redis常见阻塞原因总结"
date: 2021-03-01 09:37:00
updated: 2021-03-01 09:37:00
permalink: knowledge/database/redis/redis-common-blocking-problems-summary/
categories:
  - 数据库
tags:
  - Redis
  - 阻塞
  - 慢查询
description: "Redis 延迟尖刺的五类常见根因：大 key、慢命令、fork、AOF fsync、swap 与透明大页，逐一给出症状、原因与处置。"
---

Redis 单线程执行命令，任何一处卡顿都会放大成全实例的延迟尖刺。本文按"症状、原因、处置"梳理五类最常见的阻塞源，并给出排查工具清单。

<!-- more -->

## 大 key 的删除与扫描

**症状**：客户端偶发超时，超时时间点与某个大 key 的过期或删除吻合。string 超 1MB、集合类元素超 5000 个即可视为大 key。

**原因**：DEL 对集合类 key 是 O(N) 操作，释放内存时分配器还要把大量内存块串回空闲链表，主线程全程被占。批量读取大 key 同样耗时，还会打满网卡。

**处置**：4.0+ 用 `UNLINK` 替代 `DEL`，把释放动作丢给后台线程；`FLUSHALL ASYNC` 同理；给集合类 key 拆分或分片存储。找大 key 用 `redis-cli --bigkeys`（在从节点跑）或离线分析 RDB 文件，别在主节点扫。

## O(n) 命令与慢查询

**症状**：QPS 不高但 P99 飙高，`SLOWLOG GET` 里躺着 `KEYS`、`HGETALL`、`SMEMBERS`、大范围 `LRANGE` 或多集合 `SUNION`。

**原因**：这些命令时间复杂度 O(N) 甚至更高，N 一大就把主线程摁住，后续命令全部排队。慢查询日志只记录执行耗时，不含排队与网络时间，所以实际影响比日志更严重。

**处置**：生产禁用 `KEYS`、`FLUSHALL`（可用 rename-command 改名）；遍历改用 `SCAN`/`HSCAN`/`SSCAN`/`ZSCAN` 分批游标；给 `slowlog-log-slower-than` 设合理阈值并接入监控。

## fork 延迟

**症状**：`INFO stats` 里 `latest_fork_usec` 数值大，bgsave 或 AOF 重写启动瞬间全实例请求毛刺。

**原因**：bgsave、AOF 重写、主从全量同步都要 fork，fork 在主线程复制页表，数据集越大越慢；fork 后写时复制持续吃内存，高写入下额外开销可观。

**处置**：控制单实例内存规模；避免高峰手动 BGSAVE；监控 `latest_fork_usec` 与 `rdb_last_cow_size`；设 `vm.overcommit_memory=1` 防 fork 失败。

## AOF fsync 阻塞

**症状**：磁盘抖动时 P99 周期性冲高，`INFO persistence` 中 `aof_delayed_fsync` 持续增长。

**原因**：`appendfsync everysec` 下后台线程每秒 fsync；磁盘繁忙导致上一次 fsync 超过 2 秒未完成时，主线程 write 会被迫等待，全实例被拖住。`always` 模式更是每条命令同步刷盘。

**处置**：坚持用 everysec；AOF 放独立磁盘（SSD 优先）；用 `aof_delayed_fsync` 做告警，磁盘 I/O 饱和先治磁盘。

## swap 与透明大页

**症状**：无任何慢命令，整体延迟却劣化几个数量级。

**原因**：内存不足时内核把 Redis 的热页换到磁盘，访问即触发缺页，内存数据库沦为磁盘数据库。THP 则让 fork 后 COW 的复制粒度从 4KB 变 2MB，内存瞬间膨胀，进一步诱发 swap 或 OOM。

**处置**：查 `/proc/<pid>/smaps` 里的 Swap 项，非零即告警；保证内存余量并设 maxmemory；`vm.swappiness` 调到 0 或 1；`echo never > /sys/kernel/mm/transparent_hugepage/enabled` 关闭 THP。

## 其他隐蔽来源

除上述五类，还有两个容易被忽略的放大器：一是 CPU 竞争，Redis 与 CPU 密集型服务混部时吞吐会被拖垮，用 `redis-cli --stat` 和 `INFO commandstats` 定位异常命令开销；二是集群扩缩容的数据迁移，迁移大 key 时两端同步阻塞，严重时会误判故障触发切换，大 key 应先拆分再迁移。

## 排查工具速查

```bash
redis-cli SLOWLOG GET 10        # 最近的慢命令
redis-cli --bigkeys             # 采样找大 key（从节点执行）
redis-cli --latency             # 观测客户端视角延迟
redis-cli INFO stats            # latest_fork_usec
redis-cli INFO persistence      # aof_delayed_fsync、fork 相关
```

## 小结

阻塞排查就盯五条线：大 key 用 UNLINK 与拆分治理，慢命令靠 SCAN 系替换和慢日志暴露，fork 延迟靠控制实例规模与监控毛刺，fsync 阻塞先查磁盘再看策略，swap 与 THP 属于系统层必须提前关掉的雷。线上尖刺来了，先翻 slowlog 和 persistence 指标，比盲猜快得多。
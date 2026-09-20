---
title: "Raft 算法详解：Leader 选举、日志复制、安全性与成员变更"
date: 2023-08-25 13:35:00
updated: 2023-08-25 13:35:00
permalink: knowledge/distributed-system/protocol/raft-algorithm/
categories:
  - 分布式系统
tags:
  - Raft
  - 共识算法
  - Leader选举
description: "Raft 的 Leader 选举、日志复制与安全性约束推导，与 Paxos 的理解成本对比及 etcd、Consul 实践。"
---

Raft 为"可理解性"而生：把共识拆成 Leader 选举、日志复制、安全性三个相对独立的子问题，用强 Leader 模型换取清晰的状态机。本文按任期、随机超时、多数派、日志匹配特性、commit 条件的顺序推演 Raft 如何保证复制日志永不分叉，并落到 etcd、Consul 等真实实现。

<!-- more -->

## 它解决什么问题

与 Paxos 相同，Raft 要在节点会宕机、网络会抖动的环境里维护一组完全一致的复制日志，让集群表现得像一台状态机。不同之处在于出发点：Ongaro 与 Ousterhout 在 2014 年的论文中明确说，Raft 的第一设计目标是可理解性——Paxos 的正确性毋庸置疑，但骨架式描述让实现者无所适从。于是 Raft 主动做减法：日志只能从 Leader 流向 Follower，选举必须选出"日志足够新"的节点，用这些强约束换推理上的简单。效果确实达到了：今天 etcd、Consul、TiKV 都建立在 Raft 之上。

## 核心原理

### 任期与角色

时间被切成连续的任期（term），每个任期以选举开场，至多产生一位 Leader，也可能因分票而没有 Leader。节点在任意时刻处于三种状态之一：Follower 被动应答；Candidate 是选举期间的过渡角色；Leader 独占写路径，周期性发心跳维持权威。term 充当逻辑时钟：每次 RPC 都携带发送方的 term，收到更高 term 的节点立刻更新本地值并退回 Follower；收到过期 term 的请求直接拒绝。每条日志是 <term, index, command> 三元组。

### Leader 选举

Follower 收不到心跳超过选举超时就变身 Candidate：term 加一，先投自己，再向全集群发 RequestVote。拿到多数票（N/2+1）即当选。分票导致无人过半时，本轮任期作废，等待下一次超时重选。Raft 用随机化选举超时（如 150~300ms 区间内的随机值）让节点错开苏醒时刻，绝大多数情况下只有一个节点率先发起选举并一次成功。时间参数的经验公式是 broadcastTime << electionTimeout << MTBF：心跳往返要比超时小一个数量级，超时又要远小于机器平均无故障时间。

## 深入机制

### 日志复制与日志匹配特性

Leader 把客户端命令追加到本地日志，然后向所有 Follower 发送 AppendEntries RPC。请求中除了新日志，还带 prevLogIndex 与 prevLogTerm——Leader 眼中"这条新日志的前一条"。Follower 核对本地该位置：term 相符才追加，否则拒绝。这个一致性检查归纳出日志匹配特性（Log Matching Property）：两份日志若在相同 index 处有相同 term 的条目，那么该位置之前的所有条目必然完全相同。也就是说日志从不开叉，任何两个节点对已对齐的前缀拥有一致的判断。

冲突修复围绕 nextIndex 展开：Leader 为每个 Follower 维护"下一条该发的位置"，初值设为自己日志末尾加一；被拒绝就回退重试（工程实现会让 Follower 返回冲突 term 的边界索引，一次性跳过整段，不必逐条试探），找到共同前缀后，Follower 删除分叉点之后的条目，原样复制 Leader 的日志。

### commit 条件与安全性

一条日志复制到多数派后，Leader 才能推进 commitIndex，并按序应用到状态机。但有一条容易忽略的附加规则：Leader 只允许对"当前任期产生的日志"用多数派计数方式提交，旧任期遗留的日志只能随当前任期新日志的提交被间接提交——因此新 Leader 上任通常先追加一条 no-op。这条规则堵住了论文 Figure 8 展示的场景：旧任期日志即使已复制到多数节点，仍可能被拥有更长日志的新 Leader 覆盖，若提前判定其已提交，就会丢失已确认的数据。

选举限制是另一道闸门：Candidate 拉票时附上自己最后一条日志的 (term, index)，投票者若发现自己的日志更新（先比 term，再比 index）就拒绝投票。由此得到 Leader 完整性：任何任期的 Leader 都包含之前所有已提交的日志，日志永远只从 Leader 流向 Follower，Leader 绝不改写自己已有的条目。

## 工程实践

- etcd 的 raft 库是使用最广泛的生产实现之一，Consul、TiKV 同样以 Raft 为底座。
- 超时参数要匹配网络环境：跨机房 RTT 大就相应调大选举超时，否则心跳稍抖就触发无意义选举，监控上表现为 leader changes 频繁。
- Pre-Vote 扩展在正式自增 term 前先"预投票"，被隔离节点反复自增 term 后回归集群时不会逼宫现任 Leader，etcd 等实现均已内置。
- 读请求要线性一致可走 ReadIndex 或带租约的 Lease Read，不必让读也过一遍日志复制。
- 成员变更采用 Joint Consensus：先切到新旧配置的联合多数派，再过渡到新配置，避免一步切换造成两个互不重叠的多数派同时存在。

## 对比与权衡

| 维度 | Raft | Multi-Paxos |
| --- | --- | --- |
| 日志形态 | 严格连续，无空洞 | 槽位独立，允许空洞与乱序提交 |
| Leader | 强 Leader，唯一日志源 | 弱 Leader，可缺省、可随时更换 |
| 选举约束 | 必须日志足够新才能当选 | 无此约束，靠重跑 Prepare 收集历史 |
| 理解成本 | 论文含完整实现细节，易于落地 | 骨架留白多，落地分叉大 |
| 代表实现 | etcd、Consul、TiKV | Chubby、Spanner（内部实现） |

## 面试视角

**Raft 为什么比 Paxos 好懂？** 两点：问题被拆成选举、复制、安全三个可独立理解的子问题；强 Leader 约束让日志单向流动，推理时不用考虑多提案者并发交叉，状态空间小得多。

**一条日志何时算提交？** 复制到多数派且属于 Leader 当前任期，Leader 才推进 commitIndex；旧任期日志不单独计数提交，只能随当前任期的新日志（常见为 no-op）间接提交，防止旧日志被后续 Leader 覆盖造成已提交数据丢失。

**选举时如何保证新 Leader 不丢已提交数据？** 投票者会比较双方最后一条日志的 term 和 index，日志比候选人新就拒投。已提交日志必然存在于多数派中，多数派里至少一票会挡住日志落后的候选人，这就是 Leader 完整性的来源。

**网络分区时 Raft 的表现？** 多数派一侧继续选举与服务，少数派凑不齐选票也无法提交新日志。被隔离的旧 Leader 恢复后收到更高 term 的心跳即退位，并修复自己多出的未提交日志。

**Follower 日志落后很多怎么追？** Leader 按 nextIndex 回退定位共同前缀后批量补发；落后太多时直接发送 InstallSnapshot 快照，让 Follower 先整体替换状态再追增量。

## 小结

- Raft 用 term 做逻辑时钟，用随机超时加多数派完成选举，用 prevLogIndex/prevLogTerm 的一致性检查维持日志匹配特性。
- 两条安全性铁律：只按多数派提交当前任期日志；只投票给日志足够新的候选人。
- 与 Paxos 相比，Raft 牺牲了部分灵活性（无空洞、强 Leader），换来可完整实现、可验证的描述，这是 etcd 与 Consul 们选择它的根本原因。
- 生产运维盯住三件事：选举超时与网络 RTT 是否匹配、leader changes 频率、成员变更必须走 Joint 配置。
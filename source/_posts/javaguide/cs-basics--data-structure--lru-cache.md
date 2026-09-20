---
title: LRU 缓存面试题总结：哈希表、双向链表与 LinkedHashMap
date: 2018-12-27 10:14:00
updated: 2018-12-27 10:14:00
permalink: knowledge/cs-basics/data-structure/lru-cache/
categories:
  - 计算机基础
tags: [数据结构, 缓存, LRU]
description: "拆解 LRU 缓存的复合结构设计：哈希表负责 O(1) 定位，双向链表维护新旧次序，并延伸到 LinkedHashMap、并发安全与 Caffeine 的 W-TinyLFU。"
---

LRU（Least Recently Used）在缓存满时淘汰最久未被访问的条目。要让读写都是 O(1)，必须组合两种结构：哈希表解决按键定位，双向链表解决新旧次序的维护与尾部淘汰。它既是高频面试题，也是理解真实缓存系统（LinkedHashMap、Caffeine、Redis）的起点。

<!-- more -->

## 它解决什么问题

缓存容量永远有限，而访问流无限。缓存写满后新数据还要进来，就必须决定淘汰谁。理想答案是"未来最久才会被用到的那个"，但程序无法预知未来，只能找代理指标。LRU 用过去近似未来：刚被访问的数据大概率还会再被访问（时间局部性），最久没被碰的优先出局。这个启发式简单有效，成为本地缓存、操作系统页面置换、数据库 Buffer Pool 的常见默认策略。

实现层面的挑战在于：淘汰决策需要完整的"新旧次序"，而读写路径又要求按键快速定位——单一结构同时满足不了这两个需求。

## 核心原理

### 单一结构为什么都不够

只用哈希表：get/put 是 O(1)，但哈希表不记录任何时间信息，容量满时无从得知哪个 key 最久未用。只用链表：可以按访问时间排序（头新尾旧），淘汰尾部是 O(1)，但每次按 key 找节点都要 O(n) 扫一遍，读写路径被拖垮。

### 复合结构：哈希表 + 双向链表

把两者拼起来正好互补：哈希表存 `key -> 链表节点`，负责 O(1) 定位；双向链表按访问时间排序，头部是最近使用，尾部是最久未使用。每次访问（无论读还是写）都把命中的节点摘下重新挂到头部；淘汰时砍掉尾节点，并同步从哈希表删掉它的 key。节点里必须同时存 key 和 value——淘汰尾节点时要靠 key 反向清理哈希表项。

### 为什么必须是双向链表

"把任意节点移到头部"分解为两步：从原位置摘除，再插入头部。摘除节点需要把它的前驱和后继接起来。单链表节点只有后继指针，即使哈希表直接给出节点本身，也拿不到它的前驱，只能从头遍历，O(1) 目标就此破产。双向链表的前驱指针让摘除变成两句赋值：

```java
n.before.after = n.after;
n.after.before = n.before;
```

再配上一对不存数据的哨兵头尾节点（dummy head/tail），插入头部、删除尾部、空链表全走同一套代码，边界分支全部消失。

## 深入机制

### get / put 的 O(1) 推演

```java
class LRUCache {
    private final int capacity;
    private final Map<Integer, Node> lookup = new HashMap<>();
    private final Node dummyHead = new Node(0, 0);   // 哨兵头
    private final Node dummyTail = new Node(0, 0);   // 哨兵尾

    LRUCache(int capacity) {
        this.capacity = capacity;
        dummyHead.after = dummyTail;
        dummyTail.before = dummyHead;
    }

    int get(int key) {
        Node hit = lookup.get(key);              // O(1) 定位
        if (hit == null) return -1;
        refresh(hit);                            // 读也是访问：刷新新旧次序
        return hit.val;
    }

    void put(int key, int value) {
        Node hit = lookup.get(key);
        if (hit != null) {                       // 命中：更新值并提为最新
            hit.val = value;
            refresh(hit);
            return;
        }
        Node created = new Node(key, value);     // 未命中：新节点直接挂到头部
        lookup.put(key, created);
        linkFront(created);
        if (lookup.size() > capacity) {          // 超容量：淘汰最旧的尾部
            Node victim = evictLast();
            lookup.remove(victim.key);
        }
    }

    private void refresh(Node n) { unlink(n); linkFront(n); }

    private void linkFront(Node n) {
        n.before = dummyHead;
        n.after = dummyHead.after;
        dummyHead.after.before = n;
        dummyHead.after = n;
    }

    private void unlink(Node n) {
        n.before.after = n.after;
        n.after.before = n.before;
    }

    private Node evictLast() {
        Node n = dummyTail.before;
        unlink(n);
        return n;
    }

    private static class Node {
        int key, val;
        Node before, after;
        Node(int k, int v) { key = k; val = v; }
    }
}
```

逐步推复杂度：get 是一次哈希查找加两组链表指针操作（摘除、头插），全是常数；put 的命中路径同理，未命中路径多出一次 evictLast 和哈希表删除，仍是常数。每个基础操作只动固定数量的指针，与缓存里已有多少数据无关，因此 get/put 都是 O(1)，空间 O(capacity)。

一个易错点值得单独强调：get 命中必须移动节点。读操作同样刷新"最近使用时间"，漏掉这步，LRU 就退化成 FIFO。

容量 2 的缓存依次执行 `put(1,1) → put(2,2) → get(1) → put(3,3)`，链表（左新右旧）变化为：`1` → `2,1` → `1,2` → `3,1`——最终淘汰的是 2，而不是最早进入的 1，因为 get(1) 把它刷新到了头部。

## 工程实践

### LinkedHashMap：JDK 自带的半成品

`LinkedHashMap` 内部就是哈希表加双向链表。构造时把第三个参数 `accessOrder` 设为 `true`，链表顺序便从插入序切换为访问序，再重写淘汰钩子即可：

```java
class LinkedHashMapLRU extends LinkedHashMap<Integer, Integer> {
    private final int capacity;

    LinkedHashMapLRU(int capacity) {
        super(capacity, 0.75f, true);            // accessOrder = true
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
        return size() > capacity;                // 插入后回调，返回 true 则删掉最旧项
    }
}
```

十来行得到一个正确的 LRU，但它不是线程安全的，且节点开销比普通 HashMap 更大，只适合演示与极轻量场景。

### 并发安全：get 也是写操作

LRU 的并发难点比一般 Map 更隐蔽：get 命中要改链表指针，本质上是写。两个线程同时 get 不同的 key，也会竞争同一条链表。常见演进路径：

- 用一把锁包住 get/put：正确，但高并发下竞争明显；
- ConcurrentHashMap 加访问事件队列，把"移动节点"异步化，牺牲精确性换吞吐；
- 直接采用 Caffeine 这类成熟缓存库，把并发、过期、统计一并解决。

### 演进方向：Caffeine 的 W-TinyLFU

精确 LRU 有两个已知软肋：一次性全表扫描会把真正的热点挤出去（扫描污染）；突发的新数据可能立刻被淘汰，哪怕它其实更热。Caffeine 采用的 W-TinyLFU 换了思路：用 Count-Min Sketch 频率草图低成本统计访问频次；新条目先进入一个很小的窗口区，淘汰时让候选者与受害者比频率，是"准入"而非"先到先留"；主区域再用分段 LRU 保持命中性能。配合环形读缓冲、写缓冲摊平并发开销，命中率和吞吐都显著优于朴素 LRU。

Redis 则是另一种折中：`allkeys-lru` 等策略不维护全局精确顺序，而是随机采样若干 key（数量由 `maxmemory-samples` 控制），淘汰样本中最久未访问者——用近似换内存与 CPU。

## 对比与权衡

| 策略 | 淘汰依据 | 实现成本 | 优点 | 短板 |
| --- | --- | --- | --- | --- |
| FIFO | 进入时间 | 一个队列 | 最简单 | 不关心后续访问，热点可能被误删 |
| LRU | 最近访问时间 | 哈希表 + 双向链表 | 契合时间局部性，操作 O(1) | 怕扫描污染；每次访问都要写指针 |
| LFU | 历史访问次数 | 哈希表 + 频次分桶 | 长期热点识别稳定 | 旧热点难退场（频率淤积），实现复杂 |
| W-TinyLFU | 频率 + 新近性 | 频率草图 + 窗口 + 分段 LRU | 抗扫描、抗突发，吞吐高 | 实现复杂，工程上只适合直接用库 |

LRU 与 LFU 的经典分歧：LRU 记得"最近一次是什么时候"，LFU 记得"总共访问过多少次"。流量存在长期稳定热点时 LFU 更准；访问模式随时间漂移时 LRU 反应更快。W-TinyLFU 可视为两者优点的工程化融合。

## 面试视角

**为什么哈希表和双向链表缺一不可？** 哈希表解决按键 O(1) 定位，双向链表解决 O(1) 的任意节点摘除与尾部淘汰。只用任何一个，要么找不到节点，要么不知道该淘汰谁。

**为什么必须是双向链表，单链表差在哪？** 把命中节点移到头部需要先摘除它，摘除需要前驱；单链表从节点本身拿不到前驱，只能 O(n) 扫描，整体复杂度失守。

**get 为什么要移动节点？** LRU 的淘汰依据是"最近访问时间"，读和写都算访问。get 命中不移动节点，淘汰顺序就退化成按插入时间的 FIFO。

**手写时最容易错的三处？** 淘汰尾节点后忘记同步删除哈希表项；节点里没存 key，淘汰时无法反查哈希表；更新已有 key 时只改了 value，忘记把节点移到头部。

**LinkedHashMap 怎么变成 LRU？** 构造时 `accessOrder=true`，让内部链表按访问排序（get 后节点被移到尾部）；重写 `removeEldestEntry` 返回 `size() > capacity`，插入后自动驱逐最旧项。

## 小结

- LRU 用"最久未访问"近似"未来最不需要"，是时间局部性假设下的高效启发式。
- 哈希表 + 双向链表的组合让定位、移动、淘汰全部 O(1)；前驱指针与哨兵头尾是这个设计成立的两颗螺丝。
- 读操作同样刷新次序，get 移动节点是不变量的一部分；淘汰时必须同时清理两个结构。
- 工程落地还要再迈两步：并发安全（get 也是写）与策略增强（Caffeine 的 W-TinyLFU、Redis 的采样近似）。面试手写精确 LRU，生产环境优先成熟库。
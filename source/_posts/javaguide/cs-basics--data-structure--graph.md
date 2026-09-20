---
title: 图详解（DFS、BFS、最短路径）
date: 2018-12-02 17:53:00
updated: 2018-12-02 17:53:00
permalink: knowledge/cs-basics/data-structure/graph/
categories:
  - 计算机基础
tags: [数据结构, 图]
description: 梳理图的两种存储结构、DFS/BFS 遍历、两种拓扑排序与最短路算法族的适用前提，以及依赖解析与路由等工程应用。
---

图是描述"多对多关系"的通用模型：社交网络、依赖管理、路由寻址的背后都是它。本文从存储结构讲起，理清 DFS/BFS 遍历、拓扑排序与最短路算法族各自的适用边界。

<!-- more -->

## 它解决什么问题

线性结构表达一对一，树表达一对多，而现实世界的关系往往是任意的多对多：用户之间的好友关系、构件之间的依赖关系、城市之间的航线。图把对象抽象为顶点集合 V、把关系抽象为边集合 E，记作 G(V, E)，再按边是否有方向、是否带权，细分出有向图、无向图、带权图等变体。建模时方向与权重定错，后面的算法再精妙也只会得到错误答案。

## 核心原理

### 存储：邻接矩阵与邻接表的权衡

邻接矩阵用 V×V 的二维数组记录边，`matrix[i][j]` 直接给出 i 到 j 的边或权值：判断任意两点是否相邻是 O(1)，但空间恒为 O(V²)，稀疏图里绝大多数格子在空转；无向图的矩阵天然对称。邻接表为每个顶点维护一条邻居列表，空间 O(V+E)，枚举一个顶点的所有邻居只花与其度数成正比的时间，是稀疏图和算法题的默认选择。选择依据就两条：边的密度（E 与 V² 的比值），以及操作画像——"频繁查任意点对之间有没有边"选矩阵，"频繁遍历某个点的邻居"选表。

### 遍历：DFS 与 BFS

DFS 沿一条路径扎到底再回溯，递归调用本身就是隐式栈，适合连通块统计、环检测与路径枚举；BFS 借助队列逐层扩散，第 k 层恰好是所有距起点 k 条边的点，因此首次抵达目标点时的层数就是最少边数，写层序 BFS 时记得在入队一刻就标记 visited。两者都离不开访问状态，否则在有环图里会死循环；邻接表下时间复杂度均为 O(V+E)，顶点极多、递归过深时 DFS 要改显式栈实现。

## 深入机制

### 拓扑排序：Kahn 与 DFS 两条路

对有向无环图（DAG），拓扑排序给出一种线性执行序，使每条边都从前指向后。Kahn 算法维护入度表：入度为 0 的点先入队，弹出时删去它的出边、邻居入度减一，减到 0 再入队。若最终输出的点数不足 V，说明剩下的点互相等待——图中必有环，这同时就是判环手法。

```java
List<Integer> topoSort(int n, List<Integer>[] graph) {
    int[] indeg = new int[n];
    for (int u = 0; u < n; u++) {
        for (int v : graph[u]) indeg[v]++;
    }
    Queue<Integer> queue = new ArrayDeque<>();
    for (int i = 0; i < n; i++) {
        if (indeg[i] == 0) queue.offer(i);
    }
    List<Integer> order = new ArrayList<>();
    while (!queue.isEmpty()) {
        int u = queue.poll();
        order.add(u);
        for (int v : graph[u]) {
            if (--indeg[v] == 0) queue.offer(v);
        }
    }
    return order.size() == n ? order : List.of(); // 不足 n 个点，说明存在环
}
```

DFS 版本则用三色标记（未访问/访问中/已完成）：递归返回时把顶点压栈，栈的逆序即拓扑序；若递归中碰到"访问中"的点，说明存在回边，即有环。

### 最短路算法族：按边权定位

Dijkstra 要求边权非负：每轮从优先队列取出当前距离最小的未确定点并锁定它——非负权保证此后不存在更短的迂回路径，贪心正确性正系于此；随后松弛它的出边，二叉堆实现复杂度 O((V+E) log V)。

```java
int[] dijkstra(List<int[]>[] graph, int s) { // graph[u] 中元素为 {邻居, 边权}
    int[] dist = new int[graph.length];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[s] = 0;
    PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[1]));
    pq.offer(new int[]{s, 0});
    while (!pq.isEmpty()) {
        int[] cur = pq.poll();
        int u = cur[0];
        if (cur[1] > dist[u]) continue;        // 堆里是旧距离，跳过
        for (int[] e : graph[u]) {
            int v = e[0], nd = dist[u] + e[1];
            if (nd < dist[v]) {
                dist[v] = nd;
                pq.offer(new int[]{v, nd});    // 惰性删除：旧值留在堆里
            }
        }
    }
    return dist;
}
```

存在负权边时 Dijkstra 的前提崩塌，改用 Bellman-Ford：对所有边做 V-1 轮松弛，第 V 轮若还能松弛即存在可达负环，复杂度 O(VE)。Floyd 用三重循环枚举中转点，求所有点对最短路，O(V³)，适合顶点数百以内或确实需要任意两点距离的场景。

## 工程实践

- **依赖解析**：Maven、Gradle 与各类构建系统把模块组织成 DAG，拓扑排序决定编译顺序；Kahn 跑完剩下的点就是循环依赖环。增量构建还要维护依赖图的局部更新。
- **网络路由**：OSPF 这类链路状态协议在区域内跑 Dijkstra 生成最短路径树；BGP 的路径向量交换思想更接近分布式 Bellman-Ford。边权定义为延迟、带宽还是策略成本，直接决定算出什么样的路。
- **常见坑**：无向边漏存反向；BFS 推迟到出队才标 visited 导致同一节点重复入队；递归 DFS 在大图上栈溢出要改显式栈；负权图上跑 Dijkstra 不报错但结果错。

## 对比与权衡

| 算法 | 适用前提 | 时间复杂度 | 典型用途 |
| --- | --- | --- | --- |
| BFS | 无权图 | O(V+E) | 最少边数、最少步数 |
| Dijkstra | 边权非负 | O((V+E) log V) | 单源最短路的首选 |
| Bellman-Ford | 允许负权 | O(VE) | 负权图、负环检测 |
| Floyd | 无负环 | O(V³) | 小规模全源最短路 |
| Kahn / DFS 拓扑 | DAG | O(V+E) | 依赖排序、有向判环 |

## 面试视角

**Dijkstra 为什么不能处理负权？** 贪心锁定的前提是"已确定点不可能再有更短路径"，负权边让后到的迂回路线反而更短，前提失效，结果可能出错却不报异常。

**BFS 凭什么求无权最短路？** 队列保证按层扩散，第 k 层恰好是所有距起点 k 条边的点，首次遇到目标即最少边数；一旦边带权，层数与代价脱钩，必须换 Dijkstra 一族。

**拓扑排序两种实现有何差异？** Kahn 基于入度，队列排空后剩点即环，迭代式易写；DFS 版靠三色标记识别回边判环，递归完成序逆置得结果，还能与其他 DFS 任务同趟完成。

**邻接矩阵什么时候仍优于邻接表？** 图稠密（E 接近 V²）时两者空间同阶，而矩阵 O(1) 查点对边、访存连续缓存友好；Floyd 这类全源算法也天然跑在矩阵上。

**Bellman-Ford 为什么是 V-1 轮松弛？** 不含负环时，任意最短路至多经过 V-1 条边；每轮松弛至少让"边数不超过 k 的最短路"确定一批，V-1 轮收敛。此后仍能松弛，唯一解释就是负环。

## 小结

- 建图先定方向与权重，再按密度和操作画像在邻接矩阵与邻接表之间取舍。
- DFS/BFS 是遍历基石，复杂度 O(V+E)，visited 标记一刻不能省。
- 拓扑排序服务 DAG：Kahn 看入度，DFS 看完成序，两者都能顺手判环。
- 最短路算法与边权前提强绑定：无权 BFS、非负 Dijkstra、负权 Bellman-Ford、小规模全源 Floyd。
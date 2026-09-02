---
title: 图详解（DFS、BFS、最短路径）
date: 2018-12-02 17:53:00
updated: 2018-12-02 17:53:00
permalink: knowledge/cs-basics/data-structure/graph/
categories:
  - 计算机基础
tags: [数据结构, 图]
description: 梳理图的表示、遍历、最短路径和复杂度选择。
---

图由顶点和边组成，可有向或无向、带权或无权。邻接矩阵占 `O(V²)`，判断两点是否有边很直接；邻接表占 `O(V+E)`，更适合稀疏图。选表示方式前应看图的密度以及遍历边和查询边哪个更频繁。

<!-- more -->

DFS 用栈深入路径，适合连通块、环检测和路径枚举；BFS 用队列按层展开，在无权图中首次到达某点即得到最少边数。两者都必须维护访问状态，邻接表下时间为 `O(V+E)`。有向无环图可用入度为零的队列执行拓扑排序；若最终处理节点少于 `V`，说明存在环。

带权最短路要依据边权选择。Dijkstra 反复确定当前距离最小的未定节点，并松弛出边，适合非负权；优先队列实现常为 `O((V+E)log V)`。存在负权边可用 Bellman-Ford，它多轮松弛所有边，并能检测可达负环，但成本约 `O(VE)`。所有点对问题则另有 Floyd 等方法。

```text
dist[start]=0; push(start,0)
while heap not empty:
  (d,u)=popMin()
  if d != dist[u]: continue
  for (u,v,w):
    if d+w < dist[v]: update and push
```

常见误区是对负权图使用 Dijkstra、无向边只存一个方向、在出队时才标记 BFS 导致重复、递归 DFS 忽略栈深，以及把“访问过”与“最短距离已确定”混淆。小结：先明确方向、权重和目标，再选择图表示与算法；算法名称必须和边权前提一起记。
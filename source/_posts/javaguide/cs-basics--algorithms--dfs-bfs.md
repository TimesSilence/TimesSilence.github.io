---
title: DFS 与 BFS 面试题总结：树、图、矩阵搜索与最短路径模板
date: 2019-07-21 14:02:00
updated: 2019-07-21 14:02:00
permalink: knowledge/cs-basics/algorithms/dfs-bfs/
categories:
  - 计算机基础
tags: [算法, 图搜索]
description: 对比深度优先与广度优先搜索的状态、步骤和适用边界。
---

DFS 沿一条路径深入到底再回退，BFS 按距离一层层扩展。二者都在遍历状态图，差别主要是待访问节点的组织方式：DFS 使用递归栈或显式栈，BFS 使用队列。

<!-- more -->

搜索前应定义三件事：一个状态包含什么、如何生成邻居、何时算访问过。图中必须用 `visited` 防止环；矩阵可用坐标集合或原地标记；树若只从父到子走，天然无环。DFS 适合连通块、路径枚举、拓扑相关探索；BFS 在每条边权相同的图中首次到达目标时即可得到最少边数。

```text
queue <- [start]; mark(start)
while queue not empty:
  x <- pop_front()
  for y in neighbors(x):
    if not marked(y):
      mark(y)
      queue.push(y)
```

标记通常要在入队时完成，而不是出队时，否则同一节点可能被多个前驱重复加入。多源 BFS 可以把所有起点同时入队，常用于最近距离扩散。若边有非负不同权重，应改用 Dijkstra；存在负权边时，普通 BFS 更不适用。

邻接表表示下，DFS 与 BFS 时间均为 `O(V+E)`，访问标记和容器占 `O(V)`；矩阵搜索为 `O(mn)`。递归 DFS 还要注意深图导致栈溢出，可改用显式栈。

常见误区是忘记环、把 BFS 当作任意带权最短路、在错误时机标记访问，以及把路径级访问与全局访问混用。小结：先明确状态图，再依据“枚举路径还是求层级最短”选择栈或队列。
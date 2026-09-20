---
title: 经典算法思想总结（含 LeetCode 题目推荐）
date: 2019-07-03 12:48:00
updated: 2019-07-03 12:48:00
permalink: knowledge/cs-basics/algorithms/classical-algorithm-problems-recommendations/
categories:
  - 计算机基础
tags: [算法, 刷题]
description: 按算法思想分组整理 LeetCode 经典题单，逐题标注难度、优先级与训练目标，并给出刷题顺序建议。
---

这份题单按算法思想而不是题号组织，覆盖面试中最常考的九类方法。每道题只回答三个问题：它训练什么能力、难度如何、值不值得先做。必做题用来建立模板手感，选做题用来检验迁移能力。

<!-- more -->

## 使用方式

先确认自己能默写对应方法的核心代码，再动手表里的必做题；选做题放到第二轮复习。每做完一题，记录四件事：题目的识别信号、循环或递归的不变量、时间空间复杂度、卡住自己的边界样例。说不清这四点，等于没做。

## 二分查找

| 题目 | 难度 | 优先级 | 训练目标 |
| --- | --- | --- | --- |
| [704. 二分查找](https://leetcode.cn/problems/binary-search/) | 简单 | 必做 | 固定区间定义，练循环条件与边界更新的一致性 |
| [34. 在排序数组中查找元素的第一个和最后一个位置](https://leetcode.cn/problems/find-first-and-last-position-of-element-in-sorted-array/) | 中等 | 必做 | 在基础模板上改造出左边界、右边界两种查找 |
| [35. 搜索插入位置](https://leetcode.cn/problems/search-insert-position/) | 简单 | 选做 | 理解循环结束时指针位置的含义 |
| [875. 爱吃香蕉的珂珂](https://leetcode.cn/problems/koko-eating-bananas/) | 中等 | 选做 | 把"最小可行速度"抽象成单调判定，入门答案二分 |

## 双指针与滑动窗口

| 题目 | 难度 | 优先级 | 训练目标 |
| --- | --- | --- | --- |
| [26. 删除有序数组中的重复项](https://leetcode.cn/problems/remove-duplicates-from-sorted-array/) | 简单 | 必做 | 读写指针分工，理解原地覆盖 |
| [977. 有序数组的平方](https://leetcode.cn/problems/squares-of-a-sorted-array/) | 简单 | 必做 | 利用"两端绝对值最大"从后向前填充 |
| [15. 三数之和](https://leetcode.cn/problems/3sum/) | 中等 | 必做 | 排序加左右收缩，重点在去重逻辑 |
| [142. 环形链表 II](https://leetcode.cn/problems/linked-list-cycle-ii/) | 中等 | 选做 | 快慢指针相遇点到入环口的推导 |
| [3. 无重复字符的最长子串](https://leetcode.cn/problems/longest-substring-without-repeating-characters/) | 中等 | 必做 | 可变窗口何时扩右端、何时缩左端 |
| [76. 最小覆盖子串](https://leetcode.cn/problems/minimum-window-substring/) | 困难 | 选做 | 窗口内计数状态的维护与匹配判断 |

## DFS 与 BFS

| 题目 | 难度 | 优先级 | 训练目标 |
| --- | --- | --- | --- |
| [102. 二叉树的层序遍历](https://leetcode.cn/problems/binary-tree-level-order-traversal/) | 中等 | 必做 | 队列按层扩展，学会统计层数 |
| [200. 岛屿数量](https://leetcode.cn/problems/number-of-islands/) | 中等 | 必做 | 把网格当隐式图，练遍历加访问标记 |
| [994. 腐烂的橘子](https://leetcode.cn/problems/rotting-oranges/) | 中等 | 选做 | 多源 BFS 与扩散轮次统计 |
| [127. 单词接龙](https://leetcode.cn/problems/word-ladder/) | 困难 | 选做 | 把字符串变换建模为无权图最短路 |

## 回溯

| 题目 | 难度 | 优先级 | 训练目标 |
| --- | --- | --- | --- |
| [78. 子集](https://leetcode.cn/problems/subsets/) | 中等 | 必做 | 每个元素"选与不选"的决策树 |
| [77. 组合](https://leetcode.cn/problems/combinations/) | 中等 | 必做 | 路径、选择列表、撤销选择的标准骨架 |
| [39. 组合总和](https://leetcode.cn/problems/combination-sum/) | 中等 | 选做 | 允许重复选取时的起始下标控制 |
| [51. N 皇后](https://leetcode.cn/problems/n-queens/) | 困难 | 选做 | 约束检查与剪枝的完整演练 |

## 动态规划

| 题目 | 难度 | 优先级 | 训练目标 |
| --- | --- | --- | --- |
| [70. 爬楼梯](https://leetcode.cn/problems/climbing-stairs/) | 简单 | 必做 | 状态定义与转移方程的最小实例 |
| [322. 零钱兑换](https://leetcode.cn/problems/coin-change/) | 中等 | 必做 | 完全背包式最优化，理解初始化含义 |
| [300. 最长递增子序列](https://leetcode.cn/problems/longest-increasing-subsequence/) | 中等 | 必做 | 子序列 DP，弄清 `dp[i]` 到底代表什么 |
| [416. 分割等和子集](https://leetcode.cn/problems/partition-equal-subset-sum/) | 中等 | 选做 | 0-1 背包可行性版本与空间压缩 |

## 贪心

| 题目 | 难度 | 优先级 | 训练目标 |
| --- | --- | --- | --- |
| [455. 分发饼干](https://leetcode.cn/problems/assign-cookies/) | 简单 | 必做 | 排序后配对，体验贪心策略的成立条件 |
| [55. 跳跃游戏](https://leetcode.cn/problems/jump-game/) | 中等 | 必做 | 维护最远可达边界这一不变量 |
| [435. 无重叠区间](https://leetcode.cn/problems/non-overlapping-intervals/) | 中等 | 选做 | 按结束时间排序的经典区间贪心 |
| [45. 跳跃游戏 II](https://leetcode.cn/problems/jump-game-ii/) | 中等 | 选做 | 分层扩展求最少步数，与 BFS 对照 |

## 图论与位运算

| 题目 | 难度 | 优先级 | 训练目标 |
| --- | --- | --- | --- |
| [207. 课程表](https://leetcode.cn/problems/course-schedule/) | 中等 | 必做 | 入度数组加队列的拓扑排序，同时学会判环 |
| [547. 省份数量](https://leetcode.cn/problems/number-of-provinces/) | 中等 | 必做 | 并查集 `find`/`union` 与路径压缩模板 |
| [684. 冗余连接](https://leetcode.cn/problems/redundant-connection/) | 中等 | 选做 | 用并查集定位第一条成环边 |
| [136. 只出现一次的数字](https://leetcode.cn/problems/single-number/) | 简单 | 选做 | 异或的消去性质，位运算入门 |

## 刷题顺序建议

推荐顺序是：二分、双指针与滑动窗口、DFS/BFS、回溯、动态规划、贪心、图论与位运算。理由在于依赖关系：二分练边界控制的基本功，窗口与双指针复用这份基本功；回溯依赖 DFS 的熟练度；DP 往往需要先在回溯或记忆化搜索上体会"重复子问题"；贪心的证明意识又建立在已经见过最优子结构之后。

执行时每个主题先刷完必做列，再回头补选做列；同一主题内不要连刷超过三道相似题，隔几天脱离题解重写一遍，比追加新题更能检验是否真正掌握。
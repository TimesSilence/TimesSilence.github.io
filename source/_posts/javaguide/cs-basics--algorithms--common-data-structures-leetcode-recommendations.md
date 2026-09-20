---
title: 常见数据结构经典 LeetCode 题目推荐
date: 2019-07-12 13:55:00
updated: 2019-07-12 13:55:00
permalink: knowledge/cs-basics/algorithms/common-data-structures-leetcode-recommendations/
categories:
  - 计算机基础
tags: [数据结构, 刷题]
description: 按数组、链表、栈队列、哈希表、树、堆、图七类结构分组推荐 LeetCode 入门题与进阶题，说明每题训练的结构操作。
---

数据结构题的核心问题是：面对一组操作需求，选什么结构能让最贵的那个操作足够便宜。这份题单按七类结构分组，每组给出入门题与进阶题，并写明题目要练的具体操作，而不是简单罗列链接。

<!-- more -->

## 数组

数组的优势是 `O(1)` 下标访问，短板是中间插入删除。训练重点是原地修改与区间信息。

| 层次 | 题目 | 训练目标 |
| --- | --- | --- |
| 入门 | [26. 删除有序数组中的重复项](https://leetcode.cn/problems/remove-duplicates-from-sorted-array/) | 读写双指针的原地覆盖写法 |
| 入门 | [977. 有序数组的平方](https://leetcode.cn/problems/squares-of-a-sorted-array/) | 利用有序性从两端向中间决策 |
| 进阶 | [15. 三数之和](https://leetcode.cn/problems/3sum/) | 排序把无序问题转为可收缩的区间问题 |
| 进阶 | [560. 和为 K 的子数组](https://leetcode.cn/problems/subarray-sum-equals-k/) | 前缀和加哈希计数，把区间和转成差值查询 |

## 链表

链表题不考复杂算法，考指针更新的顺序和空节点、单节点、头节点被删这些边界。

| 层次 | 题目 | 训练目标 |
| --- | --- | --- |
| 入门 | [206. 反转链表](https://leetcode.cn/problems/reverse-linked-list/) | 三个指针的更新次序，手写代码的底线题 |
| 入门 | [141. 环形链表](https://leetcode.cn/problems/linked-list-cycle/) | 快慢指针判环的最小实现 |
| 进阶 | [19. 删除链表的倒数第 N 个结点](https://leetcode.cn/problems/remove-nth-node-from-end-of-list/) | 哑节点加固定间距，一次遍历定位 |
| 进阶 | [92. 反转链表 II](https://leetcode.cn/problems/reverse-linked-list-ii/) | 区间反转中的断链与重接 |

## 栈与队列

栈表达嵌套与未完成状态，队列表达到达顺序。进阶方向是单调结构。

| 层次 | 题目 | 训练目标 |
| --- | --- | --- |
| 入门 | [232. 用栈实现队列](https://leetcode.cn/problems/implement-queue-using-stacks/) | 两个栈的职责划分，理解 LIFO 与 FIFO 的互转 |
| 入门 | [20. 有效的括号](https://leetcode.cn/problems/valid-parentheses/) | 遇到左括号入栈、右括号匹配弹栈的基本模式 |
| 进阶 | [739. 每日温度](https://leetcode.cn/problems/daily-temperatures/) | 单调栈维护"尚未找到更大元素"的下标 |
| 进阶 | [239. 滑动窗口最大值](https://leetcode.cn/problems/sliding-window-maximum/) | 单调队列同时处理过期与极值维护 |

## 哈希表

哈希表用空间换平均常数查找，难点在于 key 怎么设计，而不是 API 怎么调。

| 层次 | 题目 | 训练目标 |
| --- | --- | --- |
| 入门 | [1. 两数之和](https://leetcode.cn/problems/two-sum/) | 边遍历边查表，一遍完成配对 |
| 入门 | [242. 有效的字母异位词](https://leetcode.cn/problems/valid-anagram/) | 定长数组计数与 Map 计数的取舍 |
| 进阶 | [49. 字母异位词分组](https://leetcode.cn/problems/group-anagrams/) | 把"排序后的串"设计成 key |
| 进阶 | [146. LRU 缓存](https://leetcode.cn/problems/lru-cache/) | 哈希表与双向链表协作实现 `O(1)` 读写 |

## 树

树题的关键是想清楚递归函数返回什么、向父节点汇报什么。

| 层次 | 题目 | 训练目标 |
| --- | --- | --- |
| 入门 | [144. 二叉树的前序遍历](https://leetcode.cn/problems/binary-tree-preorder-traversal/) | 递归与显式栈两种写法都要会 |
| 入门 | [102. 二叉树的层序遍历](https://leetcode.cn/problems/binary-tree-level-order-traversal/) | 队列 BFS 与分层统计 |
| 进阶 | [105. 从前序与中序遍历序列构造二叉树](https://leetcode.cn/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) | 递归区间划分，哈希表把查根降为 `O(1)` |
| 进阶 | [236. 二叉树的最近公共祖先](https://leetcode.cn/problems/lowest-common-ancestor-of-a-binary-tree/) | 自底向上汇总左右子树的查找结果 |

## 堆

堆持续维护极值，适合"第 K 大""前 K 个"这类反复取最值的问题。

| 层次 | 题目 | 训练目标 |
| --- | --- | --- |
| 入门 | [215. 数组中的第 K 个最大元素](https://leetcode.cn/problems/kth-largest-element-in-an-array/) | 大小为 K 的小顶堆，同时了解快速选择 |
| 入门 | [703. 数据流中的第 K 大元素](https://leetcode.cn/problems/kth-largest-element-in-a-stream/) | 流式场景下堆的插入与淘汰 |
| 进阶 | [347. 前 K 个高频元素](https://leetcode.cn/problems/top-k-frequent-elements/) | 哈希计数与堆的组合，比较器写法 |
| 进阶 | [295. 数据流的中位数](https://leetcode.cn/problems/find-median-from-data-stream/) | 大顶堆小顶堆各存一半并维持平衡 |

## 图

图题大多落在遍历上，难点是把题目条件翻译成图模型。

| 层次 | 题目 | 训练目标 |
| --- | --- | --- |
| 入门 | [200. 岛屿数量](https://leetcode.cn/problems/number-of-islands/) | 网格即图，DFS/BFS 加访问标记 |
| 入门 | [207. 课程表](https://leetcode.cn/problems/course-schedule/) | 入度加队列的拓扑排序与判环 |
| 进阶 | [994. 腐烂的橘子](https://leetcode.cn/problems/rotting-oranges/) | 多源 BFS 统计扩散时间 |
| 进阶 | [547. 省份数量](https://leetcode.cn/problems/number-of-provinces/) | 并查集处理动态连通性 |

## 选题建议

同一结构内先做完入门再碰进阶，进阶题往往会组合另一个结构，比如堆题依赖哈希计数、图题依赖遍历框架。每题做完记录核心操作的成本：取最值多少、查键多少、维护代价多少。再给自己变一次条件——输入有序吗、是数据流吗、能不能改原数组——能说清方案在哪种条件下失效，才算真正理解了这个结构。
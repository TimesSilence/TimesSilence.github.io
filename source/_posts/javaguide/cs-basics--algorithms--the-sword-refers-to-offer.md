---
title: 剑指offer部分编程题
date: 2019-08-25 08:30:00
updated: 2019-08-25 08:30:00
permalink: knowledge/cs-basics/algorithms/the-sword-refers-to-offer/
categories:
  - 计算机基础
tags: [算法, 剑指Offer]
description: 《剑指 Offer》的价值定位、必做与选做题分级、与 LeetCode 热题的对照关系，以及刷这本书的使用建议。
---

《剑指 Offer》六十余题，单题难度不高，但几乎每题都对应一种面试高频模式，适合作为第一本完整刷完的面试题集。下面给出它的定位、题目分级和与 LeetCode 热题的对照，方便按需取用。

<!-- more -->

## 价值定位

这本书的优势不在题难，而在编排：每题从朴素想法出发，一步步推到优化解，并且反复强调边界条件与代码鲁棒性，这恰恰是面试官追问的方向。局限也明显：题目偏经典，缺少近年 LeetCode 上的新题型；部分简单题价值只在入门期。合理的用法是拿它打模板底子，再用 LeetCode 热题做变式训练，而不是只刷这一本。

## 必做题（第一梯队）

这些题要么是被反复考察的底线题，要么对应一种必须掌握的模式，建议全部手写通过。

| 剑指 Offer 题 | LeetCode 对照 | 必做理由 |
| --- | --- | --- |
| 反转链表 | [206](https://leetcode.cn/problems/reverse-linked-list/) | 三指针基本功，考察链表的底线 |
| 链表中倒数第 k 个节点 | [19](https://leetcode.cn/problems/remove-nth-node-from-end-of-list/) | 哑节点加固定间距，顺带练 k 非法的防御 |
| 合并两个排序的链表 | [21](https://leetcode.cn/problems/merge-two-sorted-lists/) | 迭代与递归两版都该会写 |
| 用两个栈实现队列 | [232](https://leetcode.cn/problems/implement-queue-using-stacks/) | 结构语义互转，考察对栈队列的理解 |
| 栈的压入、弹出序列 | [946](https://leetcode.cn/problems/validate-stack-sequences/) | 辅助栈模拟，训练用不变量验证合法性 |
| 二维数组中的查找 | [240](https://leetcode.cn/problems/search-a-2d-matrix-ii/) | 从角落出发每步排除一行或一列的单调性利用 |
| 旋转数组的最小数字 | [153](https://leetcode.cn/problems/find-minimum-in-rotated-sorted-array/) | 二分边界处理，重复值导致退化的讨论很典型 |
| 重建二叉树 | [105](https://leetcode.cn/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) | 前序定根、中序划区间，哈希优化到 `O(n)` |
| 连续子数组的最大和 | [53](https://leetcode.cn/problems/maximum-subarray/) | "以 i 结尾"的状态定义，DP 最干净的入门 |
| 数值的整数次方 | [50](https://leetcode.cn/problems/powx-n/) | 快速幂，附带 `Integer.MIN_VALUE` 溢出坑 |
| 斐波那契与跳台阶 | [509](https://leetcode.cn/problems/fibonacci-number/) | 从递归的重复计算到迭代递推的完整优化路径 |
| 数组中出现次数超过一半的数字 | [169](https://leetcode.cn/problems/majority-element/) | 摩尔投票，一次遍历 `O(1)` 空间 |
| 两个链表的第一个公共节点 | [160](https://leetcode.cn/problems/intersection-of-two-linked-lists/) | 双指针互补路程差 |
| 顺时针打印矩阵 | [54](https://leetcode.cn/problems/spiral-matrix/) | 边界收缩，纯模拟题的规范性训练 |

## 选做题（第二梯队）

这些题对应特定模式，时间紧张可延后，但困难档的几道值得专门安排。

| 剑指 Offer 题 | LeetCode 对照 | 定位 |
| --- | --- | --- |
| 滑动窗口的最大值 | [239](https://leetcode.cn/problems/sliding-window-maximum/) | 单调队列模板，中等偏上 |
| 数据流中的中位数 | [295](https://leetcode.cn/problems/find-median-from-data-stream/) | 双堆平衡，进阶设计题 |
| 二叉搜索树的第 k 大节点 | [230](https://leetcode.cn/problems/kth-smallest-element-in-a-bst/) | 中序遍历性质的直接应用 |
| 对称的二叉树 / 树的子结构 | [101](https://leetcode.cn/problems/symmetric-tree/) | 双递归函数配合的判断模式 |
| 复杂链表的复制 | [138](https://leetcode.cn/problems/copy-list-with-random-pointer/) | 哈希映射或原地交错复制 |
| 矩阵中的路径 | [79](https://leetcode.cn/problems/word-search/) | 网格回溯加访问标记 |
| 正则表达式匹配 | [10](https://leetcode.cn/problems/regular-expression-matching/) | 困难 DP，有余力再做 |
| 序列化二叉树 | [297](https://leetcode.cn/problems/serialize-and-deserialize-binary-tree/) | 困难，编码解码的对称设计 |
| 剪绳子、圆圈中最后剩下的数字 | [343](https://leetcode.cn/problems/integer-break/) | 数学结论题，了解推导即可 |
| 不用加减乘除做加法 | [371](https://leetcode.cn/problems/sum-of-two-integers/) | 位运算，低频 |

## 与 LeetCode 热题的关系

剑指 Offer 与 LeetCode 热题 100 的交集很大：链表反转、最大子数组和、LRU 式的设计题、二叉树遍历等在两边都出现。差异在于剑指 Offer 多了一些约定俗成的"老题"（如变态跳台阶、扑克牌顺子），LeetCode 热题则补充了滑动窗口、前缀和、图搜索等 newer 模式。对照刷的顺序是：先在剑指 Offer 里建立该模式的第一个可运行版本，再去 LeetCode 做它的加强版。

## 使用建议

顺序上先数组、字符串、链表这些基础结构，再栈与队列、树，最后动态规划与数学题。每题按"复述题意、写暴力基线、说清利用了什么约束、再优化"四步走，并主动测试空输入、单元素、重复值和整数溢出。时间紧就只做第一梯队；准备充分再把选做里的困难题逐个攻克。在 LeetCode 的剑指 Offer 专栏可以直接评测，不必依赖旧平台。
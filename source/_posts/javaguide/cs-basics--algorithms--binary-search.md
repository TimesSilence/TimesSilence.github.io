---
title: 二分查找面试题总结：左右边界、答案二分与 Java 模板
date: 2019-05-21 17:13:00
updated: 2019-05-21 17:13:00
permalink: knowledge/cs-basics/algorithms/binary-search/
categories:
  - 计算机基础
tags: [算法, 二分查找]
description: 用循环不变量统一左闭右闭与左闭右开两种模板，推导边界查找、防溢出取中点与旋转有序数组变形。
---

二分查找的思想人人会讲——每次排除一半，O(log n)。真正拉开差距的是边界：left、right、循环条件、mid 更新，任何一处语义含糊就会死循环或漏答案。用循环不变量把区间语义钉死之后，所有变形都能推导，而不必背诵。

<!-- more -->

## 它解决什么问题

在 n 个候选中定位目标，线性扫描 O(n)，二分每比较一次淘汰一半，只要 O(log n)——十亿规模约 30 次比较。成立的前提不是「数组有序」这个表象，而是单调性：一次判断能把候选切成「必不含答案」与「可能含答案」两半。有序数组只是特例，答案二分与旋转数组同样满足。

## 核心原理：循环不变量

把二分写对的可靠方法是维护一条不变量：**每轮结束时，答案（若存在）仍在当前区间内**。围绕它做三件事：初始化覆盖全部候选；每轮据 mid 排除不可能的一半；区间每轮至少缩小 1 保证终止。循环条件、边界更新、返回值都是其推论。

### 写法一：左闭右闭 [left, right]

两端都算候选，故 `right` 初始化为 `n - 1`；`left == right` 时还剩一个元素没查，所以循环条件是 `left <= right`；`mid` 被排除后从 `mid ± 1` 续搜。

```java
int binarySearch(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) left = mid + 1;   // mid 及左侧全部排除
        else right = mid - 1;                     // mid 及右侧全部排除
    }
    return -1;                                    // 区间已空，不存在
}
```

### 写法二：左闭右开 [left, right)

右端点不算候选，故 `right` 初始化为 `n`；`left == right` 即区间为空，循环条件是 `left < right`。满足条件时 `mid` 仍可能是答案，只能收缩为 `right = mid`。结束时 `left == right`，恰指向「第一个满足条件的位置」，目标不存在也自然给出插入点。

```java
int lowerBound(int[] nums, int target) {
    int left = 0, right = nums.length;         // [left, right)
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] >= target) right = mid;  // mid 可能是答案，保留
        else left = mid + 1;                   // mid 一定不是，排除
    }
    return left;                               // 可能等于 n：全部小于 target
}
```

两派全部差异——初始化、循环条件、`right = mid` 还是 `mid - 1`——都可用一句话裁决：**mid 还可能是答案吗**。想通这点，模板无需背。

### 整数溢出的细节

`(left + right) / 2` 在 int 下，两端接近 2³¹−1 时加法先溢出成负数，再除 2 得到荒谬下标。改成 `left + (right - left) / 2`，先做恒非负的减法即可免疫；Java 里 `(left + right) >>> 1` 也能兜住，但减法写法跨语言通用。Python 整数无溢出问题。

## 深入机制

### 变体一：查找第一个 / 最后一个等于目标的位置

含重复元素时，命中即返回拿不到边界。统一转成「第一个满足某条件」：第一个等于 target = 第一个 ≥ target 的位置（再校验相等）；最后一个等于 = 第一个 > target 的位置减一。

```java
int[] searchRange(int[] nums, int target) {
    int first = lowerBound(nums, target);
    if (first == nums.length || nums[first] != target) return new int[]{-1, -1};
    return new int[]{first, lowerBound(nums, target + 1) - 1};
}
```

复用同一个 `lowerBound` 只需维护一套逻辑；`target + 1` 在 `Integer.MAX_VALUE` 处会溢出，可换成 `nums[mid] > target` 的判定版本。

### 变体二：旋转有序数组

`[4,5,6,7,0,1,2]` 整体无序，但任取 mid 切一刀，两半必有一半严格有序。判断哪半有序，再看 target 是否落在该半值域内，即可确定排除哪一半——单调性被「局部有序」找了回来。

```java
int search(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return mid;
        if (nums[left] <= nums[mid]) {          // 左半有序
            if (nums[left] <= target && target < nums[mid]) right = mid - 1;
            else left = mid + 1;
        } else {                                // 右半有序
            if (nums[mid] < target && target <= nums[right]) left = mid + 1;
            else right = mid - 1;
        }
    }
    return -1;
}
```

细节一：`nums[left] <= nums[mid]` 必须带等号——区间只剩两元素时 `left == mid`，左半应视为有序，漏掉等号会走错分支。细节二：允许重复元素时（如 `[1,0,1,1,1]`），三者相等则无法判断哪半有序，只能两端各缩一格，最坏退化 O(n)。

## 工程实践

- **库函数返回值约定**：`Arrays.binarySearch` 未命中时返回 `-(插入点) - 1`，同时编码存在性与插入位置。
- **答案二分**：在答案值域上二分，配 `check(x)` 判定可行性，复杂度 O(f(n)·log R)；动笔前先证明可行性随 x 单调、上下界包住答案。
- **链表不适合二分**：定位中点要 O(n)，减半优势荡然无存——二分省的是候选数量，前提是取中点 O(1)。

## 对比与权衡

| 维度 | 左闭右闭 `[l, r]` | 左闭右开 `[l, r)` |
| --- | --- | --- |
| 初始化 | `right = n - 1` | `right = n` |
| 循环条件 | `left <= right` | `left < right` |
| 排除 mid 时 | `right = mid - 1` | 保留 mid：`right = mid` |
| 结束状态 | 区间为空，未命中 | `left == right`，指向边界/插入点 |
| 擅长场景 | 精确查值 | 边界查找、插入位置 |

## 面试视角

**`left < right` 和 `left <= right` 怎么选？** 由区间定义决定：闭区间里 `left == right` 还剩一个候选必须检查；半开区间里相等即空。混用两套语义是死循环与越界的头号来源。

**为什么二分是 O(log n)？** 每轮候选至少减半，n 折半 k 次后剩 1，k ≈ log₂n。

**找左边界时命中了为什么还要继续收缩？** 重复元素让「命中」不等于「第一个」，保留候选并压缩右边界，才能逼到最左端那个。

**旋转数组为什么还能二分？** 单调性不要求全局有序，只要每轮能论证「哪一半必不含答案」；旋转数组总有一半严格有序，足以支撑论证。

**如何自检二分写得对不对？** 过四组样例：空数组、单元素、全部相同、目标越出两端；再逐行确认每次边界更新都排除了被丢弃的一半。

## 小结

- 二分的本质是单调性上的减半排除，数组有序只是它的一种载体。
- 用循环不变量钉死区间语义，`right = mid` 与 `mid - 1` 之争自然消解。
- `left + (right - left) / 2` 防溢出；边界查找统一化为「第一个满足条件」。
- 旋转数组靠「一半必有序」恢复单调性；含重复元素时该论证失效，复杂度退化。
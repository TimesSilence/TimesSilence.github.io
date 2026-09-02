---
title: 二分查找面试题总结：左右边界、答案二分与 Java 模板
date: 2019-05-21 17:13:00
updated: 2019-05-21 17:13:00
permalink: knowledge/cs-basics/algorithms/binary-search/
categories:
  - 计算机基础
tags: [算法, 二分查找]
description: 用区间不变量理解普通二分、边界二分和答案二分。
---

二分查找依赖的不是“数组”三个字，而是搜索空间存在单调性：某个判定在分界点一侧为假，另一侧为真。每次检查中点并排除一半区间，因此查找次数为 `O(log n)`。

<!-- more -->

写对二分的关键是固定区间语义。闭区间 `[left,right]` 中循环条件为 `left <= right`；命中后若找最左位置，应保存答案并令 `right=mid-1`，否则依据大小移动边界。中点使用 `left + (right-left)/2` 可避免加法溢出。

```text
answer = none
while left <= right:
  mid = left + (right-left)/2
  if predicate(mid):
    answer = mid
    right = mid - 1
  else:
    left = mid + 1
```

普通查值的判定是 `a[mid]` 与目标的比较；寻找第一个不小于目标的位置，是找首次满足 `a[i] >= target`；答案二分则把索引换成可能答案，例如最小运载能力、最大可行距离。此时必须先证明 `predicate(x)` 随 `x` 单调，并给出一定覆盖答案的上下界。

数组二分时间 `O(log n)`、额外空间 `O(1)`；若判定一次成本为 `O(f(n))`，答案二分总成本是 `O(f(n) log R)`，`R` 为值域。链表即使有序也不适合，因为定位中点不是常数时间。

常见错误是混用半开与闭区间、边界不收缩造成死循环、重复元素时命中就返回，以及未验证单调性便套模板。小结：把“目标仍在哪个区间”写成不变量，再逐行维护它，边界问题就不必靠背诵。
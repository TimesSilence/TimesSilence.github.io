---
title: 双指针与滑动窗口面试题总结：数组、链表、字符串高频模板
date: 2019-09-11 10:44:00
updated: 2019-09-11 10:44:00
permalink: knowledge/cs-basics/algorithms/two-pointers-and-sliding-window/
categories:
  - 计算机基础
tags: [算法, 双指针, 滑动窗口]
description: 以对撞指针、快慢指针、滑动窗口三条主线讲清双指针家族，给出扩张-收缩-更新的窗口框架与典型例题。
---

双指针与滑动窗口常被并列提起，内核却是同一件事：两个指针各自只朝一个方向走，被跳过的候选永不再看。正是这份单调性，把暴力枚举的 O(n²) 压成了 O(n)。

<!-- more -->

## 它解决什么问题

子数组、子串、数对类问题，暴力枚举是 O(n²) 起步。但只要能论证「某位置被排除后绝不可能参与更优解」，指针就能放心单向移动、不再回头，枚举量坍缩为线性。三个典型形态：对撞指针两端收缩，快慢指针利用速度差，滑动窗口维护连续区间的状态。

## 核心原理

### 指针移动的合法性来自排除论证

每次移动指针前必须回答：被跳过的配对为什么不可能更优？以有序数组两数之和为例，`nums[l] + nums[r] < target` 时只能移动左指针——左值搭配任何不超过 `nums[r]` 的数都更小，「当前左值 + 任意右值」整列候选被一次排除。移动的本质是裁剪搜索空间，而非碰运气。

### 对撞指针：两数之和与盛水容器

```java
int[] twoSum(int[] nums, int target) {   // nums 已排序
    int left = 0, right = nums.length - 1;
    while (left < right) {
        int sum = nums[left] + nums[right];
        if (sum == target) return new int[]{left, right};
        if (sum < target) left++;    // 左值太小，左指针右移
        else right--;                // 右值太大，右指针左移
    }
    return new int[]{-1, -1};
}
```

盛水容器的论证更微妙：面积 = `min(h[l], h[r]) × (r - l)`，移动较高一侧则宽度缩、短板不变，面积必减；只有移动较矮一侧才可能找到更高短板。故每轮淘汰较矮者，其余逻辑与两数之和相同，只是循环体换成取面积最大值。

### 快慢指针：判圈与找中点

快指针每轮 2 步、慢指针 1 步。若有环，快指针先入环，相对速度恒为 1，距离每轮缩一格，必然相遇且不会跨过；快指针走到 null 则无环。同一结构可找中点：fast 到尾时 slow 恰走一半。

```java
boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {  // 判空顺序不可反
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}
```

判空 `fast != null && fast.next != null` 的次序是硬约束，反了 `fast.next.next` 可能空指针。奇数长度 slow 落正中，偶数停在后半段起点。

## 深入机制：滑动窗口

### 扩张—收缩—更新的三拍框架

可变窗口维护一段连续区间 `[left, right]` 及其内部状态（计数、和、匹配数），节奏固定为三拍：

1. **扩张**：right 纳入新元素并更新状态；
2. **收缩**：窗口违规时移动 left 并撤销其贡献，直到恢复合法；
3. **更新答案**：在窗口合法（或满足条件）处记录最优值。

```java
int lengthOfLongestSubstring(String s) {   // 无重复字符的最长子串
    int[] cnt = new int[128];
    int left = 0, ans = 0;
    for (int right = 0; right < s.length(); right++) {
        cnt[s.charAt(right)]++;
        while (cnt[s.charAt(right)] > 1) {      // 有重复：收缩到合法
            cnt[s.charAt(left)]--;
            left++;
        }
        ans = Math.max(ans, right - left + 1);  // 合法后更新最长
    }
    return ans;
}
```

O(n) 的根据：left 与 right 只单调右移，每个元素进窗一次、出窗一次，while 全局合计不超过 n。收缩必须用 while 而非 if——`abba` 这类输入，挪一步左边界不足以消除重复。

### 最长与最短的更新时机相反

- **求最长合法窗口**：先修到合法，再取 max（如上例）；
- **求最短满足窗口**：一满足条件就记录答案，再继续收缩试探更短。

最小覆盖子串是后者代表：窗口覆盖 t 后，先在收缩循环内更新答案，再弹左端。

```java
String minWindow(String s, String t) {
    int[] need = new int[128];
    for (char c : t.toCharArray()) need[c]++;
    int missing = t.length(), left = 0, start = 0, minLen = Integer.MAX_VALUE;
    for (int right = 0; right < s.length(); right++) {
        if (need[s.charAt(right)]-- > 0) missing--;  // 纳入有效字符
        while (missing == 0) {                       // 已覆盖：记录并收缩
            if (right - left + 1 < minLen) { start = left; minLen = right - left + 1; }
            if (++need[s.charAt(left++)] > 0) missing++;
        }
    }
    return minLen == Integer.MAX_VALUE ? "" : s.substring(start, start + minLen);
}
```

`need[c]` 为负表示窗口里该字符有富余；弹出的字符使计数由 0 变正，才说明真的缺了一个。这套记账方式省掉了哈希表，字符集大时换回 Map 即可。

### 适用条件与失效场景

滑窗成立的隐含前提是收缩方向单调：左指针右移必须让窗口朝「恢复合法」单向变化。元素含负数时前提崩塌——和不再随窗口缩窄而变小，「和 ≥ k 的最短子数组」得改用前缀和加单调队列。动手前先问：扩张与收缩是否各自单向影响约束？

固定长度窗口是退化形态：右进一个、左出一个，无需 while，如长度 k 子数组最大和。

## 工程实践

- **先声明指针含义再写代码**：left 是窗口左端、right 是待纳入元素、write 是下一可写位置——含义说清，边界就不会写到一半变形。
- **链表删除配哑节点**：找倒数第 N 个节点时前置 dummy，把「删除头节点」并入统一路径。
- **三数之和范式**：排序后固定一数，剩余区间跑对撞指针，整体 O(n²)；固定数与命中后的双指针都要跳重复值去重。
- **窗口状态选型**：ASCII 用定长数组，开放键域换哈希表，维护窗口最值上单调队列。

## 对比与权衡

| 技巧 | 指针关系 | 窗口状态 | 典型问题 |
| --- | --- | --- | --- |
| 对撞指针 | 两端相向 | 无 | 有序两数之和、盛水容器、回文判定 |
| 快慢指针 | 同向不同速 | 无 | 判圈、找中点、倒数第 K 个节点 |
| 滑动窗口 | 同向夹出区间 | 计数/和/匹配数 | 最长最短子串、定长子数组统计 |

## 面试视角

**双指针套着 while，为什么不是 O(n²)？** 依据是总移动次数而非循环层数：两指针单调前进从不回退，合计最多 2n 步。

**什么时候用 if 收缩、什么时候必须 while？** 固定窗口每轮至多违规一个元素，if 够；可变窗口违规程度任意，必须 while 收缩到彻底合法。

**快慢指针判环为什么保证相遇？** 入环后两者都在环上绕圈，相对速度恒为 1，距离每轮精确减 1，不存在「跨过去」的说法。

**含负数的子数组和为什么滑窗失效？** 收缩左边界不一定让和变小，单调性消失后排除论证不成立，只能换前缀和等工具。

**最长窗口与最短窗口的代码差别在哪？** 更新答案的时机：最长在恢复合法之后，最短在满足条件之时。把这个时机套反，是窗口题最常见的错法。

## 小结

- 双指针家族统一的复杂度底气：指针单调、候选被永久排除。
- 对撞指针两端收缩，快慢指针靠速度差探结构。
- 滑动窗口 = 扩张、收缩、更新答案三拍；先验证收缩方向的单调性再套模板。
- 最长与最短问题的关键区别是更新答案的时机，写反即错。
---
title: 几道常见的链表算法题
date: 2019-08-07 16:16:00
updated: 2019-08-07 16:16:00
permalink: knowledge/cs-basics/algorithms/linkedlist-algorithm-problems/
categories:
  - 计算机基础
tags: [算法, 链表]
description: 链表高频题精讲：反转（迭代与递归）、快慢指针判圈与找入口的数学证明、合并有序链表、一趟删除倒数第 N 个节点、两两交换，附关键代码与易错点。
---

链表没有随机访问，所有操作最终都归结为改写 `next` 指针，而指针一改错，后半段链表就可能永久丢失。本篇挑五道面试中出现频率最高的题：反转（迭代与递归两种）、判圈与找入口、合并两个有序链表、一趟删除倒数第 N 个节点、两两交换，每题按"一句话思路、关键代码、易错点"组织。

<!-- more -->

## 反转链表

**思路**：迭代法维护 prev、cur、next 三个指针，每轮把 cur 的指向掉头；递归法则先反转后半段，再把当前节点挂到末尾。

迭代的关键是守住一条不变量：循环开始时，prev 左侧是已经反转好的部分，cur 右侧是待处理部分。每轮先做 `next = cur.next` 把后继存下来，再执行 `cur.next = prev` 完成掉头，最后 prev、cur 整体右移一格。循环结束时 cur 为 null，prev 正好停在新头节点上。时间 O(n)，额外空间 O(1)。

```java
// 迭代写法
public ListNode reverseList(ListNode head) {
    ListNode prev = null, cur = head;
    while (cur != null) {
        ListNode next = cur.next; // 先存后继，再掉头
        cur.next = prev;
        prev = cur;
        cur = next;
    }
    return prev;
}

// 递归写法
public ListNode reverseList(ListNode head) {
    if (head == null || head.next == null) return head;
    ListNode newHead = reverseList(head.next);
    head.next.next = head; // 后继掉头指向自己
    head.next = null;      // 断开原边，否则成环
    return newHead;
}
```

递归版好写但要付出 O(n) 的栈空间，链表很长时有栈溢出风险，工程代码里更推荐迭代。

**易错点**：掉头前不保存后继，链表直接断成两截；递归漏写 `head.next = null` 会让最后两个节点互相指向、形成环；返回值是 prev 而不是已经走到 null 的 cur。

## 环形链表：判圈与找入口

**思路**：快慢指针从头出发，快的一次两步、慢的一次一步，若能相遇则有环；之后让一个指针回到头部，与慢指针同速前进，再次相遇的位置就是环入口。

判圈的直觉是"操场套圈"：环形跑道上快的人总会从背后追上慢的人，且相对速度为一格，不会跳过。无环时快指针先到达 null，循环自然退出。

找入口为什么正确？设头到入口 a 步，入口到首次相遇点 b 步，相遇点沿环回到入口 c 步。相遇时慢指针走了 a+b，快指针多绕了 k 圈、走了 a+b+k(b+c)。由"快指针路程是慢指针的两倍"得 a+b = k(b+c)，整理出 a = (k-1)(b+c) + c——从头走 a 步，等价于从相遇点绕 k-1 圈后再走 c 步，二者必然停在同一位置，正是入口。

```java
public ListNode detectCycle(ListNode head) {
    ListNode fast = head, slow = head;
    while (fast != null && fast.next != null) {
        fast = fast.next.next;
        slow = slow.next;
        if (fast == slow) {
            ListNode p = head;
            while (p != slow) { p = p.next; slow = slow.next; }
            return p;
        }
    }
    return null;
}
```

**易错点**：循环条件必须写成 `fast != null && fast.next != null`，只判 fast 会在 `fast.next.next` 处空指针；要先移动再判断相等，否则起点就被误认为相遇；只判圈不求入口时，相遇即可返回 true，不需要第二阶段。

## 合并两个有序链表

**思路**：借助哑节点和尾指针，每轮比较两条链表的当前头，把较小的接到结果尾部；一条耗尽后，另一条剩余部分整体挂上。

```java
public ListNode mergeTwoLists(ListNode l1, ListNode l2) {
    ListNode dummy = new ListNode(0), tail = dummy;
    while (l1 != null && l2 != null) {
        if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }
        else { tail.next = l2; l2 = l2.next; }
        tail = tail.next;
    }
    tail.next = l1 != null ? l1 : l2; // 剩余部分整条接入
    return dummy.next;
}
```

这道题也有简洁的递归写法：较小的节点作为结果头，它的 next 指向"剩余部分合并"的递归结果。递归版代码短，但同样要承担 O(n) 的调用栈开销。迭代版时间 O(n+m)、空间 O(1)，且复用原节点、不产生新分配。

**易错点**：循环结束后直接把整条剩余链接上即可，不要逐节点新建；返回值是 `dummy.next`，写成 return dummy 会把值为 0 的哑节点也带出去。

## 删除倒数第 N 个节点

**思路**：快慢指针都从哑节点出发，快指针先走 n+1 步，然后两者同步前进；快指针到尾时，慢指针恰好停在待删节点的前驱，一趟扫描完成删除。

朴素做法是先遍历一遍数出长度 L，把"倒数第 N 个"换算成"正数第 L-N+1 个"，再遍历第二遍删除，要走两趟。快慢指针技巧的本质是让两个指针始终保持 N+1 的间距，这样快指针撞线时，慢指针自然落在目标前驱上，把两趟压缩成一趟。

```java
public ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode dummy = new ListNode(0);
    dummy.next = head;
    ListNode fast = dummy, slow = dummy;
    for (int i = 0; i <= n; i++) fast = fast.next; // 先走 n+1 步
    while (fast != null) { fast = fast.next; slow = slow.next; }
    slow.next = slow.next.next;
    return dummy.next;
}
```

**易错点**：先走的是 n+1 步而不是 n 步——只有停在"前驱"位置，删除头节点（即倒数第 L 个）这种边界才能被哑节点统一兜住；题目不保证 n 合法时，先走阶段要判空，否则快指针越界。

## 两两交换相邻节点

**思路**：哑节点之后每轮处理一对节点 a、b，按固定顺序改三条边——`a.next = b.next`、`b.next = a`、`prev.next = b`，然后把 prev 移到 a 进入下一轮。

```java
public ListNode swapPairs(ListNode head) {
    ListNode dummy = new ListNode(0);
    dummy.next = head;
    ListNode prev = dummy;
    while (prev.next != null && prev.next.next != null) {
        ListNode a = prev.next, b = a.next;
        a.next = b.next; // 先让 a 接住 b 后面的部分
        b.next = a;
        prev.next = b;
        prev = a;
    }
    return dummy.next;
}
```

每轮操作前 prev 指向待交换对的前一个节点，三条边改完后，这一对的顺序变成 b、a，且与后文衔接完好。节点数为奇数时最后一个节点自然落单、保持不动。

**易错点**：三条边的改写顺序不能乱，必须先把 `b.next` 交给 `a.next` 再动 `b.next`，否则后半段丢失；循环条件是后面至少剩两个节点；prev 每轮前进两格（移动到 a），只前进一格会把已交换的节点再卷进来。

## 小结

五道题其实共用三个套路：哑节点抹平"头节点被删或被换"的边界、快慢指针处理环检测与"倒数第 N"这类相对距离问题、改指针之前先把后继存好。复杂度上都是 O(n) 时间，迭代版 O(1) 额外空间，递归版多付出 O(n) 栈空间。写完代码用空表、单节点、两节点三组最小用例手跑一遍，比背模板更能拦住指针错误。
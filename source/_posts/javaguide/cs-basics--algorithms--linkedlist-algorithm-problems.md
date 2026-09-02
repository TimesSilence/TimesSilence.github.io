---
title: 几道常见的链表算法题
date: 2019-08-07 16:16:00
updated: 2019-08-07 16:16:00
permalink: knowledge/cs-basics/algorithms/linkedlist-algorithm-problems/
categories:
  - 计算机基础
tags: [算法, 链表]
description: 用指针不变量梳理反转、环检测、合并与删除等链表题。
---

链表题考查的不是随机访问，而是能否安全地改写连接关系。节点一旦断开，后续部分可能丢失，因此修改 `next` 前先保存下一节点，是最重要的操作纪律。哑节点能统一处理头节点被删除或替换的边界。

<!-- more -->

反转链表维护 `prev、cur、next`：保存 `next=cur.next`，令 `cur.next=prev`，再整体前移。循环结束后 `prev` 指向新头，时间 `O(n)`、空间 `O(1)`。合并两个有序链表则让尾指针每次接上较小节点，剩余链表最后整体接入。

快慢指针适合环与中点。快指针每次两步、慢指针一步，若相遇则有环；相遇后一个指针回到头部，二者同速前进，再次相遇点就是环入口。删除倒数第 `k` 个节点，可让快指针先走 `k` 步，再同步移动至慢指针位于待删节点前驱。

```text
dummy.next = head
fast = slow = dummy
repeat k times: fast = fast.next
while fast.next != null:
  fast = fast.next; slow = slow.next
slow.next = slow.next.next
```

多数操作只遍历一到两次，时间 `O(n)`、额外空间 `O(1)`；递归反转会增加 `O(n)` 栈空间。常见错误是没有保存后继、空指针检查不足、快慢指针起点不一致却套用公式，以及忘记链表可能为空。

小结：画出修改前后的局部指针图，给每个指针一句不变量说明，并用空表、单节点、删除头尾测试，比背代码更可靠。
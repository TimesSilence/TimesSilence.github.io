---
title: "Java集合常见面试题总结(上)"
date: 2019-02-24 17:03:00
updated: 2019-02-24 17:03:00
permalink: knowledge/java/collection/java-collection-questions-01/
categories:
  - Java
tags:
  - Java集合
  - 面试
description: "梳理集合框架概览、List/Set/Map 选型与 ArrayList、LinkedList、HashMap 等高频面试点。"
---

集合面试上篇通常覆盖体系结构、接口继承关系，以及 List/Set/Map 最常用实现的差异——这是后续源码题的地图。

<!-- more -->

## 核心概念

**Collection** 单列：List 有序可重复、Set 不重复、Queue 队列。**Map** 双列键值对，不继承 Collection。经典实现：`ArrayList`/`LinkedList`、`HashSet`/`TreeSet`、`HashMap`/`LinkedHashMap`/`TreeMap`。迭代器 `Iterator` 与 fail-fast：`modCount` 检测并发修改。

## 关键机制与实践

选型速记：**随机访问、尾部增删 → ArrayList**；**头尾插删、无随机访问 → LinkedList**；**去重无序 → HashSet**；**有序 → TreeSet/LinkedHashSet**；**键值查找 → HashMap**；**插入顺序 → LinkedHashMap**；**排序键 → TreeMap**。HashMap 依赖 `hashCode/equals`；JDK 8 链表+红黑树；负载因子与 2 幂容量。

## 常见误区与小结

- `HashMap` 与 `Hashtable`：后者线程安全但过时，并发用 CHM。
- 认为 `Set` 用的是 `equals`  alone（还依赖 hash 桶定位）。
- LinkedList 当「比 ArrayList 快」的万能列表（中间插入仍 O(n) 找位置）。

上篇打牢接口与复杂度，下篇再攻并发容器与源码细节。
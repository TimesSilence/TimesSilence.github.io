---
title: "Java集合使用注意事项总结"
date: 2019-02-15 16:56:00
updated: 2019-02-15 16:56:00
permalink: knowledge/java/collection/java-collection-precautions-for-use/
categories:
  - Java
tags:
  - Java集合
  - 最佳实践
description: "Java 集合使用注意事项：isEmpty 判空、Arrays.asList 与 subList 视图陷阱、遍历删除的 fail-fast、toArray 空数组技巧与 toMap 暗坑。"
---

集合 API 用起来简单，但「视图语义、fail-fast、null 处理」这几类坑常年制造线上的 NPE 与 CME。本文按「坑的现象 → 原理 → 正确写法」逐条拆解高频陷阱。

<!-- more -->

## 判空：用 isEmpty() 而不是 size()==0

**现象**：`size()==0` 语义没错，但在部分集合上是性能坑，数据量大时判空接口明显变慢。

**原理**：大多数集合的 `size()` 维护了计数器，是 O(1)；但并非全部。`ConcurrentLinkedQueue` 为了无锁化没有维护精确计数，`size()` 要遍历整条链表数节点，复杂度 O(n)，而 `isEmpty()` 只需判断头节点是否为空，近似 O(1)。并发环境下 `size()` 统计到的还可能是过期快照，精确性也不可靠。

**正确写法**：统一用 `collection.isEmpty()`，可读性和复杂度都更好，也不依赖具体实现是否维护了 size 字段。

## Arrays.asList：返回的不是你以为的 ArrayList

**现象一**：`Arrays.asList(1, 2, 3).add(4)` 运行期抛 UnsupportedOperationException，set 却正常。

**原理**：返回值是 `java.util.Arrays` 的内部类 `Arrays$ArrayList`，与 `java.util.ArrayList` 毫无继承关系。它只重写了 get、set、contains 等查询类方法；add、remove、clear 继承自 AbstractList，而 AbstractList 对这些方法的默认实现就是直接抛异常。底层数据就是传入的那个数组，长度天然不可变。

**正确写法**：需要可增删时包一层 `new ArrayList<>(Arrays.asList(...))`，把数据拷进真正的 ArrayList。

**现象二**：传入基本类型数组，得到的列表 size 是 1。

**原理**：asList 的签名是泛型可变参数 `T...`，而泛型不支持基本类型，`int[]` 会被整体当作单个元素 T（数组本身是对象），不会自动装箱展开成三个 Integer。

**正确写法**：改用包装类型数组，或用流显式装箱：`Arrays.stream(intArray).boxed().collect(Collectors.toList())`。

## subList：与父列表共享底层数组的活视图

**现象**：对 subList 的增删直接改到原列表；反过来，拿到 subList 之后再结构性修改原列表，子列表上的任何操作都抛 ConcurrentModificationException。

**原理**：`ArrayList#subList` 返回的是视图而非副本，内部持有父列表引用加起止偏移量，不复制数据，读写穿透到底层数组。视图创建时记录了父列表当时的 modCount，父列表一旦发生结构性修改，视图立即失效。`subList.clear()` 也绝非「清空副本」，而是删除父列表对应区间的全部元素。

**正确写法**：需要独立副本就 `new ArrayList<>(list.subList(from, to))`；只读截取的场景才直接使用视图，且持有视图期间不要动原列表。

## 不可变集合：unmodifiableList 与 List.of 不一样

**现象**：用 `Collections.unmodifiableList(list)` 包装后原列表被改动，包装后的「不可变」列表内容也跟着变了。

**原理**：unmodifiableList 返回的同样是视图——它只拦截修改方法的调用，数据仍来自原列表，原列表的变化会完整穿透。而 JDK 9 的 `List.of(...)` 返回的是真正独立的不可变集合，与原数据无关联，且不允许 null 元素。

**正确写法**：想做防御性拷贝用 `List.copyOf(list)` 或先拷再包；创建常量集合直接用 `List.of`。

## 遍历时删除：foreach 里 remove 必炸

**现象**：foreach 循环里调用 `list.remove()` 抛 ConcurrentModificationException——单线程下也会，与并发无关。

**原理**：foreach 是语法糖，编译后就是 Iterator 遍历。迭代器创建时记下集合的 modCount，每次 `next()` 前比对；`list.remove()` 走的是集合自身方法，modCount 变了而迭代器不知情，fail-fast 机制触发。这是集合在主动告诉你「遍历状态已不可信」。

**正确写法**：

```java
// 方式一：迭代器自己的 remove，会同步 expectedModCount
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (shouldDelete(it.next())) {
        it.remove();
    }
}
// 方式二（JDK 8+）：条件删除，一行搞定
list.removeIf(s -> shouldDelete(s));
```

并发遍历场景则应换用 CopyOnWriteArrayList 这类基于快照迭代的集合，而不是给迭代器加锁。

## 集合转数组：toArray 传空数组

**现象**：`list.toArray()` 返回 Object[]，强转成 String[] 抛 ClassCastException。

**原理**：无参 toArray 丢失泛型信息，只能返回 Object[]；带参版本 `toArray(T[] a)` 依据传入数组的运行时类型反射创建结果数组——传入数组容量不够时新建，够用时直接填充。

**正确写法**：`list.toArray(new String[0])`。长度 0 的数组只起「类型模板」作用，实测比预分配 size 长度的数组更快：零长度数组的分配路径被 JVM 高度优化，省掉了预分配场景的数组清零开销。

## Stream 转 Map：两个暗坑

**现象**：`Collectors.toMap(Person::getName, Person::getPhone)` 在某条数据 phone 为 null 时抛 NPE；key 重复时抛 IllegalStateException，报错信息还很晦涩。

**原理**：toMap 内部走 `Map.merge` 累积元素，而 merge 开头对 value 做 `Objects.requireNonNull`，value 为 null 直接 NPE；不传合并函数时，遇到重复 key 默认实现就是抛异常。这两个坑都只在线上数据触到时才暴露，测试数据往往恰好绕开。

**正确写法**：提前过滤 null，并显式给出合并函数明确冲突策略：

```java
list.stream()
    .filter(p -> p.getPhone() != null)
    .collect(Collectors.toMap(Person::getName,
                              Person::getPhone,
                              (oldV, newV) -> oldV));
```

## 集合去重：别用 List.contains 硬扛

**现象**：循环里 `if (!result.contains(e)) result.add(e)` 去重，数据量一大就慢得离谱。

**原理**：ArrayList 的 contains 是线性扫描 O(n)，嵌在循环里整体复杂度 O(n²)；HashSet 靠哈希定位加 equals 判同去重，单次接近 O(1)，整体 O(n)，数据量上万时差距是数量级的。

**正确写法**：`new HashSet<>(list)`；需要保留原始顺序时用 `new LinkedHashSet<>(list)`，去重与保序兼得。

## 并发场景：别裸用 HashMap

**现象**：多线程 put 同一个 HashMap，JDK 7 下可能因扩容死循环把 CPU 打满，任何版本都可能数据覆盖、size 计数失真。

**原理**：put 的「检查桶是否为空—写入节点」不是原子操作，并发下相互覆盖；JDK 7 的头插法扩容在并发时会形成环形链表，get 命中后无限循环。

**正确写法**：直接使用 ConcurrentHashMap；复合操作（先判存在再写入）用 `putIfAbsent`、`computeIfAbsent`，别手写 check-then-act。读多写少的列表场景考虑 CopyOnWriteArrayList；不要指望 Collections.synchronizedList 解决一切——它的迭代仍需手动同步。

## 小结

- 判空用 `isEmpty()`；asList、subList、unmodifiableList 都是视图，改结构前先想清楚改的是谁。
- foreach 里删除用 `Iterator.remove` 或 `removeIf`；转数组传 `new String[0]`。
- toMap 防 null 值、防重复 key；去重交给 Set；并发交给 JUC 并发容器，别裸用 HashMap。
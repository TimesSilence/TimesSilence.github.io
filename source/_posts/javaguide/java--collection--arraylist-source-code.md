---
title: "ArrayList 源码分析"
date: 2019-03-21 10:24:00
updated: 2019-03-21 10:24:00
permalink: knowledge/java/collection/arraylist-source-code/
categories:
  - Java
tags:
  - Java集合
  - ArrayList
description: "从 JDK 8 源码出发，拆解 ArrayList 的动态数组本质、1.5 倍扩容与拷贝机制、modCount 与 fail-fast、subList 视图陷阱，并还原与 LinkedList 对比的真相。"
---

ArrayList 是整个集合框架中使用频率最高的类：底层只有一个 Object 数组，却通过懒初始化、1.5 倍扩容、批量拷贝把「动态数组」做得足够高效。读懂它的 grow、modCount 和 subList，就能解释日常开发里一大半诡异的并发修改异常和视图联动问题。

<!-- more -->

## 它解决什么问题

Java 数组一旦创建长度就固定，而业务里的列表长度几乎总是未知的。ArrayList 在普通数组外面包了一层「容量管理」：对外暴露 size（元素个数），对内维护 elementData.length（数组容量），当 size 逼近容量时自动扩容。它要回答的核心问题是两个：怎么让随机访问保持 O(1)，又怎么让追加元素的均摊成本也是 O(1)。前者靠数组的内存连续性天然成立，后者靠「每次扩容按倍数放大，而不是一次加一个」来保证。

理解 ArrayList 的价值不只在用它，更在于它是 fail-fast 迭代器、视图（view）设计、数组拷贝这些 JDK 通用模式最干净的样本。

## 核心原理

```java
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable {

    private static final int DEFAULT_CAPACITY = 10;
    private static final Object[] EMPTY_ELEMENTDATA = {};
    private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};

    transient Object[] elementData;  // 存放元素的数组，size 之外的槽位是预留容量
    private int size;                // 实际元素个数
}
```

两个设计细节值得注意。其一，`elementData` 被 `transient` 修饰，序列化走自定义的 `writeObject`：只写出前 size 个真实元素，而不是把整个带着预留空槽的数组写出去，避免浪费字节流。其二，JDK 8 的无参构造并不分配数组，只是把共享空数组 `DEFAULTCAPACITY_EMPTY_ELEMENTDATA` 赋给 `elementData`，第一次 add 才真正扩容到 10。空列表因此几乎零成本——大量「建了没用」的列表字段不再白白占内存。用 `EMPTY_ELEMENTDATA` 和 `DEFAULTCAPACITY_EMPTY_ELEMENTDATA` 两个不同的空数组，正是为了区分「显式指定 0 容量」和「默认构造」，后者首次扩容要补到默认的 10。

`RandomAccess` 是一个空标记接口，作用是告诉算法层（如 `Collections.binarySearch`）：这个列表按下标访问很快，可以放心用 for-i 遍历而不必退化到迭代器。

## 深入机制

### add 与扩容：grow 的 1.5 倍

```java
public boolean add(E e) {
    ensureCapacityInternal(size + 1);  // 先确认容量，modCount 也随之 +1
    elementData[size++] = e;
    return true;
}

private static int calculateCapacity(Object[] elementData, int minCapacity) {
    if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
        return Math.max(DEFAULT_CAPACITY, minCapacity); // 默认空表首次补到 10
    }
    return minCapacity;
}

private void grow(int minCapacity) {
    int oldCapacity = elementData.length;
    int newCapacity = oldCapacity + (oldCapacity >> 1);   // 旧容量的 1.5 倍
    if (newCapacity - minCapacity < 0)
        newCapacity = minCapacity;                        // 1.5 倍仍不够就直接用需求值
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);          // 超过 MAX_ARRAY_SIZE 的兜底
    elementData = Arrays.copyOf(elementData, newCapacity);
}
```

逐段看：

1. **容量预检**：add 前先把 `size + 1` 作为最小需求容量传下去，内部判断 `minCapacity - elementData.length > 0` 才触发 grow。无参构造的列表第一次 add 时，calculateCapacity 把需求抬到 10，于是「默认容量 10」在这一刻才真正落地。
2. **1.5 倍放大**：`oldCapacity + (oldCapacity >> 1)` 用右移代替除 2。为什么是 1.5 而不是 2？翻倍扩容在极限情况下会浪费接近一半的数组空间（刚扩完只用了一半时，旧空间全部空置）；扩得太小又会频繁触发拷贝。1.5 倍是空间浪费与拷贝频率的折中，且允许旧数组内存未来被复用（分配器层面）。
3. **拷贝落地**：`Arrays.copyOf` 内部新建数组并调用 `System.arraycopy` 把旧元素整体搬过去。每次扩容都是一次 O(n) 的搬迁，但因为容量按几何级数增长，追加 n 个元素的总拷贝次数是 O(log n) 级别，均摊到每次 add 仍是 O(1)——这就是「均摊 O(1)」的准确含义。

`hugeCapacity` 处理极端情况：`MAX_ARRAY_SIZE` 取 `Integer.MAX_VALUE - 8`，预留的 8 字节是给某些 VM 的数组头；需求超过它才放开到 `Integer.MAX_VALUE`。

### 中间插入与删除：搬移的代价

```java
public void add(int index, E element) {
    rangeCheckForAdd(index);
    ensureCapacityInternal(size + 1);
    System.arraycopy(elementData, index, elementData, index + 1, size - index);
    elementData[index] = element;
    size++;
}

public E remove(int index) {
    rangeCheck(index);
    modCount++;
    E oldValue = elementData(index);
    int numMoved = size - index - 1;
    if (numMoved > 0)
        System.arraycopy(elementData, index + 1, elementData, index, numMoved);
    elementData[--size] = null;  // 置空最后一个槽位，让 GC 能回收
    return oldValue;
}
```

指定位置插入要把 index 之后的元素整体右移一格，删除则左移一格并清空尾槽。两处都用 `System.arraycopy` 这个 native 方法完成内存级搬移——它比手写循环快得多，但时间复杂度依然是 O(n - index)，位置越靠前代价越高。remove 末尾的 `elementData[--size] = null` 是个容易忽略的细节：不置空的话，数组里残留的引用会让已「删除」的对象无法被 GC 回收，造成隐蔽的内存泄漏。

### modCount 与 fail-fast

ArrayList 的迭代器持有一个快照字段 `expectedModCount`，初始化时等于当时的 `modCount`。此后每次 `next()` 前都会校验：

```java
final void checkForComodification() {
    if (modCount != expectedModCount)
        throw new ConcurrentModificationException();
}
```

所有结构性修改（add、remove、clear、ensureCapacity 引发的扩容路径等）都会让 `modCount++`。一旦迭代期间绕开迭代器直接改列表，计数失配，下次迭代操作立即抛异常。需要明确两点：迭代器自己的 `remove()` 会在删除后同步 `expectedModCount`，所以是安全的；fail-fast 只是最佳努力的行为检查，不能当作并发控制手段——它可能漏报，真正的并发场景请换 `CopyOnWriteArrayList` 或 `Collections.synchronizedList`。

### subList：视图而非副本

`subList(from, to)` 返回的是共享底层数组的一个视图：内部类 SubList 持有父列表引用、offset 和 size，所有读写都直接落在原数组上。由此引出两个经典坑：

- 对子列表的增删改会反映到父列表，反之亦然；
- 拿到子列表后若直接修改父列表（比如父列表 add 了一个元素），子列表的 `expectedModCount` 失配，之后对子列表的任何操作都抛 `ConcurrentModificationException`。

要一份真正独立的子列表，用 `new ArrayList<>(list.subList(a, b))` 复制出来。

## 工程实践

- **预估容量**：已知要放 N 个元素时，`new ArrayList<>(N)` 或 add 前调一次 `ensureCapacity(N)`，把多次 1.5 倍扩容合并成一次分配，省掉中间所有数组拷贝。N 越大收益越明显。
- **批量操作用 addAll**：`addAll` 内部先一次性扩容再整体 arraycopy，比循环单 add 少走了重复的容量检查。
- **循环删除的正确姿势**：不要用 for-i 正序 remove（会跳元素），要么倒序删，要么用 `iterator.remove()`，要么直接 `removeIf`。
- **不共享给多线程**：ArrayList 没有任何同步措施，modCount 检查也不是同步替代品。

## 对比与权衡

| 维度 | ArrayList | LinkedList |
| --- | --- | --- |
| 底层结构 | 动态 Object 数组 | 双向链表 |
| get/set 按下标 | O(1) | O(n)，需从近端头/尾遍历 |
| 尾部 add | 均摊 O(1) | O(1) |
| 头/中部插入删除 | O(n)，数组搬移 | 定位 O(n) + 改指针 O(1) |
| 内存开销 | 仅预留空槽，元素紧邻 | 每个节点多两个引用，且对象分散 |
| 缓存友好性 | 高（连续内存） | 低（指针跳转） |

表面上看「链表插入快」占优，实际结论是：LinkedList 的任意位置插入要先花 O(n) 找到节点，定位本身比 ArrayList 的 arraycopy 搬移更慢，因为 arraycopy 是连续内存的批量拷贝，常数极小；而链表指针在堆里四处跳转，缓存命中率低。再加上每个节点额外的两个引用开销，绝大多数「查询为主、偶发增删」的场景 ArrayList 都更快。

## 面试视角

**ArrayList 的扩容过程是怎样的？** add 前用 `size + 1` 做最小需求容量，发现现有数组放不下时进入 grow：新容量取旧容量的 1.5 倍（`old + (old >> 1)`），仍不够则直接用需求值，超过 `MAX_ARRAY_SIZE` 走 hugeCapacity 兜底，最后 `Arrays.copyOf` 把旧数组拷进新数组。无参构造首次 add 会先补到默认容量 10。

**为什么扩容是 1.5 倍而不是 2 倍？** 倍数越大空间浪费越严重：2 倍扩容后数组可能接近一半空置，且旧数组内存难以被后续分配复用；倍数太小则扩容频繁、拷贝次数上升。1.5 倍在空间利用率与拷贝频率之间取了折中。

**fail-fast 机制是怎么实现的，能保证线程安全吗？** 结构性修改会让 `modCount++`，迭代器创建时记录 `expectedModCount`，每次迭代前比对，不一致就抛 `ConcurrentModificationException`。它只是开发期的行为检查，可能漏报，不能替代同步；多线程共享应使用 CopyOnWriteArrayList 或同步包装。

**subList 为什么不能随便用？** subList 返回的是共享底层数组的视图而非副本，父子列表互相可见对方的修改；且拿到子列表后若直接对父列表做结构性修改，子列表的 modCount 校验会失败并抛异常。需要独立数据时应显式复制。

**ArrayList 的数组为什么用 transient 修饰还能序列化？** 它实现了 `writeObject`/`readObject` 自定义序列化：只写出 size 个真实元素，跳过预留空槽，节省字节流；反序列化时再按实际个数重建数组。

## 小结

- ArrayList 的本质是「数组 + 容量管理」：无参构造给空数组，首次 add 扩到 10，之后按 1.5 倍几何扩容，保证尾插均摊 O(1)。
- 中间插入删除靠 `System.arraycopy` 搬移，代价 O(n) 但常数小；remove 后尾槽置空防止内存泄漏。
- `modCount` 是结构性修改计数，迭代器据此实现 fail-fast，但它不是并发方案。
- subList 是视图，父子联动且有 modCount 陷阱；预分配容量和 addAll 是日常最有价值的两个优化点。
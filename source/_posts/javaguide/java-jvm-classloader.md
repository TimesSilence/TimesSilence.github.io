---
title: "类加载器详解（重点）"
date: 2021-08-18 17:43:00
updated: 2021-08-18 17:43:00
permalink: knowledge/java/jvm/classloader/
categories:
  - Java
tags:
  - JVM
  - 类加载器
description: "拆解启动/扩展/应用/自定义四类加载器的职责边界，双亲委派模型的工作流程与安全价值，以及 SPI、Tomcat 隔离、热部署三类打破委派的经典场景。"
---

类加载器是 JVM 把「字节码」变成「Class 对象」的入口，也是 Java 实现动态加载、模块隔离与安全防线的基石。本文讲清四类加载器的分工、双亲委派模型的执行流程与三大价值，以及为什么 SPI、Tomcat、热部署必须打破它。

<!-- more -->

## 它解决什么问题

编译产物的 `.class` 文件只是磁盘上的字节流，JVM 不可能启动时把几万类全部读进内存——既慢又浪费。真正合理的策略是「用到才加载」，而「从哪里拿字节流、由谁把它定义成 Class」这件事，就交给了类加载器。

字节流的来源被刻意抽象化：可以来自本地 jar、网络下载、数据库，甚至是运行时动态生成（动态代理、Lambda）。只要最终能产出符合规范的字节数组，`defineClass` 就能把它变成可用的类。这个抽象带来两个直接收益：一是应用可以在运行期扩展自己的代码来源；二是不同加载器定义的同名类互不相同，为容器隔离（Tomcat 多应用）和热部署提供了可能。

## 核心原理

### 四类加载器的职责

以 JDK 8 的经典视角看，JVM 内置三层加载器，加上用户自定义的一层：

- **启动类加载器（Bootstrap）**：JVM 内置，Java 代码里拿不到它的引用，`getClassLoader()` 返回 `null` 即表示由它加载。负责 `JAVA_HOME/lib` 下的核心类库（JDK 8 的 `rt.jar`，如 `java.lang.*`、`java.util.*`）。
- **扩展类加载器（Extension）**：加载 `lib/ext` 目录及 `java.ext.dirs` 指定路径的类。JDK 9 模块化之后被**平台类加载器（Platform）**取代，职责变为加载 `java.sql` 等平台模块。
- **应用类加载器（Application/System）**：加载 classpath 上的类，我们写的业务代码默认都由它定义。
- **自定义类加载器**：继承 `ClassLoader`，自己控制字节流来源，用于加密类解密、网络加载、隔离部署等场景。

### 双亲委派的工作流程

一个类加载器收到加载请求后，第一反应不是自己干活，而是把请求交给父加载器；父加载器再向上交，直到启动类加载器；只有父加载器在自己的搜索范围内找不到这个类，子加载器才亲自尝试。逻辑全部收敛在 `ClassLoader.loadClass` 里：

```java
protected Class<?> loadClass(String name, boolean resolve) {
    synchronized (getClassLoadingLock(name)) {
        Class<?> c = findLoadedClass(name);      // 1. 已加载过就直接返回
        if (c == null) {
            try {
                if (parent != null) {
                    c = parent.loadClass(name, false); // 2. 先委派父加载器
                } else {
                    c = findBootstrapClassOrNull(name); // 3. 顶层交给 Bootstrap
                }
            } catch (ClassNotFoundException e) {
                // 父加载器找不到，忽略异常继续
            }
            if (c == null) {
                c = findClass(name);             // 4. 父不行，才轮到我自己
            }
        }
        if (resolve) {
            resolveClass(c);
        }
        return c;
    }
}
```

注意两点细节：一是每个加载器都先查自己的 `findLoadedClass` 缓存，已加载过的类不会重复定义；二是「父子关系」是组合（`parent` 字段）而非继承——自定义加载器通常默认以应用类加载器为父。

### 委派的三大价值

1. **安全**：`java.lang.String` 永远由启动类加载器定义，应用在 classpath 下放一个同名伪造类也不会被采用，核心 API 不会被篡改。
2. **唯一性**：类的身份 = 全限定名 + 定义它的加载器。委派保证同一委派链上一个类只有一个定义，不会出现「两个 String 互相赋值报错」的混乱。
3. **避免重复加载**：父加载器加载过的类，子加载器直接复用，省内存也省去重复链接的开销。

需要澄清：委派只是推荐模型而非强制约束，而且即使绕过它，`defineClass` 前的 `preDefineClass` 校验也会拒绝任何以 `java.` 开头的类名，抛出 `SecurityException`——这是比委派更底层的一道防线。

## 深入机制

### 自定义类加载器：重写哪个方法是分水岭

想自定义加载器，继承 `ClassLoader` 后有两个选择：

- 重写 `findClass`：**保留**双亲委派。父加载器加载不到的类，最后会回调到这里，这是最常用的扩展点。
- 重写 `loadClass`：**打破**委派。整个流程由你重写，可以「先自己找，找不到再问父亲」，Tomcat 就是这么干的。

一个从指定目录加载字节码的最小实现：

```java
public class DirClassLoader extends ClassLoader {
    private final String dir;

    public DirClassLoader(String dir, ClassLoader parent) {
        super(parent);
        this.dir = dir;
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        String path = dir + "/" + name.replace('.', '/') + ".class";
        try {
            byte[] bytes = Files.readAllBytes(Paths.get(path));
            // 字节流 → Class 对象，双亲委派流程不受影响
            return defineClass(name, bytes, 0, bytes.length);
        } catch (IOException e) {
            throw new ClassNotFoundException(name, e);
        }
    }
}
```

### 打破委派的三个经典场景

**SPI 与线程上下文类加载器（TCCL）**。JDBC 的接口 `java.sql.Driver` 由核心库提供（JDK 8 由启动类加载器加载），而实现 `com.mysql.cj.jdbc.Driver` 在应用的 classpath 下。按委派规则，上层加载器看不到下层加载器的类，`DriverManager` 根本找不到驱动实现。JDK 的解法是：把应用类加载器塞进线程私有数据里，`Thread.currentThread().getContextClassLoader()` 取出来用，相当于「上级借用下级的眼睛」反向加载。JDBC、JNDI、Spring 加载业务 Bean 都走这条路。

**Tomcat 的应用隔离**。每个 Web 应用配一个独立的 `WebAppClassLoader`，加载自己 `WEB-INF/classes` 和 `WEB-INF/lib` 下的类，并且**优先自己找、找不到才委派** Common 加载器。这样两个应用可以各用 Spring 4 和 Spring 5 互不干扰——因为同名类由不同加载器定义，在 JVM 眼里就是两个类。

**热部署**。类一旦由某加载器定义就无法更换同名类，但加载器实例本身可以丢弃。OSGi 和各类热部署方案的做法是：为每个模块/版本建一个加载器，更新时整个换掉旧加载器，旧类随旧加载器一起被 GC 卸载。

## 工程实践

排查类加载问题先分清两个高频异常：`ClassNotFoundException` 发生在**主动加载**时（`Class.forName`、TCCL 加载），意思是「按这个名字在搜索范围内没找到字节码」；`NoClassDefFoundError` 则是编译期类还在、运行期某个加载器找不到它的定义，常见于打包丢依赖或静态初始化失败后再次触发。前者是 checked exception，后者是 Error，栈信息里的加载器线索完全不同。

调试时一个实用技巧是打印加载器链：

```java
ClassLoader loader = Demo.class.getClassLoader();
while (loader != null) {
    System.out.println(loader);
    loader = loader.getParent();
}
System.out.println("null -> BootstrapClassLoader");
```

再叠加 `java -verbose:class` 观察每个类实际由谁从哪个路径加载，大多数「类冲突」「类找不到」都能定位到具体的 jar。

## 对比与权衡

| 维度 | 遵守双亲委派（重写 findClass） | 打破委派（重写 loadClass / TCCL） |
| --- | --- | --- |
| 核心类安全 | 有保障，核心类统一由上层定义 | 需自行控制边界，依赖 `java.*` 名校验兜底 |
| 类隔离能力 | 弱，同名类以父加载器定义为准 | 强，不同加载器可共存同名类 |
| 典型场景 | 加密类解密、自定义字节码来源 | Tomcat 多应用、SPI、热部署 |
| 复杂度与风险 | 低，流程仍是标准路径 | 高，委派顺序写错易出现 LinkageError |

一句话权衡：能用 `findClass` 解决就不要动 `loadClass`；只有隔离和反向加载这两类需求，才值得承担打破委派的复杂度。

## 面试视角

**问：双亲委派模型的工作流程是什么？** 收到加载请求先查缓存，没加载过就递归委派父加载器，直到启动类加载器；父加载器在自己搜索范围找不到时，子加载器才调用自己的 `findClass` 尝试，都失败则抛 `ClassNotFoundException`。

**问：为什么要有双亲委派？** 核心是安全与唯一性：保证 `java.lang.*` 等核心类只能由启动类加载器定义，防止伪造核心 API；同时避免同一类被重复加载、出现多个冲突定义。

**问：哪些场景打破了双亲委派？** 三个经典例子：SPI 通过线程上下文类加载器让上层加载器借道加载厂商实现；Tomcat 的 `WebAppClassLoader` 优先自加载实现应用间隔离；热部署/OSGi 通过替换加载器实例实现类的动态更新。

**问：自定义类加载器要重写哪个方法？** 想保留委派就重写 `findClass`，只控制字节码获取；想改变委派顺序才重写 `loadClass`。绝大多数场景前者就够。

**问：两个类「相同」的判定条件？** 全限定名相同，且由同一个类加载器定义，两者缺一不可。这也是 Tomcat 隔离能成立的规范基础。

## 小结

类加载器的本质是「字节码来源」的抽象：四层加载器划定职责边界，双亲委派用「先问父亲」的简单规则换来核心类安全、类定义唯一和不重复加载三大收益。而当隔离（Tomcat）、反向加载（SPI/TCCL）、动态更新（热部署）成为刚需时，打破委派同样有成熟范式。记住一条工程准则：优先重写 `findClass` 保留委派，只有明确需要隔离或反向加载时才动 `loadClass`。
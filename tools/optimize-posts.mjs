#!/usr/bin/env node
/**
 * Apply editorial cleanup to the HTML-to-Markdown migration.
 *
 * The explicit map keeps titles, summaries, and publication dates reviewable.
 * Existing permalinks remain untouched so historical links continue to work.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts');

const posts = [
  ['2017-07-17-day01笔记.md', 'Java 开发入门：环境、工具与 Hello World', '2017-07-17', '从计算机基础出发，认识 Java 的运行环境、开发工具、JDK 配置与第一个 Hello World 程序。'],
  ['2017-07-18-day02笔记.md', 'Java 数据基础：进制、常量与变量', '2017-07-18', '梳理二进制、不同进制之间的转换，以及 Java 常量、变量和基本数据类型的使用。'],
  ['2017-07-19-day03笔记.md', 'Java 运算符与条件控制', '2017-07-19', '介绍逻辑与位运算、键盘输入，以及 if、switch 等条件控制语句。'],
  ['2017-07-21-day04笔记.md', 'Java 循环与流程控制', '2017-07-21 09:00:00', '通过 for、while 和 do-while 掌握循环结构、跳转语句及常见练习。'],
  ['2017-07-21-day05笔记.md', 'Java 数组基础与常见操作', '2017-07-21 21:00:00', '从数组定义和内存结构入手，整理遍历、查找、排序及二维数组等常见操作。'],
  ['2017-07-22-day06笔记.md', 'Java 面向对象：类、对象与封装', '2017-07-22', '理解类与对象、成员变量、匿名对象、封装、private 与 this 的核心用法。'],
  ['2017-07-23-day07笔记.md', 'Java 面向对象：构造方法与静态成员', '2017-07-23', '整理构造方法、对象初始化、static 关键字及工具类的设计方式。'],
  ['2017-07-24-day08笔记.md', 'Java 继承、方法重写与 final', '2017-07-24', '理解 Java 继承体系、构造方法调用、方法重写以及 final 关键字。'],
  ['2017-07-25-day09笔记.md', 'Java 多态、抽象类与接口', '2017-07-25', '总结多态与类型转换、抽象类、接口以及它们在面向对象设计中的关系。'],
  ['2017-07-26-day10笔记.md', 'Java 包、权限修饰符与内部类', '2017-07-26', '介绍 package、import、访问权限，以及成员内部类、局部内部类和匿名内部类。'],
  ['2017-07-27-day11笔记.md', 'Eclipse 开发技巧与 Java Object 类', '2017-07-27', '整理 Eclipse 项目开发、调试和快捷操作，并认识 Java Object 类的核心方法。'],
  ['2017-07-28-day12笔记.md', 'Java 字符串与常用对象', '2017-07-28', '介绍 Scanner、String 等常用对象及字符串判断、查找、截取和转换操作。'],
  ['2017-07-29-day13笔记.md', 'Java StringBuffer、排序与包装类型', '2017-07-29', '整理 StringBuffer、StringBuilder、数组排序与查找，以及基本类型包装类。'],
  ['2017-07-30-day14笔记.md', 'Java 正则表达式与常用工具类', '2017-07-30', '汇总正则表达式、Math、Random、System、BigDecimal、Date 与 Calendar 等工具类。'],
  ['2017-08-01-day15笔记.md', 'Java 集合框架：List 与迭代器', '2017-08-01', '从集合框架入门，理解 Collection、List、迭代器与 ArrayList 的常见操作。'],
  ['2017-08-02-day16笔记.md', 'Java 集合框架：LinkedList、泛型与 Set', '2017-08-02', '整理 LinkedList、泛型、增强 for 循环、可变参数及 Set 集合。'],
  ['2017-08-03-day17笔记.md', 'Java 集合框架：HashSet 与 TreeSet', '2017-08-03', '理解 HashSet 的哈希机制、TreeSet 的排序规则及 Comparable、Comparator。'],
  ['2017-08-04-day18笔记.md', 'Java 集合框架：Map 与 Collections', '2017-08-04', '介绍 Map、HashMap、TreeMap、集合嵌套与 Collections 工具类。'],
  ['2017-08-05-day19笔记.md', 'Java 异常处理与 File 类', '2017-08-05', '梳理异常体系、try-catch、throw、throws、finally，以及 File 类的文件操作。'],
  ['2017-08-06-day20笔记.md', 'Java IO：字节流与缓冲流', '2017-08-06', '从 IO 流分类出发，介绍字节输入输出流、缓冲流和文件复制。'],
  ['2017-08-07-day21笔记.md', 'Java IO：字符流、编码与装饰模式', '2017-08-07', '整理字符流、缓冲字符流、编码转换，以及 IO 中的装饰器设计模式。'],
  ['2017-08-08-day22笔记.md', 'Java IO：序列化、打印流与 Properties', '2017-08-08', '介绍序列流、内存流、对象序列化、打印流、随机访问文件和 Properties。'],
  ['2017-08-09-day23笔记.md', 'Java 递归与经典算法练习', '2017-08-09', '通过目录遍历、文件复制、斐波那契数列、阶乘和约瑟夫环练习递归思维。'],
  ['2017-08-10-day24笔记.md', 'Java 并发：线程创建、同步与死锁', '2017-08-10', '认识 Java 线程模型、Thread 与 Runnable、线程调度、同步机制和死锁。'],
  ['2017-08-11-day25笔记.md', 'Java 并发工具、设计模式与 GUI 事件', '2017-08-11', '整理线程通信、锁、线程池、工厂与适配器模式，以及 GUI 事件监听。'],
  ['2017-08-12-day26笔记.md', 'Java 网络编程：UDP、TCP 与 Socket', '2017-08-12', '从网络通信三要素入手，实践 UDP、TCP、Socket 与多线程服务端。'],
  ['2017-08-13-day27笔记.md', 'Java 反射、类加载器与 JDK 新特性', '2017-08-13', '认识类加载机制和反射 API，并回顾 JDK 5、7、8 的代表性语言特性。'],
];

function cleanHeading(raw) {
  let text = raw.trim();
  text = text.replace(/^\d{2}\.\d{2}[_\s-]*/, '');
  text = text.replace(/\\([*_])/g, '$1');
  text = text.replace(/\*+/g, '');
  text = text.replace(/\((?:了解|掌握|重点|面试题?)\)/g, '');
  text = text.replace(/\((?:面试的时候[^)]*|开发[^)]*)\)/g, '');
  text = text.replace(/day\d+总结/gi, '小结');
  const grouped = text.match(
    /^(?:计算机基础知识|Java语言基础|Java开发工具|面向对象|常见对象|集合框架|异常|File类|IO流|多线程|网络编程|反射|JDK\d+新特性|设计模式|GUI)\((.+)\)$/,
  );
  if (grouped) text = grouped[1];
  text = text.replace(/\s+/g, ' ').trim();
  return text || '小结';
}

function optimizeBody(body, summary) {
  const marker = '<!-- more -->';
  const markerIndex = body.indexOf(marker);
  if (markerIndex >= 0) {
    body = `${summary}\n\n${marker}${body.slice(markerIndex + marker.length)}`;
  } else {
    body = `${summary}\n\n${marker}\n\n${body}`;
  }

  // Some headings were paragraphs in the generated HTML. Turndown therefore
  // preserved their literal ### text, occasionally nested inside list items.
  body = body.replace(/^[ \t]*#{3,}[ \t]*(.+)$/gm, (_match, heading) => {
    return `\n## ${cleanHeading(heading)}\n`;
  });

  body = body.replace(/^(#{2})\s+(.+)$/gm, (_match, hashes, heading) => {
    return `${hashes} ${cleanHeading(heading)}`;
  });
  body = body.replace(/^(\s*-\s+)[A-Z]:\s*/gm, '$1');
  body = body
    .replace(/^–>\s*$/gm, '')
    .replace(/ObjecOutputStream/g, 'ObjectOutputStream')
    .replace(/BufferOutputStream/g, 'BufferedOutputStream')
    .replace(/Stirng/g, 'String')
    .replace(/synchroinzed/g, 'synchronized')
    .replace(/模版/g, '模板')
    .replace(/equals\(animale\)/g, 'equals(animalName)')
    .replace(/^\s*[0-9]{20,}\s*$/gm, '')
    .replace(/^\s*#\s+\\#\s+\\\*\s+package 包名;\s*$/gm, '    -   `package 包名;`');
  body = body.replace(/\\\*\\\*|\*\*\\\*/g, '');
  body = body.replace(/\n{3,}/g, '\n\n');
  return body.trimEnd() + '\n';
}

async function main() {
  const available = new Set(await readdir(POSTS_DIR));
  for (const [file, title, date, summary] of posts) {
    if (!available.has(file)) throw new Error(`Missing post: ${file}`);
    const fullPath = path.join(POSTS_DIR, file);
    const source = await readFile(fullPath, 'utf8');
    const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) throw new Error(`Invalid front matter: ${file}`);

    let frontMatter = match[1]
      .replace(/^title:.*$/m, `title: ${JSON.stringify(title)}`)
      .replace(/^date:.*$/m, `date: ${date.includes(' ') ? date : `${date} 09:00:00`}`);
    if (!/^description:/m.test(frontMatter)) {
      frontMatter += `\ndescription: ${JSON.stringify(summary)}`;
    } else {
      frontMatter = frontMatter.replace(/^description:.*$/m, `description: ${JSON.stringify(summary)}`);
    }

    const body = optimizeBody(match[2].replace(/^\n+/, ''), summary);
    await writeFile(fullPath, `---\n${frontMatter}\n---\n\n${body}`, 'utf8');
  }
  console.log(`Optimized ${posts.length} posts.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

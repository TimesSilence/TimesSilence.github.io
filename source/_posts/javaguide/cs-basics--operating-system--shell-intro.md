---
title: Shell 编程基础知识总结
date: 2018-07-31 12:08:00
updated: 2018-07-31 12:08:00
permalink: knowledge/cs-basics/operating-system/shell-intro/
categories:
  - 计算机基础
tags: [操作系统, Shell]
description: 从用户与内核的接口定位讲清 Shell——变量与环境变量、管道与重定向背后的 fork/exec/dup2、find+xargs 与 grep+awk 组合、脚本调试基本功。
---

Shell 是用户与内核之间的命令解释器，也是把小程序拼成数据流的脚本语言。本文讲清变量与环境变量、管道与重定向背后的 fork/exec/dup2 机制、find+xargs 与 grep+awk 两组经典组合，以及脚本调试的基本功。

<!-- more -->

## Shell 的定位

内核不认识 `ls -l | grep log` 这样的字符串。Shell 站在用户与内核之间：读入命令行，做变量替换、通配符展开、参数切分，然后调用 `fork`、`exec` 等系统调用把程序跑起来，再把结果交回终端。交互时它是命令解释器，写进文件就是脚本语言——变量、条件、循环、函数一样不缺。常见实现有 bash（主流默认）、sh（POSIX 标准）、zsh、dash 等；写脚本第一行用 `#!/bin/bash` 声明解释器。

## 变量与环境变量

Shell 变量分两类。普通变量 `name="value"` 只活在当前 Shell 进程里，子进程看不到；`export PATH="$HOME/bin:$PATH"` 导出的环境变量才会随 `fork` 被子进程继承——`PATH`、`HOME` 都是如此。赋值等号两边不能有空格，引用时写 `"$name"`：不加双引号的变量会被重新分词，含空格的路径立刻出问题。

还有一组特殊变量由 Shell 维护：`$?` 是上一条命令的退出码（0 表示成功），`$#` 是参数个数，`"$@"` 是全部参数（保留边界，遍历参数只用它），`$$` 是当前进程号。

退出码是脚本可靠性的基础：每条命令执行完都会返回状态，脚本应显式判断失败分支，而不是只看屏幕上有没有报错。例如 `if ! cp a b; then echo "备份失败" >&2; exit 1; fi`，比跑完再人工检查可靠得多。

## 管道与重定向的进程视角

`ps aux | grep java` 背后没有魔法，是几次系统调用的配合：

```text
1. Shell 调用 pipe() 创建管道，得到读端、写端两个文件描述符
2. fork() 出两个子进程，分别准备执行 ps 和 grep
3. 左子进程用 dup2 把管道写端复制到标准输出（fd 1）
   右子进程用 dup2 把管道读端复制到标准输入（fd 0）
4. 两个子进程各自 exec 成目标程序，字节流开始流动
```

重定向同理：`cmd > out.log` 是子进程打开文件后用 `dup2` 覆盖 fd 1；`2>&1` 是让 fd 2 指向 fd 1 当前的目标。理解了"管道传的是字节流、走内核缓冲区、两端进程并行跑"，就能解释为什么管道前段失败默认不影响整体退出码，以及为什么脚本里几乎必开 `set -o pipefail`。

## 两组常用组合

### find 配 xargs：批量处理文件

```bash
# 找出 30 天前的日志并删除
find /var/log/myapp -name "*.log" -mtime +30 -print0 | xargs -0 rm -f
```

`find` 负责按条件筛文件，`xargs` 把输入拼成参数分批喂给后面的命令，避免"参数列表过长"。文件名可能含空格时，用 `-print0` 配合 `xargs -0` 以 NUL 分隔，是最稳的写法。

### grep 配 awk：文本过滤与提取

```bash
# 找出 ERROR 日志并提取前两列与最后一列
grep "ERROR" app.log | awk '{print $1, $2, $NF}'
```

grep 按行过滤，awk 按列处理——一个负责"选哪些行"，一个负责"取哪几列"。日志分析、统计报错分布，九成都逃不出这个套路。

## 脚本调试与健壮性

- `bash -n script.sh`：只查语法不执行，提交前必跑。
- `set -x`：逐行打印展开后的命令，定位"哪一步开始不对"最直接；也可用 `bash -x script.sh` 整脚本开启。
- 脚本开头写 `set -euo pipefail`：遇错退出、用未定义变量报错、管道中间失败即整体失败，把隐性错误显性化。
- 交给 shellcheck 做静态检查，未加引号的变量、错误的重定向这类常见问题它会直接指出。

## 小结

- Shell 是用户与内核的接口：解析命令行，用 fork/exec/dup2 组装进程与数据流。
- 普通变量不出当前进程，`export` 才能传给子进程；引用变量一律加双引号。
- 管道是并行进程间的字节流，重定向是文件描述符的替换。
- find+xargs 管文件批处理，grep+awk 管文本行列；调试三板斧是 `bash -n`、`set -x`、`set -euo pipefail`，再加 shellcheck。
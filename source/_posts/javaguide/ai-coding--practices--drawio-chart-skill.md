---
title: "JavaGuide 专属 draw.io 绘图 Skill 开源：用 Agent 自动生成可编辑的 draw.io 技术图"
date: 2026-05-24 15:29:00
updated: 2026-05-24 15:29:00
permalink: knowledge/ai-coding/practices/drawio-chart-skill/
categories:
  - AI 编程
tags:
  - Skills
  - draw.io
  - 架构图
description: "让 Agent 生成可继续编辑的 draw.io 技术图：为什么保留 .drawio 源文件、draw.io XML 的基本结构、绘图 Skill 的约束与提示词写法、适用场景与局限。"
---

技术文章的配图不该是一锤子买卖：文章会迭代，图就得跟着改。把"画 draw.io 图"这件事固化成 Agent Skill 之后，Agent 可以直接产出可继续编辑的 `.drawio` 源文件，架构图、流程图的生成和维护都能纳入自动化流程。本文讲清这套做法的价值、draw.io XML 的基本结构，以及提示词该怎么写。

<!-- more -->

## 为什么让 AI 生成 draw.io，而不是直接生成图片

图片生成模型出图快、视觉表现强，但技术配图的核心诉求是可维护：文章发布后，节点名称、箭头方向、术语措辞经常要调整。手里只剩一张 PNG 时，要么整张重画，要么硬改图片，风格还未必对得上。

`.drawio` 源文件则不同：它可以在 diagrams.net 或 draw.io 桌面版里继续编辑，需要时一键导出 PNG、SVG、PDF；文件本身体积小，跟文章一起进仓库也没有负担。因此更合理的分工是把结构和表现拆开——Skill 负责生成结构准确的 `.drawio`，确实需要更强视觉表现时，再交给图片生成模型做位图层面的增强，结构始终留在源文件里。

这也决定了它和 Mermaid 的差异：Mermaid 胜在"文本即代码"，而 draw.io 的产物可以被不熟悉代码的协作者直接打开调整，交付面更宽。

## draw.io XML 的基本结构

`.drawio` 文件本质上是一个 XML 文档，骨架如下：

```xml
<mxfile>
  <diagram name="login-flow" id="page-1">
    <mxGraphModel dx="800" dy="600" grid="1">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="start" value="开始" style="rounded=1;" vertex="1" parent="1">
          <mxGeometry x="120" y="40" width="120" height="40" as="geometry" />
        </mxCell>
        <mxCell id="verify" value="校验账号密码" vertex="1" parent="1">
          <mxGeometry x="120" y="140" width="120" height="40" as="geometry" />
        </mxCell>
        <mxCell id="e1" value="提交" edge="1" source="start" target="verify" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

读懂几个要点，就能看懂 Agent 产出的图：

- `mxfile` 是根元素，`diagram` 对应一个画布页，一份文件可以容纳多页，适合给同一篇文章集中管理多张配图。
- 每个图元都是一个 `mxCell`：`vertex="1"` 表示节点，`edge="1"` 表示连线，连线通过 `source`、`target` 引用节点的 `id`。
- `id="0"` 和 `id="1"` 是固定的根层与默认层，业务图元都挂在它们下面。
- 节点的位置和尺寸写在 `mxGeometry` 里，样式写在 `style` 字符串里，显示文字放在 `value` 属性上。

正因为结构规整、语义明确，Agent 生成和修改它都很可靠——这是 draw.io 适合做"AI 绘图中间格式"的根本原因。

## 把绘图流程固化成 Skill

公开的 [`drawio-chart`](https://github.com/Snailclimb/AIGuide/tree/main/skills/drawio-chart) Skill 是这套思路的完整实现。它的 `SKILL.md` 只放关键约定：什么时候该用（流程图、架构图、时序图、ER 图、状态机图等），什么时候不该用（只要 Mermaid 代码、要海报插画），动笔前要收集哪些信息（主题、图表类型、关键节点、节点关系、是否导出），生成时按什么顺序搭建（标题、容器、核心节点、连线、标签），交付前检查什么。

细节拆进 `references/` 目录按需加载：样式规范（配色、字体、节点语义）、XML 结构与布局模板、导出命令与文件命名、常见用法示例。主文件保持精简，Agent 命中任务后再按当前需要读对应参考文件，上下文不被无关细节挤满，执行也更稳定。

其中几条硬约束值得借鉴：颜色按节点语义分配，入口、业务服务、存储、外部依赖各有固定色值，同一批图风格统一，读者不必每张重新理解颜色；`value` 默认使用纯文本，换行用 XML 换行实体，不混入 HTML 标签，避免后续渲染和再编辑出问题；连线标签保持简短，长说明写进节点或旁注；无论导出是否成功，`.drawio` 源文件必须保留。

通过 `npx skills` 生态可以直接安装：

```bash
npx skills add Snailclimb/AIGuide/skills/drawio-chart
```

## 提示词设计要点

让这套 Skill 稳定产出，提示词要注意三点。

第一，直接点名 Skill，例如以"使用 $drawio-chart"开头，让 Agent 立刻进入正确的工作流，而不是靠猜。

第二，给结构化的图表需求，而不是一个虚的标题。画微服务架构图，就要说清有哪些服务、哪些存储和外部依赖、请求从哪里进来、哪些调用是同步的、哪些链路走异步消息。给整篇文章配图时，更顺的做法是把文章路径交给它，让它先判断哪些结构值得画，再约定所有子图放进同一文件的不同 `diagram` 页面、主文件名与文章保持一致。

```markdown
使用 $drawio-chart 画一个用户登录流程图，包含：
输入账号密码 -> 校验账号密码 -> 成功跳转首页，失败则提示错误并允许重试。
要求保留 .drawio 源文件，并导出 PNG。
```

第三，把命名规范、风格要求、导出格式等长期约定沉淀进 Skill 或项目说明，而不是每次重复口述。

## 适用场景与局限

适合交给它的图主要有三类：步骤和分支清晰的流程图；要求风格统一的架构图与模块关系图；以及会反复修改、需要长期维护的图。

反过来，封面、海报这类重视觉表现的图应交给图片生成模型；白板手绘风有 Excalidraw 方向的方案更合适；要自包含 HTML 和网页交互的图，也有专门的工具可选。

另外两点要有心理预期：Agent 生成的初稿在线条、间距等细节上通常还需要手动微调；图与文章必须同步维护，节点和标题一旦和正文脱节，再漂亮也没有意义。

## 小结

用 AI 生成技术图，关键不是"生成"，而是"可维护"。draw.io XML 结构规整、人人可编辑，配合一个约束明确的绘图 Skill，让 Agent 负责搭结构、人负责审语义调细节，源文件随文章一起进仓库演进——这条链路比一次性图片走得远得多。
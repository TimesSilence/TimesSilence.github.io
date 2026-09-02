# TimesSilence.github.io

Dai Wei 的个人技术网站，记录软件开发、工程实践与技术思考。站点已从旧版 Hexo + spfk 迁移为 **Hexo 8 + Butterfly**。

## 本地运行

需要 Node.js **≥ 20.19**。

```bash
npm install
npm run server
```

浏览器打开 `http://localhost:4000`。

```bash
npm run build   # 生成 public/
```

## 内容迁移工具

旧站点备份在 `_legacy/`（已 gitignore）。若要重新抽取：

```bash
npm run extract
npm run optimize
```

`extract` 从旧 HTML 生成 Markdown，`optimize` 统一整理文章标题、摘要、发布日期和正文标题结构。重新抽取会覆盖当前文章，请先备份后续手工修改。

## JavaGuide 衍生笔记

公开技术主题以固定的 JavaGuide commit 为参考，逐篇重新组织为本站学习笔记。导航、作者经历、推广、付费内容和第三方转载不纳入迁移。

```bash
npm run inventory:javaguide  # 刷新固定版本来源清单
npm run normalize:javaguide  # 按清单统一日期、链接和元数据
npm run validate:javaguide   # 检查元数据和内容兼容性
```

来源清单和迁移报告位于 `data/`。许可证副本位于 `LICENSES/JavaGuide-Apache-2.0.txt`。

## 部署

仓库已加 GitHub Actions（`.github/workflows/pages.yml`）。在仓库 Settings → Pages 里把 Source 设为 **GitHub Actions**。自定义域仍是 `www.daiwei.biz`（`source/CNAME`）。

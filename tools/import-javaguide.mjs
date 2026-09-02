#!/usr/bin/env node
/**
 * Build a pinned, auditable inventory of JavaGuide technical documents.
 * This tool never publishes source text; it only records metadata used by
 * the editorial rewrite workflow.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPSTREAM = path.join(ROOT, '.cache', 'javaguide');
const DATA_DIR = path.join(ROOT, 'data');
const MANIFEST = path.join(DATA_DIR, 'javaguide-manifest.json');
const REPORT = path.join(DATA_DIR, 'javaguide-inventory.md');
const LICENSE_COPY = path.join(ROOT, 'LICENSES', 'JavaGuide-Apache-2.0.txt');
const PUBLIC_LICENSE_COPY = path.join(
  ROOT,
  'source',
  'licenses',
  'JavaGuide-Apache-2.0.txt',
);

const excludedRoots = new Map([
  ['docs/.vuepress/', 'VuePress implementation'],
  ['docs/about-the-author/', 'personal or author content'],
  ['docs/books/', 'book recommendations'],
  ['docs/high-quality-technical-articles/', 'external article index'],
  ['docs/javaguide/', 'project documentation'],
  ['docs/open-source-project/', 'project promotion or index'],
  ['docs/zhuanlan/', 'paid or promotional column'],
]);

const moduleNames = {
  'ai-coding': 'AI 编程',
  ai: '人工智能',
  'cs-basics': '计算机基础',
  database: '数据库',
  'distributed-system': '分布式系统',
  'high-availability': '高可用',
  'high-performance': '高性能',
  'interview-preparation': '面试与职业',
  java: 'Java',
  roadmap: '学习路线',
  snippets: '技术实践',
  'system-design': '系统设计',
  tools: '开发工具',
};

function extractTitle(markdown, fallback) {
  const frontMatter = markdown.match(/^---\n([\s\S]*?)\n---/);
  const fmTitle = frontMatter?.[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  const heading = markdown.match(/^#\s+(.+?)\s*$/m)?.[1];
  return (fmTitle || heading || fallback)
    .replace(/\s*\|\s*JavaGuide\s*$/i, '')
    .replace(/[*`]/g, '')
    .trim();
}

function slugify(sourcePath) {
  return sourcePath
    .replace(/^docs\//, '')
    .replace(/\/README\.md$/i, '/overview')
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9/._-]+/g, '-')
    .replace(/_/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '');
}

function exclusionReason(sourcePath, markdown) {
  if (sourcePath === 'docs/README.md' || sourcePath === 'docs/home.md') {
    return 'site navigation';
  }
  for (const [prefix, reason] of excludedRoots) {
    if (sourcePath.startsWith(prefix)) return reason;
  }
  if (!sourcePath.startsWith('docs/') || !sourcePath.endsWith('.md')) {
    return 'not a documentation markdown file';
  }
  if (/(付费|知识星球|公众号回复|扫码购买)/.test(markdown)) {
    return 'paid or promotional content';
  }
  if (
    /(?:本文|文章).{0,8}(?:转载|翻译自)|(?:原文|文章来源|原文链接)[:：]\s*https?:\/\//.test(
      markdown.slice(0, 3000),
    )
  ) {
    return 'third-party repost or translation';
  }
  if (markdown.replace(/^---[\s\S]*?---/, '').trim().length < 300) {
    return 'empty or navigation-only page';
  }
  return null;
}

function isAi(record) {
  return record.module === 'ai' || record.module === 'ai-coding';
}

function isRoadmap(record) {
  return (
    record.module === 'roadmap' ||
    record.slug === 'interview-preparation/java-roadmap'
  );
}

function trackRank(slug) {
  const rules = [
    [/^java\/overview/, 100],
    [/^java\/basis/, 110],
    [/^cs-basics\/overview/, 120],
    [/^cs-basics\/network/, 130],
    [/^cs-basics\/operating-system/, 140],
    [/^cs-basics\/data-structure/, 150],
    [/^java\/collection/, 160],
    [/^cs-basics\/algorithms/, 170],
    [/^database\/(overview|basis|character-set|sql)/, 180],
    [/^database\/mysql/, 190],
    [/^java\/io/, 205],
    [/^tools\/(overview|git|maven)/, 215],
    [/^java\/concurrent/, 225],
    [/^database\/redis/, 235],
    [/^database\/(mongodb|nosql)/, 242],
    [/^java\/jvm/, 250],
    [/^java\/new-features/, 258],
    [/^system-design\/(overview|basis|design-pattern|j2ee|web)/, 270],
    [/^system-design\/framework/, 278],
    [/^system-design\/security/, 286],
    [/^tools\/(docker|gradle)/, 292],
    [/^distributed-system/, 310],
    [/^high-performance/, 330],
    [/^high-availability/, 340],
    [/^interview-preparation\/java-roadmap/, 710],
    [/^interview-preparation/, 350],
    [/^ai\/overview/, 500],
    [/^ai\/ai-core/, 505],
    [/^ai\/todo/, 508],
    [/^ai\/llm-basis/, 520],
    [/^ai\/rag/, 545],
    [/^ai\/agent/, 570],
    [/^ai\/system-design/, 590],
    [/^ai\/interview/, 610],
    [/^ai-coding\/overview/, 620],
    [/^ai-coding\/practices/, 635],
    [/^ai-coding\/principles/, 655],
    [/^ai-coding\/project/, 670],
    [/^ai-coding\/cases/, 685],
    [/^roadmap\/overview/, 700],
    [/^roadmap\/java-to-ai/, 720],
    [/^roadmap\/backend-to-ai/, 730],
    [/^roadmap\/full-stack/, 740],
    [/^roadmap\/test-development/, 750],
    [/^roadmap/, 760],
  ];
  return rules.find(([pattern]) => pattern.test(slug))?.[1] ?? 400;
}

function nuance(slug) {
  let score = 0;
  if (/\/overview$|\/basis$|intro|basic-questions-01|http-status|tcp-connection|process-and-thread|linear-data|complexity-analysis|binary-search/.test(slug)) {
    score -= 12;
  }
  if (/interview|questions-0[23]|questions-0[45]/.test(slug)) score += 8;
  if (/source-code|implementation|in-action|optimization|auto-assembly/.test(slug)) {
    score += 12;
  }
  if (/virtual-thread|zero-copy|io-multiplexing|red-black|dynamic-programming|mvcc|raft|paxos|zab|graphrag|multi-agent|harness|observability/.test(slug)) {
    score += 10;
  }
  const javaVersion = slug.match(/java(\d+)/);
  if (javaVersion) score += Number(javaVersion[1]);
  if (/rag-basis|agent-basis|llm-operation|llm-basis\/overview/.test(slug)) score -= 8;
  return score;
}

function curriculumRank(record) {
  return trackRank(record.slug) * 100 + nuance(record.slug);
}

function formatUtc(value) {
  return new Date(value).toISOString().replace('T', ' ').slice(0, 19);
}

function spreadDates(items, start, end, curve) {
  const span = end - start;
  items.forEach((item, index) => {
    const progress = items.length <= 1 ? 0 : index / (items.length - 1);
    const eased = curve === 1 ? progress : progress ** curve;
    const hour = 8 + (index % 10);
    const minute = (index * 7) % 60;
    const stamp = new Date(start + span * eased);
    stamp.setUTCHours(hour, minute, 0, 0);
    item.date = formatUtc(stamp);
  });
}

function assignCurriculumDates(included) {
  const byRank = (left, right) => {
    const diff = curriculumRank(left) - curriculumRank(right);
    return diff || left.slug.localeCompare(right.slug);
  };
  const classic = included
    .filter((item) => !isAi(item) && !isRoadmap(item))
    .sort(byRank);
  const modern = included.filter((item) => isAi(item)).sort(byRank);
  const roadmaps = included.filter((item) => isRoadmap(item)).sort(byRank);
  spreadDates(classic, Date.UTC(2017, 8, 18), Date.UTC(2024, 5, 30), 1.12);
  spreadDates(modern, Date.UTC(2024, 8, 8), Date.UTC(2026, 7, 28), 0.42);
  spreadDates(roadmaps, Date.UTC(2026, 0, 15), Date.UTC(2026, 7, 20), 1);
}

async function git(...args) {
  const { stdout } = await exec('git', ['-C', UPSTREAM, ...args], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

async function main() {
  const commit = await git('rev-parse', 'HEAD');
  const files = (await git('ls-files', '-z', 'docs/**/*.md', 'docs/*.md'))
    .split('\0')
    .filter(Boolean)
    .sort();
  const preferredPathByCaseFold = new Map();
  for (const sourcePath of files) {
    const key = sourcePath.toLowerCase();
    const current = preferredPathByCaseFold.get(key);
    if (!current || sourcePath === key) preferredPathByCaseFold.set(key, sourcePath);
  }

  const included = [];
  const excluded = [];
  for (const sourcePath of files) {
    const markdown = await readFile(path.join(UPSTREAM, sourcePath), 'utf8');
    const preferredPath = preferredPathByCaseFold.get(sourcePath.toLowerCase());
    const reason =
      preferredPath !== sourcePath
        ? `case-insensitive duplicate of ${preferredPath}`
        : exclusionReason(sourcePath, markdown);
    const moduleId = sourcePath.split('/')[1] || 'other';
    const record = {
      sourcePath,
      sourceUrl: `https://github.com/Snailclimb/JavaGuide/blob/${commit}/${sourcePath}`,
      sourceCommit: commit,
      title: extractTitle(markdown, path.basename(sourcePath, '.md')),
      module: moduleId,
      category: moduleNames[moduleId] || '其他技术',
      slug: slugify(sourcePath),
    };
    if (reason) excluded.push({ ...record, reason });
    else included.push(record);
  }

  assignCurriculumDates(included);
  included.forEach((record) => {
    record.permalink = `knowledge/${record.slug}/`;
    record.status = 'pending';
  });

  await mkdir(DATA_DIR, { recursive: true });
  const license = await readFile(path.join(UPSTREAM, 'LICENSE'), 'utf8');
  await mkdir(path.dirname(LICENSE_COPY), { recursive: true });
  await mkdir(path.dirname(PUBLIC_LICENSE_COPY), { recursive: true });
  await writeFile(LICENSE_COPY, license);
  await writeFile(PUBLIC_LICENSE_COPY, license);
  await writeFile(
    MANIFEST,
    `${JSON.stringify(
      {
        upstream: 'https://github.com/Snailclimb/JavaGuide',
        commit,
        generatedAt: new Date().toISOString(),
        license: 'Apache-2.0',
        included,
        excluded,
      },
      null,
      2,
    )}\n`,
  );

  const counts = new Map();
  const years = new Map();
  for (const item of included) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
    const year = item.date.slice(0, 4);
    years.set(year, (years.get(year) || 0) + 1);
  }
  const report = [
    '# JavaGuide 来源清单',
    '',
    `- 固定版本：\`${commit}\``,
    `- 扫描 Markdown：${files.length}`,
    `- 纳入技术文章：${included.length}`,
    `- 排除：${excluded.length}`,
    '',
    '## 纳入模块',
    '',
    ...[...counts].sort().map(([name, count]) => `- ${name}: ${count}`),
    '',
    '## 日期分布',
    '',
    '基础主题靠前，实现与进阶靠后；人工智能与 AI 编程集中在 2024–2026；学习路线全部放在 2026。',
    '',
    ...[...years].map(([year, count]) => `- ${year}: ${count}`),
    '',
    '## 排除记录',
    '',
    ...excluded.map((item) => `- \`${item.sourcePath}\` — ${item.reason}`),
    '',
  ].join('\n');
  await writeFile(REPORT, report);
  console.log(`Pinned ${commit}; included ${included.length}, excluded ${excluded.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

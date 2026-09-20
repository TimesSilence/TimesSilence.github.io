#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts', 'javaguide');
const MANIFEST_PATH = path.join(ROOT, 'data', 'javaguide-manifest.json');
const REPORT_PATH = path.join(ROOT, 'data', 'javaguide-migration-report.md');
const required = [
  'title',
  'date',
  'updated',
  'permalink',
  'categories',
  'tags',
  'description',
];

async function listMarkdown(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await listMarkdown(fullPath)));
    else if (entry.name.endsWith('.md')) result.push(fullPath);
  }
  return result;
}

function frontMatterOf(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z_]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].replace(/^["']|["']$/g, '');
  }
  return { fields, frontMatter: match[1], body: match[2] };
}

function sourcePathFromPermalink(permalink, included) {
  const item = included.find((entry) => entry.permalink === permalink);
  return item?.sourcePath ?? null;
}

function hasLongVerbatimCopy(source, upstream, size = 180) {
  const normalize = (value) => value.replace(/\s+/g, '').replace(/[`*_>#-]/g, '');
  const left = normalize(source);
  const right = normalize(upstream);
  if (left.length < size || right.length < size) return false;
  for (let index = 0; index <= left.length - size; index += 40) {
    if (right.includes(left.slice(index, index + size))) return true;
  }
  return false;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const files = await listMarkdown(POSTS_DIR);
  const failures = [];
  const warnings = [];
  const permalinks = new Map();
  const seenPermalinks = new Set();
  const manifestByPermalink = new Map(
    manifest.included.map((item) => [item.permalink, item]),
  );

  for (const file of files) {
    const relative = path.relative(ROOT, file);
    const source = await readFile(file, 'utf8');
    if (/source_url\s*:/.test(source)) {
      failures.push(`${relative}: 仍含 source_url`);
    }
    const parsed = frontMatterOf(source);
    if (!parsed) {
      failures.push(`${relative}: front matter 无效`);
      continue;
    }
    for (const field of required) {
      if (!(field in parsed.fields)) failures.push(`${relative}: 缺少 ${field}`);
    }
    if (parsed.fields.updated !== parsed.fields.date) {
      failures.push(`${relative}: updated 必须与 date 一致`);
    }
    if (/来源说明|归属说明|修改说明|Guide哥/.test(parsed.body)) {
      failures.push(`${relative}: 正文仍含来源声明`);
    }
    if (!parsed.body.includes('<!-- more -->')) {
      failures.push(`${relative}: 缺少摘要分隔符`);
    }
    if (/^:::\s|<Badge|<ClientOnly|@include/m.test(parsed.body)) {
      failures.push(`${relative}: 存在 VuePress 专有语法`);
    }
    if (new Date(parsed.fields.date) > new Date()) {
      failures.push(`${relative}: 日期晚于当前日期`);
    }
    const previous = permalinks.get(parsed.fields.permalink);
    if (previous) failures.push(`${relative}: permalink 与 ${previous} 重复`);
    permalinks.set(parsed.fields.permalink, relative);
    seenPermalinks.add(parsed.fields.permalink);
    const manifestItem = manifestByPermalink.get(parsed.fields.permalink);
    if (!manifestItem) {
      failures.push(`${relative}: permalink 不在纳入清单中`);
    } else {
      if (parsed.fields.date !== manifestItem.date) {
        failures.push(`${relative}: date 与清单不一致`);
      }
      const categoryPattern = new RegExp(
        `^\\s*-\\s+${manifestItem.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
        'm',
      );
      if (!categoryPattern.test(parsed.frontMatter)) {
        failures.push(`${relative}: categories 与清单不一致`);
      }
    }

    const sourcePath = sourcePathFromPermalink(
      parsed.fields.permalink,
      manifest.included,
    );
    if (sourcePath) {
      try {
        const upstream = await readFile(
          path.join(ROOT, '.cache', 'javaguide', sourcePath),
          'utf8',
        );
        if (hasLongVerbatimCopy(parsed.body, upstream)) {
          warnings.push(`${relative}: 存在较长的原文连续片段，需人工复核`);
        }
      } catch {
        failures.push(`${relative}: 找不到固定版本源文件`);
      }
    }
  }

  for (const item of manifest.included) {
    if (!seenPermalinks.has(item.permalink)) failures.push(`${item.sourcePath}: 尚未生成`);
  }
  const yearCounts = new Map();
  for (const item of manifest.included) {
    const year = item.date.slice(0, 4);
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
  }

  const report = [
    '# JavaGuide 迁移报告',
    '',
    `- 固定版本：\`${manifest.commit}\``,
    `- 计划纳入：${manifest.included.length}`,
    `- 已生成：${files.length}`,
    `- 阻塞问题：${failures.length}`,
    `- 人工复核：${warnings.length}`,
    '',
    '## 日期分布',
    '',
    ...[...yearCounts].map(([year, count]) => `- ${year}: ${count}`),
    '',
    '## 阻塞问题',
    '',
    ...(failures.length ? failures.map((item) => `- ${item}`) : ['- 无']),
    '',
    '## 人工复核',
    '',
    ...(warnings.length ? warnings.map((item) => `- ${item}`) : ['- 无']),
    '',
  ].join('\n');
  await writeFile(REPORT_PATH, report);
  console.log(
    `Validated ${files.length}/${manifest.included.length}: ${failures.length} failures, ${warnings.length} warnings.`,
  );
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

#!/usr/bin/env node
/**
 * 输出全站已有文章的标题、标签与 permalink，供每日选题查重使用。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts');

async function listMarkdown(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdown(fullPath)));
    else if (entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

function parseFrontMatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = match[1];
  const title = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? '';
  const permalink = fm.match(/^permalink:\s*(\S+)\s*$/m)?.[1] ?? '';
  const tagsBlock = fm.match(/^tags:\n((?:\s+- .+\n?)+)/m)?.[1] ?? '';
  const tags = [...tagsBlock.matchAll(/^\s+- (.+)$/gm)].map((m) => m[1]);
  return { title, permalink, tags };
}

const files = await listMarkdown(POSTS_DIR);
const rows = [];
for (const file of files) {
  const parsed = parseFrontMatter(await readFile(file, 'utf8'));
  if (!parsed) continue;
  rows.push(`${parsed.title} | ${parsed.permalink} | ${parsed.tags.join(', ')}`);
}
rows.sort();
console.log(`共 ${rows.length} 篇已有文章。格式：标题 | permalink | 标签`);
console.log(rows.join('\n'));

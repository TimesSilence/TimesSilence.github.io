#!/usr/bin/env node
/**
 * Validate daily posts against tools/daily-article-playbook.md hard rules.
 * Exit code 1 on any failure so CI can block regressions.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_ROOT = path.join(ROOT, 'source', '_posts');
const DAILY_DIR = path.join(POSTS_ROOT, 'daily');

const REQUIRED = ['title', 'date', 'updated', 'permalink', 'categories', 'tags', 'description'];
const FORBIDDEN_WORDS = /来源说明|归属说明|修改说明|Guide哥|本文转载|原文链接/;
const VUEPRESS_SYNTAX = /^:::\s|<Badge|<ClientOnly|@include/m;
const MIN_CHARS = 1500;
const MAX_CHARS = 2800;

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
  const lists = {};
  let currentList = null;
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z_]+):\s*(.*)$/);
    if (field) {
      currentList = field[2] === '' ? field[1] : null;
      if (field[2] !== '') fields[field[1]] = field[2].replace(/^["']|["']$/g, '');
      else if (currentList) lists[currentList] = [];
      continue;
    }
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && currentList) lists[currentList].push(item[1].replace(/^["']|["']$/g, ''));
  }
  return { fields, lists, body: match[2] };
}

function countBodyChars(text) {
  // 字数口径与常规中文编辑器一致：剔除代码块后，
  // 统计汉字与中文标点，英文/数字按词计。
  const prose = text.replace(/```[\s\S]*?```/g, '');
  const cjkAndPunct = (prose.match(/[一-鿿　-〿＀-￯]/g) || []).length;
  const asciiWords = (prose.match(/[A-Za-z0-9]+/g) || []).length;
  return cjkAndPunct + asciiWords;
}

async function main() {
  const failures = [];
  let dailyFiles = [];
  try {
    dailyFiles = (await listMarkdown(DAILY_DIR)).sort();
  } catch {
    console.log('No daily posts directory yet, nothing to validate.');
    return;
  }
  if (dailyFiles.length === 0) {
    console.log('No daily posts yet, nothing to validate.');
    return;
  }

  // permalink 全站唯一性需要对照其他系列
  const allFiles = await listMarkdown(POSTS_ROOT);
  const permalinkOwners = new Map();
  for (const file of allFiles) {
    const source = await readFile(file, 'utf8');
    const parsed = frontMatterOf(source);
    if (parsed?.fields.permalink) {
      permalinkOwners.set(parsed.fields.permalink, path.relative(ROOT, file));
    }
  }

  for (const file of dailyFiles) {
    const relative = path.relative(ROOT, file);
    const name = path.basename(file, '.md');
    const source = await readFile(file, 'utf8');

    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(name)) {
      failures.push(`${relative}: 文件名应为 YYYY-MM-DD-<英文-slug>`);
    }

    const parsed = frontMatterOf(source);
    if (!parsed) {
      failures.push(`${relative}: front matter 无效`);
      continue;
    }
    const { fields, lists, body } = parsed;

    for (const field of REQUIRED) {
      if (!(field in fields) && !(field in lists)) failures.push(`${relative}: 缺少 ${field}`);
    }

    if (fields.permalink) {
      if (!/^daily\/[a-z0-9-]+\/$/.test(fields.permalink)) {
        failures.push(`${relative}: permalink 应为 daily/<英文-slug>/ 形式`);
      }
      const owner = permalinkOwners.get(fields.permalink);
      if (owner && owner !== relative) {
        failures.push(`${relative}: permalink 与 ${owner} 重复`);
      }
    }

    if (lists.categories && (lists.categories.length !== 1 || lists.categories[0] !== '技术动态')) {
      failures.push(`${relative}: categories 应为且仅为「技术动态」`);
    }

    if (lists.tags && (lists.tags.length < 2 || lists.tags.length > 5)) {
      failures.push(`${relative}: tags 应为 2-5 个（当前 ${lists.tags.length} 个）`);
    }

    const fileDate = name.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (fileDate && fields.date && !fields.date.startsWith(fileDate)) {
      failures.push(`${relative}: date 与文件名日期不一致`);
    }
    if (fields.date && new Date(fields.date) > new Date()) {
      failures.push(`${relative}: 日期晚于当前日期`);
    }

    if (!body.includes('<!-- more -->')) {
      failures.push(`${relative}: 缺少摘要分隔符 <!-- more -->`);
    }
    if (/^# /m.test(body)) {
      failures.push(`${relative}: 正文标题须从 ## 开始，禁止使用 #`);
    }
    if (FORBIDDEN_WORDS.test(body)) {
      failures.push(`${relative}: 正文含禁用词（来源/归属/修改说明、Guide哥、转载、原文链接）`);
    }
    if (VUEPRESS_SYNTAX.test(body)) {
      failures.push(`${relative}: 存在 VuePress 专有语法`);
    }

    const fenceMatches = body.match(/^```.*$/gm) || [];
    let inCodeBlock = false;
    for (const fence of fenceMatches) {
      if (!inCodeBlock && fence.trim() === '```') {
        failures.push(`${relative}: 存在未标注语言的代码块`);
        break;
      }
      inCodeBlock = !inCodeBlock;
    }

    const chars = countBodyChars(body);
    if (chars < MIN_CHARS || chars > MAX_CHARS) {
      failures.push(`${relative}: 正文 ${chars} 字，不在 ${MIN_CHARS}-${MAX_CHARS} 字区间`);
    }
  }

  console.log(
    `Validated ${dailyFiles.length} daily posts: ${failures.length} failures.`,
  );
  for (const item of failures) console.log(`  FAIL ${item}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

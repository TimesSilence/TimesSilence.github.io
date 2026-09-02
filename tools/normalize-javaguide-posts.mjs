#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'source', '_posts', 'javaguide');
const MANIFEST_PATH = path.join(ROOT, 'data', 'javaguide-manifest.json');

async function listMarkdown(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdown(fullPath)));
    else if (entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

function quote(value) {
  return JSON.stringify(value);
}

function placeExcerpt(text) {
  const marker = '<!-- more -->';
  const parts = text.split(marker);
  if (parts.length !== 2) return text;
  const before = parts[0].trim();
  const after = parts[1].trim();
  if (before && !/^#{1,6}\s/.test(before.split('\n\n').pop() || '')) {
    return `${before}\n\n${marker}\n\n${after}`;
  }
  const chunks = `${before}\n\n${after}`.trim().split(/\n\n+/);
  let index = 0;
  while (index < chunks.length && /^#{1,6}\s/.test(chunks[index])) index += 1;
  if (index >= chunks.length) return `${chunks.join('\n\n')}\n\n${marker}\n`;
  return `${chunks.slice(0, index + 1).join('\n\n')}\n\n${marker}\n\n${chunks.slice(index + 1).join('\n\n')}`;
}

function stripAttribution(body) {
  let text = body.replace(/^\uFEFF/, '').replace(/^\n+/, '');
  while (true) {
    const match = text.match(/^(?:>[^\n]*(?:\n|$))+\n*/);
    if (!match) break;
    if (!/JavaGuide|Apache-?2\.0|重新整理|归属说明|来源说明|修改说明/.test(match[0])) {
      break;
    }
    text = text.slice(match[0].length);
  }
  text = text.replace(/\n## 收束与致谢\n\n[\s\S]*?(?=\n## |\s*$)/, '\n');
  text = text.replace(/^.*感谢 JavaGuide.*$\n?/gm, '');
  text = text.replace(/^\n+/, '');
  return placeExcerpt(text);
}

function descriptionFrom(title, body) {
  const text = body
    .replace(/^>.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/[*_`[\]()|#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (text.slice(0, 110) || `围绕${title}整理核心概念、实现机制与工程实践。`).replace(
    /["\\]/g,
    '',
  );
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const byPermalink = new Map(
    manifest.included.map((item) => [item.permalink, item]),
  );
  let changed = 0;

  for (const file of await listMarkdown(POSTS_DIR)) {
    const source = await readFile(file, 'utf8');
    const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) continue;

    let frontMatter = match[1];
    let body = match[2];
    const permalink = frontMatter
      .match(/^permalink:\s*["']?(.+?)["']?\s*$/m)?.[1]
      ?.replace(/\/?$/, '/');
    const slug = path.basename(file, '.md').replace(/--/g, '/');
    const record =
      byPermalink.get(permalink) ||
      byPermalink.get(`knowledge/${slug}/`);

    frontMatter = frontMatter
      .replace(/^(source_url|source_title|source_commit|source|license|adaptation):\s*.*$/gm, '')
      .replace(/^\s+- JavaGuide\s*$/gm, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
    body = stripAttribution(body);
    body = body.replace(/^.*JavaGuide 原文.*$\n?/gm, '');

    if (record) {
      const title =
        frontMatter.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || record.title;
      frontMatter = frontMatter
        .replace(/^date:.*$/m, `date: ${record.date}`)
        .replace(/^updated:.*$/m, `updated: ${record.date}`)
        .replace(/^permalink:.*$/m, `permalink: ${record.permalink}`)
        .replace(/^category:\s*(.+)$/m, `categories:\n  - ${record.category}`);
      if (!/^updated:/m.test(frontMatter)) {
        frontMatter = frontMatter.replace(
          /^date:.*$/m,
          `date: ${record.date}\nupdated: ${record.date}`,
        );
      }
      if (!/^categories:/m.test(frontMatter)) {
        frontMatter = frontMatter.replace(
          /^tags:/m,
          `categories:\n  - ${record.category}\ntags:`,
        );
      }
      if (!/^description:/m.test(frontMatter)) {
        frontMatter += `\ndescription: ${quote(descriptionFrom(title, body))}`;
      }
    }

    const output = `---\n${frontMatter}\n---\n\n${body.replace(/^\n+/, '')}`;
    if (output !== source) {
      await writeFile(file, output);
      changed += 1;
    }
  }
  console.log(`Normalized ${changed} JavaGuide posts.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

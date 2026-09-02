#!/usr/bin/env node
/**
 * Convert generated Hexo/spfk post HTML into Markdown with front-matter.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LEGACY = path.join(ROOT, '_legacy');
const OUT = path.join(ROOT, 'source', '_posts');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});

turndown.addRule('preCode', {
  filter: (node) => node.nodeName === 'PRE',
  replacement: (_content, node) => {
    const text = node.textContent ?? '';
    return `\n\n\`\`\`java\n${text.replace(/\n$/, '')}\n\`\`\`\n\n`;
  },
});

function yamlQuote(value) {
  if (/[:#{}[\],&*?|!<>=!%@`'"\\]/.test(value) || value === '') {
    return JSON.stringify(value);
  }
  return value;
}

function slugFromDir(dirName) {
  return dirName;
}

function padDay(slug) {
  const day = slug.match(/day(\d+)/i)?.[1];
  return day ? day.padStart(2, '0') : null;
}

function betterTitle(rawTitle, slug, excerpt) {
  const day = padDay(slug);
  const hint = (excerpt || '').replace(/\s+/g, ' ').trim();
  const expectedPrefix = day ? `Day${day}` : null;
  const titleMatchesSlug = expectedPrefix && rawTitle.startsWith(expectedPrefix);
  const generic = !rawTitle || rawTitle === 'Java语言基础' || rawTitle === 'Java' || !titleMatchesSlug;
  if (!generic) return rawTitle;
  if (day && hint) return `Day${day}_${hint}`;
  if (day) return `Day${day}_笔记`;
  return rawTitle || slug;
}

async function collectPostDirs(base) {
  const years = await readdir(base, { withFileTypes: true });
  const posts = [];
  for (const year of years) {
    if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
    const months = await readdir(path.join(base, year.name), { withFileTypes: true });
    for (const month of months) {
      if (!month.isDirectory()) continue;
      const days = await readdir(path.join(base, year.name, month.name), { withFileTypes: true });
      for (const day of days) {
        if (!day.isDirectory()) continue;
        const slugs = await readdir(path.join(base, year.name, month.name, day.name), {
          withFileTypes: true,
        });
        for (const slug of slugs) {
          if (!slug.isDirectory()) continue;
          const html = path.join(
            base,
            year.name,
            month.name,
            day.name,
            slug.name,
            'index.html',
          );
          posts.push({
            html,
            year: year.name,
            month: month.name,
            day: day.name,
            slug: slug.name,
          });
        }
      }
    }
  }
  return posts;
}

function extract(html, meta) {
  const $ = cheerio.load(html);
  const rawTitle = $('h1.article-title').first().text().replace(/\s+/g, ' ').trim();
  const displayDate = $('time').first().text().trim();
  const tags = [...new Set($('.article-tag-list-link').map((_, el) => $(el).text().trim()).get())];
  const categories = [
    ...new Set($('.article-category-link').map((_, el) => $(el).text().trim()).get()),
  ];

  const entry = $('.article-entry[itemprop="articleBody"]').first().clone();
  entry.find('script, .page-reward, nav, #toc, #tocButton').remove();
  entry.find('a.headerlink').remove();

  const excerptEl = entry.find('p').first().clone();
  excerptEl.find('#more, a#more').remove();
  const excerpt = excerptEl.text().replace(/\s+/g, ' ').trim();

  entry.find('#more, a#more').replaceWith('<!-- more -->');

  let markdown = turndown.turndown(entry.html() || '').trim();
  markdown = markdown.replace(/\\_/g, '_');
  markdown = markdown.replace(/\[\]\([^)]*#[^)]*\)/g, '');
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  if (excerpt && !markdown.includes('<!-- more -->')) {
    const idx = markdown.indexOf(excerpt);
    if (idx === 0) {
      markdown = `${excerpt}\n\n<!-- more -->\n${markdown.slice(excerpt.length).replace(/^\s+/, '\n')}`;
    } else {
      markdown = `${excerpt}\n\n<!-- more -->\n\n${markdown}`;
    }
  }

  const title = betterTitle(rawTitle, meta.slug, excerpt);
  const date = `${displayDate || `${meta.year}-${meta.month}-${meta.day}`} 00:00:00`;
  const permalink = `${meta.year}/${meta.month}/${meta.day}/${meta.slug}/`;

  const fm = [
    '---',
    `title: ${yamlQuote(title)}`,
    `date: ${date}`,
    `permalink: ${permalink}`,
    'categories:',
    ...(categories.length ? categories.map((c) => `  - ${yamlQuote(c)}`) : ['  - Java']),
    'tags:',
    ...(tags.length ? tags.map((t) => `  - ${yamlQuote(t)}`) : ['  - Java']),
    '---',
    '',
    markdown,
    '',
  ].join('\n');

  return { title, file: `${meta.year}-${meta.month}-${meta.day}-${meta.slug}.md`, body: fm };
}

async function main() {
  const htmlRoot = LEGACY;
  await mkdir(OUT, { recursive: true });
  const posts = await collectPostDirs(htmlRoot);
  if (!posts.length) {
    throw new Error(`No posts found under ${htmlRoot}`);
  }
  const summary = [];
  for (const post of posts) {
    const html = await readFile(post.html, 'utf8');
    const result = extract(html, post);
    await writeFile(path.join(OUT, result.file), result.body, 'utf8');
    summary.push(`${result.file}  →  ${result.title}`);
  }
  console.log(`Extracted ${summary.length} posts:\n${summary.sort().join('\n')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

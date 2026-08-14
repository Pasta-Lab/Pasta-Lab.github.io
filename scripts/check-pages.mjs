#!/usr/bin/env node
/* Checks the pages, the stylesheet, and the repo layout.

   Everything here is static analysis in plain Node, so CI needs no browser and
   nothing can go flaky. Run with `npm run check`. */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join, normalize } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://pasta-lab.github.io/';

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);
const has = (p) => existsSync(join(ROOT, p));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
if (!pages.length) fail('.', 'no HTML pages found');

/* Pages that are part of the site proper, so 404 is excluded. */
const publicPages = pages.filter((p) => p !== '404.html');

/* --- Every page carries the shared chrome ---------------------------------- */

const REQUIRED = [
  [/<html lang="[a-z-]+"/, 'a lang attribute on <html>'],
  [/<title>[^<]+<\/title>/, 'a <title>'],
  [/<meta name="description" content="[^"]+"/, 'a meta description'],
  [/<link rel="canonical" href="[^"]+"/, 'a canonical link'],
  [/<meta property="og:image" content="[^"]+"/, 'an og:image'],
  [/<meta property="og:url" content="[^"]+"/, 'an og:url'],
  [/<meta name="twitter:card"/, 'a twitter:card'],
  [/<a class="skip-link" href="#main"/, 'a skip-to-content link'],
  [/<header class="nav">/, 'the shared nav'],
  [/<nav class="nav__menu" aria-label="[^"]+"/, 'a <nav> landmark with a label'],
  [/<main id="main"/, 'a <main id="main"> for the skip link to reach'],
  [/<footer class="footer">/, 'the shared footer'],
  [/classList\.add\('js'\)/, "the inline script that adds the 'js' class"],
  [/js\/site\.js/, 'js/site.js'],
];

const MOUNTS = [
  ['data-publications', 'js/publications.js'],
  ['data-news', 'js/news.js'],
  ['data-projects', 'js/projects.js'],
  ['data-project-feature', 'js/projects.js'],
  ['data-faculty', 'js/people.js'],
  ['data-students', 'js/people.js'],
  ['data-openings', 'js/openings.js'],
];

for (const page of pages) {
  const html = read(page);

  for (const [pattern, what] of REQUIRED) {
    if (!pattern.test(html)) fail(page, `is missing ${what}`);
  }

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (canonical) {
    const expected = SITE + (page === 'index.html' ? '' : page);
    if (canonical[1] !== expected) {
      fail(page, `canonical is ${canonical[1]}, expected ${expected}`);
    }
  }

  /* internal links and assets resolve */
  for (const m of html.matchAll(/href="([^"#][^":]*?\.html)(#[^"]*)?"/g)) {
    if (!has(m[1])) fail(page, `links to a page that does not exist: ${m[1]}`);
  }
  for (const m of html.matchAll(/(?:src|href)="((?:assets|css|js)\/[^"]+)"/g)) {
    if (!has(m[1])) fail(page, `references a missing file: ${m[1]}`);
  }

  /* fragment links point at an id that exists on the target page */
  for (const m of html.matchAll(/href="([^"]*?)#([^"]+)"/g)) {
    const target = m[1] || page;
    if (!target.endsWith('.html')) continue;
    if (!has(target)) continue;
    if (!new RegExp(`id="${m[2]}"`).test(read(target))) {
      fail(page, `links to #${m[2]} on ${target}, which has no such id`);
    }
  }

  /* duplicate ids break both anchors and querySelector */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of [...new Set(dupes)]) fail(page, `duplicate id: ${id}`);

  /* images: alt is required, dimensions avoid layout shift */
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
    const tag = m[1];
    const src = (tag.match(/src="([^"]+)"/) || [])[1] || '(no src)';
    if (!/\salt=/.test(tag)) fail(page, `img has no alt attribute: ${src}`);
    if (!/\swidth=/.test(tag) || !/\sheight=/.test(tag)) {
      fail(page, `img has no width/height, which risks layout shift: ${src}`);
    }
  }

  /* new tabs must not hand the opener over */
  for (const m of html.matchAll(/<a\b([^>]*target="_blank"[^>]*)>/g)) {
    if (!/rel="[^"]*noopener/.test(m[1])) {
      fail(page, `target="_blank" without rel="noopener": ${m[1].slice(0, 60)}`);
    }
  }

  /* static heading outline: one h1, no skipped levels */
  const headings = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  const h1s = headings.filter((h) => h === 1).length;
  if (h1s !== 1) fail(page, `has ${h1s} <h1> elements, expected exactly 1`);
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] > headings[i - 1] + 1) {
      fail(page, `heading level jumps from h${headings[i - 1]} to h${headings[i]}`);
    }
  }

  /* a data mount with no module behind it renders as a permanent spinner */
  for (const [attr, module] of MOUNTS) {
    if (new RegExp(`${attr}[=> ]`).test(html) && !html.includes(module)) {
      fail(page, `has [${attr}] but never loads ${module}`);
    }
  }
}

/* --- Stylesheet ----------------------------------------------------------- */

const css = read('css/site.css');
for (const m of css.matchAll(/url\('([^']+)'\)/g)) {
  const target = normalize(join('css', m[1]));
  if (!has(target)) fail('css/site.css', `references a missing file: ${target}`);
}
for (const m of css.matchAll(/\.logo--([a-z]+)\s*\{([^}]*)\}/g)) {
  if (!/mask-size/.test(m[2])) fail('css/site.css', `.logo--${m[1]} has no mask-size`);
}
/* both themes have to define every token the other one defines */
const blocks = [...css.matchAll(/:root(?:\[data-theme='dark'\])?\s*\{([^}]*)\}/g)].map((m) => m[1]);
if (blocks.length >= 2) {
  const names = blocks.map((b) => new Set([...b.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1])));
  const themed = ['--canvas', '--surface', '--surface-2', '--surface-inset', '--ink', '--ink-2',
    '--ink-3', '--line', '--line-strong', '--accent', '--accent-hover', '--accent-on',
    '--accent-strong', '--accent-wash', '--accent-line'];
  for (const token of themed) {
    if (!names[0].has(token)) fail('css/site.css', `light theme never defines ${token}`);
    if (!names[1].has(token)) fail('css/site.css', `dark theme never defines ${token}`);
  }
}

/* --- Sitemap and robots --------------------------------------------------- */

const sitemap = read('sitemap.xml');
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const page of publicPages) {
  const url = SITE + (page === 'index.html' ? '' : page);
  if (!listed.includes(url)) fail('sitemap.xml', `does not list ${url}`);
}
for (const url of listed) {
  const file = url.replace(SITE, '') || 'index.html';
  if (!has(file)) fail('sitemap.xml', `lists ${url}, which has no file`);
}
if (!read('robots.txt').includes(`${SITE}sitemap.xml`)) {
  fail('robots.txt', 'does not point at the sitemap');
}

/* --- Every module has to load ---------------------------------------------- */

for (const file of readdirSync(join(ROOT, 'js')).filter((f) => f.endsWith('.js')).sort()) {
  try {
    await import(pathToFileURL(join(ROOT, 'js', file)).href);
  } catch (error) {
    fail(`js/${file}`, `fails to load under Node (${error.message})`);
  }
}

/* --- Repo hygiene ---------------------------------------------------------- */

const STRAY = /(\.b|\.bak|\.orig|\.rej|\.tmp|\.swp|\.pyc)$/;
function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const rel = dir ? `${dir}/${entry}` : entry;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}
for (const file of walk('')) {
  if (STRAY.test(file)) fail(file, 'looks like a stray editor or build artifact');
  if (file.includes('__pycache__')) fail(file, 'is Python bytecode and should not be committed');
}

/* --- Dash discipline ------------------------------------------------------- */

const textFiles = [
  ...pages,
  'css/site.css',
  'README.md',
  ...readdirSync(join(ROOT, 'data')).filter((f) => f.endsWith('.md')).map((f) => `data/${f}`),
];
for (const file of textFiles) {
  read(file).split('\n').forEach((line, i) => {
    if (/[–—]/.test(line)) {
      fail(file, `line ${i + 1} contains an em-dash or en-dash, use a plain hyphen`);
    }
  });
}

/* --- Report --------------------------------------------------------------- */

console.log(
  `Checked ${pages.length} pages, css/site.css, sitemap.xml, robots.txt, ` +
    `${readdirSync(join(ROOT, 'js')).length} modules, and ${textFiles.length} text files.`,
);

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('All pages are valid.');

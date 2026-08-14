#!/usr/bin/env node
/* Validates everything under data/ using the site's own parsers, so the
   checker and the website can never disagree about what a file means.

   Run with `npm run check`. CI runs it on every push and pull request. */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import { parseBibtex } from '../js/bibtex.js';
import { DOMAIN_IDS, domainsOf, venueDomains } from '../js/domains.js';
import { PIS, BIB_FILES } from '../js/lab.js';
import { parseNews } from '../js/news.js';
import { parseProjects } from '../js/projects.js';
import { parsePeople } from '../js/people.js';
import { parseOpenings } from '../js/openings.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const asset = (p) => existsSync(join(ROOT, p));

const problems = [];
const notes = [];
const fail = (file, message) => problems.push(`${file}: ${message}`);

/* --- Publications --------------------------------------------------------- */

const keys = new Map();
let paperCount = 0;

for (const path of BIB_FILES) {
  let entries;
  try {
    entries = parseBibtex(read(path));
  } catch (error) {
    fail(path, `could not be parsed (${error.message})`);
    continue;
  }

  if (!entries.length) fail(path, 'contains no entries');

  for (const entry of entries) {
    const at = `${path} [${entry.key}]`;
    paperCount += 1;

    if (!entry.key) fail(path, 'an entry has no citation key');
    if (keys.has(entry.key)) {
      fail(at, `duplicate citation key, also in ${keys.get(entry.key)}`);
    } else {
      keys.set(entry.key, path);
    }

    if (!entry.title) fail(at, 'missing title');
    if (!entry.authors.length) fail(at, 'missing author');
    if (!entry.year) fail(at, 'missing or unparsable year');
    if (!entry.venue) fail(at, 'missing venue');

    if (entry.year && (entry.year < 1990 || entry.year > 2100)) {
      fail(at, `year ${entry.year} looks wrong`);
    }

    const explicit = (entry.domain || '')
      .split(/[,\s]+/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const unknown = explicit.filter((d) => !DOMAIN_IDS.includes(d));
    if (unknown.length) {
      fail(at, `unknown domain ${unknown.join(', ')}, expected one of ${DOMAIN_IDS.join(', ')}`);
    }

    const domains = domainsOf(entry);
    if (!domains.length) {
      fail(
        at,
        `no research domain. Venue "${entry.venue}" is not in the table in ` +
          'js/domains.js, so add it there or set domain = {…} on this entry',
      );
    }

    for (const link of entry.links) {
      if (!/^https?:\/\//i.test(link.href)) {
        fail(at, `link "${link.label}" is not an absolute http(s) URL: ${link.href}`);
      }
    }

    if (!entry.links.length) notes.push(`${at} has no links`);
    if (!explicit.length && entry.venue) {
      const fromVenue = venueDomains(entry.venue);
      if (fromVenue.length) notes.push(`${at} takes domain ${fromVenue.join('+')} from its venue`);
    }
  }
}

/* --- News ----------------------------------------------------------------- */

const newsSource = read('data/news.md');
const news = parseNews(newsSource);
if (!news.length) fail('data/news.md', 'no items were parsed');

for (const line of newsSource.split('\n')) {
  if (!line.startsWith('- ')) continue; // indented lines are the format example
  if (/^-\s*\*?\s*`\d{4}-\d{2}(-\d{2})?`/.test(line)) continue;
  fail('data/news.md', `bullet has no \`YYYY-MM-DD\` date: ${line.trim().slice(0, 60)}`);
}

for (const item of news) {
  if (item.month < 1 || item.month > 12) fail('data/news.md', `month ${item.month} is out of range`);
  if (!item.body.trim()) fail('data/news.md', `item ${item.year}-${item.month} has no text`);
}

/* --- Projects ------------------------------------------------------------- */

const projectSource = read('data/projects.md');
const projects = parseProjects(projectSource);
if (!projects.length) fail('data/projects.md', 'no projects were parsed');

const projectHeadings = (projectSource.match(/^##\s+(.+)$/gm) || []).length;
if (projectHeadings !== projects.length) {
  fail(
    'data/projects.md',
    `${projectHeadings} "##" headings but only ${projects.length} parsed, check that each has a tagline`,
  );
}

for (const project of projects) {
  const at = `data/projects.md [${project.title}]`;
  if (!project.body.trim()) fail(at, 'has no description below the --- line');
  for (const link of project.links) {
    if (!/^https?:\/\//i.test(link.href)) fail(at, `link "${link.label}" is not absolute`);
  }
}

/* --- People --------------------------------------------------------------- */

const { faculty, students } = parsePeople(read('data/people.md'));
if (faculty.length !== PIS.length) {
  fail(
    'data/people.md',
    `${faculty.length} faculty but js/lab.js lists ${PIS.length}, keep the two in step`,
  );
}

const STYLES = ['chibi-v2', 'lego', 'minecraft'];
for (const person of faculty) {
  const at = `data/people.md [${person.name}]`;
  if (!person.role) fail(at, 'missing role');
  if (!person.affiliation) fail(at, 'missing affiliation');
  if (!person.website) fail(at, 'missing website');
  for (const style of STYLES) {
    const path = `assets/people/${person.photo}-${style}.webp`;
    if (!asset(path)) fail(at, `portrait not found: ${path}`);
  }
}

if (!students.length) fail('data/people.md', 'no students were parsed');
for (const student of students) {
  if (!student.affiliation) {
    fail('data/people.md', `student "${student.name}" has no affiliation after the | separator`);
  }
  for (const field of [student.name, student.note]) {
    for (const link of field.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (!/^https?:\/\//i.test(link[1])) {
        fail('data/people.md', `"${student.name}" has a link that is not an absolute URL: ${link[1]}`);
      }
    }
  }
}

/* --- Openings ------------------------------------------------------------- */

const openings = parseOpenings(read('data/openings.md'));
if (!openings.length) fail('data/openings.md', 'no openings were parsed');
for (const opening of openings) {
  if (!opening.about) {
    fail('data/openings.md', `"${opening.role}" has no description after the second | separator`);
  }
}

/* --- Report --------------------------------------------------------------- */

console.log(
  `Checked ${paperCount} papers, ${news.length} news items, ${projects.length} projects, ` +
    `${faculty.length} faculty, ${students.length} students, ${openings.length} openings.`,
);

if (process.env.VERBOSE && notes.length) {
  console.log('\nNotes:');
  for (const note of notes) console.log(`  ${note}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} found:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('All data files are valid.');

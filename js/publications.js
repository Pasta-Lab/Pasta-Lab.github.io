import { parseBibtex } from './bibtex.js';
import { DOMAINS, domainsOf, labelOf } from './domains.js';
import { PIS, BIB_FILES } from './lab.js';
import { escapeHtml } from './md.js';
import { loadText, renderError, observeReveals } from './site.js';

/* Looked up inside init() rather than at module scope, so this file can also
   be imported by scripts/check-data.mjs where there is no DOM. */
let mount = null;
let filterBar = null;
let summary = null;

let papers = [];
let active = 'all';

function byRecency(a, b) {
  if (b.year !== a.year) return b.year - a.year;
  if (b.month !== a.month) return b.month - a.month;
  return a.title.localeCompare(b.title);
}

function authorLine(paper) {
  return paper.authors
    .map((name) => {
      const safe = escapeHtml(name);
      return PIS.some((pi) => pi.name === name) ? `<span class="is-pi">${safe}</span>` : safe;
    })
    .join(', ');
}

function paperHtml(paper, index) {
  const title = escapeHtml(paper.title);
  const heading = paper.url
    ? `<a href="${escapeHtml(paper.url)}" target="_blank" rel="noopener noreferrer">${title}</a>`
    : title;

  const domains = paper.domains
    .map((id) => `<span class="domain domain--${id}">${escapeHtml(labelOf(id))}</span>`)
    .join('');

  const award = paper.award ? `<p class="pub__award">${escapeHtml(paper.award)}</p>` : '';

  const links = paper.links.length
    ? `<div class="pub__links">${paper.links
        .map(
          (link) =>
            `<a class="pub__link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
        )
        .join('')}</div>`
    : '';

  return `<li class="pub" data-reveal style="--i:${Math.min(index, 6)}">
    <div class="pub__venue">${escapeHtml(paper.venue || String(paper.year))}</div>
    <div>
      <h3 class="pub__title">${heading}</h3>
      <p class="pub__authors">${authorLine(paper)}</p>
      <div class="pub__domains">${domains}</div>
      ${award}
      ${links}
    </div>
  </li>`;
}

function render() {
  const shown =
    active === 'all' ? papers : papers.filter((paper) => paper.domains.includes(active));

  if (summary) {
    const label = active === 'all' ? 'in total' : `tagged ${labelOf(active).toLowerCase()}`;
    summary.textContent = `${shown.length} paper${shown.length === 1 ? '' : 's'} ${label}.`;
  }

  if (!shown.length) {
    mount.innerHTML = '<div class="state"><p>Nothing here yet.</p></div>';
    return;
  }

  const years = [...new Set(shown.map((paper) => paper.year))].sort((a, b) => b - a);
  mount.innerHTML = years
    .map((year) => {
      const group = shown.filter((paper) => paper.year === year);
      return `<h2 class="pub-year">${year}</h2>
        <ul class="pub-list">${group.map(paperHtml).join('')}</ul>`;
    })
    .join('');

  observeReveals(mount);
}

function buildFilters() {
  if (!filterBar) return;
  const counts = Object.fromEntries(
    DOMAINS.map((d) => [d.id, papers.filter((p) => p.domains.includes(d.id)).length]),
  );
  const options = [
    { id: 'all', label: 'All', count: papers.length },
    ...DOMAINS.map((d) => ({ id: d.id, label: d.label, count: counts[d.id] })),
  ];

  filterBar.innerHTML = options
    .map(
      (option) =>
        `<button class="filter" type="button" data-filter="${option.id}" aria-pressed="${option.id === 'all'}">` +
        `${escapeHtml(option.label)}<span class="filter__count">${option.count}</span></button>`,
    )
    .join('');

  filterBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    active = button.dataset.filter;
    filterBar.querySelectorAll('[data-filter]').forEach((other) => {
      other.setAttribute('aria-pressed', String(other.dataset.filter === active));
    });
    render();
  });
}

async function init() {
  mount = document.querySelector('[data-publications]');
  filterBar = document.querySelector('[data-pub-filters]');
  summary = document.querySelector('[data-pub-summary]');
  if (!mount) return;
  try {
    const sources = await Promise.all(BIB_FILES.map(loadText));
    const seen = new Set();
    papers = sources
      .flatMap(parseBibtex)
      .filter((paper) => {
        if (!paper.title || seen.has(paper.key)) return false;
        seen.add(paper.key);
        return true;
      })
      .map((paper) => ({ ...paper, domains: domainsOf(paper) }))
      .sort(byRecency);
    buildFilters();
    render();
  } catch (error) {
    console.error(error);
    renderError(mount, 'the publication list');
  }
}

if (typeof document !== 'undefined') init();

import { inlineMd } from './md.js';
import { loadText, renderError, observeReveals } from './site.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Lines look like:  - * `2026-08-11` Body text with [links](...) */
const ITEM = /^-\s*(\*\s*)?`(\d{4})-(\d{2})(?:-(\d{2}))?`\s*(.+)$/;

export function parseNews(source) {
  return source
    .split('\n')
    .map((line) => line.trim().match(ITEM))
    .filter(Boolean)
    .map((match) => ({
      pinned: Boolean(match[1]),
      year: Number(match[2]),
      month: Number(match[3]),
      day: Number(match[4] || 1),
      body: match[5].trim(),
    }))
    .sort((a, b) => b.year - a.year || b.month - a.month || b.day - a.day);
}

function itemHtml(item, index) {
  const date = `${MONTHS[item.month - 1] || ''} ${item.year}`;
  return `<li class="news-item${item.pinned ? ' news-item--pinned' : ''}" data-reveal style="--i:${Math.min(index, 6)}">
    <div class="news-item__date">${date}</div>
    <div class="news-item__body">${inlineMd(item.body)}</div>
  </li>`;
}

async function init() {
  const mount = document.querySelector('[data-news]');
  if (!mount) return;
  const limit = Number(mount.dataset.news) || Infinity;

  try {
    const items = parseNews(await loadText('data/news.md'));
    if (!items.length) {
      mount.innerHTML = '<div class="state"><p>No news yet.</p></div>';
      return;
    }
    mount.innerHTML =
      `<ul class="news-list">${items.slice(0, limit).map(itemHtml).join('')}</ul>`;
    observeReveals(mount);
  } catch (error) {
    console.error(error);
    renderError(mount, 'the news feed');
  }
}

if (typeof document !== 'undefined') init();

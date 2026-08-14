import { escapeHtml, inlineMd } from './md.js';
import { loadText, renderError, observeReveals } from './site.js';

/* Bullets of the form:  - Role | Affiliation | Description */
export function parseOpenings(source) {
  const section = source.split(/^##\s+Openings\s*$/m)[1] || '';
  return section
    .split('\n')
    .map((line) => line.trim().match(/^-\s+(.+)$/))
    .filter(Boolean)
    .map((match) => {
      const parts = match[1].split('|').map((p) => p.trim());
      return { role: parts[0] || '', where: parts[1] || '', about: parts[2] || '' };
    })
    .filter((opening) => opening.role && opening.where);
}

function openingHtml(opening, index) {
  return `<li class="opening" data-reveal style="--i:${Math.min(index, 5)}">
    <div class="opening__head">
      <h2 class="opening__role">${escapeHtml(opening.role)}</h2>
      <span class="opening__where">${escapeHtml(opening.where)}</span>
    </div>
    <p class="opening__about">${inlineMd(opening.about)}</p>
  </li>`;
}

async function init() {
  const mount = document.querySelector('[data-openings]');
  if (!mount) return;
  try {
    const openings = parseOpenings(await loadText('data/openings.md'));
    mount.innerHTML = openings.length
      ? `<ul class="openings">${openings.map(openingHtml).join('')}</ul>`
      : '<div class="state"><p>No openings right now.</p></div>';
    observeReveals(mount);
  } catch (error) {
    console.error(error);
    renderError(mount, 'the list of openings');
  }
}

if (typeof document !== 'undefined') init();

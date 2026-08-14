import { escapeHtml, inlineMd } from './md.js';
import { loadText, renderError, observeReveals } from './site.js';

const STYLES = [
  { id: 'chibi-v2', label: 'Chibi' },
  { id: 'lego', label: 'Brick' },
  { id: 'minecraft', label: 'Voxel' },
];

const STYLE_KEY = 'pasta-portrait-style';

export function parsePeople(source) {
  const faculty = [];
  const students = [];

  const facultyBlocks = source.split(/^###\s+/m).slice(1);
  facultyBlocks.forEach((block) => {
    const newline = block.indexOf('\n');
    const name = block.slice(0, newline).trim();
    const meta = {};
    block.slice(newline + 1).split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) return;
      const at = trimmed.indexOf(':');
      if (at === -1) return;
      const key = trimmed.slice(0, at).trim().toLowerCase();
      const value = trimmed.slice(at + 1).trim();
      if (key && value) meta[key] = value;
    });
    if (name && meta.photo) faculty.push({ name, ...meta });
  });

  const studentSection = source.split(/^##\s+Students\s*$/m)[1] || '';
  studentSection.split('\n').forEach((line) => {
    const match = line.trim().match(/^-\s+(.+)$/);
    if (!match) return;
    const parts = match[1].split('|').map((part) => part.trim());
    students.push({
      name: parts[0] || '',
      affiliation: parts[1] || '',
      note: parts[2] || '',
    });
  });

  return { faculty, students };
}

function readStyle() {
  try {
    const stored = localStorage.getItem(STYLE_KEY);
    if (STYLES.some((style) => style.id === stored)) return stored;
  } catch (err) { /* private mode */ }
  return STYLES[0].id;
}

function photoPath(stem, styleId) {
  return `assets/people/${stem}-${styleId}.webp`;
}

function piHtml(person, index, styleId) {
  const links = [
    person.website ? { label: 'Website', href: person.website } : null,
    person.scholar ? { label: 'Scholar', href: person.scholar } : null,
    person.github ? { label: 'GitHub', href: person.github } : null,
  ].filter(Boolean);

  return `<article class="pi" data-reveal style="--i:${index}">
    <div class="pi__frame">
      <img class="pi__photo" data-photo="${escapeHtml(person.photo)}"
           src="${escapeHtml(photoPath(person.photo, styleId))}"
           alt="Illustrated portrait of ${escapeHtml(person.name)}"
           width="300" height="340" loading="lazy">
    </div>
    <div class="pi__body">
      <h3 class="pi__name">${escapeHtml(person.name)}</h3>
      <p class="pi__role">${escapeHtml(person.role || '')}</p>
      <p class="pi__affil">${escapeHtml(person.affiliation || '')}</p>
      ${person.interests ? `<p class="pi__interests">${escapeHtml(person.interests)}</p>` : ''}
      <div class="pi__links">${links
        .map(
          (link) =>
            `<a class="chip" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
        )
        .join('')}</div>
    </div>
  </article>`;
}

function studentHtml(person) {
  return `<li class="student">
    <span class="student__name">${inlineMd(person.name)}</span>
    <span class="student__affil">${escapeHtml(person.affiliation)}${
      person.note ? ` <span class="student__note">${inlineMd(person.note)}</span>` : ''
    }</span>
  </li>`;
}

function buildSwitcher(container, onPick, initial) {
  container.innerHTML = STYLES.map(
    (style) =>
      `<button type="button" data-style="${style.id}" aria-pressed="${style.id === initial}">${style.label}</button>`,
  ).join('');

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-style]');
    if (!button) return;
    const picked = button.dataset.style;
    container.querySelectorAll('[data-style]').forEach((other) => {
      other.setAttribute('aria-pressed', String(other.dataset.style === picked));
    });
    try { localStorage.setItem(STYLE_KEY, picked); } catch (err) { /* private mode */ }
    onPick(picked);
  });
}

function swapPortraits(styleId) {
  document.querySelectorAll('[data-photo]').forEach((img) => {
    const next = photoPath(img.dataset.photo, styleId);
    const preload = new Image();
    preload.onload = () => {
      img.classList.add('is-swapping');
      window.setTimeout(() => {
        img.src = next;
        img.classList.remove('is-swapping');
      }, 180);
    };
    preload.src = next;
  });
}

async function init() {
  const facultyMount = document.querySelector('[data-faculty]');
  const studentMount = document.querySelector('[data-students]');
  const switcher = document.querySelector('[data-style-switch]');
  if (!facultyMount && !studentMount) return;

  try {
    const { faculty, students } = parsePeople(await loadText('data/people.md'));
    const style = readStyle();

    if (facultyMount) {
      facultyMount.innerHTML = faculty
        .map((person, index) => piHtml(person, index, style))
        .join('');
      observeReveals(facultyMount);
    }

    if (studentMount) {
      studentMount.innerHTML = students.length
        ? students.map(studentHtml).join('')
        : '<li class="student"><span class="student__name">Positions open</span></li>';
    }

    if (switcher) buildSwitcher(switcher, swapPortraits, style);
  } catch (error) {
    console.error(error);
    renderError(facultyMount || studentMount, 'the people list');
  }
}

if (typeof document !== 'undefined') init();

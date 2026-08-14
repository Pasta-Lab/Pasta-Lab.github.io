import { blockMd, escapeHtml, inlineMd, parseLinkList } from './md.js';
import { loadText, renderError, observeReveals } from './site.js';

export function parseProjects(source) {
  const blocks = source.split(/^##\s+/m).slice(1);
  return blocks.map((block) => {
    const newline = block.indexOf('\n');
    const title = block.slice(0, newline).trim();
    const rest = block.slice(newline + 1);

    const split = rest.indexOf('\n---');
    const head = split === -1 ? rest : rest.slice(0, split);
    const body = split === -1 ? '' : rest.slice(split + 4);

    const meta = {};
    head.split('\n').forEach((line) => {
      const at = line.indexOf(':');
      if (at === -1) return;
      const key = line.slice(0, at).trim().toLowerCase();
      const value = line.slice(at + 1).trim();
      if (key && value) meta[key] = value;
    });

    const list = (key) =>
      (meta[key] || '').split(',').map((part) => part.trim()).filter(Boolean);

    return {
      title,
      tagline: meta.tagline || '',
      status: meta.status || '',
      year: meta.year || '',
      tags: list('tags'),
      people: list('people'),
      partners: list('partners'),
      links: parseLinkList(meta.links || ''),
      body: body.trim(),
    };
  }).filter((project) => project.title && project.tagline);
}

function projectHtml(project, index) {
  const meta = [
    project.status ? `<span class="status">${escapeHtml(project.status)}</span>` : '',
    project.year ? `<span class="tag">${escapeHtml(project.year)}</span>` : '',
    ...project.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`),
  ].filter(Boolean).join('');

  const links = project.links.length
    ? `<div class="chip-row">${project.links
        .map(
          (link) =>
            `<a class="chip" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
        )
        .join('')}</div>`
    : '';

  const credits = [];
  if (project.people.length) {
    credits.push(`<b>Team.</b> ${escapeHtml(project.people.join(', '))}`);
  }
  if (project.partners.length) {
    credits.push(`<b>With.</b> ${escapeHtml(project.partners.join(', '))}`);
  }

  return `<article class="project" data-reveal style="--i:${index}">
    <div>
      <div class="project__meta">${meta}</div>
      <h2 class="project__title">${escapeHtml(project.title)}</h2>
      <p class="project__tagline">${inlineMd(project.tagline)}</p>
      <div class="project__body">${blockMd(project.body)}</div>
      ${links}
      ${credits.length ? `<p class="project__people">${credits.join('<br>')}</p>` : ''}
    </div>
  </article>`;
}

/* The home page shows only the newest project, in a wider band. */
function featureHtml(project) {
  const firstPara = project.body.split(/\n{2,}/)[0] || '';

  return `<div class="feature" data-reveal>
    <div>
      <div class="project__meta">
        ${project.status ? `<span class="status">${escapeHtml(project.status)}</span>` : ''}
        ${project.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <h3>${escapeHtml(project.title)}</h3>
      <p>${inlineMd(project.tagline)}</p>
      <p>${inlineMd(firstPara.replace(/\s*\n\s*/g, ' '))}</p>
      <div class="chip-row">
        <a class="chip" href="research.html">All research</a>
        ${project.links
          .map(
            (link) =>
              `<a class="chip" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
          )
          .join('')}
      </div>
    </div>
  </div>`;
}

async function init() {
  const mount = document.querySelector('[data-projects]');
  const feature = document.querySelector('[data-project-feature]');
  if (!mount && !feature) return;

  try {
    const projects = parseProjects(await loadText('data/projects.md'));
    if (mount) {
      mount.innerHTML = projects.length
        ? `<div class="projects">${projects.map(projectHtml).join('')}</div>`
        : '<div class="state"><p>Projects are on the way.</p></div>';
      observeReveals(mount);
    }
    if (feature && projects.length) {
      feature.innerHTML = featureHtml(projects[0]);
      observeReveals(feature);
    }
  } catch (error) {
    console.error(error);
    renderError(mount || feature, 'the project list');
  }
}

if (typeof document !== 'undefined') init();

/* Tiny Markdown subset used by the data files.
   Supports: **bold**, *italic*, `code`, [text](url). Everything else is
   escaped, so the data files can never inject markup into the page. */

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SAFE_LINK = /^(https?:\/\/|mailto:|\/|\.\/|#)/i;

export function inlineMd(text) {
  let out = escapeHtml(text);

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
    if (!SAFE_LINK.test(href)) return label;
    const external = /^https?:/i.test(href);
    const rel = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}"${rel}>${label}</a>`;
  });

  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

  return out;
}

/* Block level: blank-line separated paragraphs, each rendered inline. */
export function blockMd(text) {
  return String(text)
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((para) => `<p>${inlineMd(para.replace(/\s*\n\s*/g, ' '))}</p>`)
    .join('');
}

/* Pull markdown links out of a one-line list such as
   "[Paper](https://...) [Code](https://...)" */
export function parseLinkList(text) {
  const links = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (SAFE_LINK.test(m[2])) links.push({ label: m[1], href: m[2] });
  }
  return links;
}

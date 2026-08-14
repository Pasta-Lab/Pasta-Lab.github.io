/* A small BibTeX / biblatex reader.

   Handles nested braces, quoted values, `%` comments outside of entries, and
   the LaTeX escapes that show up in author names. It is deliberately lenient:
   an entry it cannot read is skipped rather than breaking the page. */

const LATEX_ACCENTS = {
  "\\v{c}": 'č', "\\v{C}": 'Č', "\\v{s}": 'š', "\\v{S}": 'Š',
  "\\v{z}": 'ž', "\\v{Z}": 'Ž', "\\v{r}": 'ř', "\\v{e}": 'ě',
  "\\'{e}": 'é', "\\'e": 'é', "\\'{a}": 'á', "\\'a": 'á',
  "\\'{o}": 'ó', "\\'o": 'ó', "\\'{i}": 'í', "\\'i": 'í',
  "\\'{u}": 'ú', "\\'u": 'ú', "\\'{c}": 'ć', "\\'{n}": 'ń',
  '\\"{o}': 'ö', '\\"o': 'ö', '\\"{u}': 'ü', '\\"u': 'ü',
  '\\"{a}': 'ä', '\\"a': 'ä', '\\"{e}': 'ë',
  '\\`{e}': 'è', '\\`e': 'è', '\\`{a}': 'à', '\\`a': 'à',
  '\\^{e}': 'ê', '\\^{o}': 'ô', '\\^{i}': 'î',
  '\\~{n}': 'ñ', '\\~n': 'ñ', '\\~{a}': 'ã',
  '\\c{c}': 'ç', '\\c{C}': 'Ç',
  '\\o': 'ø', '\\ss': 'ß', '\\aa': 'å', '\\&': '&', '\\%': '%',
  '\\_': '_', '\\#': '#', '\\$': '$',
};

function deLatex(value) {
  let out = value;
  for (const [tex, ch] of Object.entries(LATEX_ACCENTS)) {
    out = out.split(tex).join(ch);
  }
  out = out.replace(/\{\\[a-zA-Z]+\s*\}/g, '');
  out = out.replace(/[{}]/g, '');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/* Read a braced value starting at `start`, which must point at "{". */
function readBraced(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\\') { i += 1; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { value: src.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

function readQuoted(src, start) {
  for (let i = start + 1; i < src.length; i += 1) {
    if (src[i] === '\\') { i += 1; continue; }
    if (src[i] === '"') return { value: src.slice(start + 1, i), end: i + 1 };
  }
  return null;
}

/* Split an author field on the top level " and " separators. */
function splitAuthors(field) {
  const parts = [];
  let depth = 0;
  let current = '';
  const tokens = field.split(/(\{|\}|\sand\s)/i);
  for (const token of tokens) {
    if (token === '{') { depth += 1; current += token; continue; }
    if (token === '}') { depth -= 1; current += token; continue; }
    if (/^\sand\s$/i.test(token) && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += token;
  }
  parts.push(current);
  return parts
    .map((name) => normaliseName(deLatex(name)))
    .filter(Boolean);
}

function normaliseName(name) {
  const trimmed = name.trim().replace(/,\s*$/, '');
  if (!trimmed) return '';
  if (trimmed.includes(',')) {
    const [last, ...rest] = trimmed.split(',');
    const first = rest.join(',').trim();
    return first ? `${first} ${last.trim()}` : last.trim();
  }
  return trimmed;
}

export function parseBibtex(source) {
  const entries = [];
  let i = 0;

  while (i < source.length) {
    const at = source.indexOf('@', i);
    if (at === -1) break;

    // ignore an @ that sits inside a comment line
    const lineStart = source.lastIndexOf('\n', at) + 1;
    const before = source.slice(lineStart, at);
    if (before.includes('%')) { i = source.indexOf('\n', at) + 1 || source.length; continue; }

    const braceOpen = source.indexOf('{', at);
    if (braceOpen === -1) break;
    const type = source.slice(at + 1, braceOpen).trim().toLowerCase();
    if (type === 'comment' || type === 'string' || type === 'preamble') {
      const skip = readBraced(source, braceOpen);
      i = skip ? skip.end : braceOpen + 1;
      continue;
    }

    const block = readBraced(source, braceOpen);
    if (!block) break;
    i = block.end;

    const body = block.value;
    const commaAt = body.indexOf(',');
    if (commaAt === -1) continue;

    const entry = { type, key: body.slice(0, commaAt).trim(), fields: {} };
    let j = commaAt + 1;

    while (j < body.length) {
      const eq = body.indexOf('=', j);
      if (eq === -1) break;
      const name = body.slice(j, eq).trim().replace(/^,/, '').trim().toLowerCase();
      let k = eq + 1;
      while (k < body.length && /\s/.test(body[k])) k += 1;

      let read = null;
      if (body[k] === '{') read = readBraced(body, k);
      else if (body[k] === '"') read = readQuoted(body, k);
      else {
        let end = k;
        while (end < body.length && body[end] !== ',') end += 1;
        read = { value: body.slice(k, end), end };
      }
      if (!read) break;

      if (name) entry.fields[name] = read.value;
      j = read.end;
      while (j < body.length && /[\s,]/.test(body[j])) j += 1;
    }

    entries.push(finalise(entry));
  }

  return entries;
}

/* Name a link by where it points, so the chips read "arxiv" rather than "link". */
function labelFor(url) {
  if (/arxiv\.org/i.test(url)) return 'arxiv';
  if (/dl\.acm\.org/i.test(url)) return 'acm';
  if (/dagstuhl|drops\./i.test(url)) return 'dagstuhl';
  if (/github\.com/i.test(url)) return 'code';
  if (/\.pdf(\?|$)/i.test(url) || /usenix\.org/i.test(url)) return 'pdf';
  return 'link';
}

function finalise(entry) {
  const f = entry.fields;
  const get = (key) => (f[key] ? deLatex(f[key]) : '');

  const year = parseInt(get('year'), 10) || 0;
  const month = parseInt(get('month'), 10) || 0;

  const url = get('url');
  const links = [];
  const seen = new Set();
  const push = (label, href) => {
    if (!href || seen.has(href)) return;
    seen.add(href);
    links.push({ label, href });
  };
  push(labelFor(url), url);
  push('pdf', get('pdf'));
  const hasArxiv = () => [...seen].some((href) => /arxiv\.org/i.test(href));
  if (f.eprint && /arxiv/i.test(get('eprinttype') || 'arxiv') && !hasArxiv()) {
    push('arxiv', `https://arxiv.org/abs/${get('eprint')}`);
  }
  push('code', get('code'));
  push('site', get('website'));

  const primary = url || (links[0] ? links[0].href : '');

  return {
    key: entry.key,
    type: entry.type,
    title: get('title'),
    authors: f.author ? splitAuthors(f.author) : [],
    container: get('booktitle') || get('journal') || get('school') || '',
    venue: get('venue') || get('booktitle') || get('journal') || '',
    domain: get('domain'),
    address: get('address'),
    award: get('award'),
    year,
    month,
    url: primary,
    links,
  };
}

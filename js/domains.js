/* Research domains for the publication list.

   A paper's domains come from its venue by default. When the venue is not
   enough, or is misleading, the entry carries an explicit `domain` field which
   REPLACES the venue default:

       domain = {sec, ai}

   `scripts/check-data.mjs` fails the build if any entry ends up with no
   domain, so a new venue that is not in the table below has to be either added
   here or tagged on the entry. */

export const DOMAINS = [
  { id: 'pl', label: 'Programming languages', short: 'PL' },
  { id: 'ai', label: 'AI', short: 'AI' },
  { id: 'sec', label: 'Security', short: 'Security' },
  { id: 'se', label: 'Software engineering', short: 'SE' },
];

export const DOMAIN_IDS = DOMAINS.map((d) => d.id);

/* Matched against the start of the `venue` field, first hit wins. */
const VENUE_TABLE = [
  [/^LMPL/i, ['pl', 'ai']],
  [/^(POPL|PLDI|ICFP|OOPSLA|ECOOP|PEPM|TFP|FnTPL|ITP)/i, ['pl']],
  [/^(ICSE|FSE|ASE|ISSTA|TOSEM|TSE)/i, ['se']],
  [/^(IEEE S&P|USENIX Security|NDSS|CCS|RAID|ASIACCS)/i, ['sec']],
  [/^(ICML|ICLR|NeurIPS|ACL|EMNLP|NAACL|LREC)/i, ['ai']],
];

export function venueDomains(venue) {
  const hit = VENUE_TABLE.find(([pattern]) => pattern.test(venue || ''));
  return hit ? hit[1] : [];
}

/* Domains for a parsed bib entry. Explicit field wins over the venue table. */
export function domainsOf(entry) {
  const explicit = (entry.domain || '')
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const resolved = explicit.length ? explicit : venueDomains(entry.venue);
  return resolved.filter((d) => DOMAIN_IDS.includes(d));
}

export function labelOf(id) {
  const found = DOMAINS.find((d) => d.id === id);
  return found ? found.label : id;
}

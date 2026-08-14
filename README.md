# Pasta Lab website

Programming languages, AI, Security, Trust, and Assurance.
Live at <https://pasta-lab.github.io/>.

Everything that changes lives in `data/`. Edit a file, commit, done. No HTML, no
build step. CI checks the format on every push.

## Where things live

| To add or change | Edit |
|---|---|
| A paper | `data/publications/zhang.bib`, `wei.bib`, or `yang.bib` |
| A news item | `data/news.md` |
| A project | `data/projects.md` |
| A person | `data/people.md` |
| An open position | `data/openings.md` |

## Papers

One entry, in one file, whichever PI is closest to the work. The site merges
all three, so nothing needs duplicating.

```bibtex
@inproceedings{lastname2027short,
  title        = {A Paper Title},
  author       = {First Last and Zhuo Zhang},
  booktitle    = {Proceedings of Somewhere},
  year         = {2027},
  venue        = {ICSE 2027},
  domain       = {se, sec},
  url          = {https://example.org/paper},
  code         = {https://github.com/example/repo},
  award        = {Distinguished Paper Award}
}
```

- `venue` is the short badge on the left of the row.
- `domain` is one or more of **`pl`**, **`ai`**, **`sec`**, **`se`** and drives the
  filters. Leave it out and the domain is inferred from the venue via the table
  in `js/domains.js`. Set it when the venue is wrong or tells only half the
  story. CI fails if a paper ends up with no domain.
- `award` is the only annotation shown next to a paper.
- Extra links: `pdf`, `code`, `website`. `eprint` + `eprinttype = {arXiv}` adds
  an arXiv chip.

## News

Newest first. A `*` after the dash pins it as a highlight. Write as the lab,
not as a person.

```markdown
- * `2027-01-15` We released **Something**. [Paper](https://example.org).
```

## People

Faculty are `###` blocks with `role`, `affiliation`, `photo`, `website`.
Students are one line each:

```markdown
- Someone Name | Their University
- Someone Else | Their University | co-advised with [Name](https://example.com)
```

Only PIs have portraits. A new PI needs three files in `assets/people/`:
`<photo>-chibi-v2.webp`, `<photo>-lego.webp`, `<photo>-minecraft.webp`.

## Projects and openings

Projects: one `##` block per project, key/value lines, `---`, then the
description. The `icon` key names a pasta emoji in `assets/emoji/`, for example
`pasta-sec`. Openings: one line each, `Role | Affiliation | Description`.
Both files carry their own format notes at the top.

## Regenerating the emoji

`assets/emoji/` holds the pasta emoji with their glowing backgrounds cut out.
The source art lives outside the repo. After adding new art there:

```sh
python3 scripts/build-emoji.py
```

## Checking your edits

```sh
npm run check     # same check CI runs
npm run serve     # http://localhost:8000
```

`npm run check` runs two scripts, the same two CI runs on every push:

- `check-data.mjs` validates every data file using the site's own parsers, so
  the checker and the website can never disagree. It catches missing fields,
  unknown domains, duplicate citation keys, broken dates, and missing portraits.
- `check-pages.mjs` checks the pages themselves: internal links and assets
  resolve, fragment links point at ids that exist, no duplicate ids, images
  carry `alt` and dimensions, `target="_blank"` carries `rel="noopener"`, the
  heading outline never skips a level, every page has its canonical URL and
  social tags and skip link, the sitemap matches the pages on disk, both themes
  define the same tokens, every JS module loads, and no stray build artifacts
  are committed.

Neither needs a browser, so CI has no moving parts.

The site must be served over HTTP; opening `index.html` from disk will not load
the data files.

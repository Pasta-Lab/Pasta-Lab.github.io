/* Chrome shared by every page: theme, navigation, scroll reveals. */

/* --- Theme ---------------------------------------------------------------- */

const THEME_KEY = 'pasta-theme';

function applyTheme(value) {
  const root = document.documentElement;
  if (value === 'light' || value === 'dark') root.setAttribute('data-theme', value);
  else root.removeAttribute('data-theme');
}

/* The stylesheet is light unless data-theme says otherwise, so the toggle
   reads what is actually applied rather than the system preference. */
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function initTheme() {
  const button = document.querySelector('.theme-toggle');
  if (!button) return;
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* private mode */ }
    button.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'light' : 'dark'} theme`);
  });
}

/* --- Navigation ----------------------------------------------------------- */

function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const here = location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('.nav__links a').forEach((link) => {
    const target = link.getAttribute('href');
    if (target === here) link.setAttribute('aria-current', 'page');
  });

  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);
  new IntersectionObserver(
    ([entry]) => nav.setAttribute('data-stuck', String(!entry.isIntersecting)),
    { threshold: 0 },
  ).observe(sentinel);

  const burger = nav.querySelector('.nav__burger');
  const links = nav.querySelector('.nav__links');
  if (!burger || !links) return;

  const setOpen = (open) => {
    links.setAttribute('data-open', String(open));
    burger.setAttribute('aria-expanded', String(open));
  };
  burger.addEventListener('click', () => {
    setOpen(links.getAttribute('data-open') !== 'true');
  });
  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

/* --- Scroll reveals ------------------------------------------------------- */

let revealObserver = null;

function ensureObserver() {
  if (revealObserver) return revealObserver;
  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  return revealObserver;
}

/* The reveal animation must never be the reason content stays invisible, so
   anything the observer has not reported on shortly after load is shown
   anyway. Covers reduced motion, an observer that never fires, and elements
   inserted after a fetch resolves. */
let failsafe = null;

function revealEverything() {
  document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => {
    el.classList.add('is-visible');
  });
}

/* Call again after rendering data-driven content. */
export function observeReveals(scope = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scope.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = ensureObserver();
  scope.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => observer.observe(el));

  window.clearTimeout(failsafe);
  failsafe = window.setTimeout(revealEverything, 2000);
}

/* --- Data loading --------------------------------------------------------- */

export async function loadText(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return response.text();
}

export function renderError(mount, what) {
  if (!mount) return;
  mount.innerHTML =
    `<div class="state state--error"><p>Could not load ${what}. ` +
    'If you are viewing these files straight from disk, serve the folder over ' +
    'HTTP instead: <code>python3 -m http.server</code>.</p></div>';
}

/* --- Boot ----------------------------------------------------------------- */

/* Guarded so the parsers in the sibling modules can be imported by
   scripts/check-data.mjs under Node, where there is no DOM. */
if (typeof document !== 'undefined') {
  initTheme();
  initNav();
  observeReveals();
  document.documentElement.classList.add('js-ready');
}

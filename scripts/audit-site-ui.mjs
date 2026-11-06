// Whole-site layout sweep: every chapter and route × widths × colour modes. Records page-level
// problems (sideways scroll, boxes past the viewport, clipped text, overlapping controls, content
// under the fixed navigation, small touch targets, tiny text) and writes labelled contact sheets.
// Usage: node scripts/audit-site-ui.mjs [baseUrl] [outputDir]
//   PAGES=chapters|routes|all  WIDTHS=1440,1024,768,390  MODES=dark,light
import { chromium } from 'file:///C:/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const base = (process.argv[2] || 'http://127.0.0.1:3042').replace(/\/$/, '');
const output = process.argv[3]
  ? pathToFileURL(process.argv[3].replace(/[\\/]?$/, '/'))
  : new URL('../docs/site-verification/', import.meta.url);
const widths = (process.env.WIDTHS || '1440,1024,768,390').split(',').map(Number);
const modes = (process.env.MODES || 'dark,light').split(',');
const slug = process.env.SLUG || '2026-baiye-shifeng';
const chapters = ['prologue', 'rules', 'invitation', 'register', 'duel', 'schedule', 'rewards'].map(
  (id) => ({
    id: 'ch-' + id,
    url: `/?intro=0&stage=2d#${id}`,
    chapter: id,
  }),
);
const routes = [
  ['home', '/home?intro=0&stage=2d'],
  ['t-home', `/t/${slug}`],
  ['t-rules', `/t/${slug}/rules`],
  ['t-signup', `/t/${slug}/signup`],
  ['t-bracket', `/t/${slug}/bracket`],
  ['t-bets', `/t/${slug}/bets`],
  ['t-login', `/t/${slug}/login`],
  ['loadout', '/loadout'],
  ['sportsbook', '/sportsbook'],
  ['tools', '/tools'],
  ['judge-login', '/judge/login'],
].map(([id, url]) => ({ id, url }));
const pages =
  process.env.PAGES === 'chapters'
    ? chapters
    : process.env.PAGES === 'routes'
      ? routes
      : [...chapters, ...routes];
await mkdir(output, { recursive: true });
const shotPath = (name) => new URL(name, output).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));

function inspect() {
  const vw = document.documentElement.clientWidth;
  const vh = innerHeight;
  const issues = [];
  const seen = new Set();
  // Line boxes that overlap vertically belong to the same line (mixed font sizes share a baseline).
  const lineCount = (rects) => {
    const lines = [];
    for (const r of [...rects].filter((x) => x.width > 2).sort((a, b) => a.top - b.top)) {
      const last = lines.at(-1);
      if (last && r.top < last.bottom - 2) last.bottom = Math.max(last.bottom, r.bottom);
      else lines.push({ top: r.top, bottom: r.bottom });
    }
    return lines.length;
  };
  const label = (el) => {
    const cls =
      typeof el.className === 'string'
        ? el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${text ? ` “${text}”` : ''}`;
  };
  const push = (kind, el, detail) => {
    const key = kind + label(el);
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ kind, element: label(el), detail });
  };
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < vh * 3;
  };
  // Elements belonging to the active chapter (lunjian) or the whole page elsewhere.
  const active = document.querySelector('.chapter[data-on]');
  const scope = active || document.querySelector('main') || document.body;
  const roots = [scope, document.querySelector('header[data-site-nav]')].filter(Boolean);
  const all = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  roots.forEach(walk);
  if (document.documentElement.scrollWidth > vw + 2)
    issues.push({
      kind: 'page-scrolls-sideways',
      element: 'html',
      detail: `${document.documentElement.scrollWidth} > ${vw}`,
    });
  const header = document.querySelector('header[data-site-nav]');
  const headerBottom = header && visible(header) ? header.getBoundingClientRect().bottom : 0;
  const scrollers = (el) => {
    for (
      let p = el.parentElement || el.getRootNode().host;
      p;
      p = p.parentElement || p.getRootNode?.().host
    ) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2)
        return true;
    }
    return false;
  };
  const interactive = [];
  for (const el of all) {
    if (!(el instanceof HTMLElement) || !visible(el)) continue;
    if (el.closest('[aria-hidden="true"]') || el.matches('dialog:not([open]) *')) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const isText =
      el.childNodes.length &&
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    // Past the viewport edges, unless inside a box that scrolls on purpose.
    if (
      (r.right > vw + 2 || r.left < -2) &&
      r.width < vw * 2 &&
      !scrollers(el) &&
      !header?.contains(el) &&
      cs.position !== 'fixed'
    )
      push('outside-viewport', el, `${Math.round(r.left)}–${Math.round(r.right)} / ${vw}`);
    if (isText) {
      if (
        /(hidden|clip)/.test(cs.overflowX) &&
        el.scrollWidth > el.clientWidth + 2 &&
        cs.textOverflow !== 'ellipsis'
      )
        push('text-clipped', el, `${el.scrollWidth}>${el.clientWidth}`);
      if (
        /(hidden|clip)/.test(cs.overflowY) &&
        el.scrollHeight > el.clientHeight + 3 &&
        !(cs.webkitLineClamp && cs.webkitLineClamp !== 'none')
      )
        push('text-clipped-vertical', el, `${el.scrollHeight}>${el.clientHeight}`);
      const size = parseFloat(cs.fontSize);
      if (size < 12) push('text-tiny', el, `${size}px`);
      // A short label broken across lines is a layout squeeze, not a paragraph.
      const words = el.textContent.trim();
      if (
        words.length <= 6 &&
        /^(A|BUTTON|SUMMARY|LABEL|STRONG|B|SPAN|H[1-6]|SMALL)$/.test(el.tagName)
      ) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const lines = lineCount(range.getClientRects());
        if (lines > 1)
          push('short-label-wrapped', el, `${lines} lines in ${Math.round(r.width)}px`);
      }
    }
    if (
      el.matches('a[href], button, summary, [role=button], [role=tab], input, select, textarea') &&
      !el.disabled
    ) {
      interactive.push({ el, r });
      if (vw <= 1024 && (r.height < 40 || r.width < 40) && cs.display !== 'inline')
        push('touch-target-small', el, `${Math.round(r.width)}×${Math.round(r.height)}`);
      // Hidden behind the fixed navigation while the page is at rest.
      if (
        headerBottom &&
        !header.contains(el) &&
        r.top < headerBottom - 4 &&
        r.bottom > 0 &&
        !el.closest('dialog')
      )
        push('under-navigation', el, `top ${Math.round(r.top)} < nav ${Math.round(headerBottom)}`);
    }
  }
  // Controls that overlap each other (not nested).
  for (let i = 0; i < interactive.length; i++) {
    for (let j = i + 1; j < interactive.length; j++) {
      const a = interactive[i],
        b = interactive[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 6 && h > 6) push('controls-overlap', a.el, label(b.el));
    }
  }
  return {
    issues,
    navSkin: header
      ? header.querySelector('.battle-nav-frame') &&
        getComputedStyle(header.querySelector('.battle-nav-frame')).display !== 'none'
        ? 'timber'
        : 'other'
      : 'none',
    chapter: active?.id || '',
    url: location.pathname + location.search + location.hash,
  };
}

const results = [];
for (const mode of modes) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    for (const p of pages) {
      try {
        await page.goto(base + p.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.evaluate((mode) => {
          document.documentElement.dataset.colorMode = mode;
          try {
            localStorage.setItem('lunjian-color-mode', mode);
          } catch {
            /* storage may be blocked; the attribute above still applies */
          }
        }, mode);
        if (p.chapter) {
          await page.waitForFunction(() => !!window.__LUNJIAN, null, { timeout: 30000 });
          await page.waitForFunction(
            (c) =>
              document.querySelector('.chapter[data-on]')?.id === c &&
              !document.body.hasAttribute('data-cut'),
            p.chapter,
            { timeout: 30000 },
          );
        }
        await page.waitForTimeout(p.chapter ? 2200 : 1800);
        const result = await page.evaluate(inspect);
        const name = `${p.id}-${width}-${mode}.png`;
        await page.screenshot({ path: shotPath(name) });
        results.push({ page: p.id, width, mode, shot: name, ...result });
        console.log(
          `${p.id} ${width} ${mode}: ${result.issues.length} issues, nav=${result.navSkin}`,
        );
      } catch (e) {
        results.push({ page: p.id, width, mode, error: e.message.split('\n')[0] });
        console.log(`${p.id} ${width} ${mode}: ERROR ${e.message.split('\n')[0]}`);
      }
    }
  }
}
// Contact sheets: one per width × mode, every page as a labelled thumbnail.
for (const mode of modes) {
  for (const width of widths) {
    const set = results.filter((r) => r.width === width && r.mode === mode && r.shot);
    const thumbW = width < 700 ? 200 : 360;
    const thumbH = Math.round(thumbW * ((width < 700 ? 844 : 900) / width));
    const cols = width < 700 ? 6 : 3;
    const html = `<html><body style="margin:0;background:#222;font:12px sans-serif;color:#fff;display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:6px;padding:6px;width:max-content">${set
      .map(
        (r) =>
          `<figure style="margin:0"><img src="${r.shot}" style="width:${thumbW}px;height:${thumbH}px;object-fit:cover;object-position:top;display:block"><figcaption style="padding:2px 0;color:${r.issues.length ? '#ff8a7a' : '#9fe0a0'}">${r.page} · ${r.issues.length} · nav ${r.navSkin}</figcaption></figure>`,
      )
      .join('')}</body></html>`;
    const file = `sheet-${width}-${mode}.html`;
    await writeFile(new URL(file, output), html);
    const sheet = await browser.newPage({
      viewport: { width: cols * (thumbW + 6) + 6, height: 400 },
    });
    await sheet.goto(new URL(file, output).href);
    await sheet.waitForTimeout(400);
    await sheet.screenshot({ path: shotPath(`sheet-${width}-${mode}.png`), fullPage: true });
    await sheet.close();
  }
}
const totals = {};
for (const r of results) for (const i of r.issues || []) totals[i.kind] = (totals[i.kind] || 0) + 1;
const md = [
  `# Site UI sweep — ${base} — ${new Date().toISOString()}`,
  '',
  `Totals: ${JSON.stringify(totals)}`,
  '',
];
for (const r of results) {
  if (r.error) {
    md.push(`## ${r.page} · ${r.width} · ${r.mode} — ERROR ${r.error}`, '');
    continue;
  }
  if (!r.issues.length) continue;
  md.push(`## ${r.page} · ${r.width} · ${r.mode} (${r.issues.length}, nav ${r.navSkin})`);
  for (const i of r.issues.slice(0, 40)) md.push(`- ${i.kind}: ${i.element} — ${i.detail}`);
  if (r.issues.length > 40) md.push(`- … ${r.issues.length - 40} more`);
  md.push('');
}
await writeFile(new URL('sweep.md', output), md.join('\n'));
await writeFile(
  new URL('sweep.json', output),
  JSON.stringify({ base, totals, errors, results }, null, 2),
);
console.log(JSON.stringify({ screens: results.length, totals, errors: errors.slice(0, 10) }));
await browser.close();

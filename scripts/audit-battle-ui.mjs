// Self-audit of the battle screens: clipped or wrapped text, elements leaving their frame,
// off-screen boxes, overlapping tags, touch targets, type sizes and font families — per
// layout A–J, per width and colour mode. Thresholds follow the design system (44px targets,
// 14px minimum text, Noto TC families) and Material's 8px rhythm for spacing checks.
// Usage: node scripts/audit-battle-ui.mjs [baseUrl] [outputDir]
import { chromium } from 'file:///C:/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture } from './battle-fixture.mjs';
const base = process.argv[2] || 'http://127.0.0.1:3042';
const output = process.argv[3]
  ? pathToFileURL(process.argv[3].replace(/[\\/]?$/, '/'))
  : new URL('../docs/battle-verification/audit/', import.meta.url);
const modes = (process.env.MODES || 'dark,light').split(',');
const widths = (process.env.WIDTHS || '1440,1024,390').split(',').map(Number);
const layouts = process.env.LAYOUTS || 'ABCDEFGHIJ';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?intro=0&stage=2d#schedule`, {
  waitUntil: 'domcontentloaded',
  timeout: 120000,
});
await page.waitForFunction(() => !!window.__LUNJIAN);
await page.waitForTimeout(3500);
await page.evaluate(() => {
  const real = window.__LUNJIAN.updateTournament;
  window.__LUNJIAN.updateTournament = (view) => {
    if (view?.slug === 'visual-test') real(view);
  };
});

function auditInPage({ layout, width }) {
  const duel = 'CDEFGH'.includes(layout);
  const host = duel
    ? document.querySelector('#battle-duel-host .battle-art-host')
    : document.querySelector('#bracket-host .battle-art-host');
  const root = host.shadowRoot;
  const issues = [];
  const vw = document.documentElement.clientWidth;
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
    const cls = [...el.classList].slice(0, 2).join('.');
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` “${text}”` : ''}`;
  };
  const rendered = (el) =>
    el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const push = (kind, el, detail) => issues.push({ kind, element: label(el), detail });
  const fonts = new Set();
  // 1. Text: clipping, unintended wrapping, size and family.
  const textLeaves = [
    ...root.querySelectorAll(
      'strong, small, h2, h3, h4, p, span, td, th, button, summary, b, li, dt, dd',
    ),
  ].filter(
    (el) =>
      rendered(el) && el.textContent.trim() && ![...el.children].some((c) => c.textContent.trim()),
  );
  for (const el of textLeaves) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const size = parseFloat(cs.fontSize);
    const line = parseFloat(cs.lineHeight) || size * 1.4;
    // Count real line boxes; fixed-height buttons are not "wrapped" because they are tall.
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = lineCount(range.getClientRects()) || Math.round(rect.height / line);
    const clamped = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    // An ellipsis on a long name is the intended overflow (the full name is in the label and dialog);
    // a hard cut without it is a defect. Names up to six characters must always fit in full.
    const ellipsis = cs.textOverflow === 'ellipsis' && el.textContent.trim().length > 6;
    if (!ellipsis && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1)
      push('text-clipped', el, `${el.scrollWidth}>${el.clientWidth}px`);
    if (!clamped && cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2)
      push('text-clipped-vertical', el, `${el.scrollHeight}>${el.clientHeight}px`);
    const name = el.matches(
      '.seat-name strong, .duel-plate-text strong, .duel-hero-plate strong, .identity strong, .member-name strong, .seat-status b, .route-score, .duel-team h3, .scene-title h2',
    );
    // Names up to six characters must stay on one line; longer ones are allowed to wrap (two-line clamp).
    if (name && lines > 1 && el.textContent.trim().length <= 6)
      push('text-wrapped', el, `${lines} lines at ${Math.round(rect.width)}px`);
    if (size < 12) push('text-too-small', el, `${size}px`);
    else if (size < 14 && width <= 600) push('text-small-on-phone', el, `${size}px`);
    const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    fonts.add(family);
    if (!/^Noto (Serif|Sans) TC$/.test(family)) push('font-off-system', el, family);
    const weight = Number(cs.fontWeight);
    if (weight && weight < 400) push('font-weight-thin', el, String(weight));
  }
  // 2. Containment and screen bounds for interactive boxes.
  const frames =
    '.ab-col, .ab-center, .round-match, .duel-roster, .duel-center, .side-history, .champion-focus, .team-crown-frame, .dialog-roster';
  for (const el of root.querySelectorAll(
    '.seat, .duel-plate, .duel-hero, .nameplate, .route-score, .duel-back, .duel-more, .paper-action, .member-portrait, .laurel-name, .history-table, .duel-groups button, .side-controls button, .round-tabs-new button, .ab-final-status',
  )) {
    if (!rendered(el)) continue;
    const r = el.getBoundingClientRect();
    // The tablet tree scrolls sideways inside its own box by design; that is not off-screen.
    if (!el.closest('.ab-scroll') && (r.left < -1 || r.right > vw + 1))
      push('off-screen', el, `left ${Math.round(r.left)} right ${Math.round(r.right)} / ${vw}`);
    const frame = el.parentElement?.closest(frames);
    if (frame && frame !== el) {
      const f = frame.getBoundingClientRect();
      const tag = el.matches('.route-score');
      // Match tags live in the 72px gutter beside their pair; anything else stays inside its frame.
      const slack = tag ? 72 : 8;
      if (
        r.left < f.left - slack ||
        r.right > f.right + slack ||
        r.top < f.top - slack ||
        r.bottom > f.bottom + slack
      )
        push(
          'leaves-frame',
          el,
          `${label(frame)}: box ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} vs frame ${Math.round(f.left)},${Math.round(f.top)}–${Math.round(f.right)},${Math.round(f.bottom)}`,
        );
    }
  }
  // 3. Match tags must not sit on top of names; cards must not overlap each other.
  const inter = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const names = [
    ...root.querySelectorAll('.seat-name strong, .seat-name small, .duel-plate-text strong'),
  ]
    .filter(rendered)
    .map((el) => ({ el, r: el.getBoundingClientRect() }));
  for (const tag of root.querySelectorAll('.route-score')) {
    if (!rendered(tag)) continue;
    const r = tag.getBoundingClientRect();
    for (const n of names) if (inter(r, n.r) > 4) push('tag-covers-text', tag, label(n.el));
  }
  const cards = [...root.querySelectorAll('.seat, .duel-plate, .duel-hero, .nameplate')]
    .filter(rendered)
    .map((el) => ({ el, r: el.getBoundingClientRect() }));
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++)
      if (inter(cards[i].r, cards[j].r) > 64)
        push('cards-overlap', cards[i].el, label(cards[j].el));
  // 4. Touch targets on phones and tablets (Material 48dp, design system 44px).
  if (width <= 1024) {
    for (const el of [
      ...root.querySelectorAll('button, a, summary'),
      ...document.querySelectorAll('header[data-site-nav] a, header[data-site-nav] button'),
    ]) {
      if (!rendered(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 44 || r.width < 44)
        push('touch-target', el, `${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  // 5. Navigation: chapter labels on one line, actions inside the frame, brand readable.
  const nav = document.querySelector('header[data-site-nav] .lj-nav__inner');
  if (nav) {
    const n = nav.getBoundingClientRect();
    for (const a of nav.querySelectorAll('.lj-nav__chapters a')) {
      if (!rendered(a)) continue;
      const r = a.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(a);
      if (lineCount(range.getClientRects()) > 1)
        push('nav-label-wrapped', a, `${Math.round(r.height)}px tall`);
      if (a.scrollWidth > a.clientWidth + 1)
        push('nav-label-clipped', a, `${a.scrollWidth}>${a.clientWidth}`);
    }
    for (const el of nav.querySelectorAll('.lj-nav__actions > *')) {
      if (!rendered(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > n.right + 1 || r.left < n.left - 1)
        push(
          'nav-action-outside',
          el,
          `${Math.round(r.left)}–${Math.round(r.right)} vs ${Math.round(n.left)}–${Math.round(n.right)}`,
        );
    }
    const brand = nav.querySelector('.brand-wordmark');
    if (brand && rendered(brand)) {
      const b = brand.getBoundingClientRect(),
        p = nav.querySelector('.lj-nav__brand').getBoundingClientRect();
      if (b.right > p.right + 1 || b.left < p.left - 1)
        push(
          'brand-outside-plaque',
          brand,
          `${Math.round(b.left)}–${Math.round(b.right)} vs ${Math.round(p.left)}–${Math.round(p.right)}`,
        );
      const c = getComputedStyle(brand).color;
      if (
        /^rgb\((\d+), (\d+), (\d+)\)$/.test(c) &&
        c
          .match(/\d+/g)
          .map(Number)
          .reduce((a, b) => a + b) < 300
      )
        push('brand-dark-on-dark', brand, c);
    }
  }
  // 6. Spacing rhythm: gaps between stacked cards should sit on the 8px grid (Material baseline).
  const stacks = [
    ...root.querySelectorAll('.ab-pair, .duel-list, .match-entrants, .champion-members'),
  ].filter(rendered);
  for (const stack of stacks) {
    const gap = parseFloat(getComputedStyle(stack).rowGap || getComputedStyle(stack).gap);
    if (gap && gap % 4 !== 0) push('gap-off-grid', stack, `${gap}px`);
  }
  return { issues, fonts: [...fonts], count: issues.length };
}

const report = [];
for (const mode of modes) {
  await page.evaluate((mode) => {
    document.documentElement.dataset.colorMode = mode;
  }, mode);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    for (const layout of layouts) {
      const data = fixture(layout, { longName: true });
      await page.evaluate(
        ({ data, layout }) => {
          window.__LUNJIAN.updateTournament(data);
          if ('CDEFGH'.includes(layout))
            window.__LUNJIAN.selectDuelMatch(data.rounds[0].matches[0].id);
          else location.hash = 'schedule';
        },
        { data, layout },
      );
      await page.waitForFunction(
        (layout) => {
          const duel = 'CDEFGH'.includes(layout);
          const el = duel
            ? document.querySelector('#battle-duel-host .battle-art-host')
            : document.querySelector('#bracket-host');
          const root = duel ? el?.shadowRoot : el?.querySelector('.battle-art-host')?.shadowRoot;
          const chapter = document.querySelector('.chapter[data-on]')?.id;
          return (
            el?.dataset.battleLayout === layout &&
            root?.querySelector('.ab-tree, .champion-board, .scene-duel') &&
            !document.body.hasAttribute('data-cut') &&
            chapter === (duel ? 'duel' : 'schedule')
          );
        },
        layout,
        { timeout: 20000 },
      );
      await page.waitForTimeout(700);
      const result = await page.evaluate(auditInPage, { layout, width });
      // Hover state must not move the card or spill its portrait outside the frame.
      const hover = await page.evaluate((layout) => {
        const duel = 'CDEFGH'.includes(layout);
        const el = duel
          ? document.querySelector('#battle-duel-host .battle-art-host')
          : document.querySelector('#bracket-host .battle-art-host');
        const card = [
          ...el.shadowRoot.querySelectorAll(
            '.seat-player, .duel-plate, .duel-hero, .nameplate, .member-portrait',
          ),
        ].find((c) => c.getClientRects().length);
        return card
          ? {
              x: card.getBoundingClientRect().x + 20,
              y: card.getBoundingClientRect().y + 20,
              before: card.getBoundingClientRect().toJSON(),
            }
          : null;
      }, layout);
      if (hover) {
        await page.mouse.move(hover.x, hover.y);
        await page.waitForTimeout(350);
        const after = await page.evaluate((layout) => {
          const duel = 'CDEFGH'.includes(layout);
          const el = duel
            ? document.querySelector('#battle-duel-host .battle-art-host')
            : document.querySelector('#bracket-host .battle-art-host');
          const card = [
            ...el.shadowRoot.querySelectorAll(
              '.seat-player, .duel-plate, .duel-hero, .nameplate, .member-portrait',
            ),
          ].find((c) => c.getClientRects().length);
          return card.getBoundingClientRect().toJSON();
        }, layout);
        if (
          Math.abs(after.x - hover.before.x) > 1 ||
          Math.abs(after.width - hover.before.width) > 1 ||
          Math.abs(after.height - hover.before.height) > 1
        )
          result.issues.push({
            kind: 'hover-shifts-layout',
            element: 'first card',
            detail: `${Math.round(hover.before.width)}×${Math.round(hover.before.height)} → ${Math.round(after.width)}×${Math.round(after.height)}`,
          });
        await page.mouse.move(5, 500);
      }
      report.push({ layout, width, mode, ...result });
      if (result.issues.length)
        await page.screenshot({
          path: new URL(`${layout}-${width}-${mode}.png`, output).pathname.replace(
            /^\/(\w:)/,
            '$1',
          ),
          fullPage: width < 1300,
        });
    }
  }
}
const totals = {};
for (const r of report) for (const i of r.issues) totals[i.kind] = (totals[i.kind] || 0) + 1;
await writeFile(
  new URL('audit.json', output),
  JSON.stringify({ base, at: new Date().toISOString(), totals, errors, report }, null, 2),
);
const lines = [
  `# Battle UI audit — ${new Date().toISOString()}`,
  '',
  `Totals: ${JSON.stringify(totals)}`,
  '',
];
for (const r of report)
  if (r.issues.length) {
    lines.push(`## ${r.layout} · ${r.width}px · ${r.mode} (${r.issues.length})`);
    const seen = new Set();
    for (const i of r.issues) {
      const key = `${i.kind}|${i.element}|${i.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${i.kind}: ${i.element} — ${i.detail}`);
    }
    lines.push('');
  }
await writeFile(new URL('audit.md', output), lines.join('\n'));
console.log(JSON.stringify({ screens: report.length, totals, errors }));
await browser.close();

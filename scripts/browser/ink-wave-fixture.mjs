// Browser-only fixture: real component CSS, no account or server writes.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const css = (path, prefix) =>
  fs.readFileSync(root + path, 'utf8').replace(/\.([a-zA-Z][\w-]*)/g, (_, n) => '.' + prefix + n);
export async function fixture(p) {
  await p.addStyleTag({
    content:
      css('web/src/features/signup/BuildCard.module.css', 'build-') +
      '\n' +
      css('web/src/features/signup/SelectedLoadout.module.css', 'option-'),
  });
  await p.evaluate(() => {
    const e = document.createElement('div');
    e.id = 'wave-audit-fixture';
    e.style.cssText =
      'position:fixed;inset:180px 20px auto;z-index:999999;background:var(--surface-base);padding:20px';
    e.innerHTML = `<button class="option-option" style="width:100%" aria-pressed="false"><strong>角色一</strong><span><span class="build-card" data-build-card><span class="build-content"><span class="build-heading"><strong>尚未選擇流派</strong></span><span class="build-martials"><span class="build-empty">選擇流派後顯示對應武學</span></span></span></span></span><small>尚未完成配置</small></button>`;
    document.body.append(e);
  });
}
export function inspect(el) {
  const layer = el.querySelector('.ink-g-layer'),
    label = el.querySelector('.ink-g-label');
  if (!layer || !label) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const rgba = (color) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const lum = (c) =>
    c
      .slice(0, 3)
      .map((v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      })
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    a = lum(a);
    b = lum(b);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const fill = getComputedStyle(el.querySelector('.ink-g-front')).fill;
  const texts = [...label.querySelectorAll('*')].filter((n) =>
    [...n.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()),
  );
  if ([...label.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
    texts.push(label);
  return {
    text: el.textContent.trim().slice(0, 70),
    fill,
    items: texts.map((n) => {
      let bg = rgba(fill);
      for (let a = n; a && a !== label.parentElement; a = a.parentElement) {
        const c = rgba(getComputedStyle(a).backgroundColor);
        if (c[3] > 240) {
          bg = c;
          break;
        }
      }
      return {
        text: n.textContent.trim().slice(0, 45),
        color: getComputedStyle(n).color,
        bg,
        ratio: ratio(rgba(getComputedStyle(n).color), bg),
      };
    }),
  };
}

// 產 art/vs-ink.png 佔位圖：骨白的墨、透明的底，裁到剛好框住 VS。
// 透明度寫在檔案裡，執行期就不必 invert、不必 mix-blend-mode ——
// 那條路走不通，因為 .chapter-sticky 是 sticky，自成一個堆疊脈絡，
// 混色模式根本碰不到底下 #stage 那層場景。
// 真跡請用 tools/vs-import.py 轉成同一種格式再覆蓋這個檔案。
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB  = resolve(HERE, '..');
const BOX = 760, PAD = 40;   // 只畫 VS 本身，四周留一點筆畫甩出去的餘地
const W = BOX + PAD * 2, H = W;

const b  = await chromium.launch();
const pg = await b.newPage({ viewport: { width: W, height: H } });
pg.on('pageerror', e => console.error('page:', e.message));
await pg.setContent(`<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden}
  #host{position:absolute;width:${BOX}px;height:${BOX}px;left:${PAD}px;top:${PAD}px}
  svg{width:100%;height:100%;overflow:visible}
  svg path,svg ellipse{fill:#f1e9d8}
</style>
<svg style="position:absolute;width:0;height:0">
  <filter id="ink-jh" x="-25%" y="-25%" width="150%" height="150%">
    <feGaussianBlur stdDeviation="2.4" result="b"/>
    <feColorMatrix in="b" type="matrix"
      values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"/>
  </filter>
</svg>
<div id="host"></div>
<script>${readFileSync(resolve(LAB, 'brush.js'), 'utf8')}</script>
<script>${readFileSync(resolve(LAB, 'ink-title.js'), 'utf8')}</script>
<script>document.getElementById('host').appendChild(inkVS());</script>`);
await pg.waitForTimeout(400);
writeFileSync(resolve(LAB, 'art/vs-ink.png'),
  await pg.screenshot({ type: 'png', omitBackground: true }));
await b.close();
console.log(`art/vs-ink.png  ${W}×${H}  骨白墨 ＋ 透明底`);

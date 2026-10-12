/* ══════════════════════════════════════════════════════════
   墨字引擎
   ------------------------------------------------------------------
   做法：**筆畫外框當形狀，中線當驅動**。
   外框（hanzi-writer 的 strokes）本身就是毛筆輪廓 —— 起筆的頓、行筆的提按、
   收筆的挑鋒全都在裡面。中線（medians）只負責「寫到哪裡了」：
   沿中線塗一條粗白線當遮罩，露到哪、字就出現到哪。

   只拿中線去描粗會變成麥克筆：粗細一致、沒有收鋒。那不是毛筆。

   浮誇的部分有四層，每一層都對應真的墨在紙上的行為：
     1. 滲  bleed   朱紅的暈，比字大一點、糊一點，壓在字下面
     2. 飛白 rough   feTurbulence 位移，讓邊緣咬出紙的纖維
     3. 噴  splash  最後一筆收筆時墨點爆開
     4. 潤  sheen   剛寫完那一下的水光，很快乾掉
   ══════════════════════════════════════════════════════════ */

const INK = {
  glyphs: null,       // 楷書骨架：每個字的中線，筆順就是從這裡來的
  uid: 0,
  async load(url){
    if (!this.glyphs) this.glyphs = await (await fetch(url)).json();
    return this.glyphs;
  },
};

/* 這裡本來還有一支 tracedSVG()：拿真跡的整塊外框，用楷書中線當導引，
   拿一支很粗的筆掃過去做「遮色片顯影」。字形是對的行草，但那條路
   使用者明確否決過兩次 —— 遮色片掃出來的是「一次露出一整個字」，
   看起來就是擦除動畫，不是在寫字。留著只會讓人再繞回去，所以整支移除。
   要寫字就走 strokeSVG()：一個動畫元素等於一筆，這是它讀起來像書寫的原因。 */


/**
 * 一筆一筆寫。
 *
 * 這是唯一真的在「寫」的做法：每一筆的**形狀**由那一筆的中線長出來
 * （brush.js），**顯影**再走同一條中線。同一個來源，所以筆刷走到哪、
 * 筆畫就長到哪，不會出現「刮開一塊」。
 *
 * 用行書字型或真跡做不到這件事：那是一整塊填色路徑，沒有逐筆資訊，
 * 只能拿另一條線去刮。刮開不是寫 —— 差別看得出來。
 * 代價是這裡的字形是楷書骨架，不是行草。形 vs 寫，只能選一個。
 */
function strokeSVG(word, o = {}){
  const G = INK.glyphs;
  if (!G) return null;
  const chars = [...word];
  if (!chars.every(c => G[c] || PUNCT[c] !== undefined)) return null;

  const track = o.track ?? 0.12;
  const ADV = 1024 * (1 + track);
  const vert = !!o.vertical;
  const W = vert ? ADV : chars.length * ADV;
  const uid = 'sk' + (++INK.uid);

  // 先把所有筆畫攤平，時長才能按整行的筆畫長度分配
  const plan = [];
  chars.forEach((c, ci) => {
    if (!G[c]) { plan.push({ci, punct: PUNCT[c] || ''}); return; }
    const g = G[c];
    const style = o.glyphStyles?.[c] || {};
    const Wd = style.width ?? Math.max(52, Math.min(96, 96 - (g.m.length - 7) * 4.2));
    const cursive = style.cursive ?? 1;
    g.m.forEach((med, si) => {
      // **關鍵**：外形和顯影必須用同一條中線。
      // 這就是「一筆一筆寫」成立的全部原因 —— 筆刷走到哪，筆畫就長到哪。
      const cm = cursivize(med, cursive);
      plan.push({
        ci, si, med: cm, len: polyLen(cm), nib: Wd,
        outline: brushStroke(med, {width: Wd, cursive, seed: (ci * 7 + si) * 0.37}),
      });
    });
  });
  const strokes = plan.filter(x => x.len !== undefined);
  if (!strokes.length) return null;

  const GAP = o.gap ?? 40;                       // 提筆：筆與筆之間的空檔
  const CHAR_GAP = o.charGap ?? 190;             // 換字時手要移過去
  const MIN = 58;
  const total = o.dur ?? 2600;
  const budget = Math.max(400, total - GAP * strokes.length - CHAR_GAP * (chars.length - 1));
  const sumLen = strokes.reduce((a, x) => a + x.len, 0) || 1;
  let durs = strokes.map(x => Math.max(MIN, x.len / sumLen * budget));

  let defs = '', lace = '', t = o.delay ?? 0, si = 0, lastCi = -1;
  const inner = {};
  let prevEnd = null, prevOff = null;

  plan.forEach(item => {
    const dx = vert ? 0 : item.ci * ADV;
    const dy = vert ? -item.ci * ADV : 0;
    if (item.ci !== lastCi && lastCi >= 0) t += CHAR_GAP;
    lastCi = item.ci;

    if (item.punct !== undefined){
      inner[item.ci] = (inner[item.ci] || '') +
        `<g class="ink-punct" style="--at:${t.toFixed(0)}ms">${item.punct}</g>`;
      t += 90;
      return;
    }

    const dur = durs[si++];
    // 牽絲：上一筆收處拉到這一筆起處。它也照順序長出來，所以會**加強**
    // 「正在寫」的感覺，而不是像遮色片那樣憑空刮開。
    if (prevEnd && o.lace !== false){
      const a = [prevEnd[0] + prevOff[0], prevEnd[1] + prevOff[1]];
      const b = [item.med[0][0] + dx, item.med[0][1] + dy];
      const d0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d0 > 70 && d0 < 1500){
        const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * .22;
        const my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * .22;
        const cross = (item.ci !== (prevOff[2]));
        lace += `<path class="ink-lace${cross ? ' cross' : ''}"`
             +  ` d="M${a[0].toFixed(0)} ${a[1].toFixed(0)} Q${mx.toFixed(0)} ${my.toFixed(0)} ${b[0].toFixed(0)} ${b[1].toFixed(0)}"`
             +  ` style="--len:${(d0 * 1.3).toFixed(0)};--dur:${Math.min(130, GAP * 2.4).toFixed(0)}ms;--at:${(t - GAP).toFixed(0)}ms"/>`;
      }
    }
    prevEnd = item.med[item.med.length - 1];
    prevOff = [dx, dy, item.ci];

    const id = `${uid}-${item.ci}-${item.si}`;
    const L = item.len + item.nib * 1.5;         // 含筆刷半徑，收筆才蓋得滿
    defs += `<mask id="${id}" maskUnits="userSpaceOnUse" x="-200" y="-320" width="1424" height="1464">`
         +  `<path class="ink-nib" d="${polyPath(item.med)}" stroke="#fff"`
         +  ` stroke-width="${(item.nib * 2.1).toFixed(0)}" fill="none"`
         +  ` stroke-linecap="round" stroke-linejoin="round"`
         +  ` style="--len:${L.toFixed(0)};--dur:${dur.toFixed(0)}ms;--at:${t.toFixed(0)}ms"/></mask>`;
    inner[item.ci] = (inner[item.ci] || '') + `<path d="${item.outline}" mask="url(#${id})"/>`;
    t += dur + GAP;
  });

  let body = '';
  Object.keys(inner).forEach(ci => {
    const i = +ci;
    const seed = (word.charCodeAt(i) * 2654435761 % 1000) / 1000;
    const rot = (seed * 6 - 3).toFixed(2);
    const sc = (0.96 + seed * 0.08).toFixed(3);
    const bx = (vert ? 0 : i * ADV) + (vert ? (seed - .5) * 60 : 0);
    const by = (vert ? -i * ADV : 0) + (vert ? 0 : (seed - .5) * 70);
    body += `<g transform="translate(${bx.toFixed(0)},${by.toFixed(0)}) rotate(${rot} 512 400) scale(${sc})">${inner[ci]}</g>`;
  });
  body += `<g class="ink-lace-set">${lace}</g>`;

  const vbW = W + 360;
  const vbH = vert ? (1024 + (chars.length - 1) * ADV + 360) : 1500;
  return `<svg class="ink-svg wild" viewBox="-180 -180 ${vbW} ${vbH}"
     preserveAspectRatio="xMidYMid meet" role="img" aria-label="${word}" style="--ink-dur:${t.toFixed(0)}ms">
    <defs>${defs}</defs>
    <g transform="scale(1,-1) translate(0,-900)"><g class="ink-body">${body}</g></g>
  </svg>`;
}

function polyLen(pts){
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
  return L;
}
function polyPath(pts){
  return 'M' + pts.map(p => `${p[0]} ${p[1]}`).join(' L');
}

/** 把一個帶 data-ink 的容器換成墨字。已經換過就不重做。 */
function mountInk(el, o){
  if (!el || el.dataset.inkDone) return;
  const word = el.dataset.ink || el.textContent.trim();
  const svg = strokeSVG(word, o);
  if (svg === null) return;                      // 缺字 → 保留字型版本
  el.dataset.inkDone = '1';
  // 長寬比由字數決定，寬度吃滿容器 → 字會隨卡寬長大，不用逐張調字級
  {
    const n = [...word].length;
    const adv = 1024 * (1 + (o.track ?? .12));
    el.style.aspectRatio = o.vertical
      ? ((adv + 360) / (1024 + (n - 1) * adv + 360)).toFixed(3)
      : ((n * adv + 360) / 1500).toFixed(3);
  }
  el.innerHTML = svg;
}

/** 播放：加 class 讓 CSS 的 animation-delay/duration 生效；只播一次。 */
function playInk(root){
  root.querySelectorAll('.ink-svg').forEach(svg => {
    if (svg.dataset.played) return;
    svg.dataset.played = '1';
    svg.classList.add('writing');
    const total = parseFloat(svg.style.getPropertyValue('--ink-dur')) || 900;
    // 收筆那一下：噴墨 ＋ 水光 ＋ 一個很小的過衝
    // 寫完不做任何切換：不換濾鏡、不拆遮罩。
    // 那兩件事都會讓字在完成的瞬間「跳」一下，看起來像換了字體。
    // 收尾交給遮罩裡那層慢淡入。
    setTimeout(() => splash(svg), total);

  });
}

/** 收筆噴墨：在最後一筆的終點附近撒幾顆，往外散開然後乾掉。 */
function splash(svg){
  const host = svg.parentElement;
  if (!host || host.querySelector('.ink-splash')) return;
  const nibs = svg.querySelectorAll('.ink-nib');
  const last = nibs[nibs.length - 1];
  if (!last) return;
  const r = last.getBoundingClientRect(), hr = host.getBoundingClientRect();
  if (!r.width && !r.height) return;
  const cx = ((r.right - hr.left) / hr.width) * 100;
  const cy = ((r.bottom - hr.top) / hr.height) * 100;
  const wrap = document.createElement('span');
  wrap.className = 'ink-splash';
  const N = 7;
  for (let i = 0; i < N; i++){
    const a = (-0.9 + Math.random() * 1.8) * Math.PI;     // 往下半圈甩
    const dist = 14 + Math.random() * 26;
    const size = 3 + Math.random() * 6;
    const b = document.createElement('i');
    b.style.cssText = `left:${cx}%;top:${cy}%;width:${size}px;height:${size}px;`
      + `--dx:${(Math.cos(a) * dist).toFixed(1)}px;--dy:${(Math.abs(Math.sin(a)) * dist).toFixed(1)}px;`
      + `--d:${(i * 22).toFixed(0)}ms`;
    wrap.appendChild(b);
  }
  host.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('go'));
  setTimeout(() => wrap.remove(), 1400);
}

/* ── VS 墨印 ────────────────────────────────────────────────────────────────
   對決那一格中間的標記。不放圖檔，用跟標題同一支筆生成：
   一筆圈（有開口的圓，起收筆會錯開）＋ V 兩筆 ＋ S 一筆。
   都走 brushStroke 的壓力曲線，所以粗細、側鋒、飛白跟題字是同一套手感。 */
const VS_ENSO = (() => {
  const pts = [];
  // 從右上起筆，繞 335° 留一道開口；半徑帶點雜訊，圈才不會像用圓規畫的
  for (let i = 0; i <= 44; i++){
    const t = i / 44;
    const a = (-0.34 + t * 5.85) * Math.PI / 3.0 * 1.0;
    const r = 122 + Math.sin(t * 11.3) * 4.6 + Math.sin(t * 4.1 + 1.7) * 3.2;
    pts.push([150 + Math.cos(a) * r * 1.03, 150 + Math.sin(a) * r * 0.97]);
  }
  return pts;
})();

/* V 兩筆、S 一筆。三筆之間留得開一點 —— #ink-jh 是黏合型濾鏡，
   筆畫挨太近會被糊成一坨，那就不是兩個字母了。 */
const VS_STROKES = [
  // V 左撇：起筆重，一路收
  { med: [[62,68],[88,134],[109,192],[124,234],[130,250]], w: 40, seed: 3.1 },
  // V 右挑：從谷底翻上去，收在半空
  { med: [[130,250],[146,192],[158,132],[164,88],[166,70]], w: 35, seed: 5.7 },
  // S：一筆連綿，落在右下，跟 V 錯開
  { med: [[258,120],[232,101],[204,107],[196,130],[209,151],[234,168],[247,191],
          [242,218],[216,239],[186,242],[169,229]], w: 31, seed: 8.2 },
];

/* 甩出去的墨點。位置是寫死的，不是隨機 —— 每次重整都換一組會像雜訊，不像同一塊招牌。 */
const VS_SPATTER = [
  [188,58,5.2],[205,46,3.1],[152,268,4.4],[171,282,2.6],[96,44,3.6],
  [274,168,3.0],[62,206,2.4],[246,268,3.4],[118,22,2.2],
];

/** 生一顆 VS 墨印的 <svg>。size 只影響外框，內部一律 300×300 座標。 */
function inkVS(){
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 300');
  svg.setAttribute('class', 'duel-vs-ink');
  svg.setAttribute('aria-hidden', 'true');

  const group = (cls, op) => {
    const g = document.createElementNS(NS, 'g');
    // 濾鏡與透明度分兩層：#ink-jh 的 feColorMatrix 把 alpha 乘上 ~19 再減 8，
    // 半透明的東西丟進去會被直接壓成 0。所以外層只管濾鏡，透明度掛在外層 <g>
    // 上（群組透明度是在濾鏡之後才合成的），圈才不會整條消失。
    g.setAttribute('filter', 'url(#ink-jh)');
    if (cls) g.setAttribute('class', cls);
    const outer = document.createElementNS(NS, 'g');
    if (op != null) outer.setAttribute('opacity', op);
    outer.appendChild(g); svg.appendChild(outer);
    return g;
  };
  const put = (g, d, cls) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); if (cls) p.setAttribute('class', cls);
    g.appendChild(p);
  };

  // 圈在後，字在前
  const back = group('enso-g', 0.5);
  put(back, brushStroke(VS_ENSO, { width: 30, seed: 1.3, cursive: 0, tail: 0.05 }), 'enso');
  const front = group(null, null);
  for (const s of VS_STROKES)
    put(front, brushStroke(s.med, { width: s.w, seed: s.seed, cursive: 0.22, tail: 0.22 }));
  for (const [x, y, r] of VS_SPATTER){
    const c = document.createElementNS(NS, 'ellipse');
    c.setAttribute('cx', x); c.setAttribute('cy', y);
    c.setAttribute('rx', r); c.setAttribute('ry', r * 0.82);
    front.appendChild(c);
  }
  return svg;
}

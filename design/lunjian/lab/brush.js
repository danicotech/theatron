/* ══════════════════════════════════════════════════════════
   筆鋒生成器
   ------------------------------------------------------------------
   不用字型的輪廓，自己從中線長出筆畫。

   為什麼：楷書輪廓是「印出來的字」——粗細平均、收筆是方的頓角。
   套再多濾鏡，它還是一個被弄糙的印刷體。毛筆字的樣子來自**運筆**：
   起筆側鋒入紙、行筆有按有提、收筆把筆提起來出鋒。那是寬度沿著
   筆畫長度變化的函數，只要有中線就能算出來。

   所以這裡做的事是：把中線加密平滑，沿法線往兩側各推 w(t)/2，
   前進一側、回來另一側，收成一個封閉外形。w(t) 就是壓力曲線。
   ══════════════════════════════════════════════════════════ */

/** Catmull-Rom 加密：原始中線只有幾個點，直接用會是折線不是筆畫。 */
function resample(pts, n){
  if (pts.length < 2) return pts.slice();
  const P = pts.length === 2
    ? [pts[0], [(pts[0][0]+pts[1][0])/2, (pts[0][1]+pts[1][1])/2], pts[1]]
    : pts;
  const ext = [P[0], ...P, P[P.length-1]];
  const out = [];
  const segs = P.length - 1;
  for (let i = 0; i < segs; i++){
    const p0 = ext[i], p1 = ext[i+1], p2 = ext[i+2], p3 = ext[i+3];
    const steps = Math.max(2, Math.round(n / segs));
    for (let s = 0; s < steps; s++){
      const t = s / steps, t2 = t*t, t3 = t2*t;
      out.push([
        0.5*((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5*((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
      ]);
    }
  }
  out.push(P[P.length-1]);
  return out;
}

/**
 * 壓力曲線。這一條決定了字看起來是寫的還是印的。
 *   起筆 0.58 → 頓到 1.0（t 0.14）→ 行筆微幅起伏 → 收筆提到 0.08 出鋒
 * turn：轉折處加一點按（真的寫字在轉角會下沉）
 */
function pressure(t, seed){
  const ss = (a, b, x) => { const n = Math.min(1, Math.max(0, (x-a)/(b-a))); return n*n*(3-2*n); };
  // 起筆：側鋒入紙後立刻頓下去，所以頭是重的。
  const head = 0.52 + 0.48 * ss(0, 0.10, t);
  // 收筆：**從一半就開始提**，一路提到幾乎沒有。
  // 這條曲線是行草和楷書最大的差別 —— 楷書收筆是頓（粗的），
  // 行草收筆是提（出鋒，細到剩一絲）。之前提得太晚太少，所以看起來像麥克筆。
  const tail = 1 - 0.97 * Math.pow(ss(0.42, 1, t), 1.35);
  // 行筆的按提：手不是等速的，中段會有起伏
  const ripple = 1 + 0.13 * Math.sin(t * 6.1 + seed * 6.3) * ss(0.08, 0.28, t) * (1 - ss(0.55, .95, t));
  return Math.max(0.018, head * tail * ripple);
}

/** 出鋒：把中線往前拖一小段，筆離紙前的那道尾巴。 */
function addTail(pts, frac){
  if (pts.length < 2 || frac <= 0) return pts;
  const n = pts.length;
  const a = pts[n-2], b = pts[n-1];
  let dx = b[0]-a[0], dy = b[1]-a[1];
  const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
  const L = total * frac;
  // 尾巴微微彎，直的尾巴看起來像箭頭不像筆
  const cx = -dy * L * 0.12, cy = dx * L * 0.12;
  return pts.concat([
    [b[0] + dx*L*0.5 + cx*0.5, b[1] + dy*L*0.5 + cy*0.5],
    [b[0] + dx*L + cx,         b[1] + dy*L + cy],
  ]);
}

/**
 * 把楷書中線推向行書。
 *
 * 楷書中線是「端正的骨架」：轉折方、弧度小、起收都在格線上。
 * 行書的差別不在筆觸，在**運筆的路徑本身**更流、更斜、彎得更開。
 * 所以在生成筆畫之前先改中線：
 *   1 誇張既有的弧度（原本就彎的地方彎得更多）
 *   2 整體帶一點右上的斜勢（寫快時手腕的方向）
 *   3 起收各往外拉一點，筆是從紙外進來、往紙外出去的
 * 這不會變成真的行書字形，但會從「端正」變成「寫得快」。
 */
function cursivize(med, amt = 1){
  if (med.length < 3) return med;
  const n = med.length;
  const a = med[0], b = med[n-1];
  const cx = b[0]-a[0], cy = b[1]-a[1];
  const cl = Math.hypot(cx, cy) || 1;
  const nx = -cy/cl, ny = cx/cl;              // 弦的法線
  const out = med.map((p, i) => {
    const t = i/(n-1);
    // 這個點離弦有多遠 → 弧度。把它放大。
    const px = p[0]-a[0], py = p[1]-a[1];
    const dev = px*nx + py*ny;
    const bow = dev * 0.34 * amt;
    // 右上斜勢，中段最明顯
    const lean = Math.sin(t*Math.PI) * 26 * amt;
    return [p[0] + nx*bow + lean*0.55, p[1] + ny*bow + lean*0.42];
  });
  return out;
}

/** 一筆中線 → 一個封閉的筆畫外形（SVG path d）。 */
function brushStroke(med, opt = {}){
  const W = opt.width ?? 104;
  const seed = opt.seed ?? 0;
  const src = opt.cursive === false ? med : cursivize(med, opt.cursive ?? 1);
  const pts = resample(addTail(src, opt.tail ?? 0.2), 52);
  if (pts.length < 2) return '';

  // 弧長參數：用長度而不是點序，轉彎密的地方才不會被算成「走得慢」
  const acc = [0];
  for (let i = 1; i < pts.length; i++)
    acc.push(acc[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
  const total = acc[acc.length-1] || 1;

  const L = [], R = [];
  for (let i = 0; i < pts.length; i++){
    const t = acc[i] / total;
    // 法線
    const a = pts[Math.max(0, i-1)], b = pts[Math.min(pts.length-1, i+1)];
    let dx = b[0]-a[0], dy = b[1]-a[1];
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const nx = -dy, ny = dx;
    // 轉折加按：方向變化越大，筆越沉
    const c = pts[Math.max(0, i-3)], d = pts[Math.min(pts.length-1, i+3)];
    const v1 = Math.atan2(pts[i][1]-c[1], pts[i][0]-c[0]);
    const v2 = Math.atan2(d[1]-pts[i][1], d[0]-pts[i][0]);
    let turn = Math.abs(((v2 - v1 + Math.PI*3) % (Math.PI*2)) - Math.PI);
    const w = W * pressure(t, seed) * (1 + 0.28 * Math.min(1, turn / 1.1));
    L.push([pts[i][0] + nx*w/2, pts[i][1] + ny*w/2]);
    R.push([pts[i][0] - nx*w/2, pts[i][1] - ny*w/2]);
  }

  // 起筆側鋒：頭端不是平的，往入筆方向切一刀
  const h = pts[0], h2 = pts[1];
  let hdx = h2[0]-h[0], hdy = h2[1]-h[1];
  const hm = Math.hypot(hdx, hdy) || 1; hdx /= hm; hdy /= hm;
  const headBack = [h[0] - hdx*W*0.16, h[1] - hdy*W*0.16];

  const quad = arr => {
    let d = '';
    for (let i = 1; i < arr.length; i++){
      const p = arr[i-1], q = arr[i];
      d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0]+q[0])/2).toFixed(1)} ${((p[1]+q[1])/2).toFixed(1)}`;
    }
    const last = arr[arr.length-1];
    d += `L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
    return d;
  };
  return `M${L[0][0].toFixed(1)} ${L[0][1].toFixed(1)}`
       + quad(L)
       + quad(R.slice().reverse())
       + `Q${headBack[0].toFixed(1)} ${headBack[1].toFixed(1)} ${L[0][0].toFixed(1)} ${L[0][1].toFixed(1)}Z`;
}

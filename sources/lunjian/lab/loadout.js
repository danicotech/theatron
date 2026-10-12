// 備戰方案配置器的畫面與互動。搭配 loadout.html。
//
// 格式本身（文字怎麼寫、怎麼讀回來、怎麼轉 JSON）不在這裡 ——
// 那在 build-note.js，因為對決面板也要讀同一份格式。兩邊各寫一份
// 解析器的話，改了格式只會改到其中一邊。
//
// 這個檔只負責：把狀態畫成畫面、把點擊變成狀態、把結果送出去。
//
// 刻意沒做的：詞條數值輸入。數值不在任何公開資料裡（工具站畫面上的
// 數字是它自己的使用者手打的），開了只是製造假精確度。

import {
  SCHEMA, emptyState, newItem, WEAPON_SLOT, indexOf, formatNote, parseNote,
  itemOf, vaultFor, equipItem, unequip, removeItem,
  toJSON as stateToJSON, fromJSON as stateFromJSON,
  weaponOf as noteWeaponOf, setBuild as noteSetBuild, num,
  allSlots, weaponKeyOf, tuningsFor, pitchesFor, rollTone, computeAttrs, goalProgress, fmtVal,
  rateOf, levelResist,
} from './build-note.js?v=20260920003910';   // 版本參數要跟 HTML 那邊一起換 —— 
// ES module 的 import 是分開快取的，只給 loadout.js 加版本沒有用，
// build-note.js 會繼續用舊的，畫面就對不上程式碼。

export function mountLoadout(options = {}) {
window.__LOADOUT?.destroy?.();

const lifetime = new AbortController();
let destroyed = false;
const timers = new Set(), frames = new Set(), cleanups = [];
const on = (target, type, fn, options = {}) => target.addEventListener(type, fn,
  { ...(typeof options === 'boolean' ? {capture:options} : options), signal:lifetime.signal });
const addEventListener = (type, fn, options) => on(window, type, fn, options);
const setTimeout = (fn, ms) => { const id = window.setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, ms); timers.add(id); return id; };
const requestAnimationFrame = fn => { const id = window.requestAnimationFrame(t => { frames.delete(id); if (!destroyed) fn(t); }); frames.add(id); return id; };
const setInterval = (fn, ms) => { const id = window.setInterval(() => { if (!destroyed) fn(); }, ms); cleanups.push(() => window.clearInterval(id)); return id; };

const ASSETS = '../loadout/assets/';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    // null／undefined／false 的屬性直接不設。
    // `'data-x': cond || undefined` 這種寫法很常用，但 setAttribute 會把
    // undefined 變成字串 "undefined" —— 屬性一存在 [data-x] 就選得到，
    // 於是「只有溢出才標紅」變成「每一條都紅」。跟 append(null) 同一類錯。
    if (v === null || v === undefined || v === false) continue;
    if (k.includes('-')) n.setAttribute(k, v === true ? '' : v); else n[k] = v;
  }
  // null／undefined／false 要跳過：Node.append(null) 會塞進字串 "null"。
  // 條件式子節點（cond ? el(...) : null）到處都是，少了這道就會冒出 null 字樣。
  for (const c of [].concat(kids)) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
};

let C = null;                 // catalog.json
let IDX = {};                 // key → 物件

/* ── 角色 ────────────────────────────────────────────────────────────────
   一個帳號可能練好幾隻，各自一套配置。

   兩件事刻意維持不變：
     報名文字只反映**當前角色** —— 報名是以一個角色的身分報。
     JSON 匯出則帶全部角色（v3），所以換電腦時整批都帶得走。

   存在 localStorage，但**耐久的那一份是匯出的 JSON**：
   清瀏覽器資料、換裝置、無痕視窗都會沒有。介面上直說這件事。 */
const localActivity = new URLSearchParams(location.search).get('sportsEvent');
let localOwner = '';
try { localOwner = sessionStorage.getItem('lunjian-sportsbook-user') || ''; } catch {}
const roleSource = new URLSearchParams(location.search).get('roleSource') === 'library' ? 'library' : 'event';
const STORE = localActivity && roleSource !== 'library' ? 'lunjian.loadout.v3.local.' + encodeURIComponent(localActivity) + '.' + encodeURIComponent(localOwner) : 'lunjian.loadout.v3';
const NAME_MAX = 10;

let ROLES = [{ id: 1, name: '角色一', state: emptyState() }];
let ACTIVE = 0;
let S = ROLES[0].state;       // 目前這份配置（就是 ROLES[ACTIVE].state 本人）

/** parseNote／fromJSON 回傳的是新物件；換掉整份，不逐欄搬。 */
const adopt = (next) => { S = next; if (ROLES[ACTIVE]) ROLES[ACTIVE].state = next; };

const nextRoleId = () => ROLES.reduce((n, r) => Math.max(n, r.id), 0) + 1;

function useRole(i) {
  if (i < 0 || i >= ROLES.length || i === ACTIVE) return;
  ACTIVE = i;
  S = ROLES[i].state;
  render();
  toast('切換到「' + ROLES[i].name + '」');
}

let saveT = 0;
function storageStatus(state, message) {
  const status = $('#storage-status');
  if (!status) return;
  status.dataset.state = state;
  $('#storage-message').textContent = message;
  $('#storage-retry').hidden = state !== 'error';
}
function flushSave() {
  clearTimeout(saveT);
  saveT = 0;
  if (!C) return false;
  try {
    localStorage.setItem(STORE, JSON.stringify({
      v: 3, active: ACTIVE,
      roles: ROLES.map(r => ({ id: r.id, name: r.name, data: stateToJSON(r.state, C, IDX) })),
    }));
    storageStatus('saved', '配置已儲存在此瀏覽器；尚未提交報名。');
    return true;
  } catch {
    storageStatus('error', '尚未儲存：瀏覽器儲存空間不可用。請重試或匯出 JSON 備份後再離開。');
    return false;
  }
}
function persist() {
  clearTimeout(saveT);
  storageStatus('pending', '正在儲存配置…');
  saveT = setTimeout(flushSave, 400);
}

function restore() {
  let raw = null;
  try { raw = localStorage.getItem(STORE); } catch { return false; }
  if (!raw) return false;
  try {
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.roles) || !o.roles.length) return false;
    ROLES = o.roles.map((r, i) => ({
      id: r.id || i + 1,
      name: String(r.name || '角色' + (i + 1)).slice(0, NAME_MAX),
      state: stateFromJSON(r.data || {}, C, IDX),
    }));
    ACTIVE = Math.min(Math.max(0, o.active | 0), ROLES.length - 1);
    const requestedRole = new URLSearchParams(location.search).get('loadoutRole');
    const requestedIndex = ROLES.findIndex(role => String(role.id) === requestedRole);
    if (requestedIndex >= 0) ACTIVE = requestedIndex;
    S = ROLES[ACTIVE].state;
    return true;
  } catch { return false; }
}

function renderRoles() {
  const host = $('#roles');
  host.textContent = '';
  ROLES.forEach((r, i) => {
    const b = el('button', { type: 'button', textContent: r.name });
    if (i === ACTIVE) b.setAttribute('data-on', '');
    b.setAttribute('aria-pressed', String(i === ACTIVE));
    b.title = i === ACTIVE ? '目前編輯中，報名文字反映這一隻' : '切換到這一隻';
    on(b, 'click', () => useRole(i));
    host.append(b);
  });
  const mg = el('button', { type: 'button', className: 'manage', textContent: '⋯' });
  mg.title = '角色管理';
  mg.setAttribute('aria-label', '角色管理');
  on(mg, 'click', openRoles);
  host.append(mg);
}

let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.setAttribute('data-on', '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.removeAttribute('data-on'), 2000);
}

const b64enc = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64dec = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - t.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

const text = () => formatNote(S, C, IDX);
const weaponOf = (slot) => noteWeaponOf(S, IDX, slot);

// ── 畫面 ─────────────────────────────────────────────────────────────────
/* 圖載不到就換成墨印。CDN 上確實少了一張（XF_DJWS 大卷微身），
   留一個破圖框比沒有圖更難看，而且會讓人以為是自己網路壞了。 */
function img(path, alt) {
  // path 可能是 null（來源缺圖）。直接組字串會變成 ".../null"，
  // 白白送一次 404 出去，主控台也髒。沒有路徑就直接走墨印那條。
  if (!path) {
    const seal = el('span', { className: 'seal', textContent: (alt || '？').slice(0, 5) });
    seal.title = '這一筆在來源沒有圖';
    return seal;
  }
  const n = el('img', { src: ASSETS + path, alt: alt || '', loading: 'lazy' });
  on(n, 'error', () => {
    const seal = el('span', { className: 'seal', textContent: (alt || '？').slice(0, 5) });
    seal.title = '這一筆在來源的 CDN 上沒有圖';
    n.replaceWith(seal);
  }, { once: true });
  return n;
}

// ── 浮動說明 ─────────────────────────────────────────────────────────────
/* 卡片上放不下的細節走浮層：心法加什麼、一件裝備的六條詞條。
   浮層自己 pointer-events:none，不然滑過去會被它擋住、hover 掉了又彈回來。
   位置優先擺右邊，右邊放不下才翻到左邊；上下再夾回視窗內。 */
const TIP = { el: null, t: 0 };

function hideTip() {
  clearTimeout(TIP.t);
  if (TIP.el) { TIP.el.removeAttribute('data-on'); TIP.el.setAttribute('aria-hidden', 'true'); }
}

function showTip(anchor, build, opt = {}) {
  const tip = TIP.el || (TIP.el = $('#tip'));
  tip.textContent = '';
  tip.toggleAttribute('data-paper', !!opt.paper);
  // 第三種外觀：暗色面板。用在「加成」那一類 —— 它們列的是一疊數字，
  // 亮紙底上一堆金色數字會糊掉，暗底才讓數字自己跳出來。
  if (opt.skin) tip.setAttribute('data-skin', opt.skin); else tip.removeAttribute('data-skin');
  if (opt.q) tip.setAttribute('data-q', opt.q); else tip.removeAttribute('data-q');
  const body = build();
  if (!body) return;
  tip.append(body);
  tip.setAttribute('data-on', '');
  tip.setAttribute('aria-hidden', 'false');

  const a = anchor.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const pad = 10;
  let x = a.right + pad;
  if (x + t.width > innerWidth - pad) x = a.left - t.width - pad;
  if (x < pad) x = pad;
  let y = a.top + a.height / 2 - t.height / 2;
  y = Math.max(pad, Math.min(innerHeight - t.height - pad, y));
  tip.style.left = Math.round(x) + 'px';
  tip.style.top = Math.round(y) + 'px';
}

/** 滑入延遲一下才顯示 —— 掃過一排卡片時不該一路彈出十個浮層。 */
function onHover(node, build, opt) {
  on(node, 'mouseenter', () => {
    clearTimeout(TIP.t);
    TIP.t = setTimeout(() => showTip(node, build, opt), 260);
  });
  on(node, 'mouseleave', hideTip);
  on(node, 'click', hideTip);
}

const attrRows = (rows) => rows.map((a) => el('div', { className: 'arow' }, [
  el('span', { className: 'k', textContent: a.n }),
  el('span', { className: 'v', textContent: fmtVal(a.v) + (a.pct ? '%' : '') }),
]));

// Native dialogs provide the focus boundary. Keep a return target across render()
// replacing controls, and across a menu handing off to a second dialog.
const overlays = [];
const overlayReturns = new WeakMap();
function focusTarget(node) {
  return { node, id: node?.id, key: node?.dataset?.focusKey, scope: node?.closest?.('dialog')?.id, title: node?.getAttribute('title'),
    label: node?.getAttribute('aria-label'), parent: overlayReturns.get(node?.closest?.('dialog')) ||
      (node?.closest?.('#acts') ? focusTarget($('#btn-more')) : null) };
}
function showOverlay(dialog) {
  if (dialog.open) return;
  overlayReturns.set(dialog, focusTarget(document.activeElement));
  dialog.setAttribute('data-on', '');
  dialog.showModal();
  overlays.push(dialog);
}
function hideOverlay(dialog) {
  if (!dialog.open) return;
  const target = overlayReturns.get(dialog);
  overlays.splice(overlays.indexOf(dialog), 1);
  dialog.close();
  dialog.removeAttribute('data-on');
  queueMicrotask(() => {
    if (destroyed) return;
    const top = overlays.at(-1);
    for (let saved = target; saved; saved = saved.parent) {
      const candidates = saved.node?.isConnected ? [saved.node] :
        [...document.querySelectorAll('button,a,input,select,textarea')].filter(n =>
          (saved.key && n.dataset.focusKey === saved.key && n.closest('dialog')?.id === saved.scope) ||
          (saved.id && n.id === saved.id) || (saved.title && n.getAttribute('title') === saved.title) ||
          (saved.label && n.getAttribute('aria-label') === saved.label));
      const node = candidates.find(n => !n.disabled && n.checkVisibility?.() !== false && !n.closest('dialog:not([open])') &&
        (!top || top.contains(n)));
      if (node) { node.focus({ preventScroll: true }); return; }
    }
  });
}

/* ── 數值晶片與選值面板 ─────────────────────────────────────────────────
   格子只有 72px 寬，任何「就地微調」都會小到點不到：
   先試過 34px 的數字框（要對準），再試過 22px 的加減鈕（手機還是點不到）。
   手指的可靠命中面積是 44px，那在格子裡放不下。

   所以不在格子裡調。格子只放一顆好點的晶片顯示目前的值（26px 高），
   點下去開面板，裡面每個候選值都是 44px 的大鈕，一次點中。
   面板同時把「可以選到多少」攤開 —— 那是小輸入框做不到的。 */
const pop = $('#pop');
const popBox = $('#pop-box');

const closePop = () => hideOverlay(pop);

function openPop(anchor, cfg) {
  popBox.textContent = '';
  // 面板的名字每次都不一樣（「倉庫工具」「無名心法 階數」…），
  // 所以名字跟著標題一起換 —— 標記裡那個 aria-label 只是還沒開之前的預設值。
  pop.setAttribute('aria-label', cfg.title);
  popBox.append(el('div', { className: 'pop-title', textContent: cfg.title }));

  const grid = el('div', { className: 'pop-grid' });
  if (cfg.menu) grid.classList.add('pop-menu');
  if (cfg.cols) grid.style.gridTemplateColumns = 'repeat(' + cfg.cols + ',1fr)';
  for (const o of cfg.options) {
    // 選項可以是單純的值，也可以是 { v, t, sub, img } —— 帶圖的那種。
    // 兵器有十種，光看「傘」「鼓」「繩鏢」名字分不出誰是誰，圖比字快。
    const rich = o && typeof o === 'object';
    const val = rich ? o.v : o;
    const b = el('button', { type: 'button' });
    if (rich && cfg.menu) {
      // 選單列：一列一件事，左邊動作名、右邊一句說明。
      // 會刪東西的標紅，跟「整理一下」那幾項在視覺上分開。
      b.classList.add('menurow');
      if (o.danger) b.classList.add('danger');
      if (o.sep) b.classList.add('sep');
      b.append(el('span', { className: 'mr-t', textContent: o.t }));
      if (o.sub) b.append(el('small', { textContent: o.sub }));
      b.setAttribute('aria-label', o.t + (o.sub ? '，' + o.sub : ''));
    } else if (rich) {
      b.classList.add('rich');
      const a = img(o.img, o.t);
      a.classList.add('pop-art');
      b.append(a);
      b.append(el('span', { className: 'pop-t', textContent: o.t }));
      if (o.sub) b.append(el('small', { textContent: o.sub }));
      b.setAttribute('aria-label', o.t + (o.sub ? '，' + o.sub : ''));
    } else {
      b.textContent = String(val);
    }
    // 勾選模式：狀態由 isOn 決定（可以同時好幾個），點了不關、原地重畫。
    // 篩選本來就是「選一個看一下、再加一個」，每點一次就關掉的話根本沒法用。
    const selected = cfg.isOn ? cfg.isOn(val) : cfg.value === val;
    if (selected) b.setAttribute('data-on', '');
    if (cfg.toggle) b.setAttribute('role', 'menuitemcheckbox');
    if (cfg.toggle) b.setAttribute('aria-checked', selected ? 'true' : 'false');
    on(b, 'click', () => {
      // 包起來的理由：closePop() 排在 render() 後面，render() 一丟例外就走不到 ——
      // 面板不關、沒有提示、點的人只看到「按了沒反應」，錯誤只躺在主控台裡沒人看。
      // 不管成不成功都把面板收掉，失敗就把話講出來。
      try {
        cfg.onChange(val);
        render();
      } catch (err) {
        console.error('倉庫工具／選單動作出錯', err);
        toast('這個動作出錯了：' + ((err && err.message) || err));
        closePop();
        return;
      }
      if (cfg.toggle) openPop(anchor, cfg); else closePop();
    });
    grid.append(b);
  }
  popBox.append(grid);

  // 純選單（例如「要加到哪一格」）沒有「自己打一個數字」這回事，
  // 底下那一列就不要出現 —— 空的輸入框只會讓人以為少填了什麼。
  if (cfg.plain) {
    showOverlay(pop);
    place(anchor);
    setTimeout(() => { const f = grid.querySelector('button'); if (f) f.focus({ preventScroll: true }); }, 20);
    return;
  }

  const foot = el('div', { className: 'pop-foot' });

  /* 有上限的（心法 1–5、武學 1–20）不放輸入框：1..上限**每一個都已經是上面那顆按鈕了**，
     底下再擺一個「自己打」只是多一個看不懂的東西。
     只有奇術沒有公開上限，那裡才真的需要打一個清單外的數字。 */
  // 選單模式（倉庫工具、篩選、底圖…）沒有「數值」這回事，
  // 整個底列都不該出現 —— 先前漏了這個判斷，選單底下就掛著一個
  // 「其他數字／確定／清除數值」，看的人完全不知道那是要幹嘛。
  if (cfg.menu) {
    showOverlay(pop);
    place(anchor);
    setTimeout(() => { const f = grid.querySelector('button'); if (f) f.focus({ preventScroll: true }); }, 20);
    return;
  }

  let inp = null;
  if (!cfg.cap) {
    inp = el('input', { type: 'number', min: '1', value: cfg.value == null ? '' : cfg.value,
      placeholder: '其他數字' });
    const apply = () => {
      const v = num(inp.value, 1, null);
      if (v == null) return;
      cfg.onChange(v); closePop(); render();
    };
    const ok = el('button', { className: 'ok', type: 'button', textContent: '確定' });
    on(ok, 'click', apply);
    on(inp, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    foot.append(inp, ok);
  }
  // 上面點任一個數字就直接套用並關閉，所以這裡不需要「確定」——
  // 剩下的只有「把這一格清掉」這件事。
  const clr = el('button', { type: 'button', textContent: '清除數值' });
  on(clr, 'click', () => { cfg.onChange(null); closePop(); render(); });
  foot.append(clr);
  popBox.append(foot);

  showOverlay(pop);
  place(anchor);
  setTimeout(() => {
    const first = inp || grid.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }, 20);
}

/** 面板位置：優先貼在下面，放不下就翻到上面；左右夾回視窗內。 */
function place(anchor) {
  const a = anchor.getBoundingClientRect();
  const b = popBox.getBoundingClientRect();
  const pad = 8;
  let x = a.left + a.width / 2 - b.width / 2;
  x = Math.max(pad, Math.min(innerWidth - b.width - pad, x));
  let y = a.bottom + 6;
  if (y + b.height > innerHeight - pad) y = Math.max(pad, a.top - b.height - 6);
  popBox.style.left = Math.round(x) + 'px';
  popBox.style.top = Math.round(y) + 'px';
}

/**
 * 顯示數值的晶片。點了開面板。
 *   cap      有上限就把 1..cap 全列出來（心法 5、武學 20）
 *   options  沒有上限時的捷徑值（奇術）
 *   unit     數字後面的小字（★、級…）
 */
function valueChip(value, opts) {
  const cap = opts.cap || null;
  const options = opts.options || (cap ? Array.from({ length: cap }, (_, i) => i + 1) : []);
  const chip = el('button', { className: 'chip', type: 'button' });
  if (value == null) chip.setAttribute('data-empty', '');
  chip.append(document.createTextNode(value == null ? '–' : String(value)));
  if (opts.unit) chip.append(el('span', { className: 'u', textContent: opts.unit }));
  chip.title = opts.title + '　點一下設定';
  chip.setAttribute('aria-label', opts.title + '，目前 ' + (value == null ? '未填' : value));
  on(chip, 'click', (e) => {
    e.stopPropagation();
    openPop(chip, {
      title: opts.title, value, cap, options,
      cols: opts.cols || (options.length > 10 ? 5 : options.length),
      onChange: opts.onChange,
    });
  });
  return chip;
}

/** 編輯窗裡的欄位空間夠，維持一般輸入框。 */
function lvBox(value, cap, onChange, unit) {
  const input = el('input', {
    type: 'number', min: '1', value: value == null ? '' : value,
    placeholder: '–', 'aria-label': '數值',
  });
  if (cap) input.max = String(cap);
  on(input, 'click', (e) => e.stopPropagation());
  on(input, 'change', () => { onChange(num(input.value, 1, cap)); render(); });
  return el('span', { className: 'lv' }, [input, el('span', { textContent: unit || (cap ? '/' + cap : '') })]);
}

/* 一張流派卡。左上角那張（current=true，多一個換派圖示與等級欄）
   與「選擇流派」窗裡的每一張，共用同一個版型 ——
   工具站自己的 CSS 也是 __current 與 __option 共用一條規則。 */
function buildCard(b, current) {
  const card = el('button', { className: 'bpick', type: 'button', 'data-family': b.family });
  const content = el('div', { className: 'bpick-content' });

  const head = el('div', { className: 'bpick-header' });
  const sig = img(b.img, b.name);
  sig.className = 'bpick-sig';
  head.append(sig);
  head.append(el('span', { textContent: b.name }));
  if (current) {
    const sw = el('img', { src: ASSETS + 'ui/switch.png', alt: '切換流派' });
    sw.className = 'bpick-switch';
    head.append(sw);
  }
  content.append(head);

  const strip = el('div', { className: 'bpick-strip' });
  for (const [slot, k] of b.martials.map((x, i) => [i === 0 ? 'main' : 'off', x])) {
    const m = IDX[k];
    if (!m) continue;
    const item = el('div', { className: 'bpick-item' });
    item.append(img(m.img, m.name));
    const id = el('span', { className: 'id' });
    id.append(el('span', { className: 'nm', textContent: m.name, title: m.name }));
    if (current) {
      // 工具站沒有這一格（它不管等級），但報名欄位要寫。
      // 放名字**下面**不是右邊 —— 左欄只有 340px，兩欄各 103px，
      // 輸入框往旁邊一擺，名字就只剩得下一個字。
      id.append(valueChip(S.martials[m.key], {
        title: m.name + ' 等級', cap: C.caps.martial, unit: '/ ' + C.caps.martial,
        onChange: (v) => { S.martials[m.key] = v; },
      }));
    }
    item.append(id);
    if (current) {
      on(item, 'click', (e) => e.stopPropagation());
      onHover(item, () => martialTip(m), { paper: true });
    }
    strip.append(item);
  }
  if (strip.children.length) content.append(strip);
  else content.append(el('p', { className: 'bpick-none', textContent: '資料表裡沒有這一派的武學' }));

  card.append(content);
  if (b.familyImg) {
    const icon = img(b.familyImg, '');
    icon.className = 'bpick-icon';
    icon.setAttribute('aria-hidden', 'true');
    card.append(icon);
  }
  return card;
}

/**
 * 選完流派就把心法補上。
 *
 * 資料表每個流派都列了 requiredMindKeys 與 optionalMindKeys，
 * 必備的排前面、選配的補後面，剛好四格（破竹樽是四個必備、零個選配）。
 * 主修放第一個必備 —— 那是流派的核心，不是隨便哪一格。
 *
 * 換流派時，**自動補進去的會被換成新流派的，手動選的留著**。
 * 兩者靠 auto 這個旗標分：只有這支函式放進去的才標 auto。
 * 不這樣分的話，換到破竹樽還留著裂石威的心法，等於沒補。
 *
 * 奇術沒有這樣做，因為資料表裡沒有「哪個流派該帶哪些奇術」——
 * 那要靠攻略的主觀判斷，我不替你編。
 */
/**
 * 換流派時自動補心法。
 *
 * **必備心法一定進得去。** 舊版是「手動選的優先、剩下的才補必備」，
 * 結果換到鳴金虹時四格被上一套佔滿，威猛歌與無名心法一個都沒補上 ——
 * 而抬頭還大剌剌寫著「必備心法 威猛歌、無名心法」，自己打自己的臉。
 * 必備是流派的武學要它才成立，不是建議。
 *
 * 順序：必備（第一個當主修）→ 你自己挑的（保留原本的先後）→ 可選補滿。
 * 位子不夠時被擠掉的會回報幾個，讓呼叫端講給使用者聽。
 */
function fillMinds(b) {
  if (!b) return { added: 0, dropped: 0 };
  const mk = (k, auto) => ({ key: k, name: IDX[k].name, lv: null, auto });
  // 手動挑的：保留原本的先後，但必備自己會進來，所以先去掉重複的
  const req = (b.req || []).filter((k) => IDX[k]);
  const reqSet = new Set(req);
  const mine = S.minds.filter((m) => m && !m.auto && !(m.key && reqSet.has(m.key)));

  const out = req.map((k) => mk(k, true));
  let dropped = 0;
  for (const m of mine) {
    if (out.length < 4) out.push(m); else dropped++;
  }
  // 還有空位就拿可選的補
  const taken = new Set(out.map((m) => m.key).filter(Boolean));
  for (const k of b.opt || []) {
    if (out.length >= 4) break;
    if (!IDX[k] || taken.has(k)) continue;
    out.push(mk(k, true));
    taken.add(k);
  }
  const before = S.minds.filter(Boolean).length;
  S.minds = [0, 1, 2, 3].map((i) => out[i] || null);
  return { added: Math.max(0, S.minds.filter(Boolean).length - before + dropped), dropped };
}

function renderBuild() {
  const b = IDX[S.build];
  const host = $('#bhead');
  const frame = $('#build-card');
  host.textContent = '';
  host.className = 'build-trigger bpick-content';
  frame.replaceChildren(host);
  frame.removeAttribute('data-family');
  host.onclick = openBuildPicker;
  host.disabled = false;
  host.setAttribute('aria-label', b ? '更換流派，目前 ' + b.name : '選擇流派');

  if (!b) {
    host.append(el('div', { className: 'bpick-content' }, [
      el('div', { className: 'bpick-header' }, [el('span', { textContent: '選一個流派' })]),
      el('p', { className: 'bpick-none', textContent: '十一個流派。選了之後武器與武學會自動跟上，點這裡開始。' }),
    ]));
    return;
  }
  frame.setAttribute('data-family', b.family);
  const card = buildCard(b, true);
  // Only the title changes the build. Level chips remain sibling controls,
  // never nested inside the build-selection button.
  const header = card.querySelector('.bpick-header');
  host.className = 'bpick-header build-trigger';
  while (header.firstChild) host.append(header.firstChild);
  header.replaceWith(host);
  while (card.firstChild) frame.append(card.firstChild);
  // 必備心法要放進 .bpick-content 裡面。
  // 直接掛在 #bhead 上會變成 flex 的第三個子項，跟內容搶寬度 ——
  // 流派名與兩個武學名會被擠成 0 寬，那一行則跑到右邊蓋住印記。
  frame.querySelector('.bpick-content').append(el('p', {
    className: 'bhead-req',
  }, [
    document.createTextNode('必備心法　'),
    el('b', { textContent: b.req.map((k) => IDX[k] ? IDX[k].name : k).join('、') || '—' }),
  ]));
}

/**
 * 一格心法或奇術。
 *
 * 外面一層 div 畫框線與底色，裡面才是按鈕 —— 因為角落那顆調數值的晶片
 * 本身也是按鈕，而按鈕不能包按鈕（axe 的 nested-interactive）：
 * 螢幕報讀器會把內層當成外層的一部分唸掉，鍵盤也走不進去，
 * 結果是「階數只能用滑鼠改」。晶片是 .slot 的兄弟，不是它的小孩。
 *
 * 心法與奇術本來各自手搭一次，兩邊只差圖與標題 —— 併成一個，
 * 免得以後改了一邊忘了另一邊。
 */
function slotCell(cfg) {
  const wrap = el('div', { className: 'slotwrap' });
  if (cfg.empty) wrap.setAttribute('data-empty', '');
  if (cfg.main) wrap.setAttribute('data-main', '');
  const btn = el('button', { className: 'slot', type: 'button' });
  const fig = el('figure', {}, [cfg.figure]);
  // 圖的正下方就印著同一個名字，所以圖本身是裝飾 —— alt 留著只會被唸兩遍
  //（「無名心法 無名心法」）。這一格的名字由下面那行 aria-label 負責。
  for (const im of fig.querySelectorAll('img')) im.alt = '';
  btn.append(fig);
  btn.append(el('span', { className: 'nm', textContent: cfg.name }));
  btn.setAttribute('aria-label', cfg.name + '，點一下選擇');
  on(btn, 'click', cfg.onPick);
  wrap.append(btn);
  if (cfg.chip) wrap.append(cfg.chip);
  // 必備只點一個金點，不寫「本流派必備」四個字 —— 四格並排時字放不下
  if (cfg.req) wrap.append(el('span', { className: 'req' }));
  return { wrap, btn };
}

function renderMinds() {
  const host = $('#minds');
  host.textContent = '';
  const b = IDX[S.build];
  const req = new Set(b ? b.req : []);
  S.minds.forEach((m, i) => {
    const meta = m && m.key ? IDX[m.key] : null;
    const { wrap: slot } = slotCell({
      empty: !m,
      main: i === 0,
      req: !!(m && m.key && req.has(m.key)),
      name: m ? m.name : (i === 0 ? '主修' : '心法'),
      figure: m
        ? (meta ? img(meta.img, m.name) : el('span', { className: 'seal', textContent: m.name.slice(0, 5) }))
        : el('span', { textContent: '＋' }),
      chip: m ? valueChip(m.lv, {
        title: m.name + ' 階數', cap: C.caps.mind, unit: '★',
        onChange: (v) => { m.lv = v; },
      }) : null,
      onPick: () => openMindPicker(i),
    });
    // 心法加成放不進格子裡（四格並排，一格才 72px 寬），滑過去看
    if (m) {
      onHover(slot, () => {
        const box = el('div');
        const rows = (m.key && (C.mindAttr || {})[m.key]) || [];
        const meta2 = m.key ? IDX[m.key] : null;
        box.append(el('div', { className: 'tip-h',  textContent: m.name }));
        box.append(el('p', {
          className: 'sub',
          textContent: (meta2 && meta2.tags ? meta2.tags.join(' · ') + '　' : '')
            + (i === 0 ? '主修' : '副修') + (m.lv ? ' · ' + m.lv + '★' : '')
            + (m.key && req.has(m.key) ? ' · 本流派必備' : ''),
        }));
        // 效果文字：來源表一個字都沒有，只有拿得到憑據的那幾張才寫
        if (meta2 && meta2.desc) {
          const sec = el('div', { className: 'sec' });
          sec.append(el('div', { className: 'lab', textContent: '效果' }));
          sec.append(el('p', { className: 'none', style: 'padding:0;white-space:pre-line', textContent: meta2.desc }));
          if (meta2.src) {
            sec.append(el('p', {
              className: 'none',
              style: 'padding:6px 0 0;opacity:.75',
              textContent: '來源：' + meta2.src + '（資料表沒有心法效果文字）',
            }));
          }
          box.append(sec);
        }
        if (rows.length) {
          const sec = el('div', { className: 'sec' });
          sec.append(el('div', { className: 'lab', textContent: '心法加成' }));
          for (const r of attrRows(rows)) sec.append(r);
          box.append(sec);
        } else {
          box.append(el('p', {
            className: 'none',
            textContent: m.key
              ? '數值表裡沒有這張的加成資料（50 張裡有 40 張有）。'
              : '這一筆是你自己打的，沒有對應的加成資料。',
          }));
        }
        return box;
      });
    }
    host.append(slot);
  });
}

function renderArts() {
  const host = $('#arts');
  host.textContent = '';
  S.arts.forEach((a, i) => {
    const { wrap: slot } = slotCell({
      empty: !a,
      name: a ? a.name : '奇術 ' + (i + 1),
      figure: a
        ? el('span', { className: 'seal', textContent: a.name.slice(0, 5) })
        : el('span', { textContent: '＋' }),
      // 奇術沒有公開上限，列 1–10 當捷徑，超出的自己打
      chip: a ? valueChip(a.lv, {
        title: a.name + ' 等級', options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], unit: '級',
        onChange: (v) => { a.lv = v; },
      }) : null,
      onPick: () => openArtPicker(i),
    });
    host.append(slot);
  });
}

// ── 倉庫的共用查詢 ───────────────────────────────────────────────────────
/* 倉庫裡的一件**同時就是**舊模型的 conf（套裝／階）與 piece（六條詞條）。
   兩個袋子併成一個，查一次就夠，也不會再出現兩邊不同步的狀況。 */
const BLANK = Object.freeze({ set: null, tier: null, quality: 'gold' });
const confOf = (s) => (s && s.item) || BLANK;

/** 這一格沒東西時開一件新的進倉庫並掛上 —— 「自己加入一件」走的就是這裡。 */
function ensureItem(s) {
  if (s.item) return s.item;
  // 武器一定要有兵器型別：詞條清單、卡面圖、基礎屬性全按它查。
  // 還沒選流派時 s.partKey 是 null，這裡不給預設就會生出一件查無此物的東西 ——
  // 畫面上是一整片紅色墨印加「資料表沒有這個部位的基礎屬性」。
  const pk = s.partKey
    || (s.isWeapon ? ((C.weapons || [])[0] || {}).key : null);
  const it = newItem(s.isWeapon ? WEAPON_SLOT : s.id, pk);
  S.vault.push(it);
  equipItem(S, s.id, it.id);
  s.item = it;
  return it;
}

/** 這一件屬於哪個部位（名稱、側、卡面圖）。 */
function slotMetaOf(it) {
  if (it.slot === WEAPON_SLOT) {
    const w = (C.weapons || []).find((x) => x.key === it.partKey);
    return { id: it.slot, name: w ? w.name : '武器', part: w ? w.name : '武器',
             side: 'right', img: w ? w.img : '', isWeapon: true, partKey: it.partKey };
  }
  const g = (C.gearSlots || []).find((x) => x.id === it.slot);
  return g ? { ...g, isWeapon: false }
           : { id: it.slot, name: '未知部位', part: '', side: 'left', img: '', isWeapon: false };
}

/** 這一件現在掛在哪一格（沒掛回 null）。 */
const wornAt = (it) => Object.keys(S.equip || {}).find((k) => S.equip[k] === it.id) || null;

/** 格位 id → 給人看的名字。 */
const slotNameOf = (id) => (id === 'w_main' ? '主武器' : id === 'w_off' ? '副武器'
  : ((C.gearSlots || []).find((g) => g.id === id) || {}).name || id);

/**
 * 這一件的**名稱**。優先序：你自己取的 → 資料表那件的名字（流星含光）
 * → 最後才是格位名。「主武器」是位置不是名字，拿它當標題等於什麼都沒說。
 */
function nameOf(it, sm) {
  const gb = it && baseOf(it.partKey);
  return (it && it.label) || (gb && gb.name) || (sm && sm.name) || '未命名';
}

/** 這一件的**類型**：武器寫兵器型別（劍、傘），防具寫部位（冠胄）。 */
const typeOf = (sm) => (sm && sm.name) || '';

/** 這一件掛得上哪些格位。武器兩格都行，防具只有自己那格。 */
const fitsOf = (it) => (it.slot === WEAPON_SLOT ? ['w_main', 'w_off'] : [it.slot]);

// ── 裝備縮圖列 ───────────────────────────────────────────────────────────
// 中欄的卡片網格要捲，這一列不捲 —— 它是索引，一眼看完十件，點了直接開編輯。
/**
 * 裝備欄。版型照工具站的 .equipment-panel__grid 量出來的：
 *
 *   4 欄 × 2 列，gap 6px
 *   欄 0、1  grid-template-rows: 6fr 4fr   上大下小
 *   欄 2、3  grid-template-rows: 5fr 5fr   上下等高
 *
 * 分欄照這一頁一直在用的左四／右四：
 *   右四（欄 0–1）主武器 環 ／ 副武器 佩 —— 武器佔上面那格大的
 *   左四（欄 2–3）冠胄 胸甲 ／ 腕甲 脛甲
 * 工具站在欄 0、1 上掛套裝角標，剛好也是右四那組，對得起來。
 */
/* 四欄用**同一個比例**。工具站是 6fr4fr ／ 5fr5fr 混用，但那會讓
   第二排的頂端在左右兩半對不齊，看起來像沒對好。
   統一成 6fr 4fr：整排上面都是大的、下面都是小的，分割線是一直線。 */
/* 6fr 4fr 是工具站的比例，但它的格子是 67px 寬的細長條（1:1.9），
   那個比例在細長格上剛好。我們的格子寬得多（約 62px 寬卻要塞五欄），
   6:4 會讓上排空出一大片金、下排擠成一條 —— 整體看起來頭重腳輕。
   收成 11:9，上排仍然大一點（武器是主角），但兩排都還有呼吸空間。 */
const STRIP_ROWS = '11fr 9fr';
const STRIP_COLS = [
  { ids: ['w_main', 'ring'] },
  { ids: ['w_off', 'pend'] },
  { ids: ['head', 'body'] },
  { ids: ['arms', 'legs'] },
];

function renderStrip() {
  const host = $('#strip');
  host.textContent = '';
  const slots = allSlots(S, C, IDX);
  const by = new Map(slots.map((x) => [x.id, x]));
  let done = 0;

  for (const col of STRIP_COLS) {
    const c = el('div', { className: 'scol' });
    c.style.gridTemplateRows = STRIP_ROWS;
    for (const id of col.ids) {
      const s = by.get(id);
      if (!s) continue;
      const p = s.item;
      const conf = confOf(s);
      const gb = baseOf(s.partKey);
      const filled = tuneRows(p).filter((r) => r.k && r.meta && Number.isFinite(r.v)).length;
      if (filled === 6) done++;

      const t = el('button', {
        className: 'thumb', type: 'button',
        'data-q': p && p.quality === 'purple' ? 'purple' : 'gold',
      });
      if (!p) t.setAttribute('data-empty', '');
      if (filled === 6) t.setAttribute('data-done', '');
      if (s.isWeapon) t.setAttribute('data-w', '');   // 主副武器的標籤上金色
      if (SEL === s.id) t.setAttribute('data-sel', '');

      // 套裝角標擺左上，跟工具站同一個位置
      const set = conf.set && IDX[conf.set];
      if (set) t.append(el('span', { className: 'sbadge', textContent: set.short || set.name[0] }));

      if (p) {
        // alt 清掉：這一格的名字由下面那行 aria-label 負責，圖是裝飾。
        // 留著的話螢幕報讀器會唸兩次（「環　環，流星雲瓏」）。
        const a = img(gb && gb.img ? gb.img : s.img, s.part);
        if (a.tagName === 'IMG') a.alt = '';
        t.append(a);
      } else {
        t.append(el('span', { className: 'plus', textContent: '＋' }));
      }
      // 標籤是格位不是物品：配裝要認的是「哪個洞」
      t.append(el('span', { className: 't', textContent: slotLabel(s) }));

      t.setAttribute('aria-label', slotLabel(s) + '，'
        + (p ? nameOf(p, slotMetaOf(p)) : '空著'));
      on(t, 'click', () => {
        SEL = s.id;
        vaultBy = 'part';
        vaultFilter = s.isWeapon ? 'weapon' : 'p:' + s.id;
        render();
      });
      attachGearTip(t, s);
      c.append(t);
    }
    host.append(c);
  }

  /* 第 5 欄：弓箭套裝與武庫。
     它們不是裝備（沒有詞條、沒有階、不算進「幾件已填滿」），但擺回網格裡，
     因為結構跟其他八格一樣就不會互相牽扯 —— 圖 ＋ 名稱，兩個字，不會截斷。
     完整屬性在 hover 浮層，而且那裡是三個來源的合計，比在格子裡看一條有用。 */
  const extra = el('div', { className: 'scol' });
  extra.style.gridTemplateRows = STRIP_ROWS;
  const bowMeta = S.bow && (C.sets || []).find((x) => x.key === S.bow);
  const arsMeta = S.arsenal && (C.arsenals || []).find((x) => x.key === S.arsenal);
  extra.append(pickCell({
    img: bowMeta && 'equipment/loadout/BOW1.png', meta: bowMeta, empty: '弓箭',
  }));
  extra.append(pickCell({ meta: arsMeta, img: arsMeta && arsMeta.img, empty: '武庫' }));
  host.append(extra);

  $('#strip-cap').textContent = slots.length ? done + ' / ' + slots.length + ' 件已填滿' : '先選流派';
  secCounts();
}

/**
 * 第 5 欄那兩格：弓箭套裝與武庫。
 *
 * 只放圖與名稱，**不放屬性** —— 「最大鳴金攻擊 +373」那串字要約 95px，
 * 五欄平分的話左欄得拉到 550px 才不截斷，那比中欄的倉庫還寬。
 * 屬性在 hover 浮層裡，那裡還是三個來源的合計，比在格子裡看一條有用。
 */
function pickCell(cfg) {
  const t = el('button', { className: 'thumb pickcell', type: 'button', 'data-q': 'gold', 'data-focus-key': cfg.empty });
  if (!cfg.meta) t.setAttribute('data-empty', '');
  const art = cfg.meta && cfg.img
    ? img(cfg.img, cfg.meta.name)
    : el('span', { className: 'plus', textContent: '＋' });
  if (art.tagName === 'IMG') art.alt = '';   // 名字在下面那行，別唸兩次
  t.append(art);
  t.append(el('span', { className: 't', textContent: cfg.meta ? cfg.meta.name : cfg.empty }));
  t.setAttribute('aria-label', (cfg.meta ? cfg.meta.name : cfg.empty) + '，點一下選擇');
  on(t, 'click', openEqsel);
  onHover(t, extraTip, { skin: 'panel' });
  return t;
}

/**
 * 套裝與武庫加成。合併三個來源：武器套裝、弓箭套裝、武庫。
 *
 * 為什麼合在一起：這三樣的性質一樣 —— **選了就給**，不是你滾出來的，
 * 所以看的時候會想一起看「我從這一層總共拿到多少」。
 * 分三個浮層的話要滑三次，而且加起來是多少還得自己心算。
 */
function extraTip() {
  const box = el('div');
  box.append(el('div', { className: 'tip-h',  textContent: '套裝與武庫加成' }));
  box.append(el('p', { className: 'sub', textContent: '合併列出武器套裝、弓箭套裝、武庫' }));

  const groups = [];
  // 武器套裝：按目前掛上的那幾件統計，同一套算幾件
  const used = new Map();
  for (const sl of allSlots(S, C, IDX)) {
    const conf = confOf(sl);
    if (!conf.set || !IDX[conf.set]) continue;
    const row = used.get(conf.set) || { meta: IDX[conf.set], n: 0 };
    row.n += 1;
    used.set(conf.set, row);
  }
  for (const { meta, n } of used.values()) {
    groups.push({ label: meta.name + '　×' + n, attr: meta.attr });
  }
  const bow = S.bow && (C.sets || []).find((x) => x.key === S.bow);
  if (bow) groups.push({ label: bow.name + '　弓箭', attr: bow.attr });
  const ars = S.arsenal && (C.arsenals || []).find((x) => x.key === S.arsenal);
  if (ars) groups.push({ label: ars.name + '　武庫', attr: ars.attr });

  if (!groups.length) {
    box.append(el('p', { className: 'none',
      textContent: '還沒選套裝、弓箭或武庫。點這一格挑，或在裝備卡的編輯窗選套裝。' }));
    return box;
  }

  for (const g of groups) {
    const sec = el('div', { className: 'sec' });
    sec.append(el('p', { className: 'grp', textContent: g.label }));
    if (g.attr && g.attr.length) {
      for (const r of attrRows(g.attr)) sec.append(r);
    } else {
      sec.append(el('p', { className: 'none', style: 'padding:0',
        textContent: '數值表裡沒有這一項的效果值。' }));
    }
    box.append(sec);
  }

  // 合計：同一個屬性跨來源要加起來，不然三段各看各的還是得心算
  const sum = new Map();
  for (const g of groups) {
    for (const a of g.attr || []) {
      const r = sum.get(a.k) || { n: a.n, v: 0, pct: a.pct };
      r.v += a.v;
      sum.set(a.k, r);
    }
  }
  if (sum.size > 1 || groups.length > 1) {
    const tot = el('div', { className: 'sec' });
    tot.append(el('p', { className: 'grp', textContent: '合計' }));
    for (const r of attrRows([...sum.values()])) tot.append(r);
    box.append(tot);
  }
  return box;
}

/* ── 武器套裝・弓箭・武庫 ──────────────────────────────────────────
   一個彈窗三個分區，版型照工具站的 equipment-selector-stack：
   每區一個小標，底下是選項卡（名字 ＋ 那一條屬性），武庫多一個圖示。
   改動先進草稿，按「確認」才落回 —— 按叉叉要真的能反悔。

   武器套裝那一區跟工具站的意思一樣：**套用到右四**（主副武器、環、佩）。
   我們的套裝本來是綁在倉庫那一件上的，所以這裡是「一次改那四件」，
   不是另外存一個全域值 —— 存兩份遲早會對不起來。 */
const eqsel = $('#eqsel');
let ES = null;

const closeEqsel = () => { hideOverlay(eqsel); ES = null; };

const RIGHT_FOUR = ['w_main', 'w_off', 'ring', 'pend'];

/** 右四現在共用哪一套？四件都同一套才算，不然回 null（混搭）。 */
function rightFourSet() {
  const keys = RIGHT_FOUR.map((id) => (itemOf(S, id) || {}).set).filter(Boolean);
  if (keys.length !== RIGHT_FOUR.filter((id) => itemOf(S, id)).length || !keys.length) return null;
  return keys.every((k) => k === keys[0]) ? keys[0] : null;
}

function openEqsel() {
  ES = { weapon: rightFourSet(), bow: S.bow, arsenal: S.arsenal };
  drawEqsel();
  showOverlay(eqsel);
}

function optCard(o, selected, onPick) {
  const c = el('button', { className: 'eqopt', type: 'button' });
  if (selected) c.setAttribute('data-on', '');
  // 元素別的底色。工具站按 lieshi／mingjin／qiansi／pozhu／common 上不同的暖冷調，
  // 一排卡才不是五個一樣的灰方塊。
  if (o.el) c.setAttribute('data-el', o.el.toLowerCase());
  const tx = el('span', { className: 'eqopt-t' }, [
    el('b', { textContent: o.name }),
    // 一條屬性一行。擠成一行再讓它自己折，會斷在「最大裂石攻擊 +373　最」這種地方
    ...o.meta.map((m) => el('small', { textContent: m })),
  ]);
  c.append(tx);
  if (o.img) {
    const i = img(o.img, o.name);
    i.classList.add('eqopt-i');
    c.append(i);
  }
  c.setAttribute('aria-pressed', selected ? 'true' : 'false');
  c.dataset.focusKey = 'equipment-option-' + o.name;
  on(c, 'click', () => {
    onPick(); drawEqsel();
    [...eqsel.querySelectorAll('.eqopt')].find(n => n.dataset.focusKey === c.dataset.focusKey)?.focus({ preventScroll: true });
  });
  return c;
}

function drawEqsel() {
  const body = $('#eqsel-body');
  body.textContent = '';
  const line = (x) => {
    const rows = (x.attr || []).map((a) => a.n + ' +' + fmtVal(a.v) + (a.pct ? '%' : ''));
    return rows.length ? rows : ['資料表沒有屬性'];
  };

  const section = (title, note, opts) => {
    const sec = el('section', { className: 'eqsec' });
    sec.append(el('h3', {}, [
      document.createTextNode(title),
      note ? el('span', { textContent: note }) : null,
    ]));
    const g = el('div', { className: 'eqgrid' });
    for (const o of opts) g.append(o);
    sec.append(g);
    body.append(sec);
  };

  section('武器套裝', '套用到右四：主武器・副武器・環・佩',
    (C.sets || []).filter((x) => !x.bow).map((x) => optCard(
      { name: x.short || x.name, meta: line(x) },
      ES.weapon === x.key,
      () => { ES.weapon = ES.weapon === x.key ? null : x.key; })));

  section('弓箭套裝', null,
    (C.sets || []).filter((x) => x.bow).map((x) => optCard(
      { name: x.name, meta: line(x) },
      ES.bow === x.key,
      () => { ES.bow = ES.bow === x.key ? null : x.key; })));

  section('武庫', null,
    (C.arsenals || []).map((x) => optCard(
      { name: x.name, meta: line(x), img: x.img, el: x.key },
      ES.arsenal === x.key,
      () => { ES.arsenal = ES.arsenal === x.key ? null : x.key; })));
}

function saveEqsel() {
  if (!ES) return;
  S.bow = ES.bow || null;
  S.arsenal = ES.arsenal || null;
  let n = 0;
  if (ES.weapon) {
    // 只改掛上去的那幾件 —— 倉庫裡備著的不動，那是你另外配好的
    for (const id of RIGHT_FOUR) {
      const it = itemOf(S, id);
      if (it && it.set !== ES.weapon) { it.set = ES.weapon; n++; }
    }
  }
  closeEqsel();
  render();
  toast(n ? '套裝已更新，右四有 ' + n + ' 件換成這套' : '套裝已更新');
}

function setSelect(value, onChange) {
  const sel = el('select');
  sel.append(el('option', { value: '', textContent: '— 套裝 —' }));
  for (const s of C.sets) sel.append(el('option', { value: s.key, textContent: s.name }));
  sel.value = value || '';
  on(sel, 'change', () => { onChange(sel.value || null); render(); });
  return sel;
}


// ── 裝備倉庫 ─────────────────────────────────────────────────────────────
// 中欄畫的是**倉庫裡的每一件**，不是八個格位。
// 差別在於同一個部位可以放好幾件：爆傷一頂、減傷一頂，換裝只是換掛哪一件，
// 沒掛上的那件數值原封不動留著。舊版一個部位只存得下一組，想比較就得蓋掉。
let vaultFilter = 'all';
let vaultBy = 'part';     // part／set：依部位或依套裝分類
let vaultSort = 'new';    // 預設「最新加入」—— 剛登記完的那件要在眼前
let SEL = null;           // 左欄選到的格位，用來標出「這一格現在掛的是哪件」

/** 這一件的詞條滾得多好：已填那幾條的 值/上限。沒填回 -1。 */
function rollScore(it) {
  const rows = tuneRows(it).filter((r) => r.k && r.meta && Number.isFinite(r.v));
  if (!rows.length) return -1;
  const full = rows.reduce((n, r) => n + r.meta.max, 0);
  return full > 0 ? rows.reduce((n, r) => n + r.v, 0) / full : -1;
}

/**
 * 「哪一件比較強」的排序分。
 *
 * 只看滾動比例會出事：填了一條 100% 會贏過填滿六條 94%。
 * 所以先比填了幾條，再比滾得多好，最後才比階 —— 六條 94% 的那件確實比較強。
 */
const power = (it) => {
  const filled = tuneRows(it).filter((r) => r.k && r.meta && Number.isFinite(r.v)).length;
  return filled * 1000 + Math.max(0, rollScore(it)) * 100 + (it.tier || 0) / 1000;
};

const SORTS = [
  { k: 'new', n: '最新加入' },
  { k: 'old', n: '最早加入' },
  { k: 'power', n: '強度高→低' },
  { k: 'tier', n: '等級高→低' },
  { k: 'roll', n: '滾動品質高→低' },
  { k: 'part', n: '部位順序' },
  { k: 'set', n: '套裝' },
  { k: 'name', n: '名稱' },
];

/* 進階篩選。同一組之內是「或」，跨組是「且」——
   不然選了「金」又選「紫」會一件都不剩，而那顯然不是使用者的意思。 */
const ONLY = [
  { k: 'worn', n: '已裝備', g: 'state', test: (it) => !!wornAt(it) },
  { k: 'spare', n: '備用', g: 'state', test: (it) => !wornAt(it) },
  { k: 'gold', n: '金', g: 'q', test: (it) => it.quality !== 'purple' },
  { k: 'purple', n: '紫', g: 'q', test: (it) => it.quality === 'purple' },
  { k: 'todo', n: '詞條未滿', g: 'todo', test: (it) => isTodo(it) },
  { k: 'notier', n: '未填等級', g: 'notier', test: (it) => !it.tier },
  { k: 'noset', n: '未指定套裝', g: 'noset', test: (it) => !it.set },
];
const vaultOnly = new Set();

/* 同一組裡選兩個是「或」。下拉裡標出來，不然使用者會以為
   同時選「金」跟「紫」會一件都不剩。 */
const GRP_NOTE = {
  state: '（可與同組另一項一起選）',
  q: '（可與同組另一項一起選）',
};

/** 套用進階篩選。 */
function passOnly(it) {
  const groups = {};
  for (const o of ONLY) if (vaultOnly.has(o.k)) (groups[o.g] = groups[o.g] || []).push(o);
  return Object.values(groups).every((list) => list.some((o) => o.test(it)));
}

/** 依目前排序把清單排好。原陣列的先後就是加入的先後，所以用索引判新舊。 */
function sortVault(list) {
  const order = new Map(S.vault.map((x, i) => [x.id, i]));
  const partOrder = new Map(['weapon'].concat(C.gearSlots.map((g) => g.id)).map((k, i) => [k, i]));
  const nm = (it) => nameOf(it, slotMetaOf(it));
  const by = {
    new: (a, b) => order.get(b.id) - order.get(a.id),
    old: (a, b) => order.get(a.id) - order.get(b.id),
    power: (a, b) => power(b) - power(a),
    tier: (a, b) => (b.tier || 0) - (a.tier || 0),
    roll: (a, b) => rollScore(b) - rollScore(a),
    part: (a, b) => (partOrder.get(a.slot) ?? 99) - (partOrder.get(b.slot) ?? 99),
    set: (a, b) => String(a.set && IDX[a.set] ? IDX[a.set].name : '　').localeCompare(
      String(b.set && IDX[b.set] ? IDX[b.set].name : '　'), 'zh-Hant'),
    name: (a, b) => nm(a).localeCompare(nm(b), 'zh-Hant'),
  };
  // 排序值一樣時一律退回「新的在前」，順序才不會每次重畫都跳
  const tie = by.new;
  return list.slice().sort((a, b) => by[vaultSort](a, b) || tie(a, b));
}

/* 頁籤。空的分類照樣列 —— 整理倉庫時要看的就是「哪裡還缺」，藏起來反而沒用。 */
function tabsFor() {
  const out = [{ k: 'all', label: '全部', test: () => true }];
  if (vaultBy === 'set') {
    const seen = new Map();
    for (const it of S.vault) if (it.set && IDX[it.set]) seen.set(it.set, IDX[it.set].name);
    for (const [k, name] of seen) out.push({ k: 's:' + k, label: name, test: (x) => x.set === k });
    out.push({ k: 's:', label: '未指定套裝', test: (x) => !x.set });
    return out;
  }
  out.push({ k: 'weapon', label: '武器', test: (x) => x.slot === WEAPON_SLOT });
  for (const g of C.gearSlots) {
    out.push({ k: 'p:' + g.id, label: g.name, test: (x) => x.slot === g.id });
  }
  // 這一排只放**類別**（部位或套裝）。狀態類的（待填、已裝備、金紫…）
  // 全在底下那排晶片，它們是「或」的關係也篩得起來 ——
  // 「待填」跟冠胄、胸甲並排本來就不是同一個問題。
  return out;
}

/** 六條詞條沒填滿的算待填。 */
const isTodo = (it) => !it || tuneRows(it).some((r) => !r.k || !Number.isFinite(r.v));

const baseOf = (partKey) => C.gearBase.find((g) => g.key === partKey) || null;
const itemName = (partKey) => { const g = baseOf(partKey); return g && g.name ? g.name : null; };

/** 格位的顯示名：主武器／副武器／冠胄／環…
    認的是「哪個洞」不是「哪件東西」—— 四個流星辟邪長得一樣，
    寫物品名分不出是環一還是佩二。物品名留給浮層。 */
const slotLabel = (s) => {
  if (!s.isWeapon) return s.name;
  // 掛在格位上才叫「主武器／副武器」。備在倉庫的那幾把沒有格位，
  // 這時要退回兵器型別（劍、陌刀）—— 光寫「武器」等於什麼都沒說。
  return s.role ? s.role + '武器' : (s.name || '武器');
};

function tuneRows(piece) {
  if (!piece) return [];
  const tM = new Map(C.tunings.map((t) => [t.key, t]));
  const pM = new Map(C.pitches.map((p) => [p.key, p]));
  return [
    { ...piece.first, meta: tM.get(piece.first.k), kind: 't' },
    ...piece.sec.map((x) => ({ ...x, meta: tM.get(x.k), kind: 't' })),
    { ...piece.pitch, meta: pM.get(piece.pitch.k), kind: 'p' },
  ];
}

function renderVault() {
  const host = $('#vault');
  host.textContent = '';
  const tabs = tabsFor();
  if (!tabs.some((t) => t.k === vaultFilter)) vaultFilter = 'all';

  const bar = $('#tabs');
  bar.textContent = '';
  // 控制自己一條。原本跟部位頁籤擠在同一個容器裡靠 flex-wrap 斷行，
  // 斷在哪由寬度決定，於是「全部 16」那顆頁籤常常被擠到控制那一條的尾巴。
  const ctl = $('#vbar');
  ctl.textContent = '';
  ctl.hidden = !S.vault.length;
  bar.hidden = !S.vault.length;

  // 分類方式。兩種分法看的是不同的問題：
  // 依部位＝「這個洞我有幾件可選」，依套裝＝「時雨我湊到幾件了」。
  const seg = el('div', { className: 'seg' });
  for (const o of [{ k: 'part', n: '依部位' }, { k: 'set', n: '依套裝' }]) {
    const b = el('button', { type: 'button', textContent: o.n });
    if (vaultBy === o.k) b.setAttribute('data-on', '');
    on(b, 'click', () => { vaultBy = o.k; vaultFilter = 'all'; render(); });
    seg.append(b);
  }
  ctl.append(seg);

  // 排序。八種分法各自回答不同的問題，所以用下拉不用晶片 —— 一次只會選一種。
  const sortSel = el('select', { className: 'sortsel', 'aria-label': '排序方式' });
  for (const o of SORTS) sortSel.append(el('option', { value: o.k, textContent: o.n }));
  sortSel.value = vaultSort;
  on(sortSel, 'change', () => { vaultSort = sortSel.value; render(); });
  // 標籤與控制項包成一組，換行時一起走 —— 分開放的話「排序」會被留在上一行尾巴
  ctl.append(el('span', { className: 'fld2' }, [
    el('span', { className: 'lab', textContent: '排序' }), sortSel,
  ]));

  /* 進階篩選。做成跟排序長一樣的下拉，但**可以複選** ——
     原生 select 的複選要按住 Ctrl 點，手機根本點不出來。
     「詞條未滿」以前是上面那排的一個頁籤，跟部位混在一起；它是狀態不是類別，搬來這裡。 */
  const picked = ONLY.filter((o) => vaultOnly.has(o.k));
  const filtBtn = el('button', { className: 'sortsel filtsel', type: 'button' });
  filtBtn.append(el('span', {
    textContent: picked.length
      ? picked.map((o) => o.n).join('、')
      : '全部（不篩）',
  }));
  if (picked.length) filtBtn.setAttribute('data-on', '');
  filtBtn.append(el('span', { className: 'pf-caret', textContent: '▾' }));
  filtBtn.setAttribute('aria-label', '篩選，目前 '
    + (picked.length ? picked.map((o) => o.n).join('、') : '不篩'));
  on(filtBtn, 'click', (e) => {
    e.stopPropagation();
    openPop(e.currentTarget, {
      title: '只看　可複選', menu: true, cols: 1, toggle: true,
      isOn: (k) => (k === '' ? vaultOnly.size === 0 : vaultOnly.has(k)),
      options: [{ v: '', t: '全部（不篩）', sub: '清掉所有條件' }].concat(
        ONLY.map((o) => ({
          v: o.k, t: o.n,
          sub: '倉庫裡 ' + S.vault.filter(o.test).length + ' 件'
            + (GRP_NOTE[o.g] ? '　' + GRP_NOTE[o.g] : ''),
        }))),
      onChange: (k) => {
        if (!k) { vaultOnly.clear(); return; }
        if (vaultOnly.has(k)) vaultOnly.delete(k); else vaultOnly.add(k);
      },
    });
  });
  ctl.append(el('span', { className: 'fld2' }, [
    el('span', { className: 'lab', textContent: '篩選' }), filtBtn,
  ]));
  // 件數靠右。它回答的是「我總共有幾件」，跟左邊那三個「怎麼看」是不同的問題，
  // 所以推到另一端，不要混在同一串控制裡。
  ctl.append(el('span', { className: 'count', textContent: S.vault.length + ' 件' }));

  for (const t of tabs) {
    const n = S.vault.filter(t.test).length;
    const b = el('button', { type: 'button' });
    b.append(document.createTextNode(t.label));
    b.append(el('span', { className: 'n', textContent: n }));
    if (!n && t.k !== 'all') b.setAttribute('data-none', '');
    if (t.k === vaultFilter) b.setAttribute('data-on', '');
    on(b, 'click', () => { vaultFilter = t.k; render(); });
    bar.append(b);
  }

  const cur = tabs.find((t) => t.k === vaultFilter);
  const shown = sortVault(S.vault.filter((x) => cur.test(x) && passOnly(x)));

  /* 現在按「新增」會加到哪一類。順序：頁籤選的部位 → 左欄選的格位 → 冠胄。
     標在鈕上，按下去才不會加錯地方。 */
  const targetSlot = () => {
    if (vaultFilter.startsWith('p:')) return vaultFilter.slice(2);
    if (vaultFilter === 'weapon') return SEL && SEL.startsWith('w_') ? SEL : 'w_main';
    if (SEL) return SEL;
    // 「全部」或依套裝分類時，這裡沒有任何線索指向某一格。
    // 猜一個（以前猜冠胄）只會讓人加錯地方，所以回 null ＝ 按下去再問。
    return null;
  };

  if (!shown.length) {
    // 空狀態一定要給一個明確的下一步，不然使用者只會看到一片空白
    const box = el('div', { className: 'blank' });
    box.append(el('p', {
      textContent: !S.vault.length
        ? '倉庫是空的。先把你有的裝備登記進來，再決定這次要帶哪幾件。'
        : vaultOnly.size
          ? '這個分類底下沒有符合篩選的東西。'
          : '這個分類底下還沒有東西。',
    }));
    if (S.vault.length && vaultOnly.size) {
      const clr = el('button', { className: 'act-ghost', type: 'button', textContent: '清除篩選' });
      on(clr, 'click', () => { vaultOnly.clear(); render(); });
      box.append(clr);
    }
    const slotId = targetSlot();
    const add = el('button', { className: 'act-gold', type: 'button',
      textContent: '＋ 新增一件 ' + (slotId ? slotNameOf(slotId) : '裝備') });
    on(add, 'click', () => {
      if (slotId) addToVault(slotId); else askSlot(add);
    });
    box.append(add);
    host.append(box);
    return;
  }

  // 新增卡排第一張。這是倉庫的主要動作，放在你要加東西時眼睛本來就在的地方。
  const slotId = targetSlot();
  const what = slotId ? slotNameOf(slotId) : '裝備';
  const addCard = el('button', { className: 'addcard', type: 'button' }, [
    el('span', { className: 'plus', textContent: '＋' }),
    el('b', { textContent: '新增一件 ' + what }),
    el('small', {
      textContent: slotId ? '登記你有的裝備，之後才選得上去' : '按一下選要加哪一格',
    }),
  ]);
  addCard.setAttribute('aria-label', '新增一件 ' + what + ' 到倉庫');
  on(addCard, 'click', () => {
    if (slotId) { addToVault(slotId); return; }
    askSlot(addCard);
  });
  host.append(addCard);

  for (const it of shown) host.append(cardForItem(it));
}

/* ── 卡面底圖 ─────────────────────────────────────────────────────
   遊戲的底圖只有兩組，而且金紫必須成對換（同一組裡 1 是金、2 是紫）：
     c 組 c1/c2  橫幅煙塵，本來就是給寬卡畫的，倉庫卡預設
     r 組 r1/r2  直紋雨絲，工具站的直式裝備格用的
   這是外觀偏好不是配置，所以存自己的 localStorage 鍵，不進角色資料也不進匯出 ——
   別人匯入你的配置不該連他的畫面一起被改掉。 */
const HERO_KEY = 'lunjian.loadout.hero';
const HEROS = [
  { k: 'c', n: '橫的・煙霧', sub: '倉庫卡片原本就是用這個' },
  { k: 'r', n: '直的・雨絲', sub: '遊戲裡裝備格那種直條紋' },
];
let HERO = 'c';

const applyHero = () => document.documentElement.setAttribute('data-hero', HERO);

function setHero(k) {
  HERO = HEROS.some((x) => x.k === k) ? k : 'c';
  try { localStorage.setItem(HERO_KEY, HERO); } catch { /* 存不了就算了，只是外觀 */ }
  applyHero();
  toast('背景換成「' + (HEROS.find((x) => x.k === HERO) || {}).n + '」了');
}

function restoreHero() {
  try { HERO = localStorage.getItem(HERO_KEY) || 'c'; } catch { HERO = 'c'; }
  if (!HEROS.some((x) => x.k === HERO)) HERO = 'c';
  applyHero();
}

const openHeroPick = (anchor) => openPop(anchor, {
  title: '換卡片背景', menu: true, cols: 1, value: HERO,
  options: HEROS.map((x) => ({ v: x.k, t: x.n, sub: x.sub })),
  onChange: setHero,
});

/* ── 倉庫的批次動作 ───────────────────────────────────────────────
   四件事收在同一個選單裡，不往抬頭再塞四顆鈕 ——
   先前「新增裝備」擺在五顆同色鈕中間就是找不到，同樣的錯不犯第二次。 */

/** 全部脫裝：倉庫原封不動，只是這次一件都不帶。 */
function unequipAll() {
  const n = Object.keys(S.equip || {}).length;
  if (!n) { toast('本來就沒有穿任何裝備'); return; }
  S.equip = {};
  render();
  toast('脫下 ' + n + ' 件，裝備都還在倉庫裡');
}

/**
 * 一鍵最強：每一格挑倉庫裡分數最高的那件掛上。
 *
 * 武器先主後副，而且同一把不會掛兩次 —— 你只有那一把。
 * 這只是個起點，不是建議：分數只看「填了幾條、滾得多好」，
 * 不看套裝湊不湊得起來，那是你自己要權衡的事。
 */
function equipBest() {
  let n = 0;
  S.equip = {};
  for (const slotId of ['w_main', 'w_off', 'head', 'body', 'arms', 'legs', 'ring', 'pend']) {
    const best = vaultFor(S, slotId).slice().sort((a, b) => power(b) - power(a))[0];
    if (!best) continue;
    equipItem(S, slotId, best.id);
    n++;
  }
  render();
  toast(n ? '幫你穿上 ' + n + ' 件（只比詞條，沒算套裝加成）' : '倉庫是空的，沒有東西可以穿');
}

/** 設回預設：清掉現在的，照流派重新開一套 110 階、帶建議詞條的當起點。 */
/* ── 確認框 ───────────────────────────────────────────────────────────────
   **不要用原生的 confirm()。** Chrome 在同一頁連跳幾次對話框之後，會在框上
   多一個「不要讓這個網頁再建立對話方塊」的勾選框；勾下去之後 confirm() 就
   直接回 false 不再跳框 —— 於是「全部重來」「全部刪掉」按下去完全沒動作、
   也沒有任何訊息。從使用者那邊看就是「按鈕壞了」，而且查不出原因。

   （這個坑我自己的測試也沒抓到：每一支都寫了自動按「確定」，
     等於從來沒測過「對話框沒被接受」那條路。）

   附帶好處：樣式跟整頁一致，說明可以寫好幾行，會刪東西的按鈕能標紅。 */
const askBox = $('#ask');
let askResolve = null;

function closeAsk(yes) {
  hideOverlay(askBox);
  const r = askResolve;
  askResolve = null;
  if (r) r(!!yes);
}

/**
 * 問一句話，回一個 Promise（確定 true／取消 false）。
 * @param cfg { title, lines:[…], sub, warn, ok, danger }
 */
function ask(cfg) {
  // 前一個還開著就當作取消，不要讓兩個問題疊在一起
  if (askResolve) closeAsk(false);
  $('#ask-title').textContent = cfg.title || '請確認';
  const body = $('#ask-body');
  body.textContent = '';
  for (const t of cfg.lines || []) body.append(el('p', { textContent: t }));
  if (cfg.sub) body.append(el('p', { className: 'sub', textContent: cfg.sub }));
  if (cfg.warn) body.append(el('p', { className: 'warn', textContent: cfg.warn }));
  const yes = $('#ask-yes');
  yes.textContent = cfg.ok || '確定';
  if (cfg.danger) yes.setAttribute('data-danger', ''); else yes.removeAttribute('data-danger');
  showOverlay(askBox);
  // 焦點給「取消」：這幾個都是刪東西的動作，預設不該停在確定上
  setTimeout(() => $('#ask-no').focus({ preventScroll: true }), 20);
  return new Promise((resolve) => { askResolve = resolve; });
}

/**
 * 重來給的那一整套：**六件防具 ＋ 十種兵器各一把 ＝ 16 件，等級 95**。
 *
 * 為什麼配幾件跟詞條哪裡來要拆開：
 * 十一個流派裡只有十個在工具站有預設（破竹樽沒有）。如果「有沒有十把兵器」
 * 跟著預設走，破竹樽的人按下去就會拿到八件兩把武器 —— 而選單上明明寫著
 * 「十種兵器各配一把」。**配幾件是這個工具的規矩**，不是工具站的。
 *
 * 所以：
 *     配幾件   一律 6 ＋ 10，等級 95
 *     詞條     有預設用預設；沒有就照流派天賦挑（跟「套用建議」同一支）
 *
 * 掛上去的是六件防具與這個流派的主副武器，其餘八把備在倉庫。
 *
 * @returns 實際做了幾件
 */
function buildStarterVault(set) {
  const tM = new Map((C.tunings || []).map((t) => [t.key, t]));
  const pM = new Map((C.pitches || []).map((p) => [p.key, p]));
  const srcOf = (slot) => (set ? set.items.find((x) => x.slot === slot) : null);
  const tag = set ? set.modeName : '建議';
  let n = 0;

  /** 做一件。有樣板照樣板（換兵器時會把專屬詞條換掉），沒有就照天賦挑。 */
  const make = (src, part, slot, label) => {
    const isW = slot === 'w_main' || slot === 'w_off';
    const it = newItem(isW ? WEAPON_SLOT : slot, part);
    it.tier = QADD_TIER;
    it.label = label.slice(0, 12);
    if (src) {
      const first = retuneFor(part, src.first ? [src.first] : [], 'first', tM)[0];
      if (first) it.first = { k: first, v: tM.get(first).base };
      retuneFor(part, src.sec || [], 'sec', tM).forEach((k, i) => {
        if (i < 4) it.sec[i] = { k, v: tM.get(k).base, carry: false };
      });
      // 定音沒有基準值，只有上限
      if (src.pitch && pM.has(src.pitch) && (pM.get(src.pitch).slots || []).includes(part)) {
        it.pitch = { k: src.pitch, v: pM.get(src.pitch).max };
      }
    } else {
      // 沒有預設：照流派天賦挑，跟「套用建議」走的是同一支
      suggestPiece({ partKey: part }, it);
    }
    S.vault.push(it);
    n += 1;
    return it;
  };

  // 六件防具
  for (const g of C.gearSlots || []) {
    const it = make(srcOf(g.id), g.partKey, g.id, tag + '·' + g.name);
    equipItem(S, g.id, it.id);
  }

  // 主副武器用哪兩種兵器：有預設聽預設的，沒有就照流派的兩門武學。
  // 兩條都問不出來的時候（破竹樽在資料表裡沒有武學）就拿清單前兩把頂著 ——
  // 十把都在倉庫裡，換一把只要點一下，但至少重來完是一套掛得滿的配置，
  // 不是兩個空的武器格。
  const wname = new Map((C.weapons || []).map((w) => [w.key, w.name]));
  const all = (C.weapons || []).map((w) => w.key);
  const mainPart = (srcOf('w_main') || {}).partKey || weaponKeyOf(S, IDX, 'main') || all[0] || null;
  const offPart = (srcOf('w_off') || {}).partKey || weaponKeyOf(S, IDX, 'off') || all[1] || null;

  // 十種兵器各一把。主副那兩把用它們自己的樣板（一字不差），
  // 其餘八把拿主武器的樣板改寫 —— 只換兵器專屬的那一條。
  for (const w of C.weapons || []) {
    const slot = w.key === mainPart ? 'w_main' : (w.key === offPart ? 'w_off' : 'w_main');
    const src = w.key === mainPart ? srcOf('w_main')
      : (w.key === offPart ? srcOf('w_off') : srcOf('w_main'));
    const it = make(src, w.key, slot, tag + '·' + (wname.get(w.key) || '兵器'));
    if (w.key === mainPart) equipItem(S, 'w_main', it.id);
    else if (w.key === offPart) equipItem(S, 'w_off', it.id);
  }
  return n;
}

async function resetVault() {
  // 有預設就回到預設（跟「快速添加」拿的是同一套），沒有才退回自動挑詞條。
  // 十一個流派裡有十個有預設；破竹樽沒有，那一個走 suggestAll。
  // 破竹樽站上沒有預設，那一個的詞條改照流派天賦挑；件數與等級兩條路一樣。
  const set = presetFor(S.build);
  const NL = String.fromCharCode(10);
  const total = (C.gearSlots || []).length + (C.weapons || []).length;
  const what = '六件防具 ＋ 十種兵器各一把，共 ' + total + ' 件，等級都寫 ' + QADD_TIER + '。'
    + NL + '詞條來源：' + (set ? set.buildName + '　' + set.modeName + '預設' : '照這個流派的武學天賦挑（站上沒有這個流派的預設）')
    + NL + '防具與這個流派的主副武器會掛上去，其餘八把備在倉庫。';
  if (!await ask({
    title: '全部重來',
    lines: ['現在的 ' + S.vault.length + ' 件裝備會被刪掉，救不回來。', '重來之後會拿到：'],
    sub: what,
    ok: '重來', danger: true,
  })) return;
  S.vault = [];
  S.equip = {};
  // 十種兵器各配一把：換武學、換流派的時候不用從頭填一把
  const n = buildStarterVault(set);
  render();
  toast('重來完成，' + n + ' 件（' + QADD_TIER + ' 級，十種兵器各一把）'
    + (set ? '　' + set.modeName + '預設' : '　照流派天賦挑的詞條'));
}

/** 清空倉庫：真的全部丟掉。 */
async function clearVault() {
  if (!S.vault.length) { toast('倉庫本來就是空的'); return; }
  if (!await ask({
    title: '全部刪掉',
    lines: ['要把 ' + S.vault.length + ' 件裝備全部刪掉嗎？連預設加進來的也會一起刪。'],
    sub: '想留著的話，先按「匯出 JSON」存一份再刪。',
    warn: '刪掉就救不回來了。',
    ok: '刪掉', danger: true,
  })) return;
  S.vault = [];
  S.equip = {};
  render();
  toast('倉庫已清空');
}

/* ── 快速添加 ─────────────────────────────────────────────────────────────
   工具站的「快速添加」：選流派 ＋ 預設模式，一次把八件寫進倉庫。
   預設本身是**規則**不是現成的裝備表 —— 三份樣板（大外／小外／鳴金）
   依流派套一層覆寫，展開成 17 組。抽法見 ../loadout/tools/fetch-presets.py，
   結果在 catalog.json 的 presets 段。

   **等級一律寫 95。** 那是使用者指定的；而且站上沒有分等級的數值表
   （整份表掛在遊戲版本 110_RBDZ_DOWN 底下，沒有等級維度），
   所以詞條數值用的是那份表的基準值，跟畫面上「套用建議」同一組。
   真的一件 95 級裝備滾出來會比這裡低，拿到之後自己改。

   加進去是**新增**不是取代：原本倉庫裡的東西一件都不動，
   八件新的加在後面，掛不掛上去由你決定。 */
const QADD_TIER = 95;
const qadd = $('#qadd');
let QA = null;      // { build, mode, off:Set(不要的部位) }

const closeQadd = () => { hideOverlay(qadd); QA = null; };

/** 這個流派有哪幾種預設模式。沒有就是空陣列，那個流派站上沒做預設。 */
const qaModes = (buildKey) => (C.presets || [])
  .filter((p) => p.build === buildKey)
  .map((p) => ({ mode: p.mode, name: p.modeName }));

const qaSet = () => (C.presets || []).find((p) => QA && p.build === QA.build && p.mode === QA.mode);

function openQadd() {
  const presets = C.presets || [];
  if (!presets.length) { toast('這份資料表沒有預設，請先跑 tools/fetch-presets.py'); return; }
  // 預設選現在這個流派；它沒有預設的話，就用清單第一個有預設的
  const mine = presets.find((p) => p.build === S.build);
  const first = mine || presets[0];
  QA = { build: first.build, mode: first.mode, off: new Set() };
  drawQadd();
  showOverlay(qadd);
}

function drawQadd() {
  const presets = C.presets || [];
  // 流派下拉：只列有預設的，而且照 catalog 裡的流派順序，不是 presets 的順序
  const sel = $('#qadd-build');
  sel.textContent = '';
  const has = new Set(presets.map((p) => p.build));
  for (const b of (C.builds || []).filter((x) => has.has(x.key))) {
    sel.append(el('option', { value: b.key, textContent: b.name }));
  }
  sel.value = QA.build;

  // 模式：這個流派有幾種就畫幾顆。站上大外八個流派、小外七個、鳴金兩個。
  const modes = qaModes(QA.build);
  if (!modes.some((m) => m.mode === QA.mode)) QA.mode = modes[0].mode;
  const host = $('#qadd-modes');
  host.textContent = '';
  for (const m of modes) {
    const b = el('button', { type: 'button', textContent: m.name + '預設' });
    if (m.mode === QA.mode) b.setAttribute('data-on', '');
    b.setAttribute('aria-pressed', m.mode === QA.mode ? 'true' : 'false');
    on(b, 'click', () => { QA.mode = m.mode; QA.off.clear(); drawQadd(); });
    host.append(b);
  }

  const set = qaSet();
  const grid = $('#qadd-grid');
  grid.textContent = '';
  const tM = new Map((C.tunings || []).map((t) => [t.key, t]));
  const pM = new Map((C.pitches || []).map((p) => [p.key, p]));
  for (const it of (set ? set.items : [])) {
    const selected = !QA.off.has(it.slot);
    const card = el('button', { className: 'qcard', type: 'button' });
    if (selected) card.setAttribute('data-on', '');
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    const part = slotNameOf(it.slot);
    const nm = itemName(it.partKey) || part;
    card.append(el('div', { className: 'qcard-h' }, [
      el('span', { className: 'part', textContent: part }),
      el('span', { className: 'nm', textContent: nm }),
      el('span', { className: 'tick', textContent: selected ? '✓ 會加' : '不加' }),
    ]));
    const ul = el('ul');
    if (it.first && tM.has(it.first)) {
      ul.append(el('li', { className: 'f', textContent: tM.get(it.first).name }));
    }
    for (const k of it.sec) {
      if (tM.has(k)) ul.append(el('li', { textContent: tM.get(k).name }));
    }
    if (it.pitch && pM.has(it.pitch)) {
      ul.append(el('li', { className: 'p', textContent: '定音　' + pM.get(it.pitch).name }));
    }
    card.append(ul);
    card.setAttribute('aria-label', part + ' ' + nm + '，' + (selected ? '會加入' : '不加入') + '，點一下切換');
    on(card, 'click', () => {
      if (QA.off.has(it.slot)) QA.off.delete(it.slot); else QA.off.add(it.slot);
      drawQadd();
    });
    grid.append(card);
  }

  const n = (set ? set.items.length : 0) - QA.off.size;
  $('#qadd-note').textContent = '會新增 ' + n + ' 件，等級都寫 ' + QADD_TIER
    + '。原本倉庫裡的東西一件都不動，加進來的也不會自動掛上去。'
    + '　詞條數值是資料表的基準值 —— 站上沒有分等級的表，'
    + '真的 ' + QADD_TIER + ' 級裝備會比這裡低，拿到之後在卡片上按「編輯」改掉。';
  $('#qadd-ok').disabled = !n;
}

/** 把勾選的那幾件加進倉庫。等級一律 95。 */
/* 「這一條詞條只有這一種兵器能上」的對照表：劍武學增效只能上劍、鼓武學增效只能上鼓。
   從資料表推出來不寫死 —— 出新兵器時不用回來改這裡。
   十種兵器各配一把的時候，就是靠它把樣板裡那一條換成對應的。 */
/* **第一次用到才算。** 頂層立刻算的話會炸：C 是 fetch 回來才填的，
   模組載入的當下它還是 null，整支 loadout.js 會當場掛掉、整頁空白。 */
let _wOnly = null;
function weaponOnly() {
  if (_wOnly) return _wOnly;
  const wk = new Set((C.weapons || []).map((w) => w.key));
  const by = new Map();
  for (const t of C.tunings || []) {
    const pool = new Set([...(t.first || []), ...(t.sec || [])]);
    const mine = [...pool].filter((k) => wk.has(k));
    // 只有一種兵器能上，而且不能上任何防具 —— 那就是那把兵器的專屬詞條
    if (mine.length === 1 && pool.size === 1) by.set(mine[0], t.key);
  }
  _wOnly = { by, keys: new Set(by.values()) };
  return _wOnly;
}

/** 把樣板裡的詞條搬到另一種兵器上：專屬的那條換掉，上不去的丟掉。 */
function retuneFor(part, keys, role, tM) {
  const w = weaponOnly();
  const out = [];
  for (const k of keys) {
    // 專屬詞條換成這把兵器自己的那一條
    const key = w.keys.has(k) ? w.by.get(part) : k;
    if (!key || out.includes(key)) continue;
    const t = tM.get(key);
    if (t && (t[role] || []).includes(part)) out.push(key);
  }
  return out;
}

/**
 * 把一套預設倒進倉庫。
 *
 * 快速添加與全部重來都走這裡 —— 兩邊各寫一份的話，改了預設的填法
 * 只會改到其中一邊，而那種錯要等到有人說「怎麼不一樣」才會發現。
 *
 * @param skip  不要的部位（slot id 的 Set），沒給就整套都要
 * @param wear  true 的話順手掛上去。全部重來要（重來就是要一套能用的），
 *              快速添加不要（那是往倉庫裡加，掛不掛你自己決定）。
 * @returns 實際加了幾件
 */
function addPresetSet(set, skip, wear) {
  const tM = new Map((C.tunings || []).map((t) => [t.key, t]));
  const pM = new Map((C.pitches || []).map((p) => [p.key, p]));
  let n = 0;

  /** 照一份樣板做一件出來。part 可以跟樣板本來的部位不同（換兵器時）。 */
  const make = (src, part, slot, label) => {
    const isW = slot === 'w_main' || slot === 'w_off';
    const it = newItem(isW ? WEAPON_SLOT : slot, part);
    it.tier = QADD_TIER;
    it.label = label.slice(0, 12);
    const first = retuneFor(part, src.first ? [src.first] : [], 'first', tM)[0];
    if (first) it.first = { k: first, v: tM.get(first).base };
    retuneFor(part, src.sec || [], 'sec', tM).forEach((k, i) => {
      if (i < 4) it.sec[i] = { k, v: tM.get(k).base, carry: false };
    });
    // 定音沒有基準值，只有上限
    if (src.pitch && pM.has(src.pitch) && (pM.get(src.pitch).slots || []).includes(part)) {
      it.pitch = { k: src.pitch, v: pM.get(src.pitch).max };
    }
    S.vault.push(it);
    n += 1;
    return it;
  };

  const weaponSrc = {};
  for (const src of set.items) {
    if (skip && skip.has(src.slot)) continue;
    if (src.slot === 'w_main' || src.slot === 'w_off') { weaponSrc[src.slot] = src; continue; }
    const it = make(src, src.partKey, src.slot, set.modeName + '·' + slotNameOf(src.slot));
    if (wear) equipItem(S, src.slot, it.id);
  }

  // 預設要掛的那兩把：一字不差照它們自己的樣板
  const worn = new Set();
  for (const slot of ['w_main', 'w_off']) {
    const src = weaponSrc[slot];
    if (!src) continue;
    const it = make(src, src.partKey, slot, set.modeName + '·' + slotNameOf(slot));
    worn.add(src.partKey);
    if (wear) equipItem(S, slot, it.id);
  }

  return n;
}

/** 這個流派的預設。有好幾種模式的話取第一種（大外排在前面）。 */
const presetFor = (buildKey) => (C.presets || []).find((p) => p.build === buildKey) || null;

function saveQadd() {
  const set = qaSet();
  if (!set) return;
  const n = addPresetSet(set, QA.off, false);
  closeQadd();
  render();
  toast('已加入 ' + n + ' 件（' + set.buildName + '　' + set.modeName + '預設　'
    + QADD_TIER + ' 級），都還沒掛上去');
}


function openVaultTools(anchor) {
  openPop(anchor, {
    title: '倉庫工具', menu: true, cols: 1,
    options: [
      { v: 'qadd', t: '快速添加（整套）', sub: '照流派的預設，一次加八件進倉庫' },
      { v: 'suggest', t: '自動幫我選詞條', sub: '空著的才填，選好的不會被改掉' },
      { v: 'max', t: '詞條數字調到最大', sub: '已經選好的詞條，數字全部拉到最高' },
      { v: 'best', t: '自動穿上最好的', sub: '每個部位挑倉庫裡最好的那件穿上' },
      { v: 'off', t: '全部脫下來', sub: '裝備不會不見，只是這次不穿' },
      { v: 'hero', t: '換卡片背景', sub: '現在是：' + (HEROS.find((x) => x.k === HERO) || {}).n },
      { v: 'reset', t: '全部重來', sub: '六件防具 ＋ 十種兵器各一把，等級 95', danger: true, sep: true },
      { v: 'clear', t: '全部刪掉', sub: '連預設加進來的也一起刪，救不回來', danger: true },
    ],
    onChange: (v) => {
      if (v === 'qadd') setTimeout(openQadd, 30);
      else if (v === 'suggest') { const n = suggestAll(); toast(n ? '幫你選好 ' + n + ' 件的詞條了' : '每一件都選過詞條了，沒有要改的'); }
      else if (v === 'max') { fillAllMax(); toast('詞條的數字都調到最大了'); }
      else if (v === 'best') equipBest();
      else if (v === 'off') unequipAll();
      else if (v === 'hero') setTimeout(() => openHeroPick($('#btn-tools')), 30);
      else if (v === 'reset') resetVault();
      else if (v === 'clear') clearVault();
    },
  });
}

/** 問要加到哪一格。八格全列出來，一格一顆 44px 的鈕，手機也點得到。 */
function askSlot(anchor) {
  const slots = ['w_main', 'w_off', 'head', 'body', 'arms', 'legs', 'ring', 'pend'];
  const names = slots.map(slotNameOf);
  openPop(anchor, {
    title: '要加到哪一格？', plain: true, options: names, cols: 2,
    onChange: (n) => addToVault(slots[names.indexOf(n)]),
  });
}

/**
 * 把倉庫裡 partKey 壞掉的武器補回去。
 *
 * 早期版本在「還沒選流派」時新增武器會留下 partKey: null，
 * 那種件查不到圖也查不到基礎屬性，畫面上是一整片紅色墨印。
 * 資料已經存在別人的 localStorage 裡了，所以載入時順手修 ——
 * 叫人自己一件件去編輯窗改不合理，而且他多半不知道要改什麼。
 *
 * 只補型別，不動套裝、階與詞條 —— 那些是玩家填的，不該被猜。
 */
function healVault() {
  const ok = new Set((C.weapons || []).map((w) => w.key));
  let n = 0;
  for (const r of ROLES) {
    for (const it of r.state.vault || []) {
      if (it.slot !== WEAPON_SLOT || ok.has(it.partKey)) continue;
      it.partKey = ((C.weapons || [])[0] || {}).key || null;
      n++;
    }
  }
  if (n) {
    persist();
    setTimeout(() => toast('有 ' + n + ' 件武器沒有兵器型別，已先當成「'
      + (((C.weapons || [])[0] || {}).name || '？') + '」—— 在編輯窗改「裝備類別」就好'), 400);
  }
}

/** 開一件新的進倉庫。slotId 是格位（w_main／head…），決定它是哪一類。 */
function addToVault(slotId) {
  const isW = slotId === 'w_main' || slotId === 'w_off';
  let partKey;
  if (isW) {
    // 武器的詞條清單按兵器型別查，所以要先有個型別。
    // 預設用流派這一格該用的那把 —— 九成情況是對的，不對再去編輯窗換。
    partKey = weaponKeyOf(S, IDX, slotId === 'w_main' ? 'main' : 'off')
      || (C.weapons[0] || {}).key;
  } else {
    partKey = ((C.gearSlots || []).find((g) => g.id === slotId) || {}).partKey;
  }
  const it = newItem(isW ? WEAPON_SLOT : slotId, partKey);
  S.vault.push(it);
  // 那一格空著就順手掛上 —— 新增完還要再點一次「裝上」太囉唆
  if (!itemOf(S, slotId)) equipItem(S, slotId, it.id);
  vaultBy = 'part';
  vaultFilter = isW ? 'weapon' : 'p:' + slotId;
  render();
  openEditItem(it);
  toast('已加進倉庫：' + slotNameOf(slotId));
}

/* 裝備浮層的內容。倉庫卡與左欄縮圖都掛這一份 ——
   縮圖原本只給了原生 title，那個提示長什麼樣由作業系統決定，
   跟這一頁完全不搭，而且拿不到詞條明細。 */
function gearTip(s) {
  const p = s.item || null;
  const conf = p || BLANK;
  const gb = baseOf(s.partKey);
  const set = conf.set && IDX[conf.set];
  const b = IDX[S.build];
  const base = gb ? (p && p.quality === 'purple' ? gb.purple : gb.gold) : [];
  const list = tuneRows(p);
  const filled = list.filter((r) => r.k && r.meta && Number.isFinite(r.v));

  const box = el('div');
  box.append(el('span', { className: 'band' }, [
    el('span', { textContent: (b ? b.name + ' · ' : '') + (set ? set.name : '未指定套裝') }),
    el('span', { className: 'q', textContent: p && p.quality === 'purple' ? '紫' : '金' }),
  ]));

  const head = el('div', { className: 'tip-head' });
  const art = img(gb && gb.img ? gb.img : s.img, s.part);
  art.className = 'art';
  head.append(art);
  // 標題是**名稱**，副標是**類型**。
  // 名稱的優先序：你自己取的 → 資料表那件的名字（流星含光）→ 最後才是格位名。
  // 「主武器」是位置不是名字，拿它當標題等於什麼都沒說 ——
  // 位置退到副標，不會不見：倉庫裡同部位擺兩件時還是得知道哪件掛在哪。
  head.append(el('div', { className: 'tip-h',  textContent: nameOf(p, s) }));
  head.append(el('p', {
    className: 'sub',
    // 浮層比卡片多一項「掛在哪一格」—— 卡片頂帶已經寫了，浮層沒有頂帶
    textContent: [
      slotLabel(s),
      s.isWeapon && s.name && s.name !== slotLabel(s) ? s.name : null,
      conf.tier ? conf.tier + '級' : '未填等級',
    ].filter(Boolean).join(' · '),
  }));
  box.append(head);

  if (base.length) {
    const sec = el('div', { className: 'sec' });
    for (const r of attrRows(base)) sec.append(r);
    box.append(sec);
  }

  const sec2 = el('div', { className: 'sec' });
  sec2.append(el('div', {
    className: 'lab',
    textContent: p ? '詞條　' + filled.length + ' / 6' : '詞條',
  }));
  if (!p) {
    sec2.append(el('p', { className: 'none', style: 'padding:0', textContent: '還沒填。點一下開編輯窗。' }));
  } else {
    for (const r of list) {
      const row = el('div', { className: 'arow ' + (r.kind === 'p' ? 'p' : 't') });
      if (!r.k || !r.meta) {
        row.classList.add('empty');
        row.append(el('span', { className: 'k', textContent: '未填' }));
      } else {
        const tone = rollTone(r.v, r.meta.max);
        if (tone) row.setAttribute('data-roll', String(tone));
        row.append(el('span', { className: 'k', textContent: r.meta.name }));
        row.append(el('span', { className: 'v' }, [
          document.createTextNode((Number.isFinite(r.v) ? fmtVal(r.v) : '–') + (r.meta.pct ? '%' : '')),
          el('span', { className: 'cap', textContent: '/ ' + fmtVal(r.meta.max) }),
        ]));
      }
      sec2.append(row);
    }
  }
  box.append(sec2);
  return box;
}

const attachGearTip = (node, s) => onHover(node, () => gearTip(s), {
  paper: true,
  q: s.item && s.item.quality === 'purple' ? 'purple' : 'gold',
});

/**
 * 倉庫裡的一件 → 一張卡。
 *
 * 跟舊版最大的差別：卡上要看得出**這件現在掛在哪一格、還是只是備著**。
 * 倉庫裡同一個部位會有好幾件，少了這個標示就分不出哪件是身上那件。
 */
function cardForItem(it, opts = {}) {
  const sm = slotMetaOf(it);
  const gb = baseOf(it.partKey);
  const set = it.set && IDX[it.set];
  // 預覽的那一份不在倉庫裡（是草稿），掛在哪一格要由外面告訴它
  const at = opts.preview ? (opts.at || null) : wornAt(it);
  const card = el('div', {
    className: 'ecard', role: 'group',
    'data-q': it.quality || 'gold',
    'data-side': sm.side,         // 武器／左四／右四，頂條用色分組
  });
  card.setAttribute('aria-label', nameOf(it, sm) + '，' + typeOf(sm)
    + (at ? '，已裝備在' + slotNameOf(at) : '，備在倉庫'));
  if (at) card.setAttribute('data-worn', '');
  if (SEL && at === SEL) card.setAttribute('data-sel', '');

  // hero：底黑、品質光暈拉滿，方案帶壓在最上面，名字與物件圖並排。
  const hero = el('div', { className: 'ecard-hero' });
  hero.append(el('span', { className: 'band' }, [
    el('span', { className: 'worn', textContent: at ? '已裝備 · ' + slotNameOf(at) : '備在倉庫' }),
    el('span', { className: 'setn', textContent: set ? set.name : '未指定套裝' }),
    el('span', { className: 'q', textContent: it.quality === 'purple' ? '紫' : '金' }),
  ]));
  // 大標題是**裝備位置**不是物品名：配裝要認的是「哪個洞」。
  // 同部位有好幾件時靠玩家自己下的備註（爆傷／減傷）分辨，那比物品名有用。
  // 主標＝名稱、副標＝類型。跟浮層同一套，兩邊走同一個 nameOf／typeOf，
  // 不會出現卡片寫「主武器」、浮層寫「流星羽林」這種各說各話。
  hero.append(el('span', { className: 'who' }, [
    el('b', { textContent: nameOf(it, sm) }),
    el('small', {
      textContent: [typeOf(sm), it.tier ? it.tier + '級' : '未填等級']
        .filter(Boolean).join(' · '),
    }),
  ]));
  // 卡面圖優先用 equipment/cards 那一份（防具只有那裡有）；武器兩種都有。
  hero.append(img(gb && gb.img ? gb.img : sm.img, sm.part));
  card.append(hero);

  // 基礎屬性（金／紫兩組數值不同）
  const base = el('div', { className: 'base' });
  const rows = gb ? (it.quality === 'purple' ? gb.purple : gb.gold) : [];
  if (rows.length) {
    for (const x of rows) {
      base.append(el('div', { className: 'arow' }, [
        el('span', { className: 'k', textContent: x.n }),
        el('span', { className: 'v', textContent: fmtVal(x.v) + (x.pct ? '%' : '') }),
      ]));
    }
  } else {
    base.append(el('div', { className: 'arow' }, [
      el('span', { className: 'k', textContent: '資料表沒有這個部位的基礎屬性' }),
    ]));
  }
  card.append(base);

  // 詞條
  const tunes = el('div', { className: 'tunes' });
  const list = tuneRows(it);
  list.forEach((r, i) => {
    const row = el('div', { className: 'arow ' + (r.kind === 'p' ? 'p' : 't') });
    if (!r.k || !r.meta) {
      row.classList.add('empty');
      row.append(el('span', {
        className: 'k',
        textContent: r.kind === 'p' ? '定音未填' : (i === 0 ? '首詞條未填' : '副詞條 ' + i + ' 未填'),
      }));
    } else {
      const tone = rollTone(r.v, r.meta.max);
      if (tone) row.setAttribute('data-roll', String(tone));
      row.append(el('span', { className: 'k', textContent: r.meta.name }));
      row.append(el('span', {
        className: 'v',
        textContent: Number.isFinite(r.v) ? fmtVal(r.v) + (r.meta.pct ? '%' : '') : '–',
      }));
    }
    tunes.append(row);
  });
  card.append(tunes);

  const filled = list.filter((r) => r.k && r.meta && Number.isFinite(r.v));
  const got = filled.reduce((n, r) => n + r.v, 0);
  const full = filled.reduce((n, r) => n + r.meta.max, 0);
  const pct = el('span', { className: 'pct', textContent: full > 0 ? (got / full * 100).toFixed(1) + '%' : '—' });
  if (!full) pct.setAttribute('data-low', '');
  card.append(el('div', { className: 'foot' }, [
    el('span', { textContent: filled.length + ' / 6 條' }), pct,
  ]));

  // 預覽到此為止：預覽裡不需要「裝上／刪除」，那是倉庫裡才有的動作。
  if (opts.preview) {
    card.classList.add('preview');
    return card;
  }

  // 動作列。卡片本身不再是一顆大按鈕 —— 一張卡現在有三件事可做，
  // 全塞進同一個點擊區的話，想刪的人只會不小心開到編輯窗。
  const act = el('div', { className: 'ecard-act' });
  for (const slotId of fitsOf(it)) {
    const here = at === slotId;
    const other = itemOf(S, slotId);
    const b2 = el('button', {
      className: 'act-gold', type: 'button',
      'data-focus-key': 'wear-item-' + it.id + '-' + slotId,
      // 武器兩格都掛得上，所以要標是哪一格；防具只有一格，標了是廢話。
      // 用「主／副」不用「主武器／副武器」—— 三顆鈕排開會換行。
      textContent: here ? '卸下' + (fitsOf(it).length > 1 ? ' ' + (slotId === 'w_main' ? '主' : '副') : '')
        : '裝上' + (fitsOf(it).length > 1 ? ' ' + (slotId === 'w_main' ? '主' : '副') : ''),
    });
    // 那一格已經有別件時先講清楚會換掉誰，不要默默頂掉
    if (!here && other) b2.title = slotNameOf(slotId) + ' 目前是「'
      + (IDX[other.set] ? IDX[other.set].name : '未指定套裝') + '」，會換成這件';
    on(b2, 'click', () => {
      if (here) unequip(S, slotId);
      else { equipItem(S, slotId, it.id); SEL = slotId; }
      render();
      [...$('#vault').querySelectorAll('button')].find(n => n.dataset.focusKey === b2.dataset.focusKey)?.focus({ preventScroll: true });
    });
    act.append(b2);
  }
  const ed = el('button', { className: 'act-ghost', type: 'button', textContent: '編輯', 'data-focus-key': 'edit-item-' + it.id });
  on(ed, 'click', () => openEditItem(it));
  act.append(ed);
  const del = el('button', { className: 'act-danger', type: 'button', textContent: '刪除' });
  del.setAttribute('aria-label', '刪除 ' + nameOf(it, sm));
  on(del, 'click', async () => {
    const msg = '從倉庫刪掉「' + nameOf(it, sm) + '（' + typeOf(sm) + '）'
      + (set ? '・' + set.name : '') + (it.tier ? ' ' + it.tier + '級' : '') + '」？'
      + String.fromCharCode(10) + '這件的六條詞條會一起消失，救不回來。';
    if (!await ask({ title: '確認', lines: String(msg).split(String.fromCharCode(10)),
      ok: '確定', danger: true })) return;
    removeItem(S, it.id);
    render();
    toast('已從倉庫刪除');
  });
  act.append(del);
  card.append(act);

  attachGearTip(hero, {
    ...sm, item: it,
    // 掛著就帶上是主是副；備在倉庫的不帶，標題會退回兵器型別
    role: at === 'w_main' ? '主' : at === 'w_off' ? '副' : null,
  });
  return card;
}

/**
 * 這個流派「在乎哪些屬性」。
 *
 * 依據是武學天賦：資料表裡每一門武學都明說了需求屬性與它換到的額外屬性
 * （例：勢 462 → 最大外功攻擊 122）。那是遊戲自己講的，不是我猜的。
 * 工具站另有一套 T0/T1/T2 的建議規則，但那是一組會算的程式而不是平表，
 * 照抄等於跑它的程式碼 —— 不做。
 *
 * 回傳的是有序的 key 清單，愈前面愈想要。
 */
function wantedStats() {
  const b = IDX[S.build];
  const want = [];
  const push = (k) => { if (k && !want.includes(k)) want.push(k); };
  for (const mk of (b ? b.martials : [])) {
    const m = IDX[mk];
    if (!m) continue;
    for (const t of m.talents || []) { push(t.need.k); push(t.gain.k); }
    for (const a of m.attr || []) push(a.k);
  }
  // 心法給的屬性也算 —— 你都選了它，顯然是想往那邊堆
  for (const x of S.minds) {
    if (!x || !x.key) continue;
    for (const a of (C.mindAttr || {})[x.key] || []) push(a.k);
  }
  return want;
}

/**
 * 給一件裝備一組建議詞條，並填上基準值。
 *
 * 先挑流派在乎的，不夠再用上限大的補。填基準值不填上限 ——
 * 上限是「滾到完美」，拿它當預設會讓每個人的畢業率都是 100%，那個數字就沒意義了。
 * 這是起點不是答案：填完之後照著自己那件改。
 */
function suggestPiece(s, piece) {
  const want = wantedStats();
  const rank = (t) => {
    const i = want.indexOf(t.key);
    return i >= 0 ? i : 500 + (1 / (t.max || 1));
  };
  const pick = (pool, used) => pool
    .filter((t) => !used.has(t.key))
    .sort((a, b) => rank(a) - rank(b))[0] || null;

  const used = new Set();
  const firsts = tuningsFor(C, s.partKey, 'first');
  const f = pick(firsts, used);
  if (f) { piece.first = { k: f.key, v: f.base }; used.add(f.key); }

  const secs = tuningsFor(C, s.partKey, 'sec');
  for (let i = 0; i < 4; i++) {
    const t = pick(secs, used);
    if (!t) break;
    piece.sec[i] = { k: t.key, v: t.base, carry: false };
    used.add(t.key);
  }

  const ps = pitchesFor(C, s.partKey);
  const p = ps.slice().sort((a, b) => rank(a) - rank(b))[0];
  if (p) piece.pitch = { k: p.key, v: p.max };   // 定音沒有基準值，只有上限
  return piece;
}

/** 把所有還沒填的格子套上建議。已經填過的不動 —— 那是你自己決定的東西。 */
function suggestAll() {
  let n = 0;
  for (const s of allSlots(S, C, IDX)) {
    if (s.item && tuneRows(s.item).some((r) => r.k)) continue;
    // 這一格空著就順手開一件進倉庫 —— 「套用建議」的用意就是一鍵有個起點
    const it = ensureItem(s);
    suggestPiece(s, it);
    if (!it.tier) it.tier = 110;        // 實務上的常見值，當起點
    n++;
  }
  return n;
}

/** 把已經選了詞條的格子一次拉到上限。沒選詞條的不動 —— 那是玩家還沒決定的事。 */
function fillAllMax() {
  const tM = new Map(C.tunings.map((t) => [t.key, t]));
  const pM = new Map(C.pitches.map((p) => [p.key, p]));
  // 整個倉庫都滾滿，不只掛著的那八件 —— 備著的那幾件也是要拿來比的
  for (const p of S.vault) {
    if (p.first.k && tM.has(p.first.k)) p.first.v = tM.get(p.first.k).max;
    for (const x of p.sec) if (x.k && tM.has(x.k)) x.v = tM.get(x.k).max;
    if (p.pitch.k && pM.has(p.pitch.k)) p.pitch.v = pM.get(p.pitch.k).max;
  }
}

/* 武學加成與武學天賦。
   加成是固定值；天賦是「你的某個屬性到門檻了沒」——
   生效率 ＝ 你的需求屬性 ÷ 門檻（上限 100%），再乘到額外屬性上。
   驗算過：勢 283 ÷ 462 = 61.26%，額外 122 × 61.26% = 74.74，跟遊戲畫面一致。

   **算出來的額外屬性不回灌總計。** 天賦吃的是總屬性，總屬性又會被天賦加大，
   那是一個循環；要收斂得知道遊戲怎麼迭代，而那個規則不在資料裡。
   所以這裡只呈現「以目前總屬性計，這條天賦生效多少」，不替它再算一輪。 */
function martialTip(m) {
  const A = computeAttrs(S, C, IDX);
  const have = new Map(A.total.map((r) => [r.k, r.v]));
  const box = el('div');
  box.append(el('div', { className: 'tip-h',  textContent: m.name }));
  box.append(el('p', { className: 'sub', textContent: m.weapon + (S.martials[m.key] ? ' · 等級 ' + S.martials[m.key] : '') }));

  if (m.attr && m.attr.length) {
    const sec = el('div', { className: 'sec' });
    sec.append(el('div', { className: 'lab', textContent: '武學加成' }));
    for (const r of attrRows(m.attr)) sec.append(r);
    box.append(sec);
  }

  if (!m.talents || !m.talents.length) {
    box.append(el('p', { className: 'none', textContent: '數值表裡沒有這一門的天賦資料。' }));
    return box;
  }
  const sec = el('div', { className: 'sec' });
  sec.append(el('div', { className: 'lab', textContent: '武學天賦' }));
  m.talents.forEach((t, i) => {
    const mine = have.get(t.need.k) || 0;
    const rate = t.need.v > 0 ? Math.min(1, mine / t.need.v) : 0;
    const row = el('div', { className: 'tal' });
    if (i) row.setAttribute('data-sep', '');
    row.append(el('div', { className: 'arow' }, [
      el('span', { className: 'k', textContent: '需求屬性' }),
      el('span', { className: 'v' }, [
        document.createTextNode(t.need.n + '　' + fmtVal(mine) + (t.need.pct ? '%' : '')),
        el('span', { className: 'cap', textContent: '/ ' + fmtVal(t.need.v) }),
      ]),
    ]));
    row.append(el('div', { className: 'arow' }, [
      el('span', { className: 'k', textContent: '額外屬性' }),
      el('span', { className: 'v' }, [
        document.createTextNode(t.gain.n + '　' + fmtVal(t.gain.v * rate) + (t.gain.pct ? '%' : '')),
        el('span', { className: 'cap', textContent: '/ ' + fmtVal(t.gain.v) }),
      ]),
    ]));
    const pct = el('div', { className: 'arow rate' }, [
      el('span', { className: 'k', textContent: '生效率' }),
      el('span', { className: 'v', textContent: (rate * 100).toFixed(2) + '%' }),
    ]);
    if (rate >= 1) pct.setAttribute('data-full', '');
    row.append(pct);
    sec.append(row);
  });
  box.append(sec);
  return box;
}

/* 套裝加成。單獨列出來是因為它跟詞條的性質不同 ——
   詞條是你自己滾出來的，套裝是「湊齊就給」，看的時候要分得開。
   件數也要標：時雨 ×4 跟 時雨 ×1 給的東西不一樣，但資料表只給一組值，
   所以這裡只誠實列出「你在幾件上選了這套」，不替它算門檻。 */
function setBonusTip() {
  const used = new Map();
  for (const s of allSlots(S, C, IDX)) {
    const conf = confOf(s);
    if (!conf.set) continue;
    const meta = IDX[conf.set];
    if (!meta) continue;
    const row = used.get(conf.set) || { meta, n: 0 };
    row.n += 1;
    used.set(conf.set, row);
  }
  const box = el('div');
  box.append(el('div', { className: 'tip-h',  textContent: '套裝加成' }));
  box.append(el('p', {
    className: 'sub',
    textContent: used.size ? '合併列出目前選到的套裝' : '還沒選任何套裝',
  }));
  if (!used.size) {
    box.append(el('p', { className: 'none', textContent: '在裝備卡的編輯窗選套裝，這裡就會列出來。' }));
    return box;
  }
  for (const { meta, n } of used.values()) {
    const sec = el('div', { className: 'sec' });
    sec.append(el('p', { className: 'grp', textContent: meta.name + '　×' + n }));
    if (meta.attr && meta.attr.length) {
      for (const r of attrRows(meta.attr)) sec.append(r);
    } else {
      sec.append(el('p', {
        className: 'none', style: 'padding:0',
        textContent: '數值表裡沒有這一套的效果值。',
      }));
    }
    box.append(sec);
  }
  return box;
}

/* ── 屬性來源明細 ─────────────────────────────────────────────────────────
   「匯總屬性」只給一個數字，看不出那 1369 是誰堆出來的。這裡拆回四層：

       武學    兩門武學各自的加成，外加天賦補正
       心法    四格各自加什麼
       套裝    湊了幾件、給什麼；弓箭套裝與武庫也算這一層
       裝備    詞條小計（首／副／定音）與各部位的基礎屬性

   **武學那一層不進「匯總屬性」。** 這是既有的決定，不是這裡改的：
   天賦吃的是總屬性，總屬性又會被天賦放大，那是一個迴圈，
   要收斂得知道遊戲怎麼迭代，而那條規則不在資料表裡。所以武學只呈現，不回灌。
   板子上會寫清楚，免得有人拿去對帳對不起來。 */
const srcModal = $('#src');
const closeSrc = () => hideOverlay(srcModal);

/** 一列：左名稱、右數值。pct 的補上 %，另外可以掛一段灰色小字。 */
function srcRow(name, v, pct, sub, isPitch) {
  const val = el('span', { className: 'v' }, [
    document.createTextNode(fmtVal(v) + (pct ? '%' : '')),
    sub ? el('span', { className: 'sub', textContent: sub }) : null,
  ]);
  const row = el('div', { className: 'srow' }, [
    el('span', { className: 'k', textContent: name }), val,
  ]);
  if (isPitch) row.setAttribute('data-p', '');
  return row;
}

function srcPanel(title, hint, tags) {
  const p = el('div', { className: 'spanel' });
  p.append(el('div', { className: 'spanel-h' }, [
    el('div', { className: 'tip-h',  textContent: title }),
    hint ? el('span', { className: 'hint2', textContent: hint }) : null,
    (tags && tags.length)
      ? el('div', { className: 'tags' }, tags.map((t) => el('span', { textContent: t })))
      : null,
  ]));
  return p;
}

function srcGroup(host, name, tag) {
  const g = el('div', { className: 'sgrp' });
  g.append(el('div', { className: 'sgrp-h' }, [
    el('b', { textContent: name }),
    tag ? el('small', { textContent: tag }) : null,
  ]));
  host.append(g);
  return g;
}

function drawSrc() {
  const A = computeAttrs(S, C, IDX);
  const have = new Map(A.total.map((r) => [r.k, r.v]));
  const body = $('#src-body');
  body.textContent = '';

  // ── 武學 ────────────────────────────────────────────────────────────
  const b = IDX[S.build];
  const arts = (b ? b.martials : []).map((k) => IDX[k]).filter(Boolean);
  const wp = srcPanel('武學', '這個流派配的兩門武學，以及天賦補正', arts.map((m) => m.name));
  if (!arts.length) {
    wp.append(el('p', { className: 'none', textContent: '還沒選流派。' }));
  } else {
    arts.forEach((m, i) => {
      const g = srcGroup(wp, m.name, '武學 ' + (i + 1));
      if (!(m.attr || []).length) g.append(el('p', { className: 'none', textContent: '資料表沒有這一門的加成。' }));
      for (const a of m.attr || []) g.append(srcRow(a.n, a.v, a.pct));
    });
    // 天賦補正：生效率 ＝ 你的需求屬性 ÷ 門檻（封頂 100%），再乘到額外屬性上
    const tl = arts.flatMap((m) => m.talents || []);
    const g = srcGroup(wp, '武學天賦補正', tl.length ? '照目前總屬性計' : '');
    if (!tl.length) {
      g.append(el('p', { className: 'none', textContent: '資料表沒有這兩門的天賦。' }));
    } else {
      for (const t of tl) {
        const rate = t.need.v > 0 ? Math.min(1, (have.get(t.need.k) || 0) / t.need.v) : 0;
        g.append(srcRow(t.gain.n, t.gain.v * rate, t.gain.pct,
          '生效 ' + (rate * 100).toFixed(1) + '%　需 ' + t.need.n + ' ' + fmtVal(t.need.v)));
      }
    }
    wp.append(el('p', {
      className: 'none', style: 'margin-top:9px',
      textContent: '武學這一層不算進「匯總屬性」：天賦吃總屬性、總屬性又被天賦放大，'
        + '那是一個迴圈，遊戲怎麼迭代不在資料表裡，所以只呈現不回灌。',
    }));
  }
  body.append(wp);

  // ── 心法 ────────────────────────────────────────────────────────────
  const minds = S.minds.filter((m) => m && m.key);
  const mp = srcPanel('心法', '四格各自加什麼', minds.map((m) => m.name));
  if (!minds.length) {
    mp.append(el('p', { className: 'none', textContent: '四格都還沒填。' }));
  } else {
    minds.forEach((m) => {
      const rows = (C.mindAttr || {})[m.key] || [];
      const i = S.minds.indexOf(m);
      const g = srcGroup(mp, m.name, (i === 0 ? '主修' : '副修') + (m.lv ? '　' + m.lv + '★' : ''));
      if (!rows.length) g.append(el('p', { className: 'none', textContent: '資料表沒有這張的數值。' }));
      for (const a of rows) g.append(srcRow(a.n, a.v, a.pct));
    });
  }
  body.append(mp);

  // ── 套裝（含弓箭套裝與武庫）────────────────────────────────────────
  const used = new Map();
  for (const s of allSlots(S, C, IDX)) {
    const set = confOf(s).set;
    if (!set || !IDX[set]) continue;
    const r = used.get(set) || { meta: IDX[set], n: 0 };
    r.n += 1;
    used.set(set, r);
  }
  const bow = S.bow && (C.sets || []).find((x) => x.key === S.bow);
  const ars = S.arsenal && (C.arsenals || []).find((x) => x.key === S.arsenal);
  const tags = [...used.values()].map((r) => r.meta.name + ' ×' + r.n);
  if (bow) tags.push('弓 ' + bow.name);
  if (ars) tags.push('武庫 ' + ars.name);
  const sp = srcPanel('套裝', '湊齊就給的那一層，不是你滾出來的', tags);
  if (!used.size && !bow && !ars) {
    sp.append(el('p', { className: 'none', textContent: '沒有指定套裝，也沒有選弓與武庫。' }));
  } else {
    for (const r of used.values()) {
      // **一件算一次。** computeAttrs 就是這樣加的（掛在幾件上就加幾次），
      // 這裡把乘法攤開來寫，明細才跟「匯總屬性」對得起來 ——
      // 只列一份的話，同一頁會出現兩個不一樣的精準率。
      const g = srcGroup(sp, r.meta.name, '掛在 ' + r.n + ' 件上');
      for (const a of r.meta.attr || []) {
        g.append(srcRow(a.n, a.v * r.n, a.pct,
          r.n > 1 ? '每件 ' + fmtVal(a.v) + (a.pct ? '%' : '') + ' × ' + r.n + ' 件' : ''));
      }
    }
    if (bow) {
      const g = srcGroup(sp, bow.name, '弓箭套裝');
      for (const a of bow.attr || []) g.append(srcRow(a.n, a.v, a.pct));
    }
    if (ars) {
      const g = srcGroup(sp, ars.name, '武庫');
      for (const a of ars.attr || []) g.append(srcRow(a.n, a.v, a.pct));
    }
  }
  body.append(sp);

  // ── 裝備 ────────────────────────────────────────────────────────────
  const idealBy = new Map(A.ideal.map((r) => [r.k, r.v]));
  const ep = srcPanel('裝備屬性', '詞條小計與各部位的基礎屬性',
    [A.filled + ' / ' + A.slots + ' 條已填']);
  if (!A.tune.length && !A.gear.length) {
    ep.append(el('p', { className: 'none', textContent: '八格都還沒掛東西。' }));
  } else {
    const g1 = srcGroup(ep, '詞條小計', '首、副、定音加起來');
    if (!A.tune.length) {
      g1.append(el('p', { className: 'none', textContent: '一條詞條都還沒填。' }));
    } else {
      for (const r of A.tune) {
        g1.append(srcRow(r.n + '　×' + r.count, r.v, r.pct,
          idealBy.has(r.k) ? '滾滿 ' + fmtVal(idealBy.get(r.k)) + (r.pct ? '%' : '') : ''));
      }
    }
    // 基礎屬性照部位一格一格列，不併起來 —— 要看得出是哪一件給的
    const baseByPart = new Map((C.gearBase || []).map((x) => [x.key, x]));
    for (const s of allSlots(S, C, IDX)) {
      const p = s.item;
      if (!p) continue;
      const gb = baseByPart.get(p.partKey || s.partKey);
      const rows = gb ? (p.quality === 'purple' ? gb.purple : gb.gold) : [];
      if (!rows.length) continue;
      const g = srcGroup(ep, nameOf(p, slotMetaOf(p)),
        slotNameOf(s.id) + '　' + (p.quality === 'purple' ? '紫' : '金')
          + (p.tier ? '　' + p.tier + ' 級' : ''));
      for (const a of rows) g.append(srcRow(a.n, a.v, a.pct));
    }
  }
  body.append(ep);
}

function openSrc() {
  drawSrc();
  showOverlay(srcModal);
}


/* ── 手機外殼 ─────────────────────────────────────────────────────────────
   量出來的問題（390px）：整頁 10323px ＝ 12.2 屏，右欄在 y=8838 幾乎到不了，
   頁首換四行吃掉 17% 的視窗，而且**整頁沒有一個連結回得去主站**。

   做法：手機上一次只看一區，底下一排切換（拇指構得到）。
   四區就是原本的三欄 —— 右欄本身已經有戰力／目標／報名三個分頁，不再切一次。 */
const SECS = [['gear', '配裝'], ['vault', '倉庫'], ['power', '戰力']];
const SEC_KEY = 'lunjian.loadout.sec';
const mq = matchMedia('(max-width:900px)');
let SEC = 'gear';

function showSec(k) {
  SEC = SECS.some((x) => x[0] === k) ? k : 'gear';
  try { localStorage.setItem(SEC_KEY, SEC); } catch { /* 存不了就算了 */ }
  $('#main').setAttribute('data-sec', SEC);
  for (const b of $('#secbar').children) b.toggleAttribute('data-on', b.dataset.k === SEC);
  // 換區等於換頁，捲軸要回到頂 —— 不然會停在上一區捲到一半的位置
  scrollTo({ top: 0, behavior: 'instant' });
}

/** 分區列上的數字：倉庫幾件、裝備幾格填滿。看得到進度才知道還差什麼。 */
function secCounts() {
  const bar = $('#secbar');
  if (!bar || !bar.children.length) return;
  const n = { vault: (S.vault || []).length, gear: Object.keys(S.equip || {}).length };
  for (const b of bar.children) {
    const tag = b.querySelector('.n');
    if (!tag) continue;
    tag.textContent = b.dataset.k === 'vault' ? String(n.vault)
      : b.dataset.k === 'gear' ? n.gear + '/8' : '';
  }
}

function buildShell() {
  // Return directly to the duel in the same event, including direct editor entry.
  const params = new URLSearchParams(location.search);
  const target = new URL(location.pathname.includes('/lab/') ? 'lunjian-layout.html' : '/', location.href);
  for (const key of ['sportsEvent', 'slug', 'preview', 'stage', 'mode', 'view']) {
    const value = params.get(key);
    if (value) target.searchParams.set(key, value);
  }
  target.searchParams.set('intro', '0');
  target.hash = 'duel';
  for (const a of [$('#home'), $('#navhome'), $('#return-duel')]) if (a) {
    a.href = target.href;
    a.setAttribute('aria-label', '返回比武');
    on(a, 'click', event => {
      if (saveT && !flushSave()) { event.preventDefault(); $('#storage-retry').focus(); }
    });
  }

  // ⋯ 選單（只有手機看得到；桌機那四顆本來就排得下）
  const more = $('#btn-more');
  const acts = $('#acts');
  on(more, 'click', (e) => {
    e.stopPropagation();
    const open = acts.toggleAttribute('data-open');
    more.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // 點到選單裡的按鈕、或點外面，都要收起來
  on(acts, 'click', () => {
    acts.removeAttribute('data-open');
    more.setAttribute('aria-expanded', 'false');
  });
  on(document, 'click', () => {
    if (!acts.hasAttribute('data-open')) return;
    acts.removeAttribute('data-open');
    more.setAttribute('aria-expanded', 'false');
  });

  // 分區列
  const bar = $('#secbar');
  bar.replaceChildren();
  for (const [k, n] of SECS) {
    const b = el('button', { type: 'button', 'data-k': k }, [
      el('span', { textContent: n }), el('span', { className: 'n' }),
    ]);
    on(b, 'click', () => showSec(k));
    bar.append(b);
  }
  try { SEC = localStorage.getItem(SEC_KEY) || 'gear'; } catch { SEC = 'gear'; }

  /* 只有窄螢幕才分區。桌機三欄同時看得到，切分區只會把資訊藏起來。
     視窗被拉寬／拉窄時要跟著切換，不是只在載入時判斷一次。 */
  const applyWidth = () => {
    const narrow = mq.matches;
    bar.toggleAttribute('data-on', narrow);
    bar.hidden = !narrow;
    more.hidden = !narrow;
    if (narrow) showSec(SEC);
    else {
      $('#main').removeAttribute('data-sec');
      acts.removeAttribute('data-open');
    }
  };
  on(mq, 'change', applyWidth);
  applyWidth();
}


/* ── 右欄分頁與說明收合 ───────────────────────────────────────────────────
   2026-09-18 設計定案的兩件事（見 DESIGN_MEMORY.md）：

   分頁    右欄原本三張卡疊起來 1472px，視窗只有 1000px，永遠有東西看不到。
   ⓘ      每張卡底下那段灰字是第一次看才需要的，不該天天佔六行。
           收進標題列，點了才展開；展開狀態記在 localStorage，
           因為「我想一直看著這段」也是合理的偏好。 */
const PANES = [['power', '戰力'], ['goal', '目標'], ['sheet', '準備報名']];
const PANE_KEY = 'lunjian.loadout.pane';
let PANE = 'power';

function showPane(k) {
  PANE = PANES.some((p) => p[0] === k) ? k : 'power';
  try { localStorage.setItem(PANE_KEY, PANE); } catch { /* 存不了就算了 */ }
  for (const b of $('#rtabs').children) { b.toggleAttribute('data-on', b.dataset.k === PANE); b.setAttribute('aria-selected', String(b.dataset.k === PANE)); }
  for (const c of document.querySelectorAll('.col-3 > .card[data-pane]')) {
    c.toggleAttribute('data-on', c.dataset.pane === PANE);
  }
}

function buildPanes() {
  const host = $('#rtabs');
  if (!host) return;
  host.replaceChildren();
  for (const [k, n] of PANES) {
    const b = el('button', { type: 'button', textContent: n, 'data-k': k, role: 'tab' });
    on(b, 'click', () => showPane(k));
    host.append(b);
  }
  try { PANE = localStorage.getItem(PANE_KEY) || 'power'; } catch { PANE = 'power'; }
  showPane(PANE);
}

/* 把卡片底下那段 .hint 收進標題列的 ⓘ。
   不改標記、不改文案 —— 就地把既有的那一段藏起來，掛一顆鈕去開它。
   這樣文案還是只有一份，不會有「說明改了但收合版沒改」的事。 */
const WHY_KEY = 'lunjian.loadout.why';
let WHY = new Set();
function foldHints() {
  document.querySelectorAll('.why').forEach(n => n.remove());
  try { WHY = new Set(JSON.parse(localStorage.getItem(WHY_KEY) || '[]')); } catch { WHY = new Set(); }
  // 用 .card 起手不用 h2 起手：裝備倉庫那張卡的 h2 包在 .vault-head 裡面，
  // 從 h2 往上抓 parentElement 會抓到那層 div，找不到底下的 .hint。
  document.querySelectorAll('.col .card').forEach((card, i) => {
    const h2 = card.querySelector('h2');
    if (!h2) return;
    const hint = [...card.children].find((x) => x.classList.contains('hint') && x.id !== 'radar-empty' && x.id !== 'reg-why');
    if (!hint || h2.querySelector('.why')) return;
    const id = card.dataset.pane || (card.querySelector('[id]') || {}).id || ('c' + i);
    const open = WHY.has(id);
    hint.hidden = !open;
    const b = el('button', {
      className: 'why', type: 'button', textContent: 'ⓘ',
      'aria-label': '這一塊在算什麼', 'aria-expanded': open ? 'true' : 'false',
    });
    if (open) b.setAttribute('data-on', '');
    on(b, 'click', () => {
      const now = hint.hidden;
      hint.hidden = !now;
      b.toggleAttribute('data-on', now);
      b.setAttribute('aria-expanded', now ? 'true' : 'false');
      if (now) WHY.add(id); else WHY.delete(id);
      try { localStorage.setItem(WHY_KEY, JSON.stringify([...WHY])); } catch { /* 算了 */ }
    });
    h2.append(b);
  });
}


// ── 屬性彙總與雷達 ───────────────────────────────────────────────────────
let attrAll = false;

function renderTotals() {
  const A = computeAttrs(S, C, IDX);

  const ga = $('#gear-attr');
  ga.textContent = '';
  if (!A.tune.length) {
    ga.append(el('p', { className: 'hint', textContent: '還沒填任何詞條。點中欄的裝備卡開始。' }));
  } else {
    const idealBy = new Map(A.ideal.map((r) => [r.k, r.v]));
    const LR = levelResist(C);
    for (const r of (attrAll ? A.tune : A.tune.slice(0, 8))) {
      // 會心／會意／精準要換算成「實際生效多少」。這一塊走 gear 那條規則
      //（三個都是純除法），匯總屬性那一塊才有精準率前 65 不打折的例外。
      const rate = rateOf(r.k, r.v, LR, 'gear');
      ga.append(el('div', { className: 'tot' }, [
        el('span', { className: 'k' }, [
          document.createTextNode(r.n),
          el('span', { className: 'n', textContent: '　×' + r.count }),
        ]),
        el('span', { className: 'v' }, [
          document.createTextNode(fmtVal(r.v) + (r.pct ? '%' : '')),
          rate
            ? el('span', { className: 'conv', textContent: '（' + fmtVal(rate.shown) + '%）' })
            : (idealBy.has(r.k)
                ? el('span', {
                    className: 'ideal',
                    textContent: '（' + fmtVal(idealBy.get(r.k)) + (r.pct ? '%' : '') + '）',
                  })
                : null),
        ]),
      ]));
    }
  }

  const more = $('#attr-more');
  more.hidden = A.tune.length <= 8;
  more.textContent = attrAll ? '收合' : '查看更多（' + A.tune.length + '）';

  $('#grad').textContent = A.grad === null ? '–' : (A.grad * 100).toFixed(2) + '%';
  $('#gradbar').style.width = (A.grad === null ? 0 : A.grad * 100) + '%';

  const to = $('#totals');
  to.textContent = '';
  if (A.total.length) {
    to.append(el('div', { className: 'ed-lab', textContent: '匯總屬性' }));
    // 條列另外包一層：斑馬紋走 nth-child，標題混在同一層會把單雙數錯開一格
    const list = el('div');
    const LR2 = levelResist(C);
    for (const r of A.total.slice(0, 14)) {
      // 這一塊走 total：精準率前 65 點不打折，超過上限的部分標成「溢出」
      const rate = rateOf(r.k, r.v, LR2, 'total');
      list.append(el('div', { className: 'tot' }, [
        el('span', { className: 'k', textContent: r.n }),
        el('span', { className: 'v' }, [
          document.createTextNode(fmtVal(r.v) + (r.pct ? '%' : '')),
          rate
            ? el('span', {
                className: 'conv', 'data-over': rate.over > 0 || undefined,
                textContent: '（' + fmtVal(rate.shown) + '%'
                  + (rate.over > 0 ? '，溢出 ' + fmtVal(rate.over) + '%' : '') + '）',
              })
            : null,
        ]),
      ]));
    }
    to.append(list);
  }
  renderRadar(A);
}

/* 雷達的六個軸是挑出來的、算得出來的六項。
   工具站那張用的是「外功期望」這類推導值，那要完整的傷害公式，
   公式不在資料表裡 —— 與其套一條猜的公式，不如畫六條真的。
   對照組是「同樣的詞條選擇但每條都滾滿」，所以它讀的是滾動品質，
   不是「你配得夠不夠好」。 */
const RADAR_AXES = [
  { k: 'MAX_EXTERNAL_ATTACK', n: '外功攻擊' },
  { k: 'CRITICAL_RATE', n: '會心率' },
  { k: 'CRITICAL_DAMAGE', n: '會心傷害' },
  { k: 'ACCURACY_RATE', n: '精準率' },
  { k: 'EXTERNAL_PENETRATION', n: '外功穿透' },
  { k: 'INSIGHT_RATE', n: '會意率' },
];

/* ── 屬性目標 ─────────────────────────────────────────────────────────
   「畢業率」回答的是「已有的裝備滾得好不好」，答不了「這樣夠不夠打」。
   夠不夠是跟**一個目標**比出來的，而那個目標只有你自己知道 ——
   打什麼副本、跟誰組隊、要卡哪條線。所以目標是你填的，這裡不給預設值。

   （工具站有現成的目標表，但那 26 份全掛 by@Violetta，是他的研究成果。
     格式可以學，數字不該搬。） */
function renderGoals() {
  const host = $('#goals');
  host.textContent = '';
  const G = goalProgress(S, C, IDX);

  $('#goal-cap').textContent = G.rows.length
    ? G.done + ' / ' + G.rows.length + ' 條達標' : '尚未設定';
  const head = $('#goal-rate');
  head.textContent = G.rate == null ? '–' : (G.rate * 100).toFixed(1) + '%';
  $('#goalbar').style.width = G.rate == null ? '0' : (G.rate * 100).toFixed(1) + '%';

  if (!G.rows.length) {
    host.append(el('p', { className: 'hint',
      textContent: '還沒設目標。先按「加入屬性」挑幾條你在乎的，'
        + '或按「用目前數值帶入」把現在的數字當起點再往上調。' }));
  }

  for (const r of G.rows) {
    const row = el('div', { className: 'goal' });
    if (r.rate >= 1) row.setAttribute('data-done', '');
    row.append(el('span', { className: 'gk', textContent: r.n }));

    const num = el('input', {
      type: 'number', className: 'gv', value: String(r.goal), min: '0', step: 'any',
      'aria-label': r.n + ' 的目標值',
    });
    on(num, 'change', () => {
      const v = Number(num.value);
      const g = S.goals.find((x) => x.k === r.k);
      if (g) g.v = Number.isFinite(v) && v > 0 ? v : g.v;
      render();
    });
    row.append(num);

    row.append(el('span', { className: 'gnow',
      textContent: fmtVal(r.now) + (r.pct ? '%' : '') }));
    const bar = el('span', { className: 'gbar' }, [
      el('i', { style: 'width:' + (r.rate * 100).toFixed(1) + '%' }),
    ]);
    row.append(bar);
    row.append(el('span', { className: 'gpct',
      textContent: r.rate >= 1 ? '達標'
        : r.short < 0.05 ? '差一點'      // 「差 0.0」是沒有資訊的顯示
        : '差 ' + fmtVal(r.short) + (r.pct ? '%' : '') }));

    const del = el('button', { className: 'gx', type: 'button', textContent: '×' });
    del.setAttribute('aria-label', '移除目標 ' + r.n);
    on(del, 'click', () => {
      S.goals = S.goals.filter((x) => x.k !== r.k);
      render();
    });
    row.append(del);
    host.append(row);
  }
}

/** 挑一條屬性加進目標。清單走資料表，有現在數值的排前面 —— 那才是你配得出來的。 */
function openGoalPicker() {
  const A = computeAttrs(S, C, IDX);
  const cur = new Map(A.total.map((r) => [r.k, r.v]));
  const has = new Set((S.goals || []).map((g) => g.k));
  const items = (C.stats || [])
    .filter((x) => !has.has(x.key))
    .map((x) => ({
      key: x.key, name: x.name, pct: x.pct,
      now: cur.get(x.key) || 0,
      sub: cur.has(x.key) ? '目前 ' + fmtVal(cur.get(x.key)) + (x.pct ? '%' : '') : '目前沒有這條',
    }))
    .sort((a, b) => (b.now > 0) - (a.now > 0) || b.now - a.now);
  openPick({
    title: '加入屬性目標', wide: true,
    note: '目標是你自己訂的 —— 打什麼副本、卡哪條線，只有你知道。'
      + '挑好之後在面板上直接改數字。',
    items,
    custom: false,
    onPick: (r) => {
      // 預設帶現在的值當起點，沒有就 0；反正你一定會自己改
      // 捨去不是四捨五入：進位會讓目標比現在的值高一點點，
      // 結果一帶入就顯示「差 0.0」，看起來像壞掉。
      S.goals.push({ k: r.key, v: r.now > 0 ? Math.floor(r.now * 10) / 10 : 100 });
    },
  });
}

/** 把現在的數值一次帶進所有目標，當成起點再往上調。 */
function seedGoals() {
  const A = computeAttrs(S, C, IDX);
  if (!A.total.length) { toast('還沒有任何屬性，先配一點裝備'); return; }
  const top = A.total.slice(0, 6);
  for (const r of top) {
    const g = S.goals.find((x) => x.k === r.k);
    const v = Math.floor(r.v * 10) / 10;   // 同理，捨去
    if (g) g.v = v; else S.goals.push({ k: r.k, v });
  }
  render();
  toast('已用目前數值帶入 ' + top.length + ' 條，接著自己往上調');
}

function renderRadar(A) {
  const svg = $('#radar');
  svg.textContent = '';
  const hasValues = A.total.some(r => r.v > 0) || A.ideal.some(r => r.v > 0);
  svg.toggleAttribute('hidden', !hasValues);
  $('#radar-empty').hidden = hasValues;
  $('.legend').hidden = !hasValues;
  if (!hasValues) return;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };
  const cx = 130, cy = 104, R = 70;
  const cur = new Map(A.total.map((r) => [r.k, r.v]));
  const idl = new Map(A.ideal.map((r) => [r.k, r.v]));
  for (const r of A.gear) idl.set(r.k, (idl.get(r.k) || 0) + r.v);
  for (const r of A.mind) idl.set(r.k, (idl.get(r.k) || 0) + r.v);

  const pt = (i, f) => {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  // 網格
  for (const f of [0.25, 0.5, 0.75, 1]) {
    svg.append(mk('polygon', {
      points: RADAR_AXES.map((_, i) => pt(i, f).join(',')).join(' '),
      fill: 'none', stroke: '#ffffff', 'stroke-opacity': f === 1 ? 0.18 : 0.08, 'stroke-width': 1,
    }));
  }
  for (let i = 0; i < 6; i++) {
    const [x, y] = pt(i, 1);
    svg.append(mk('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: '#ffffff', 'stroke-opacity': 0.09 }));
  }
  const frac = (map, ax) => {
    const hi = Math.max(idl.get(ax.k) || 0, cur.get(ax.k) || 0);
    return hi > 0 ? Math.min(1, (map.get(ax.k) || 0) / hi) : 0;
  };
  const poly = (map, stroke, opacity, dash) => {
    const pts = RADAR_AXES.map((ax, i) => pt(i, Math.max(0.02, frac(map, ax))).join(',')).join(' ');
    const g = mk('polygon', {
      points: pts, fill: stroke, 'fill-opacity': opacity, stroke, 'stroke-width': 1.6,
      'stroke-linejoin': 'round',
    });
    if (dash) g.setAttribute('stroke-dasharray', dash);
    svg.append(g);
    // 頂點小圓：折線在低值處會擠成一團，點出來才看得出每個軸各自到哪
    RADAR_AXES.forEach((ax, i) => {
      const [x, y] = pt(i, Math.max(0.02, frac(map, ax)));
      svg.append(mk('circle', { cx: x, cy: y, r: 2.2, fill: stroke }));
    });
  };
  poly(idl, '#c9a227', 0.08, '3 2.5');   // 全滾滿是參考線，用虛線讓它退到後面
  poly(cur, '#d9736b', 0.16);
  // 軸標
  RADAR_AXES.forEach((ax, i) => {
    const [x, y] = pt(i, 1.26);
    const t = mk('text', {
      x, y: y + 3, 'text-anchor': i === 0 || i === 3 ? 'middle' : (x > cx ? 'start' : 'end'),
      'font-size': 12, fill: '#9aa4b2',
    });
    t.textContent = ax.n;
    svg.append(t);
  });
}

function render() {
  renderRoles();
  renderBuild();
  renderMinds();
  renderArts();
  renderVault();
  renderStrip();
  renderTotals();
  renderGoals();
  const t = text();
  $('#sheet').textContent = t || '還沒配 —— 左邊先選流派。';
  renderReady();
  const configured = state => !!formatNote(state, C, IDX) || state.vault.length > 0;
  const any = ROLES.some(r => configured(r.state));
  ['#btn-export','[data-export]','#backup-export'].forEach(sel => { $(sel).disabled = !any; $(sel).title = any ? '匯出 JSON 備份' : '尚無配置可匯出'; });
  ['#btn-copy','[data-copy]'].forEach(sel => { $(sel).disabled = !t; $(sel).title = t ? '複製目前配置' : '先選流派或配置武學'; });
  $('#empty-actions').hidden = any;
  persist();
  const warn = $('#warn');
  warn.hidden = t.length <= 1200;
  if (!warn.hidden) {
    warn.textContent = '這段有 ' + t.length
      + ' 字。本機報名的武學說明最多 4,000 字；請在報名前整理重點，完整配置可另外匯出 JSON。';
  }
}

/* ── 完成報名 ─────────────────────────────────────────────────────────────
   這一頁的終點。要一眼看完三件事：這一份是誰的、還差什麼、按哪裡送出。

   「完成」不是一個感覺，是四個數字 —— 流派、心法、裝備、詞條。
   所以檢查表不是裝飾，它就是「能不能送」的依據，而送出鈕停用時
   一定要講出是哪一條沒過。停用又不說原因，等於又一顆「按了沒反應」的按鈕。 */
const SLUG_KEY = 'lunjian.loadout.slug';

/** 這份方案還差什麼。回四條，每一條自己知道過了沒。 */
function readyRows() {
  const sm = summarise(S);
  return [
    { k: '流派', v: sm.build || '未選', ok: !!sm.build },
    { k: '心法', v: sm.minds + ' / 4', ok: sm.minds === 4 },
    { k: '裝備', v: sm.gear + ' / 8', ok: sm.gear === 8 },
    { k: '詞條', v: sm.filled + ' 條', ok: sm.filled > 0 },
  ];
}

function renderReady() {
  const host = $('#ready');
  if (!host) return;
  const rows = readyRows();
  host.textContent = '';
  for (const r of rows) {
    const li = el('li', {}, [
      el('span', { textContent: r.k }), el('b', { textContent: r.v }),
    ]);
    li.setAttribute(r.ok ? 'data-ok' : 'data-no', '');
    host.append(li);
  }

  // 這一份是誰的。報名是以一個角色的身分報，所以名字要在標題上。
  $('#reg-who').textContent = (ROLES[ACTIVE] || {}).name || '—';

  /* 能不能送。缺流派就完全不能送（那是整份方案的根）；
     其餘幾條沒滿還是讓你送 —— 有人就是想先卡位，之後再改。
     但要講清楚現在送出去的是什麼樣子。 */
  const slug = ($('#slug').value || '').trim();
  const miss = rows.filter((r) => !r.ok);
  const go = $('#btn-go');
  const why = $('#reg-why');
  const noBuild = !rows[0].ok;
  const localEvent = new URLSearchParams(location.search).get('sportsEvent');
  go.disabled = noBuild || (!slug && !localEvent);
  go.textContent = localEvent ? '帶回角色設定' : '前往報名';
  if (noBuild) why.textContent = '先選流派。其餘幾項都被它收斂，沒選的話這份方案還不成立。';
  else if (localEvent) why.textContent = '此方案會帶回本機活動的角色設定，最後確認後才完成報名。';
  else if (!slug) why.textContent = '填上賽事代號才知道要報哪一場。代號在賽事頁的網址裡，例如 /t/bai-ye。';
  else if (miss.length) {
    why.textContent = '還差 ' + miss.map((r) => r.k).join('、')
      + '。可先帶入報名表補齊；此處尚未提交報名。';
  } else why.textContent = '會把下面那段文字帶進報名表的「常用武學 / PVP 經驗」。';
}


// ── 挑選 overlay ─────────────────────────────────────────────────────────
const pick = $('#pick');
let P = null;

const closePick = () => { hideOverlay(pick); P = null; };

function openPick(cfg) {
  P = { ...cfg, q: '', f: cfg.filters ? cfg.filters[0].key : null };
  $('#pick-title').textContent = cfg.title;
  $('#pick-q').value = '';
  const note = $('#pick-note');
  note.hidden = !cfg.note;
  note.textContent = cfg.note || '';
  $('#pick-foot').hidden = !(cfg.custom || cfg.onClear);
  $('#pick-custom').hidden = !cfg.custom;
  $('#pick-add').hidden = !cfg.custom;
  $('#pick-clear').hidden = !cfg.onClear;
  $('#pick-custom').value = '';

  const fbox = $('#pick-filters');
  fbox.textContent = '';
  for (const f of cfg.filters || []) {
    const b = el('button', { type: 'button', textContent: f.label, 'data-key': f.key });
    on(b, 'click', () => { P.f = f.key; drawPick(); });
    fbox.append(b);
  }
  showOverlay(pick);
  drawPick();
  $('#pick-q').focus();
}

function drawPick() {
  const g = $('#pick-grid');
  g.textContent = '';
  g.toggleAttribute('data-wide', !!P.wide);
  g.toggleAttribute('data-build', !!P.renderCard);
  for (const b of $('#pick-filters').children) {
    b.toggleAttribute('data-on', b.getAttribute('data-key') === P.f);
  }
  const q = P.q.trim();
  const f = (P.filters || []).find((x) => x.key === P.f);
  let rows = P.items;
  if (f && f.test) rows = rows.filter(f.test);
  if (q) rows = rows.filter((r) => r.name.includes(q) || r.key.toLowerCase().includes(q.toLowerCase()));
  if (!rows.length) {
    g.append(el('p', {
      className: 'hint',
      textContent: '沒有符合的。' + (P.custom ? '下面可以自己打一個。' : ''),
    }));
    return;
  }
  for (const r of rows) {
    // 流派挑選用自己的卡片版型（印記底紋 ＋ 兩個武學），不走通用那一套
    if (P.renderCard) {
      const c = P.renderCard(r);
      if (P.picked === r.key) c.setAttribute('data-picked', '');
      on(c, 'click', () => { P.onPick(r); closePick(); render(); });
      g.append(c);
      continue;
    }
    const c = el('button', { className: 'gcard' + (P.wide ? ' gcard-wide' : ''), type: 'button' });
    if (!r.img && P.wide) {
      const book = el('span', { className: 'skill-book', 'aria-hidden': 'true' }, [el('span', { className: 'skill-book-title', textContent: r.name })]);
      book.style.setProperty('--book-chars', String(Array.from(r.name).length));
      c.append(book);
    } else {
      c.append(r.img ? img(r.img, r.name) : el('span', { className: 'seal', textContent: r.name.slice(0, 4) }));
    }
    // 名字一行、分類一枚小標、描述一行。三件事三個層級，
    // 全塞進一行 inline span 的話會變成「神龍吐火輸出　進入醉酒狀態」。
    const body = el('span', { className: 'gc-body' });
    const line = el('span', { className: 'gc-line' }, [
      el('span', { className: 'nm', textContent: r.name }),
    ]);
    if (r.tag) line.append(el('span', { className: 'gc-tag', textContent: r.tag }));
    body.append(line);
    if (r.sub) body.append(el('span', { className: 'sub', textContent: r.sub }));
    c.append(body);
    if (r.req) c.setAttribute('data-req', '');
    if (P.picked === r.key) c.setAttribute('data-picked', '');
    on(c, 'click', () => { P.onPick(r); closePick(); render(); });
    g.append(c);
  }
}

function openBuildPicker() {
  openPick({
    title: '選擇流派',
    picked: S.build,
    note: '換流派只換武器與武學 —— 心法、奇術與裝備上填的詞條都留著，'
      + '所以來回切換比較不同流派時不會把配好的東西弄丟。',
    items: C.builds.map((b) => ({ key: b.key, name: b.name, b })),
    renderCard: (r) => buildCard(r.b, false),
    onPick: (r) => {
      noteSetBuild(S, r.key);
      const fm = fillMinds(IDX[r.key]);
      // 擠掉東西就要講 —— 悄悄換掉使用者自己挑的心法比不換更糟
      const msg = fm.dropped
        ? '已補上必備心法，你原本挑的有 ' + fm.dropped + ' 個放不下被移除'
        : fm.added ? '已補上 ' + fm.added + ' 個心法（必備一定會進，其餘補空格）' : '';
      if (msg) setTimeout(() => toast(msg), 60);
    },
  });
}

function openMindPicker(i) {
  const b = IDX[S.build];
  const req = new Set(b ? b.req : []);
  const opt = new Set(b ? b.opt : []);
  const used = new Set(S.minds.filter(Boolean).map((m) => m.key));
  openPick({
    title: i === 0 ? '主修心法' : '心法 ' + (i + 1),
    picked: S.minds[i] ? S.minds[i].key : null,
    filters: [
      { key: 'all', label: '全部（' + C.minds.length + '）' },
      { key: 'req', label: '本流派必備', test: (r) => req.has(r.key) || opt.has(r.key) },
      { key: 'free', label: '尚未配置', test: (r) => !used.has(r.key) },
    ],
    items: C.minds.map((m) => ({
      key: m.key, name: m.name, img: m.img, req: req.has(m.key),
      sub: m.req.length
        ? m.req.map((k) => IDX[k] ? IDX[k].name : k).join('、') + ' 必備'
        : '底色 ' + m.tint,
    })),
    custom: true,
    // 手動挑的不帶 auto —— 換流派時它會留著
    onPick: (r) => { S.minds[i] = { key: r.key, name: r.name, lv: null }; },
    onClear: () => { S.minds[i] = null; },
    onCustom: (v) => { S.minds[i] = { key: null, name: v, lv: null }; },
  });
}

function openArtPicker(i) {
  const cats = ['控制', '解控與防禦', '功能', '輸出', '輕功'];
  openPick({
    title: '奇術 ' + (i + 1), wide: true,
    picked: S.arts[i] ? S.arts[i].key : null,
    filters: [{ key: 'act', label: '主動奇術', test: (r) => r.active }]
      .concat(cats.map((c) => ({ key: c, label: c, test: (r) => r.cat === c })))
      .concat([{ key: 'all', label: '全部' }]),
    items: C.arts.map((a) => ({
      key: a.key, name: a.name, tag: a.cat, sub: a.note, cat: a.cat, active: a.active,
    })),
    custom: true,
    onPick: (r) => { S.arts[i] = { key: r.key, name: r.name, lv: null }; },
    onClear: () => { S.arts[i] = null; },
    onCustom: (v) => { S.arts[i] = { key: null, name: v, lv: null }; },
  });
}

// ── 裝備編輯窗 ───────────────────────────────────────────────────────────
// 六條詞條塞不進卡片，所以卡片只顯示結果，編輯在這裡。
// 改動先寫進 draft，按「儲存」才落回狀態 —— 按「取消」要真的能取消。
const edit = $('#edit');
let ED = null;

const closeEdit = () => { hideOverlay(edit); ED = null; };

/** 編輯倉庫裡的某一件。改動先寫進 draft，按「儲存」才落回那一件。 */
function openEditItem(it) {
  const sm = slotMetaOf(it);
  ED = {
    id: it.id,
    slot: { ...sm, item: it },
    draft: JSON.parse(JSON.stringify(it)),
    placement: wornAt(it) || null,
  };
  $('#edit-feedback').textContent = '按儲存後套用變更；取消會捨棄本次修改。';
  const at = wornAt(it);
  $('#edit-title').textContent = '修改裝備　' + sm.name
    + (it.label ? '・' + it.label : '') + (at ? '（' + slotNameOf(at) + '）' : '（備在倉庫）');
  drawEdit();
  showOverlay(edit);
}

/** 從左欄格位開編輯：空著的話先開一件。 */
function openEdit(s) {
  openEditItem(ensureItem(s));
}

/**
 * 帶圖的選擇欄。關著的時候顯示目前那一個的圖與名字，
 * 點下去開一張有圖的選擇面板 —— 原生 select 放不了圖。
 */
function fieldPick(label, value, options, onChange) {
  const cur = options.find((o) => o.v === value) || options[0] || null;
  const btn = el('button', { className: 'pickfld', type: 'button', 'data-focus-key': label });
  btn.append(img(cur && cur.img, cur ? cur.t : '？'));
  btn.append(el('span', { className: 'pf-t', textContent: cur ? cur.t : '— 未選 —' }));
  if (cur && cur.sub) btn.append(el('small', { textContent: cur.sub }));
  btn.append(el('span', { className: 'pf-caret', textContent: '▾' }));
  btn.setAttribute('aria-label', label + '，目前 ' + (cur ? cur.t : '未選'));
  on(btn, 'click', (e) => {
    e.stopPropagation();
    openPop(btn, { title: label, plain: true, value, options, cols: 2, onChange });
  });
  return el('label', { className: 'fld' }, [el('span', { textContent: label }), btn]);
}

function fieldSel(label, value, options, onChange) {
  const sel = el('select', { 'data-focus-key': label, 'aria-label': label });
  for (const o of options) sel.append(el('option', { value: o.v, textContent: o.t }));
  sel.value = value == null ? '' : value;
  on(sel, 'change', () => {
    onChange(sel.value || null); drawEdit();
    [...edit.querySelectorAll('select')].find(n => n.dataset.focusKey === label)?.focus({ preventScroll: true });
  });
  return el('label', { className: 'fld' }, [el('span', { textContent: label }), sel]);
}

/**
 * 編輯窗左側的即時預覽。
 *
 * 不另外畫一份 —— 直接用倉庫卡那個函式的預覽模式。
 * 你在這裡看到的就是按下儲存以後倉庫裡長的樣子，一模一樣，
 * 不會發生「預覽看起來對、存下去卻是另一回事」。
 */
function drawPreview() {
  const side = $('#edit-side');
  if (!side || !ED) return;
  const expanded = side.querySelector('details')?.open ?? !matchMedia('(max-width:760px)').matches;
  side.textContent = '';
  const preview = el('details', { className: 'ed-preview', open: expanded });
  preview.append(el('summary', { textContent: '查看裝備預覽' }));
  preview.append(cardForItem(ED.draft, { preview: true, at: ED.placement }));
  side.append(preview);
}

function drawEdit() {
  const { slot: s, draft: p } = ED;
  const conf = p;                 // 一件東西自己就是套裝與詞條的來源
  const gb = baseOf(p.partKey || s.partKey);
  const body = $('#edit-body');
  body.textContent = '';

  const head = el('div', { className: 'ed-grid' });
  // 這一件現在掛在哪一格。防具只有自己那一格，武器主副都行。
  const at = ED.placement;
  head.append(fieldSel('掛在哪一格', at || '',
    [{ v: '', t: '— 備在倉庫（不掛） —' }].concat(
      fitsOf(p).map((x) => ({ v: x, t: slotNameOf(x) }))),
    (v) => { ED.placement = v; }));
  // 裝備類別：武器可以選兵器型別，防具每個部位只有一件所以固定。
  // 武學綁死在武器上，流派其實已經決定了主副該用哪兩把 ——
  // 所以本流派的那兩把標出來，選別的不擋，但你會看到它跟流派對不上。
  if (s.isWeapon) {
    const b0 = IDX[S.build];
    const own = new Set((b0 ? b0.martials : []).map((k) => IDX[k] && IDX[k].weaponKey).filter(Boolean));
    head.append(fieldPick('裝備類別', p.partKey,
      (C.weapons || []).map((w) => {
        const gw = baseOf(w.key);
        return {
          v: w.key,
          t: itemName(w.key) || w.name,
          sub: w.name + (own.has(w.key) ? '・本流派' : ''),
          img: (gw && gw.img) || w.img,
        };
      }),
      (v) => {
        if (!v || v === p.partKey) return;
        // 換了兵器型別，原本填的詞條多半上不了新型別，清掉比留著錯的好
        const blank = newItem(WEAPON_SLOT, v);
        blank.id = p.id; blank.set = p.set; blank.tier = p.tier;
        blank.quality = p.quality; blank.label = p.label;
        ED.draft = blank;
        ED.slot = { ...slotMetaOf(blank), item: blank };
        drawEdit();
        $('#edit-feedback').textContent = '草稿已換成 ' + ((C.weapons || []).find((w) => w.key === v) || {}).name + '，詞條已清空。儲存後才會套用。';
      }));
  } else {
    // 防具每個部位只有一種，沒得選；但還是照同一個樣子畫，
    // 不然兩欄長得不一樣，看起來像壞掉。
    const fixed = el('div', { className: 'pickfld', 'data-fixed': '' });
    fixed.append(img(gb && gb.img ? gb.img : s.img, s.part));
    fixed.append(el('span', { className: 'pf-t', textContent: (gb && gb.name) || s.part }));
    fixed.append(el('small', { textContent: s.name }));
    head.append(el('label', { className: 'fld' }, [
      el('span', { textContent: '裝備類別' }), fixed,
    ]));
  }
  head.append(fieldSel('品質', p.quality,
    [{ v: 'gold', t: '金' }, { v: 'purple', t: '紫' }], (v) => { p.quality = v || 'gold'; }));
  head.append(fieldSel('套裝', conf.set,
    [{ v: '', t: '— 未指定 —' }].concat(C.sets.map((x) => ({ v: x.key, t: x.name }))),
    (v) => { conf.set = v; }));
  /* 階不是一個一個按的東西。
     裝備階實務上是 91／96／101／106／110 這種五階一跳的階梯，
     原生 number 的 step 是 1，從 100 調到 110 要按十下，
     而且它自己畫的上下箭頭只有約 13px 寬，手機點不到。所以：
       ・鈕上直接標級距，點一下就是 5
       ・按住不放連續跳，要跨很多階不用一直點
       ・Shift 一起按是 10
       ・鍵盤上下鍵也是 5（step 屬性），要精準的數字還是可以直接打
     外層用 div 不用 label：label 會把點擊轉給裡面的 input，
     那樣每按一次加減，游標就被搶去輸入框，按住連跳會斷掉。 */
  const TSTEP = 5;
  const tier = el('input', {
    type: 'number', min: '1', step: String(TSTEP), className: 'snum',
    value: conf.tier == null ? '' : conf.tier, placeholder: '110',
    'aria-label': s.isWeapon ? '武器等級' : '裝備等級',
  });
  const commitTier = () => { conf.tier = num(tier.value, 1); drawPreview(); };
  on(tier, 'change', commitTier);
  on(tier, 'focus', () => tier.select());   // 要改就是整個換掉，不用先刪

  const bumpTier = (dir, big) => {
    const cur = num(tier.value, 1) || Number(tier.placeholder) || 110;
    tier.value = String(Math.max(1, cur + dir * TSTEP * (big ? 2 : 1)));
    commitTier();
  };

  /** 一顆加或減。按住會連跳；放開、移出、或這個面板被重畫都要停下來。 */
  const stepBtn = (dir) => {
    const b = el('button', {
      type: 'button', className: 'stepb',
      textContent: (dir > 0 ? '＋' : '−') + TSTEP,
    });
    b.title = '點一下 ' + TSTEP + ' 級；按住不放會一直跳；Shift 一起按是 ' + TSTEP * 2 + ' 級';
    b.setAttribute('aria-label', (dir > 0 ? '增加' : '減少') + TSTEP + ' 級');
    let wait = 0, rep = 0;
    const stop = () => { clearTimeout(wait); clearInterval(rep); wait = rep = 0; };
    on(b, 'pointerdown', (e) => {
      if (e.button) return;
      b.setPointerCapture(e.pointerId);        // 手指滑出鈕外也收得到 pointerup
      bumpTier(dir, e.shiftKey);
      wait = setTimeout(() => {
        rep = setInterval(() => {
          if (!b.isConnected) { stop(); return; }   // 面板重畫過了，別再動已經脫離的欄位
          bumpTier(dir, e.shiftKey);
        }, 90);
      }, 420);
    });
    // Enter / Space dispatch click without pointerdown; pointer clicks already applied above.
    on(b, 'click', e => { if (e.detail === 0) bumpTier(dir, e.shiftKey); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) on(b, ev, stop);
    return b;
  };

  head.append(el('div', { className: 'fld' }, [
    el('span', { textContent: s.isWeapon ? '武器等級' : '裝備等級' }),
    el('div', { className: 'stepper' }, [stepBtn(-1), tier, stepBtn(1)]),
  ]));
  // 名稱擺最後一格：前面五欄是「這件是什麼」，名字是你自己給的，性質不同。
  // 同部位擺兩件時就靠它分辨 —— 資料表只有部位名（傘、冠胄），
  // 兩頂冠胄擺在一起長得一模一樣。
  const nameLab = s.isWeapon ? '武器名稱' : '裝備名稱';
  const lab = el('input', {
    type: 'text', value: p.label || '', maxLength: 12,
    placeholder: s.isWeapon ? ((itemName(p.partKey) || '流星雲傘')) : '爆傷／減傷／備用',
  });
  on(lab, 'change', () => { p.label = lab.value.trim().slice(0, 12); drawPreview(); });
  head.append(el('label', { className: 'fld' }, [el('span', { textContent: nameLab }), lab]));
  body.append(head);
  drawPreview();

  const tools = el('div', { className: 'ed-tools' });
  const cy = el('input', { type: 'checkbox', checked: !!p.chengyin });
  on(cy, 'change', () => { p.chengyin = cy.checked; });
  tools.append(el('label', { className: 'chk' }, [cy, el('span', { textContent: '承音' })]));
  const bmax = el('button', { type: 'button', textContent: '全部最大' });
  on(bmax, 'click', () => {
    const tM = new Map(C.tunings.map((t) => [t.key, t]));
    const pM = new Map(C.pitches.map((x) => [x.key, x]));
    if (p.first.k && tM.has(p.first.k)) p.first.v = tM.get(p.first.k).max;
    for (const x of p.sec) if (x.k && tM.has(x.k)) x.v = tM.get(x.k).max;
    if (p.pitch.k && pM.has(p.pitch.k)) p.pitch.v = pM.get(p.pitch.k).max;
    drawEdit();
  });
  tools.append(bmax);
  const bbase = el('button', { type: 'button', textContent: '全部基準' });
  on(bbase, 'click', () => {
    const tM = new Map(C.tunings.map((t) => [t.key, t]));
    if (p.first.k && tM.has(p.first.k)) p.first.v = tM.get(p.first.k).base;
    for (const x of p.sec) if (x.k && tM.has(x.k)) x.v = tM.get(x.k).base;
    drawEdit();
  });
  tools.append(bbase);
  const bsug = el('button', { type: 'button', textContent: '套用建議' });
  bsug.title = '依這個流派的武學天賦挑詞條，填基準值。填完再照你自己那件改。';
  on(bsug, 'click', () => { suggestPiece(s, p); drawEdit(); });
  tools.append(bsug);
  tools.append(el('span', {
    className: 'hint', style: 'margin:0',
    textContent: gb ? '基礎屬性：' + (p.quality === 'purple' ? gb.purple : gb.gold)
      .map((a) => a.n + ' ' + fmtVal(a.v) + (a.pct ? '%' : '')).join('　') : '',
  }));
  body.append(tools);

  // 首詞條
  body.append(el('div', { className: 'ed-lab', textContent: '調律詞條' }));
  body.append(tuneRow(p.first, tuningsFor(C, s.partKey, 'first'), false));
  // 副詞條 ×4
  const secList = tuningsFor(C, s.partKey, 'sec');
  for (let i = 0; i < 4; i++) {
    body.append(tuneRow(p.sec[i], secList, true, i + 1));
  }
  // 定音
  body.append(el('div', { className: 'ed-lab', textContent: '定音詞條' }));
  body.append(tuneRow(p.pitch, pitchesFor(C, s.partKey), false, null, true));

  if (!tuningsFor(C, s.partKey, 'first').length) {
    body.append(el('p', {
      className: 'hint',
      textContent: '資料表裡這個部位沒有可用的首詞條 —— 可能是部位對照有誤，或這一版沒開。',
    }));
  }
}

function tuneRow(cell, options, withCarry, n, isPitch) {
  const row = el('div', { className: 'trow' });
  // 六個下拉長得一模一樣，沒有旁邊的文字標籤（版面塞不下六個），
  // 所以名字要寫在 aria-label 上 —— 第一個 option 只是提示，不算名字。
  const label = isPitch ? '定音詞條' : '調律詞條' + (n ? ' ' + n : '');
  const sel = el('select', { 'aria-label': label });
  sel.append(el('option', { value: '', textContent: '請選擇' + label }));
  for (const t of options) {
    sel.append(el('option', {
      value: t.key,
      textContent: t.name + '　上限 ' + fmtVal(t.max) + (t.pct ? '%' : ''),
    }));
  }
  sel.value = cell.k || '';
  on(sel, 'change', () => {
    cell.k = sel.value || null;
    if (!cell.k) cell.v = null;
    drawEdit();
  });
  row.append(sel);

  if (withCarry) {
    const c = el('input', { type: 'checkbox', checked: !!cell.carry });
    on(c, 'change', () => { cell.carry = c.checked; });
    row.append(el('label', { className: 'chk' }, [c, el('span', { textContent: '轉律' })]));
  } else {
    row.append(el('span'));
  }

  const meta = options.find((t) => t.key === cell.k);
  const inp = el('input', {
    type: 'number', step: '0.01', value: cell.v == null ? '' : cell.v,
    placeholder: meta ? fmtVal(meta.max) : '數值', disabled: !cell.k,
  });
  on(inp, 'change', () => {
    const v = parseFloat(inp.value);
    cell.v = Number.isFinite(v) ? v : null;
    drawEdit();
  });
  const tone = meta ? rollTone(cell.v, meta.max) : 0;
  const bar = el('span', { className: 'bar' });
  if (tone) bar.setAttribute('data-roll', String(tone));
  bar.append(el('i', {
    style: 'width:' + (meta && Number.isFinite(cell.v)
      ? Math.max(0, Math.min(100, cell.v / meta.max * 100)) : 0) + '%',
  }));
  row.append(el('span', { className: 'val' }, [
    inp,
    el('span', { className: 'cap' }, [
      document.createTextNode(meta ? '/ ' + fmtVal(meta.max) : ''),
      bar,
    ]),
  ]));
  return row;
}

function saveEdit() {
  if (!ED) return;
  const cur = S.vault.find((x) => x.id === ED.id);
  if (!cur) return;
  Object.assign(cur, JSON.parse(JSON.stringify(ED.draft)), { id: ED.id });
  if (ED.placement) equipItem(S, ED.placement, ED.id);
  else for (const slot of Object.keys(S.equip)) if (S.equip[slot] === ED.id) unequip(S, slot);
}

/* ── 角色管理視窗 ───────────────────────────────────────────────────────
   照工具站那個：上面一排角色、兩個分頁（編輯當前／新增角色）、
   名稱欄帶字數、底下刪除／取消／保存。

   改動先寫進 RM 這份草稿，按保存才落回 —— 按取消要真的能取消。 */
const rolesModal = $('#roles-modal');
let RM = null;

const closeRoles = () => { hideOverlay(rolesModal); RM = null; };

function openRoles() {
  RM = { tab: 'edit', pick: ACTIVE, name: ROLES[ACTIVE].name };
  drawRoles();
  showOverlay(rolesModal);
  setTimeout(() => { const n = $('#rm-name'); if (n) n.focus(); }, 30);
}

function drawRoles() {
  const body = $('#rm-body');
  body.textContent = '';

  const chips = el('div', { className: 'rm-chips' });
  ROLES.forEach((r, i) => {
    const b = el('button', { type: 'button', textContent: r.name });
    if (i === RM.pick && RM.tab === 'edit') b.setAttribute('data-on', '');
    on(b, 'click', () => { RM.tab = 'edit'; RM.pick = i; RM.name = r.name; drawRoles(); });
    chips.append(b);
  });
  body.append(chips);

  const tabs = el('div', { className: 'rm-tabs' });
  for (const pair of [['edit', '編輯當前'], ['new', '新增角色']]) {
    const b = el('button', { type: 'button', textContent: pair[1] });
    if (RM.tab === pair[0]) b.setAttribute('data-on', '');
    on(b, 'click', () => {
      RM.tab = pair[0];
      RM.name = pair[0] === 'new' ? '' : ROLES[RM.pick].name;
      drawRoles();
      setTimeout(() => { const n = $('#rm-name'); if (n) n.focus(); }, 20);
    });
    tabs.append(b);
  }
  body.append(tabs);

  const fld = el('label', { className: 'rm-field' });
  fld.append(el('span', { textContent: RM.tab === 'new' ? '新角色名稱' : '編輯角色' }));
  const wrap = el('div', { className: 'rm-input' });
  const inp = el('input', {
    id: 'rm-name', type: 'text', value: RM.name, maxLength: String(NAME_MAX),
    placeholder: RM.tab === 'new' ? '例：少冬瓜' : '',
  });
  const cnt = el('span', { className: 'count' });
  const tick = () => {
    const n = [...RM.name].length;
    cnt.textContent = n + ' / ' + NAME_MAX;
    cnt.toggleAttribute('data-over', n > NAME_MAX);
  };
  on(inp, 'input', () => { RM.name = inp.value; inp.removeAttribute('aria-invalid'); $('#rm-error').textContent = ''; tick(); });
  on(inp, 'keydown', (e) => { if (e.key === 'Enter') $('#rm-save').click(); });
  tick();
  wrap.append(inp, cnt);
  fld.append(wrap);
  body.append(fld);
  inp.setAttribute('aria-describedby', 'rm-error');
  body.append(el('p', { id: 'rm-error', className: 'io-warn', role: 'alert' }));

  body.append(el('p', {
    className: 'rm-note',
    textContent: RM.tab === 'new'
      ? '新角色是一份空的配置，不會複製目前這一隻。'
      : '報名欄位永遠只反映目前選中的那一隻。'
        + '　角色存在這台瀏覽器裡 —— 換裝置或清掉瀏覽器資料就沒了，'
        + '要留就用「匯出 JSON」，那一份帶得走全部角色。',
  }));

  $('#rm-delete').hidden = RM.tab === 'new' || ROLES.length <= 1;
  $('#rm-save').textContent = RM.tab === 'new' ? '新增' : '保存';
}

function saveRoles() {
  const name = RM.name.trim().slice(0, NAME_MAX);
  if (!name) { $('#rm-error').textContent = '請填寫角色名稱。'; $('#rm-name').setAttribute('aria-invalid', 'true'); $('#rm-name').focus(); return; }
  if (RM.tab === 'new') {
    ROLES.push({ id: nextRoleId(), name, state: emptyState() });
    ACTIVE = ROLES.length - 1;
    S = ROLES[ACTIVE].state;
    closeRoles(); render(); toast('已新增「' + name + '」並切換過去');
  } else {
    ROLES[RM.pick].name = name;
    if (RM.pick !== ACTIVE) { ACTIVE = RM.pick; S = ROLES[ACTIVE].state; }
    closeRoles(); render(); toast('角色資料已更新');
  }
}

async function deleteRole() {
  if (ROLES.length <= 1) { toast('至少要留一隻'); return; }
  // 先把「要刪哪一隻」抓成物件參照。等一下要 await，等回來之後 RM 可能已經
  // 是 null（視窗被關了），ROLES 的順序也可能變了 —— 不能再用當時的索引。
  const r = RM && ROLES[RM.pick];
  if (!r) return;
  if (!await ask({
    title: '刪除角色',
    lines: ['刪除角色「' + r.name + '」？'],
    warn: '它的整份配置會一起消失，這個動作沒有復原。',
    ok: '刪除', danger: true,
  })) return;
  // 等過了，重新確認它還在，並且重新找它現在的位置
  const at = ROLES.indexOf(r);
  if (at < 0) { toast('那一隻已經不在了'); return; }
  if (ROLES.length <= 1) { toast('至少要留一隻'); return; }
  ROLES.splice(at, 1);
  ACTIVE = Math.min(ACTIVE, ROLES.length - 1);
  S = ROLES[ACTIVE].state;
  closeRoles(); render(); toast('已刪除「' + r.name + '」');
}

// ── 匯入 / 規則 ──────────────────────────────────────────────────────────
const modal = $('#modal');
const closeModal = () => hideOverlay(modal);

/* ── 匯入／匯出 ─────────────────────────────────────────────────────────
   原本兩邊都是「一個貼 JSON 的大文字框」。那對使用者太硬：
   看不懂那串字，也不知道貼下去會發生什麼事，按下去才發現配置被洗掉。

   改成三步：先看**摘要**（要帶走什麼／要匯入什麼）、
   再看**差異**（哪一格會變成什麼）、確認了才套用。
   原始 JSON 收進「進階」的摺疊區 —— 想看的人看得到，但不擋在路上。 */
const ioModal = $('#io-modal');
let IO = null;

const closeIO = () => { hideOverlay(ioModal); IO = null; };

function openIO(title, build, foot) {
  IO = {};
  $('#io-title').textContent = title;
  const body = $('#io-body');
  body.textContent = '';
  body.append(build());
  const f = $('#io-foot');
  f.textContent = '';
  for (const b of foot) f.append(b);
  showOverlay(ioModal);
}

const footBtn = (label, cls, fn) => {
  const b = el('button', { type: 'button', textContent: label });
  if (cls) b.className = cls;
  on(b, 'click', fn);
  return b;
};

/** 一份配置的人話摘要。匯出要看「帶走什麼」，匯入要看「換成什麼」。 */
function summarise(st) {
  const b = IDX[st.build];
  const minds = st.minds.filter(Boolean).length;
  const arts = st.arts.filter(Boolean).length;
  const A = computeAttrs(st, C, IDX);
  // 「幾件」算的是掛上去的，不是倉庫裡總共有幾件 —— 摘要要講的是這次帶什麼
  const gear = allSlots(st, C, IDX).filter((x) => x.item).length;
  return {
    build: b ? b.name : null,
    minds, arts, gear,
    filled: A.filled,
    grad: A.grad,
    line: [
      b ? b.name : '未選流派',
      '心法 ' + minds + '/4',
      '奇術 ' + arts + '/4',
      '裝備 ' + gear + ' 件',
      '詞條 ' + A.filled + ' 條'
        + (A.grad === null ? '' : '（畢業率 ' + (A.grad * 100).toFixed(1) + '%）'),
    ].join('　·　'),
  };
}

// ── 匯出 ─────────────────────────────────────────────────────────────────
function openExport() {
  let scope = 'all';
  const report = (message, failed = false, requestIO = IO) => {
    if (destroyed || !ioModal.open || IO !== requestIO) return;
    let feedback = $('#io-feedback');
    if (!feedback) {
      feedback = el('p', { id: 'io-feedback', tabIndex: -1, style: 'flex-basis:100%;margin:0' });
      $('#io-foot').prepend(feedback);
    }
    feedback.className = failed ? 'io-warn' : 'io-hint';
    feedback.setAttribute('role', failed ? 'alert' : 'status');
    feedback.textContent = message;
    if (failed) feedback.focus();
  };

  const payload = () => (scope === 'all'
    ? { v: 3, active: ACTIVE, roles: ROLES.map((r) => ({ name: r.name, data: stateToJSON(r.state, C, IDX) })) }
    : { v: 3, active: 0, roles: [{ name: ROLES[ACTIVE].name, data: stateToJSON(S, C, IDX) }] });

  const draw = () => {
    const box = el('div');

    const sec1 = el('div', { className: 'io-sec' });
    sec1.append(el('div', { className: 'io-lab', textContent: '要帶走什麼' }));
    const seg = el('div', { className: 'seg' });
    for (const pair of [['all', '全部角色（' + ROLES.length + '）'], ['one', '只有「' + ROLES[ACTIVE].name + '」']]) {
      const b = el('button', { type: 'button', textContent: pair[1] });
      if (scope === pair[0]) b.setAttribute('data-on', '');
      on(b, 'click', () => { scope = pair[0]; redraw(); });
      seg.append(b);
    }
    sec1.append(seg);
    const list = scope === 'all' ? ROLES : [ROLES[ACTIVE]];
    for (const r of list) {
      const sm = summarise(r.state);
      const row = el('div', { className: 'io-row' });
      if (r === ROLES[ACTIVE]) row.setAttribute('data-me', '');
      row.append(el('span', { className: 'nm', textContent: r.name }));
      row.append(el('span', { className: 'sum', textContent: sm.line }));
      if (r === ROLES[ACTIVE]) row.append(el('span', { className: 'tag', textContent: '當前' }));
      sec1.append(row);
    }
    box.append(sec1);

    const sec2 = el('div', { className: 'io-sec' });
    sec2.append(el('div', { className: 'io-lab', textContent: '怎麼帶走' }));
    sec2.append(el('p', {
      className: 'io-hint',
      style: 'margin:0',
      textContent: '下載的檔案可以丟給別人，對方用「匯入」讀回來。'
        + '報名連結只帶當前這一隻 —— 那是報名用的，不是備份。',
    }));
    const adv = el('details', { className: 'io-adv' });
    adv.append(el('summary', { textContent: '進階：看原始 JSON' }));
    adv.append(el('pre', { textContent: JSON.stringify(payload(), null, 1) }));
    sec2.append(adv);
    box.append(sec2);
    return box;
  };

  const redraw = () => openExport.draw();

  const doDownload = () => {
    const blob = new Blob([JSON.stringify(payload(), null, 1)], { type: 'application/json' });
    const name = 'lunjian-' + (scope === 'all' ? '全部角色' : ROLES[ACTIVE].name)
      + '-' + new Date().toISOString().slice(0, 10) + '.json';
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('已下載 ' + name);
  };

  const doCopy = async () => {
    const requestIO = IO;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload()));
      report('已複製，貼到別人的「匯入」就能讀', false, requestIO);
    } catch { report('瀏覽器擋了剪貼簿，請改用下載檔案。', true, requestIO); }
  };

  const doLink = async () => {
    const slug = ($('#slug').value || '').trim();
    if (!slug) { report('請先在準備報名填寫賽事代號。', true); return; }
    const requestIO = IO;
    const url = location.origin + '/t/' + encodeURIComponent(slug) + '/signup?arts=' + encodeURIComponent(text());
    try {
      await navigator.clipboard.writeText(url);
      report('報名連結已複製；尚未提交報名', false, requestIO);
    } catch { report('瀏覽器擋了剪貼簿，請關閉視窗後從準備報名繼續。', true, requestIO); }
  };

  openExport.draw = () => openIO('匯出配置', draw, [
    footBtn('複製到剪貼簿', '', doCopy),
    footBtn('複製報名連結', '', doLink),
    footBtn('下載檔案', 'ok', doDownload),
  ]);
  openExport.draw();
}

// ── 匯入 ─────────────────────────────────────────────────────────────────
/** 把貼上／讀進來的東西解析成「要套用什麼」。認 v3 多角色、v2 單份、條列文字。 */
function parseIncoming(raw) {
  const t = String(raw || '').trim();
  if (!t) return { kind: 'empty' };
  if (t.startsWith('{')) {
    let o;
    try { o = JSON.parse(t); } catch { return { kind: 'bad', why: 'JSON 格式不完整。請貼上完整的匯出內容，或改用選擇檔案。' }; }
    if (Array.isArray(o.roles) && o.roles.length) {
      return {
        kind: 'roles',
        roles: o.roles.map((r, i) => ({
          name: String(r.name || '角色' + (i + 1)).slice(0, NAME_MAX),
          state: stateFromJSON(r.data || {}, C, IDX),
        })),
        active: Math.min(Math.max(0, o.active | 0), o.roles.length - 1),
      };
    }
    return { kind: 'one', state: stateFromJSON(o, C, IDX) };
  }
  const st = parseNote(t, C, IDX);
  if (!st.parsedLines) return { kind: 'bad', why: '這段文字裡沒有認得出來的行（流派／武器／武學／心法／奇術／裝備）。' };
  return { kind: 'one', state: st, fromText: true };
}

function diffRow(label, a, b) {
  const same = a === b;
  const row = el('div', { className: 'io-diff' });
  if (same) row.setAttribute('data-same', '');
  row.append(el('span', { className: 'k', textContent: label }));
  if (!same) {
    row.append(el('span', { className: 'a', textContent: a || '—' }));
    row.append(el('span', { className: 'arrow', textContent: '→' }));
  }
  row.append(el('span', { className: 'b', textContent: b || '—' }));
  return row;
}

function openImport() {
  let incoming = null;
  let raw = '';
  let requestVersion = 0, reading = false, sessionIO;
  const current = () => !destroyed && ioModal.open && IO === sessionIO;

  const apply = async () => {
    if (!incoming || incoming.kind === 'bad' || incoming.kind === 'empty') return;
    if (!await ask({ title: '套用匯入配置', lines: [incoming.kind === 'roles' ? '將取代目前所有角色及配置。' : '將取代目前角色的配置。'], warn: '此操作無法復原，建議先匯出備份。', ok: '確認套用', danger: true })) return;
    if (destroyed || !ioModal.open) return;
    if (incoming.kind === 'roles') {
      ROLES = incoming.roles.map((r, i) => ({ id: i + 1, name: r.name, state: r.state }));
      ACTIVE = incoming.active;
      S = ROLES[ACTIVE].state;
      closeIO(); render(); toast('已匯入 ' + ROLES.length + ' 個角色');
    } else {
      adopt(incoming.state);
      closeIO(); render(); toast('已套用到「' + ROLES[ACTIVE].name + '」');
    }
  };

  const read = (text) => {
    if (!current()) return;
    requestVersion++; reading = false;
    raw = text; incoming = parseIncoming(text); draw();
  };
  const readFile = async f => {
    const version = ++requestVersion;
    reading = true; incoming = null; draw();
    try {
      const content = await f.text();
      if (!current() || version !== requestVersion) return;
      read(content);
    } catch {
      if (!current() || version !== requestVersion) return;
      reading = false;
      incoming = { kind: 'bad', why: '檔案讀取失敗，請重新選檔或貼上內容。' }; draw();
      const error = $('#io-import-error'); error.tabIndex = -1; error.focus();
    }
  };

  const build = () => {
    const box = el('div');

    // 來源
    const sec1 = el('div', { className: 'io-sec' });
    sec1.append(el('div', { className: 'io-lab', textContent: '來源' }));
    const drop = el('button', { type: 'button', className: 'io-drop', 'aria-label': '選擇配置 JSON 檔案' });
    drop.append(el('b', { textContent: '把 .json 檔拖進來，或點一下選檔案' }));
    drop.append(el('span', { textContent: '也可以直接把別人的那段條列文字貼在下面' }));
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
    on(file, 'change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      file.value = '';
      readFile(f);
    });
    on(drop, 'click', () => file.click());
    for (const ev of ['dragenter', 'dragover']) {
      on(drop, ev, (e) => { e.preventDefault(); drop.setAttribute('data-over', ''); });
    }
    for (const ev of ['dragleave', 'drop']) {
      on(drop, ev, (e) => { e.preventDefault(); drop.removeAttribute('data-over'); });
    }
    on(drop, 'drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
    });
    sec1.append(drop, file);
    const ta = el('textarea', {
      className: 'io-paste', 'aria-label': '貼上配置文字或 JSON', 'aria-describedby': 'io-import-error', 'aria-invalid': incoming?.kind === 'bad' ? 'true' : 'false', spellcheck: false, value: raw,
      placeholder: '流派　裂石威\n心法　山河絕韻 5★（主修）｜…\n\n或是一份 JSON',
    });
    on(ta, 'input', () => read(ta.value));
    sec1.append(ta);
    box.append(sec1);

    // 預覽
    const sec2 = el('div', { className: 'io-sec' });
    if (incoming?.kind !== 'bad') sec2.append(el('span', { id: 'io-import-error', hidden: true }));
    sec2.append(el('div', { className: 'io-lab', textContent: '會變成什麼' }));
    if (reading) {
      sec2.append(el('p', { role: 'status', className: 'io-hint', textContent: '正在讀取檔案…' }));
    } else if (!incoming || incoming.kind === 'empty') {
      sec2.append(el('p', { className: 'io-hint', style: 'margin:0', textContent: '還沒有東西。貼上或選檔案後，這裡會先告訴你會變成什麼，確認了才套用。' }));
    } else if (incoming.kind === 'bad') {
      sec2.append(el('p', { id: 'io-import-error', role: 'alert', className: 'io-warn', style: 'margin:0', textContent: incoming.why }));
    } else if (incoming.kind === 'roles') {
      sec2.append(el('p', {
        className: 'io-warn', style: 'margin:0 0 9px',
        textContent: '這是一份含 ' + incoming.roles.length + ' 個角色的檔案，'
          + '套用後會「取代」目前這台瀏覽器裡的 ' + ROLES.length + ' 個角色。',
      }));
      incoming.roles.forEach((r, i) => {
        const row = el('div', { className: 'io-row' });
        const known = ROLES.some((x) => x.name === r.name);
        row.setAttribute(known ? 'data-replace' : 'data-add', '');
        row.append(el('span', { className: 'nm', textContent: r.name }));
        row.append(el('span', { className: 'sum', textContent: summarise(r.state).line }));
        row.append(el('span', { className: 'tag', textContent: known ? '覆蓋同名' : '新增' }));
        sec2.append(row);
      });
    } else {
      const a = summarise(S); const b = summarise(incoming.state);
      sec2.append(el('p', {
        className: 'io-hint', style: 'margin:0 0 9px',
        textContent: (incoming.fromText ? '認出了一段條列文字。' : '這是一份單一配置。')
          + '套用後會覆蓋目前這一隻「' + ROLES[ACTIVE].name + '」。',
      }));
      sec2.append(diffRow('流派', a.build, b.build));
      sec2.append(diffRow('心法', a.minds + ' / 4', b.minds + ' / 4'));
      sec2.append(diffRow('奇術', a.arts + ' / 4', b.arts + ' / 4'));
      sec2.append(diffRow('裝備', a.gear + ' 件', b.gear + ' 件'));
      sec2.append(diffRow('詞條', a.filled + ' 條', b.filled + ' 條'));
      sec2.append(diffRow('畢業率',
        a.grad === null ? '—' : (a.grad * 100).toFixed(1) + '%',
        b.grad === null ? '—' : (b.grad * 100).toFixed(1) + '%'));
      if (incoming.state.freeText) {
        sec2.append(el('p', { className: 'io-hint', textContent: '另外有一段沒解析的自由文字，會一起帶進來。' }));
      }
      // 條列文字裡沒有逐條詞條 —— 那是當初刻意的（六十筆塞進報名欄位，裁判沒法讀）。
      // 從文字匯入會把已經填好的詞條清掉，這件事要在按下去之前講。
      if (incoming.fromText && a.filled > b.filled) {
        sec2.append(el('p', {
          className: 'io-warn',
          textContent: '注意：條列文字裡不含逐條詞條（只有總計那兩行），'
            + '所以目前這 ' + a.filled + ' 條會被清掉。'
            + '要連詞條一起搬，請對方改用「匯出配置 → 下載檔案」。',
        }));
      }
    }
    box.append(sec2);
    return box;
  };

  const draw = () => {
    const ok = incoming && (incoming.kind === 'roles' || incoming.kind === 'one');
    const buttons = [
      footBtn('取消', '', closeIO),
      Object.assign(footBtn(ok ? '套用' : '先貼上內容', 'ok', apply), { disabled: !ok, style: ok ? '' : 'opacity:.5;cursor:not-allowed' }),
    ];
    if (ioModal.open && $('#io-title').textContent === '匯入配置') {
      // Keep the input node alive for selection, pasted text, and IME composition.
      $('#io-body > div').lastElementChild.replaceWith(build().lastElementChild);
      const input = $('.io-paste', ioModal);
      if (input.value !== raw) input.value = raw;
      input.setAttribute('aria-invalid', String(incoming?.kind === 'bad'));
      $('#io-foot').replaceChildren(...buttons);
    } else openIO('匯入配置', build, buttons);
    const f = $('#io-foot');
    f.firstChild.style.marginLeft = 'auto';
  };

  draw();
  sessionIO = IO;
}

function openGuide() {
  $('#modal-title').textContent = '規則';
  $('#modal-body').innerHTML = [
    '<h4>順序</h4>',
    '<p>先選流派，其餘五項都被它收斂。流派決定用哪兩把武器，武器決定那 4 個武學技，',
    '流派同時列出必備心法，心法主修再回頭決定整套往哪邊堆。</p>',
    '<h4>格數</h4>',
    '<table><tr><th>項目</th><th>格數</th><th>要點</th></tr>',
    '<tr><td>武器</td><td>2（主／副）</td><td>決定攻速、攻擊距離、破定能力</td></tr>',
    '<tr><td>武學技</td><td>4</td><td>每把武器出 2 個：武學技（Q）與特殊技（~）</td></tr>',
    '<tr><td>心法</td><td>4，其中 1 主修</td><td>主修多一條會改變戰局的被動</td></tr>',
    '<tr><td>奇術</td><td>4 主動</td><td>走完五音啟太平可擴到 8</td></tr>',
    '<tr><td>裝備</td><td>左 4 ＋ 右 4</td><td>左四影響輸出，右四影響防禦</td></tr></table>',
    '<h4>等級上限</h4>',
    '<table><tr><th>項目</th><th>上限</th><th>依據</th></tr>',
    '<tr><td>武學</td><td>20</td><td>遊戲面板顯示「等級 n/20」</td></tr>',
    '<tr><td>心法</td><td>5</td><td>卡面五顆星</td></tr>',
    '<tr><td>奇術</td><td>不設限</td><td>查不到公開定數，所以不編</td></tr>',
    '<tr><td>裝備等級</td><td>不設限</td><td>同上。110 級只是常見值；91→96 是承音關卡</td></tr></table>',
    '<h4>這份資料哪裡不可靠</h4>',
    '<ul>',
    '<li><b>心法品階（虹／金／紫／藍）測不出來。</b>資料表的 quality 五十筆全是 0。',
    '畫面上寫「底色」不寫「品階」，因為量出來的底色跟遊戲品階不對應。</li>',
    '<li><b>奇術不是爬來的</b>，是一篇公開攻略整理的 23 筆，key 為本專案自編。',
    '清單一定不完整 —— 所以每一格都可以自己打。</li>',
    '<li><b>詞條數值不存在於任何公開資料</b>，工具站的數字是它自己的使用者手打的。',
    '所以這裡只到「部位＋套裝＋等級」。</li>',
    '</ul>',
    '<p>完整版在 <code>scrollcraft/builds/lunjian/loadout/GUIDE.md</code>，',
    '逐項名單在 <code>CATALOG.md</code>。</p>',
  ].join('');
  $('#modal-foot').hidden = true;
  showOverlay(modal);
}

// ── 輸出 ─────────────────────────────────────────────────────────────────
async function copyText() {
  const t = text();
  if (!t) { toast('還沒有東西可以複製'); return; }
  try {
    await navigator.clipboard.writeText(t);
    if (destroyed) return;
    toast('已複製 ' + t.split('\n').length + ' 行');
  } catch {
    if (destroyed || ioModal.open) return;
    openIO('手動複製配置', () => {
      const box = el('div', { className: 'io-sec' });
      box.append(el('p', { role: 'alert', className: 'io-warn', textContent: '瀏覽器未允許複製。下方已選取完整配置，可手動複製後繼續。' }));
      box.append(el('textarea', { id: 'io-manual-copy', className: 'io-paste', 'aria-label': '手動複製配置文字', readOnly: true, value: t }));
      return box;
    }, [footBtn('完成', 'ok', closeIO)]);
    const input = $('#io-manual-copy'); input.focus(); input.select();
  }
}

let signupPending = false;
function goSignup() {
  if (signupPending) return;
  const localEvent = new URLSearchParams(location.search).get('sportsEvent');
  const slug = $('#slug').value.trim();
  if (!slug && !localEvent) { toast('先填賽事代號'); $('#slug').focus(); return; }
  const t = text();
  if (!t) { toast('還沒配東西'); return; }
  try { localStorage.setItem(SLUG_KEY, slug); } catch { /* 存不了就算了 */ }
  /* 帶的是**人看得懂的那段文字**，不是整包 JSON。
     報名表那一格（常用武學 / PVP 經驗）要的就是這段字；
     JSON 是另一件事，走「匯出 JSON」。 */
  const params = new URLSearchParams(location.search);
  const returnUrl = new URL(params.get('returnTo') === 'register' ? '/' : '/sportsbook', location.origin);
  if (params.get('returnTo') === 'register') {
    returnUrl.searchParams.set('sportsEvent', localEvent || '');
    returnUrl.hash = 'register';
    if (params.get('preview') === '1') returnUrl.searchParams.set('preview', '1');
    if (params.get('stage') === '2d') { returnUrl.searchParams.set('stage', '2d'); returnUrl.searchParams.set('intro', '0'); }
  } else { returnUrl.searchParams.set('event', localEvent || ''); returnUrl.searchParams.set('tab', 'participation'); }
  returnUrl.searchParams.set('artsUser', localOwner);
  returnUrl.searchParams.set('loadoutRole', String(ROLES[ACTIVE].id));
  returnUrl.searchParams.set('roleSource', roleSource);
  const url = localEvent ? returnUrl.href : '/t/' + encodeURIComponent(slug) + '/signup?arts=' + encodeURIComponent(t);
  if (!flushSave()) { $('#storage-retry').focus(); return; }
  signupPending = true;
  $('#btn-go').disabled = true;
  $('#btn-go').setAttribute('aria-busy', 'true');
  toast(localEvent ? '正在返回角色設定' : '正在前往「' + slug + '」的報名表');
  setTimeout(() => { location.href = url; }, 500);
}

// ── 啟動 ─────────────────────────────────────────────────────────────────
async function boot() {
  on($('#storage-retry'), 'click', flushSave);
  addEventListener('pagehide', () => { if (saveT) flushSave(); });
  C = await fetch('../loadout/data/catalog.json', {signal:lifetime.signal}).then((r) => {
    if (!r.ok) throw new Error('catalog.json ' + r.status);
    return r.json();
  });
  if (destroyed) return;
  IDX = indexOf(C);

  on($('#pick-close'), 'click', closePick);
  on(pick, 'click', (e) => { if (e.target === pick) closePick(); });
  on($('#pick-q'), 'input', (e) => { P.q = e.target.value; drawPick(); });
  on($('#pick-clear'), 'click', () => { P.onClear?.(); closePick(); render(); });
  on($('#pick-add'), 'click', () => {
    const v = $('#pick-custom').value.trim();
    if (!v) return;
    P.onCustom?.(v); closePick(); render(); toast('已加入「' + v + '」');
  });
  on($('#pick-custom'), 'keydown', (e) => { if (e.key === 'Enter') $('#pick-add').click(); });

  on($('#edit-close'), 'click', closeEdit);
  on($('#edit-cancel'), 'click', closeEdit);
  on(edit, 'click', (e) => { if (e.target === edit) closeEdit(); });
  on($('#edit-save'), 'click', () => { saveEdit(); closeEdit(); render(); toast('裝備設定已更新'); });
  on($('#edit-clear'), 'click', () => {
    if (!ED) return;
    // Clearing is a draft edit too: cancel must preserve the saved equipment.
    const blank = newItem(ED.draft.slot, ED.draft.partKey);
    blank.id = ED.id; blank.label = ED.draft.label;
    ED.draft = blank;
    drawEdit();
    $('#edit-feedback').textContent = '已清空草稿數值。按儲存套用，或取消保留原裝備。';
  });

  on(pop, 'click', (e) => { if (e.target === pop) closePop(); });

  on($('#io-close'), 'click', closeIO);
  on(ioModal, 'click', (e) => { if (e.target === ioModal) closeIO(); });

  on($('#rm-close'), 'click', closeRoles);
  on($('#rm-cancel'), 'click', closeRoles);
  on(rolesModal, 'click', (e) => { if (e.target === rolesModal) closeRoles(); });
  on($('#rm-save'), 'click', saveRoles);
  on($('#rm-delete'), 'click', deleteRole);

  on($('#modal-close'), 'click', closeModal);
  on(modal, 'click', (e) => { if (e.target === modal) closeModal(); });
  /* 沒被接到的錯誤浮到畫面上。
     這一頁是單檔前端，出事的時候使用者看到的只有「按了沒反應」，
     而主控台不是一般人會打開的地方。有一行字至少知道「是壞掉不是我按錯」，
     也才有東西可以回報。節流是必要的：render 迴圈裡出錯會連噴幾十次。 */
  let lastErr = 0;
  const showErr = (what, e) => {
    const now = Date.now();
    if (now - lastErr < 3000) return;
    lastErr = now;
    toast(what + '：' + ((e && e.message) || e));
  };
  addEventListener('error', (e) => showErr('頁面出錯', e.error || e.message));
  addEventListener('unhandledrejection', (e) => showErr('頁面出錯', e.reason));

  for (const [dialog, close] of [
    [pop, closePop], [pick, closePick], [modal, closeModal], [edit, closeEdit],
    [rolesModal, closeRoles], [ioModal, closeIO], [eqsel, closeEqsel],
    [qadd, closeQadd], [srcModal, closeSrc], [askBox, () => closeAsk(false)],
  ]) on(dialog, 'cancel', e => { e.preventDefault(); close(); });

  buildShell();
  buildPanes();
  foldHints();


  on($('#btn-guide'), 'click', openGuide);
  on($('#attr-more'), 'click', () => { attrAll = !attrAll; renderTotals(); });
  onHover($('#set-bonus'), setBonusTip, { paper: true });
  on($('#set-bonus'), 'click', (e) => {
    e.stopPropagation(); showTip($('#set-bonus'), setBonusTip, { paper: true });
  });
  addEventListener('scroll', hideTip, { passive: true });
  restoreHero();
  on($('#btn-tools'), 'click', (e) => openVaultTools(e.currentTarget));
  on($('#ask-yes'), 'click', () => closeAsk(true));
  on($('#ask-no'), 'click', () => closeAsk(false));
  on($('#ask-x'), 'click', () => closeAsk(false));
  // 點外面當取消。這幾個都是會刪東西的動作，模糊的操作一律算「不要」。
  on(askBox, 'click', (e) => { if (e.target === askBox) closeAsk(false); });

  on($('#src-close'), 'click', closeSrc);
  on($('#src-ok'), 'click', closeSrc);
  on(srcModal, 'click', (e) => { if (e.target === srcModal) closeSrc(); });
  on($('#attr-src'), 'click', openSrc);

  on($('#qadd-close'), 'click', closeQadd);
  on($('#qadd-cancel'), 'click', closeQadd);
  on($('#qadd-ok'), 'click', saveQadd);
  on($('#qadd-build'), 'change', (e) => {
    QA.build = e.target.value; QA.off.clear(); drawQadd();
  });
  on($('#qadd-all'), 'click', () => { QA.off.clear(); drawQadd(); });
  on($('#qadd-none'), 'click', () => {
    const set = qaSet();
    if (set) for (const it of set.items) QA.off.add(it.slot);
    drawQadd();
  });
  on(qadd, 'click', (e) => { if (e.target === qadd) closeQadd(); });

  on($('#eqsel-close'), 'click', closeEqsel);
  on($('#eqsel-cancel'), 'click', closeEqsel);
  on($('#eqsel-ok'), 'click', saveEqsel);
  on(eqsel, 'click', (e) => { if (e.target === eqsel) closeEqsel(); });

  on($('#goal-add'), 'click', openGoalPicker);
  on($('#goal-seed'), 'click', seedGoals);

  $('#btn-suggest')?.addEventListener('click', () => {
    const n = suggestAll(); render();
    toast(n ? '已套用建議到 ' + n + ' 件（原本空的那些）' : '每一件都填過了，沒有動');
  });
  $('#btn-max')?.addEventListener('click', () => {
    fillAllMax(); render(); toast('已把所有已選詞條拉到上限');
  });
  on($('#btn-import'), 'click', openImport);
  on($('#btn-export'), 'click', openExport);
  on($('#btn-copy'), 'click', copyText);
  on($('#btn-go'), 'click', goSignup);
  // 邊打邊更新：按鈕停用的原因會跟著換，不用等到按下去才知道
  on($('#slug'), 'input', renderReady);
  on($('#slug'), 'keydown', (e) => {
    if (e.key === 'Enter' && !$('#btn-go').disabled) goSignup();
  });
  try { $('#slug').value = options.slug || new URLSearchParams(location.search).get('slug') || localStorage.getItem(SLUG_KEY) || ''; } catch { $('#slug').value = options.slug || ''; }
  on($('#backup-export'), 'click', openExport);
  on($('#step-build'), 'click', openBuildPicker);
  on($('#step-check'), 'click', () => { if (mq.matches) showSec('power'); showPane('sheet'); $('#slug').focus(); });
  on($('[data-copy]'), 'click', copyText);
  on($('[data-export]'), 'click', openExport);
  on($('[data-reset]'), 'click', async () => {
    if (text() && !await ask({
      title: '清空整份配置', lines: ['這個動作沒有復原。'], ok: '清空', danger: true,
    })) return;
    adopt(emptyState()); render(); toast('已清空');
  });

  const had = restore();
  // 一定要在 restore() 之後：角色是那時候才從 localStorage 讀進來的，
  // 早一步跑等於在修一份還是空的資料。
  healVault();

  // 網址帶進來的配置：跟報名表吃的是同一個參數，所以連結兩邊都能開
  const q = new URLSearchParams(location.search).get('build');
  if (q) {
    try {
      const o = JSON.parse(b64dec(q.startsWith('LJ1.') ? q.slice(4) : q));
      // 連結帶的是一份配置，不是一批角色。存成新的一隻，不覆蓋本機既有的。
      if (had) {
        ROLES.push({ id: nextRoleId(), name: '連結帶入', state: stateFromJSON(o, C, IDX) });
        ACTIVE = ROLES.length - 1;
        S = ROLES[ACTIVE].state;
        toast('連結的配置已存成新角色「連結帶入」');
      } else {
        adopt(stateFromJSON(o, C, IDX));
        toast('已載入連結帶來的配置');
      }
    } catch { toast('連結裡的配置讀不懂，已略過'); }
  }
  render();
}

window.__LOADOUT = {destroy(){
  if (destroyed) return;
  // Flush the debounced save before navigating away.
  if (C && saveT) flushSave();
  destroyed = true; lifetime.abort(); timers.forEach(window.clearTimeout); frames.forEach(window.cancelAnimationFrame);
  closeAsk(false);
  for (const dialog of overlays) { dialog.close(); dialog.removeAttribute('data-on'); }
  overlays.length = 0;
  cleanups.forEach(fn => fn());
  delete window.__LOADOUT;
}};
boot().catch(e => {
  if (destroyed) return;
  const note = document.createElement('p'); note.role = 'alert'; note.textContent = '配置資料無法載入，請重新整理後再試。';
  $('#bhead').replaceWith(note); console.error(e);
});
return window.__LOADOUT;
}

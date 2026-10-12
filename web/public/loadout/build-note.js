// 備戰方案那段文字的**唯一**格式定義：寫出去、讀回來、轉 JSON。
//
// 為什麼要獨立一個檔：這段格式有兩個消費者 —— 配置器（loadout.html）
// 寫它，對決面板（lunjian-layout.html）讀它。各寫一份解析器的話，
// 哪天格式改了只會改到其中一邊，然後某個選手的配置在比賽當天顯示成空白。
//
// 格式長這樣，存進 theatron 報名表的 arts_note 欄位：
//
//     流派　裂石威
//     武器　主 長槍・燕歸 110級｜副 大刀・斷岳 104級
//     武學　八方風雷槍 20｜嗟夫刀法 18
//     心法　山河絕韻 5★（主修）｜易水歌 4★
//     奇術　百鬼打穴手 6｜無相金身 5
//     裝備　左四 時雨×4（110級）｜右四 斷岳×4（106級）
//
// 設計理由在 ../loadout/SPEC.md 決定 2：裁判端與選手端都把這個欄位
// 原樣渲染，所以它必須是人話。可解析是附帶的，不是目的。
//
// 解析一律寬鬆：認得幾行算幾行，認不得的原樣留在 freeText。
// 選手手改壞格式時只會少掉圖示，不會掉資料。

export const SCHEMA = 3;
// 屬性與詞條兩行是算出來的，不解析回去 —— 它們是總計，反推不出來源。
const LABELS = /^(流派|武器|武學|心法|奇術|裝備|其他)[\s　:：]+(.*)$/;
const DERIVED = /^(屬性|詞條)[\s　:：]/;
const split = (s) => s.split(/[｜|]/).map((x) => x.trim()).filter(Boolean);

/** 數值顯示：整數不補小數，有小數就留一位。 */
export const fmtVal = (v) => (Math.round(v * 10) / 10).toFixed(Number.isInteger(v) ? 0 : 1);

export function num(v, lo, hi) {
  const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, hi ? Math.min(hi, n) : n);
}

/* ── 比率換算 ─────────────────────────────────────────────────────────────
   畫面上的「會心率 78.96%（32.23%）」是「你堆到的原始值（實際生效多少）」。

   公式是從工具站的 bundle 逆向出來的，不是猜的：
       calculateComputedAttrValue → qP(raw, lr) 或 VP(raw, lr, 65)
       qe(e, t) = e / t                    ← 核心就這一行
       lr = LEVEL_RESISTANCE（等級抗性），資料表給 2.45
   驗算：78.96→32.23、34.98→14.28、140.93→57.53、33.34→13.61、151.28→100（溢出 0.22）
   五個數字全中，見 ../loadout/SPEC.md。

   兩個面板算法不同，這不是筆誤：
       'gear'   裝備詞條小計 —— 三個都是純除法
       'total'  匯總屬性     —— 精準率多一段「前 65 不打折」
   證據：截圖上裝備那塊 34.98→14.28 是除法；匯總那塊 151.28→100 才是 65 那條。 */
const RATE_CAP = { CRITICAL_RATE: 80, INSIGHT_RATE: 40, ACCURACY_RATE: 100 };
const ACC_FREE = 65;          // 精準率前 65 點不打折（只有匯總那一段用）

/** 資料表裡的等級抗性。查不到就回 0，代表「不換算」。 */
export const levelResist = (C) =>
  Number((C.baseAttr || []).find((a) => a.k === 'LEVEL_RESISTANCE')?.v) || 0;

/**
 * 把原始比率換成實際生效的值。
 *
 * @param key   屬性 key
 * @param raw   你堆到的原始值
 * @param lr    等級抗性
 * @param mode  'gear'（詞條小計）或 'total'（匯總屬性）
 * @returns null 代表這條不用換算；否則 { shown, cap, over }
 *          shown 是封頂後的值，over 是超出去的部分（工具站叫「溢出」）
 */
export function rateOf(key, raw, lr, mode) {
  const cap = RATE_CAP[key];
  if (!cap || !Number.isFinite(raw)) return null;
  // 等級抗性拿不到或 <= 0 就不換算，原樣回傳 —— 跟工具站同一個保險
  const conv = lr > 0
    ? (mode === 'total' && key === 'ACCURACY_RATE'
        ? ACC_FREE + Math.max(raw - ACC_FREE, 0) / lr
        : raw / lr)
    : raw;
  return { shown: Math.min(conv, cap), cap, over: Math.max(conv - cap, 0) };
}

/** 空白狀態。配置器與解析器都從這個形狀開始，欄位才不會兩邊對不上。 */
export function emptyState() {
  return {
    build: null,
    // 主／副武器要用哪一種兵器。null＝跟著流派走（武學綁死在武器上，
    // 所以流派已經決定了該用哪兩把）。填了就是玩家自己覆蓋。
    wpick: { main: null, off: null },
    martials: {},
    minds: [null, null, null, null],   // 第 0 格是主修
    arts: [null, null, null, null],
    // 倉庫：玩家實際擁有的每一件，各自帶自己的套裝、階、六條詞條。
    // 同一個部位可以放好幾件（爆傷一頂、減傷一頂），換裝只是換掛哪一件，
    // 沒掛上的那件數值原封不動留著。
    vault: [],
    // 這次帶什麼：格位 id → 倉庫裡某一件的 id。
    equip: {},
    // 弓箭套裝與武庫。這兩個跟裝備不一樣：沒有詞條、沒有階、只能各挑一個，
    // 所以不進倉庫，就是兩個選擇。飲羽／驚弦／追影 ＋ 通用／裂石／牽絲／破竹／鳴金。
    bow: null,
    arsenal: null,
    // 屬性目標：[{ k: 屬性key, v: 你要達到的數字 }]。
    // **這是玩家自己訂的**，不是從哪裡抄來的一套「標準答案」——
    // 工具站那些目標表是某位玩家的研究成果，掛他的名字，不該搬進來當預設。
    goals: [],
    freeText: '',
  };
}

/** 倉庫裡的八種格位。武器統一是 'weapon' —— 同一把槍主副都掛得上。 */
export const WEAPON_SLOT = 'weapon';

let seq = 0;
/**
 * 新的一件裝備。
 *   slot     'weapon' 或 gearSlots 的 id（head／body／…）
 *   partKey  詞條清單是按這個查的：防具是 EQUIPMENT_HEAD 之類，
 *            武器是兵器型別（EQUIPMENT_WEAPON_SPEAR）。
 */
export function newItem(slot, partKey) {
  seq += 1;
  return {
    id: 'it' + Date.now().toString(36) + seq.toString(36),
    slot, partKey,
    set: null, tier: null,
    quality: 'gold',                 // gold／purple，決定基礎屬性取哪一組
    label: '',                       // 玩家自己的備註：「爆傷」「減傷」「備用」
    first: { k: null, v: null },
    sec: [{ k: null, v: null }, { k: null, v: null }, { k: null, v: null }, { k: null, v: null }],
    pitch: { k: null, v: null },
    chengyin: false,
  };
}

/** 這一格現在掛的是哪一件（沒掛回 null）。 */
export function itemOf(S, slotId) {
  const id = (S.equip || {})[slotId];
  if (!id) return null;
  return (S.vault || []).find((x) => x.id === id) || null;
}

/**
 * 這一格可以掛倉庫裡的哪幾件。
 *
 * 武器有個額外規矩：同一把實體武器不能同時掛在主跟副 —— 你只有那一把。
 * 防具每格只吃自己那一類，天生不會撞。
 */
export function vaultFor(S, slotId) {
  const wantWeapon = slotId === 'w_main' || slotId === 'w_off';
  const other = slotId === 'w_main' ? 'w_off' : slotId === 'w_off' ? 'w_main' : null;
  const taken = other ? (S.equip || {})[other] : null;
  return (S.vault || []).filter((x) => (wantWeapon ? x.slot === WEAPON_SLOT : x.slot === slotId)
    && x.id !== taken);
}

/** 掛上。同一件本來掛在別格的話先拔下來 —— 一件東西只有一個。 */
export function equipItem(S, slotId, itemId) {
  S.equip = S.equip || {};
  for (const k of Object.keys(S.equip)) if (S.equip[k] === itemId) delete S.equip[k];
  S.equip[slotId] = itemId;
}

export function unequip(S, slotId) {
  if (S.equip) delete S.equip[slotId];
}

/** 從倉庫丟掉。掛著的話一併拔下來，不然會留下指向空氣的格位。 */
export function removeItem(S, itemId) {
  S.vault = (S.vault || []).filter((x) => x.id !== itemId);
  for (const k of Object.keys(S.equip || {})) if (S.equip[k] === itemId) delete S.equip[k];
}

/**
 * 裝備格位：主武器、副武器 ＋ 六件防具，共八格。
 *
 * 格位固定存在，換流派不換格；沒掛東西的格位也回，因為畫面上那一格
 * 還是要畫出來讓人點。s.item 是實際掛的那一件，沒掛就是 null。
 */
export function allSlots(S, C, IDX) {
  const out = [];
  for (const [slot, role] of [['main', '主'], ['off', '副']]) {
    const id = 'w_' + slot;
    const it = itemOf(S, id);
    const m = weaponOf(S, IDX, slot);
    // 沒掛東西時，格位仍然知道自己「該」是哪種兵器 —— 詞條清單要按它查
    const key = (it && it.partKey) || (S.wpick || {})[slot] || (m && m.weaponKey) || null;
    const w = key && (C.weapons || []).find((x) => x.key === key);
    out.push({
      id, slotKey: slot, partKey: key,
      name: w ? w.name : '', part: w ? w.name : '',
      side: 'right', kind: 'weapon', img: w ? w.img : '',
      isWeapon: true, role,
      // 掛的兵器跟流派要的那把不同就標出來 —— 武學綁死在武器上，對不上就白配
      offBuild: !!(key && m && m.weaponKey && key !== m.weaponKey),
      item: it,
    });
  }
  for (const g of C.gearSlots) out.push({ ...g, isWeapon: false, item: itemOf(S, g.id) });
  return out;
}

/** 某一格實際用的兵器型別 key（先看掛了什麼，再看玩家覆蓋，最後看流派）。 */
export function weaponKeyOf(S, IDX, slot) {
  const it = itemOf(S, 'w_' + slot);
  if (it && it.partKey) return it.partKey;
  const pick = (S.wpick || {})[slot];
  if (pick) return pick;
  const m = weaponOf(S, IDX, slot);
  return m ? m.weaponKey : null;
}

/**
 * 這一格的套裝與階。
 *
 * 舊版這裡要從兩個袋子裡撈（武器按型別、防具按格位）；現在掛上去的
 * 那一件**自己就是**答案，套裝、階、六條詞條全在同一個物件上。
 * 沒掛東西時回一個唯讀的空殼，讓讀的人不用到處判 null。
 */
const BLANK = Object.freeze({ set: null, tier: null, quality: 'gold' });
export function confOf(S, s) {
  return (s && s.item) || itemOf(S, s && s.id) || BLANK;
}

/** 名稱優先用資料表裡那件（流星羽林），沒有才退回兵器型別。 */
export function itemNameOf(C, partKey) {
  const g = (C.gearBase || []).find((x) => x.key === partKey);
  return g && g.name ? g.name : null;
}

// ── 狀態 → 文字 ───────────────────────────────────────────────────────────
export function formatNote(S, C, IDX) {
  const L = [];
  const b = IDX[S.build];
  if (b) L.push('流派　' + b.name);

  const w = [];
  for (const [slot, label] of [['main', '主'], ['off', '副']]) {
    const key = weaponKeyOf(S, IDX, slot);
    if (!key) continue;
    const wm = (C.weapons || []).find((x) => x.key === key);
    const g = itemOf(S, 'w_' + slot) || {};
    const set = g.set && IDX[g.set] ? IDX[g.set].name : '';
    w.push(label + ' ' + (wm ? wm.name : key)
      + (set ? '・' + set : '') + (g.tier ? ' ' + g.tier + '級' : ''));
  }
  if (w.length) L.push('武器　' + w.join('｜'));

  const ms = (b ? b.martials : []).map((k) => {
    const m = IDX[k];
    if (!m) return null;
    const lv = S.martials[k];
    return m.name + (lv ? ' ' + lv : '');
  }).filter(Boolean);
  if (ms.length) L.push('武學　' + ms.join('｜'));

  const xs = S.minds.map((m, i) => m
    ? m.name + (m.lv ? ' ' + m.lv + '★' : '') + (i === 0 ? '（主修）' : '')
    : null).filter(Boolean);
  if (xs.length) L.push('心法　' + xs.join('｜'));

  const as = S.arts.map((a) => a ? a.name + (a.lv ? ' ' + a.lv : '') : null).filter(Boolean);
  if (as.length) L.push('奇術　' + as.join('｜'));

  const gs = [];
  for (const [side, label] of [['left', '左四'], ['right', '右四']]) {
    // 右四包含兩把武器。現在武器跟防具都是倉庫裡的一件，不用再分兩袋撈。
    const picked = allSlots(S, C, IDX)
      .filter((x) => x.side === side && x.item)
      .map((x) => x.item).filter((x) => x.set);
    if (!picked.length) continue;
    // 同一套寫「時雨×4」，混搭就逐套列出來，不假裝整齊
    const bySet = {};
    for (const p of picked) bySet[p.set] = (bySet[p.set] || 0) + 1;
    const names = Object.entries(bySet)
      .map(([k, n]) => (IDX[k] ? IDX[k].name : k) + (n > 1 ? '×' + n : ''));
    const tiers = picked.map((p) => p.tier).filter(Boolean);
    const lo = Math.min(...tiers), hi = Math.max(...tiers);
    gs.push(label + ' ' + names.join('・')
      + (tiers.length ? '（' + (lo === hi ? lo : lo + '–' + hi) + '級）' : ''));
  }
  if (gs.length) L.push('裝備　' + gs.join('｜'));

  // 弓與武庫各一行不划算，併成一行
  const extra = [];
  const bowMeta = S.bow && (C.sets || []).find((x) => x.key === S.bow);
  if (bowMeta) extra.push('弓 ' + bowMeta.name);
  const arsMeta = S.arsenal && (C.arsenals || []).find((x) => x.key === S.arsenal);
  if (arsMeta) extra.push('武庫 ' + arsMeta.name);
  if (extra.length) L.push('其他　' + extra.join('｜'));

  // 屬性只寫總計的前幾條。細節（十件 × 六條詞條）留在 JSON 匯出 ——
  // 全寫進來裁判那一格就沒法讀了，而這個欄位是給人看的。
  const A = computeAttrs(S, C, IDX);
  if (A.total.length) {
    const top = A.total.slice(0, 6)
      .map((r) => r.n + ' ' + fmtVal(r.v) + (r.pct ? '%' : ''));
    L.push('屬性　' + top.join('｜'));
  }
  if (A.grad !== null) {
    L.push('詞條　已填 ' + A.filled + ' 條，畢業率 ' + (A.grad * 100).toFixed(1) + '%');
  }

  let out = L.join('\n');
  if (S.freeText) out = (out ? out + '\n\n' : '') + S.freeText;
  return out;
}

// ── 文字 → 狀態 ───────────────────────────────────────────────────────────
export function parseNote(text, C, IDX) {
  const S = emptyState();
  const keep = [];
  let hits = 0;

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    // 屬性／詞條是我們自己算出來印上去的，再讀回來只會變成重複的自由文字
    if (DERIVED.test(line)) continue;
    const m = line.match(LABELS);
    if (!m) { if (line) keep.push(raw); continue; }
    const [, label, rest] = m;
    const parts = split(rest);
    hits++;

    if (label === '流派') {
      const b = C.builds.find((x) => x.name === rest.trim());
      if (b) setBuild(S, b.key); else { keep.push(raw); hits--; }
    } else if (label === '武器') {
      for (const p of parts) {
        const slot = /^主/.test(p) ? 'main' : /^副/.test(p) ? 'off' : null;
        if (!slot) continue;
        const set = C.sets.find((s) => p.includes(s.name));
        // 「級」是現在寫出去的字，「階」是以前的 —— 兩種都要讀得回來
        const tier = (p.match(/(\d+)\s*[階級]/) || [])[1];
        // 文字只寫得下兵器、套裝、階；六條詞條讀不回來，那本來就只在 JSON 裡
        const wm = (C.weapons || []).find((x) => p.includes('・' + x.name) || p.includes(x.name));
        const m = weaponOf(S, IDX, slot);
        const key = (wm && wm.key) || (m && m.weaponKey);
        if (!key) continue;
        const it = newItem(WEAPON_SLOT, key);
        it.set = set ? set.key : null;
        it.tier = tier ? +tier : null;
        S.vault.push(it);
        equipItem(S, 'w_' + slot, it.id);
      }
    } else if (label === '武學') {
      for (const p of parts) {
        const hit = C.martials.find((x) => p.startsWith(x.name));
        if (hit) S.martials[hit.key] = num(p.slice(hit.name.length), 1, C.caps.martial);
      }
    } else if (label === '心法') {
      let i = 1;
      for (const p of parts) {
        const hit = C.minds.find((x) => p.startsWith(x.name));
        const item = hit
          ? { key: hit.key, name: hit.name, lv: num(p, 1, C.caps.mind) }
          : { key: null, name: p.replace(/[\d★（）()主修\s]+$/g, '').trim(), lv: num(p, 1, C.caps.mind) };
        if (!item.name) continue;
        if (p.includes('主修')) S.minds[0] = item;
        else if (i < 4) S.minds[i++] = item;
      }
    } else if (label === '奇術') {
      let i = 0;
      for (const p of parts) {
        const hit = C.arts.find((x) => p.startsWith(x.name));
        const item = hit
          ? { key: hit.key, name: hit.name, lv: num(p.slice(hit.name.length), 1) }
          : { key: null, name: p.replace(/[\d\s]+$/, '').trim(), lv: num(p, 1) };
        if (item.name && i < 4) S.arts[i++] = item;
      }
    } else if (label === '其他') {
      for (const x of parts) {
        const b = /^弓\s*(.+)$/.exec(x);
        if (b) {
          const hit = (C.sets || []).find((y) => y.bow && y.name === b[1].trim());
          if (hit) S.bow = hit.key;
          continue;
        }
        const a = /^武庫\s*(.+)$/.exec(x);
        if (a) {
          const hit = (C.arsenals || []).find((y) => y.name === a[1].trim());
          if (hit) S.arsenal = hit.key;
        }
      }
    } else if (label === '裝備') {
      for (const p of parts) {
        const side = p.startsWith('左') ? 'left' : p.startsWith('右') ? 'right' : null;
        if (!side) continue;
        const set = C.sets.find((s) => p.includes(s.name));
        const tier = (p.match(/(\d+)/g) || []).pop();
        for (const g of C.gearSlots.filter((x) => x.side === side)) {
          const it = newItem(g.id, g.partKey);
          it.set = set ? set.key : null;
          it.tier = tier ? +tier : null;
          S.vault.push(it);
          equipItem(S, g.id, it.id);
        }
      }
    }
  }
  S.freeText = keep.join('\n').trim();
  S.parsedLines = hits;
  return S;
}

// ── JSON ─────────────────────────────────────────────────────────────────
// k 為準，n 只是給人看的註解，v 讓未來換結構還讀得懂舊檔。

/** 一件裝備 → 精簡陣列形式。詞條寫成 [key, 值] 省掉一半體積。 */
const packItem = (it, C, IDX) => {
  const o = { id: it.id, slot: it.slot, k: it.partKey || null };
  const nm = it.slot === WEAPON_SLOT
    ? ((C.weapons || []).find((x) => x.key === it.partKey) || {}).name
    : ((C.gearSlots || []).find((x) => x.id === it.slot) || {}).name;
  if (nm) o.n = nm;                                   // 給人看的，程式不讀
  if (it.set) { o.set = it.set; if (IDX[it.set]) o.setN = IDX[it.set].name; }
  if (it.tier) o.tier = it.tier;
  if (it.quality && it.quality !== 'gold') o.q = it.quality;
  if (it.label) o.label = it.label;
  if (it.first && it.first.k) o.first = [it.first.k, it.first.v];
  const sec = (it.sec || []).map((x) => (x && x.k ? [x.k, x.v, x.carry ? 1 : 0] : null));
  if (sec.some(Boolean)) o.sec = sec;
  if (it.pitch && it.pitch.k) o.pitch = [it.pitch.k, it.pitch.v];
  if (it.chengyin) o.cy = 1;
  return o;
};

const unpackItem = (o) => {
  const it = newItem(o.slot || null, o.k || null);
  if (o.id) it.id = o.id;
  it.set = o.set || null;
  it.tier = o.tier || null;
  it.quality = o.q === 'purple' ? 'purple' : 'gold';
  it.label = o.label || '';
  it.chengyin = !!o.cy;
  if (o.first) it.first = { k: o.first[0], v: o.first[1] };
  if (o.pitch) it.pitch = { k: o.pitch[0], v: o.pitch[1] };
  (o.sec || []).slice(0, 4).forEach((x, i) => {
    if (x) it.sec[i] = { k: x[0], v: x[1], carry: !!x[2] };
  });
  return it;
};

export function toJSON(S, C, IDX) {
  const b = IDX[S.build];
  const o = { v: SCHEMA };
  if (b) o.build = b.key;
  o.martials = (b ? b.martials : []).map((k) => IDX[k] && ({
    k, n: IDX[k].name, lv: S.martials[k] || null,
  })).filter(Boolean);
  // auto 要跟著走：少了它，重整之後自動補的會被當成「你自己挑的」，
  // 下次換流派就換不掉，必備心法永遠補不進來。
  o.minds = S.minds.map((m, i) => m && ({
    k: m.key, n: m.name, lv: m.lv, main: i === 0, auto: m.auto ? 1 : undefined,
  })).filter(Boolean);
  o.arts = S.arts.map((a) => a && ({ k: a.key, n: a.name, lv: a.lv })).filter(Boolean);
  // 整個倉庫都帶走 —— 沒掛上的那幾件也是你的東西，而且往往是備著要比較的
  o.vault = (S.vault || []).map((it) => packItem(it, C, IDX));
  o.equip = { ...(S.equip || {}) };
  if (S.bow) {
    const m = (C.sets || []).find((x) => x.key === S.bow);
    o.bow = { k: S.bow, n: m ? m.name : undefined };
  }
  if (S.arsenal) {
    const m = (C.arsenals || []).find((x) => x.key === S.arsenal);
    o.arsenal = { k: S.arsenal, n: m ? m.name : undefined };
  }
  // 目標帶著走：換一台機器、丟給別人看，都要知道你是照什麼標準在配
  if ((S.goals || []).length) {
    o.goals = S.goals.map((g) => {
      const m = (C.stats || []).find((x) => x.key === g.k);
      return { k: g.k, n: m ? m.name : undefined, v: g.v };
    });
  }
  // 玩家自己覆蓋過主／副要用哪種兵器時才寫
  for (const k of ['main', 'off']) if ((S.wpick || {})[k]) (o.wpick = o.wpick || {})[k] = S.wpick[k];
  // 數值是綁遊戲版本的。少了這個，半年後這份檔的數字沒人知道是哪一版。
  if (C.version) o.dataVersion = C.version.key;
  if (S.freeText) o.note = S.freeText;
  return o;
}

/**
 * v2（格位導向）→ v3（倉庫導向）。
 *
 * 舊檔一個部位只有一組數值，所以轉出來就是一格一件，全部掛著。
 * 舊檔的 bench（換流派後留著的武器）本來就是個半成品倉庫，
 * 這裡正好併進來變成沒掛上的那幾件。
 */
function fromV2(o, C, IDX, S) {
  const pieceOf = (slot) => (o.pieces || []).find((x) => x.slot === slot) || null;
  const build = (slot, partKey, conf, target) => {
    const src = pieceOf(target);
    const it = unpackItem({
      slot, k: partKey,
      set: conf && conf.set, tier: conf && conf.tier,
      q: src && src.quality, cy: src && src.chengyin,
      first: src && src.first, sec: src && src.sec, pitch: src && src.pitch,
    });
    S.vault.push(it);
    return it;
  };
  for (const w of o.weapons || []) {
    if (!w.k) continue;
    const it = build(WEAPON_SLOT, w.k, w, 'w_' + w.slot);
    equipItem(S, 'w_' + w.slot, it.id);
    if (w.pick && (w.slot === 'main' || w.slot === 'off')) S.wpick[w.slot] = w.pick;
  }
  // 沒掛上但配過的武器：留在倉庫，換回那個流派時還在
  for (const w of o.bench || []) if (w.k) build(WEAPON_SLOT, w.k, w, null);
  for (const g of C.gearSlots) {
    const conf = (o.gear || []).find((x) => x.slot === g.id);
    if (!conf && !pieceOf(g.id)) continue;      // 這一格舊檔根本沒碰過
    const it = build(g.id, g.partKey, conf, g.id);
    equipItem(S, g.id, it.id);
  }
}

export function fromJSON(o, C, IDX) {
  const S = emptyState();
  if (o.build && IDX[o.build]) setBuild(S, o.build);
  for (const m of o.martials || []) {
    const hit = IDX[m.k] || C.martials.find((x) => x.name === m.n);
    if (hit && m.lv) S.martials[hit.key] = num(m.lv, 1, C.caps.martial);
  }
  (o.minds || []).slice(0, 4).forEach((m) => {
    const hit = IDX[m.k] || C.minds.find((x) => x.name === m.n);
    const item = { key: hit ? hit.key : null, name: hit ? hit.name : m.n,
      lv: m.lv ? num(m.lv, 1, C.caps.mind) : null, auto: !!m.auto };
    if (!item.name) return;
    if (m.main) S.minds[0] = item;
    else { const i = S.minds.findIndex((x, ix) => ix > 0 && !x); if (i > 0) S.minds[i] = item; }
  });
  (o.arts || []).slice(0, 4).forEach((a, i) => {
    const hit = IDX[a.k] || C.arts.find((x) => x.name === a.n);
    S.arts[i] = { key: hit ? hit.key : null, name: hit ? hit.name : a.n, lv: a.lv ? num(a.lv, 1) : null };
  });

  if (Array.isArray(o.vault)) {
    // v3：直接讀。掛的那一格指到不存在的件時就當空著，不要指向空氣。
    S.vault = o.vault.map(unpackItem);
    const has = new Set(S.vault.map((x) => x.id));
    for (const [slot, id] of Object.entries(o.equip || {})) if (has.has(id)) S.equip[slot] = id;
    for (const k of ['main', 'off']) if ((o.wpick || {})[k]) S.wpick[k] = o.wpick[k];
  } else {
    fromV2(o, C, IDX, S);
  }

  if (o.bow && o.bow.k && (C.sets || []).some((x) => x.key === o.bow.k)) S.bow = o.bow.k;
  if (o.arsenal && o.arsenal.k && (C.arsenals || []).some((x) => x.key === o.arsenal.k)) {
    S.arsenal = o.arsenal.k;
  }
  S.goals = (o.goals || [])
    .filter((g) => g && g.k && Number.isFinite(Number(g.v)))
    .map((g) => ({ k: g.k, v: Number(g.v) }));
  S.freeText = o.note || '';
  return S;
}

/**
 * 把任何來源的狀態正規化成 v3。localStorage 裡的舊角色走這裡 ——
 * 不轉的話那些人打開頁面會看到自己配好的裝備整組不見。
 */
export function migrateState(S, C, IDX) {
  if (!S || typeof S !== 'object') return emptyState();
  if (Array.isArray(S.vault)) {                 // 已經是 v3
    S.equip = S.equip || {};
    return S;
  }
  const out = emptyState();
  out.build = S.build || null;
  out.martials = S.martials || {};
  out.minds = S.minds || out.minds;
  out.arts = S.arts || out.arts;
  out.wpick = S.wpick || out.wpick;
  out.goals = Array.isArray(S.goals) ? S.goals : [];
  out.bow = S.bow || null;
  out.arsenal = S.arsenal || null;
  out.freeText = S.freeText || '';
  fromV2({
    weapons: ['main', 'off'].map((slot) => {
      const key = (S.wpick || {})[slot];
      const m = IDX[(IDX[S.build] || { martials: [] }).martials[slot === 'main' ? 0 : 1]];
      const k = key || (m && m.weaponKey);
      return k ? { slot, k, ...((S.weapons || {})[k] || {}) } : null;
    }).filter(Boolean),
    bench: Object.entries(S.weapons || {}).map(([k, v]) => ({ k, ...v })),
    gear: Object.entries(S.gear || {}).map(([slot, v]) => ({ slot, ...v })),
    pieces: Object.entries(S.pieces || {}).map(([slot, v]) => ({
      slot, quality: v.quality, chengyin: v.chengyin,
      first: v.first && v.first.k ? [v.first.k, v.first.v] : null,
      sec: (v.sec || []).map((x) => (x && x.k ? [x.k, x.v, x.carry ? 1 : 0] : null)),
      pitch: v.pitch && v.pitch.k ? [v.pitch.k, v.pitch.v] : null,
    })),
  }, C, IDX, out);
  // bench 會把已掛上的武器再放一份進倉庫，去重
  const worn = new Set(Object.values(out.equip));
  const seen = new Set();
  out.vault = out.vault.filter((it) => {
    if (worn.has(it.id)) { seen.add(it.slot + '|' + it.partKey); return true; }
    const sig = it.slot + '|' + it.partKey;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return !!(it.set || it.tier || it.first.k);
  });
  return out;
}

/**
 * 目標達成率。
 *
 * 每一條 ＝ min(1, 你的值 ÷ 你的目標)，整體取平均。
 * 封頂在 1 是刻意的：某一條超標 300% 不該把其他沒達標的條目蓋過去，
 * 那會讓「還差什麼」看不出來，而這個面板存在的意義就是回答那件事。
 */
export function goalProgress(S, C, IDX, A) {
  const attrs = A || computeAttrs(S, C, IDX);
  const cur = new Map(attrs.total.map((r) => [r.k, r.v]));
  const meta = new Map((C.stats || []).map((x) => [x.key, x]));
  const rows = (S.goals || [])
    .filter((g) => g && g.k && Number.isFinite(g.v) && g.v > 0)
    .map((g) => {
      const m = meta.get(g.k);
      const now = cur.get(g.k) || 0;
      return {
        k: g.k, n: m ? m.name : g.k, pct: !!(m && m.pct),
        now, goal: g.v, rate: Math.min(1, now / g.v), short: Math.max(0, g.v - now),
      };
    });
  const rate = rows.length ? rows.reduce((n, r) => n + r.rate, 0) / rows.length : null;
  return { rows, rate, done: rows.filter((r) => r.rate >= 1).length };
}

// ── 詞條與數值 ───────────────────────────────────────────────────────────
// 數值來源：工具站 entry bundle 裡的資料表（見 ../loadout/tools/fetch-table.py）。
// base／max 是「這條詞條最高能滾到多少」—— 判斷一件裝備好壞的分母。
// 玩家自己那件實際滾到多少，只有他看得到，所以那個值是他填的。

/**
 * 這個部位能出現哪些詞條。首詞條與副詞條的可用清單不一樣 ——
 * 例如外功攻擊當首詞條只上武器與環佩，當副詞條連防具都能上。
 *
 * max 是 0 的要濾掉。資料表裡 MAX_HP 與 EXTERNAL_DEFENCE 兩條是 0，
 * 代表這一版它們滾不出來；留在選單裡只會讓人選了之後發現填什麼都不算分。
 */
export function tuningsFor(C, partKey, which = 'first') {
  const field = which === 'first' ? 'first' : 'sec';
  return C.tunings.filter((t) => t.max > 0 && (t[field] || []).includes(partKey));
}

export function pitchesFor(C, partKey) {
  return C.pitches.filter((p) => p.max > 0 && (p.slots || []).includes(partKey));
}

/** 滾動品質分四段，跟工具站同一組分界。回 1..4，沒得比就回 0。 */
export function rollTone(v, max) {
  if (!Number.isFinite(v) || !Number.isFinite(max) || max <= 0) return 0;
  const r = v / max;
  return r < 0.5 ? 1 : r < 0.6 ? 2 : r < 0.88 ? 3 : 4;
}

const addTo = (map, k, n, v, pct) => {
  if (!k || !Number.isFinite(v)) return;
  const row = map.get(k) || { k, n, pct, v: 0, count: 0 };
  row.v += v;
  row.count += 1;
  map.set(k, row);
};

/**
 * 把整份配置算成屬性總計。
 *
 * 分四層加：裝備詞條（玩家填的）、裝備基礎屬性、套裝效果、心法。
 * 每一層都標出來，因為它們的可信度不同 —— 詞條是玩家自填的，
 * 其餘三層是資料表給的。
 *
 * grad（畢業率）只看詞條那一層：填了的格子算 v/max，沒填的不計入分母。
 * 所以它衡量「已有的裝備滾得好不好」，不是「配齊了沒有」。
 */
export function computeAttrs(S, C, IDX) {
  const tune = new Map();      // 詞條小計
  const gear = new Map();      // 裝備基礎 ＋ 套裝
  const mind = new Map();      // 心法
  const ideal = new Map();     // 同樣的選擇但每條都滿
  let got = 0, full = 0, filled = 0, slots = 0;

  const tMeta = new Map(C.tunings.map((t) => [t.key, t]));
  const pMeta = new Map(C.pitches.map((p) => [p.key, p]));
  const baseByPart = new Map(C.gearBase.map((g) => [g.key, g]));

  for (const s of allSlots(S, C, IDX)) {
    // 掛上的那一件同時就是詞條與套裝的來源 —— 沒掛的格位什麼都不算
    const p = s.item;
    const conf = p || BLANK;

    // 一件裝備的六個詞條格：首 1、副 4、定音 1
    const rows = p ? [
      { ...p.first, meta: tMeta.get(p.first.k) },
      ...p.sec.map((x) => ({ ...x, meta: tMeta.get(x.k) })),
      { ...p.pitch, meta: pMeta.get(p.pitch.k) },
    ] : [];
    slots += 6;
    for (const r of rows) {
      if (!r.k || !r.meta) continue;
      const max = r.meta.max;
      addTo(ideal, r.k, r.meta.name, max, r.meta.pct);
      if (!Number.isFinite(r.v)) continue;
      addTo(tune, r.k, r.meta.name, r.v, r.meta.pct);
      got += r.v; full += max; filled += 1;
    }

    // 裝備基礎屬性：金裝一組、紫裝一組
    const gb = baseByPart.get(p ? p.partKey || s.partKey : s.partKey);
    if (gb && p) for (const a of (p.quality === 'purple' ? gb.purple : gb.gold)) addTo(gear, a.k, a.n, a.v, a.pct);
    // 套裝效果
    const set = conf.set && IDX[conf.set];
    if (set) for (const a of set.attr || []) addTo(gear, a.k, a.n, a.v, a.pct);
  }

  for (const m of S.minds) {
    if (!m || !m.key) continue;
    for (const a of (C.mindAttr || {})[m.key] || []) addTo(mind, a.k, a.n, a.v, a.pct);
  }

  // 弓箭套裝與武庫。歸在 gear 那一層 —— 跟套裝一樣是「選了就給」，
  // 不是玩家自己滾出來的，所以不該混進詞條那層去影響畢業率。
  const bow = S.bow && (C.sets || []).find((x) => x.key === S.bow);
  if (bow) for (const a of bow.attr || []) addTo(gear, a.k, a.n, a.v, a.pct);
  const ars = S.arsenal && (C.arsenals || []).find((x) => x.key === S.arsenal);
  if (ars) for (const a of ars.attr || []) addTo(gear, a.k, a.n, a.v, a.pct);

  const merge = (...maps) => {
    const out = new Map();
    for (const m of maps) for (const r of m.values()) addTo(out, r.k, r.n, r.v, r.pct);
    return [...out.values()].sort((a, b) => b.v - a.v);
  };

  return {
    tune: [...tune.values()].sort((a, b) => b.count - a.count || b.v - a.v),
    ideal: [...ideal.values()],
    total: merge(tune, gear, mind),
    gear: [...gear.values()],
    mind: [...mind.values()],
    grad: full > 0 ? got / full : null,
    filled, slots,
  };
}

// ── 共用 ─────────────────────────────────────────────────────────────────
export function weaponOf(S, IDX, slot) {
  const b = IDX[S.build];
  if (!b) return null;
  return IDX[b.martials[slot === 'main' ? 0 : 1]] || null;
}

export function setBuild(S, key) {
  if (S.build !== key) {
    // 武學綁死在武器上，換流派整組失效。等級不留 —— 留著會對到別人的武學。
    // 但**武器與裝備都留著**：那是倉庫，不是這一套配裝的一部分。
    // 換回原本的流派時，先前配好的東西要還在。
    S.martials = {};
  }
  S.build = key;
  return S;
}

/** key → 物件的索引。兩個消費者都要，就放這裡。 */
export function indexOf(C) {
  const IDX = {};
  for (const list of ['builds', 'martials', 'minds', 'arts', 'sets']) {
    for (const x of C[list]) IDX[x.key] = x;
  }
  return IDX;
}

/**
 * 把一段報名文字整理成對決面板要的形狀。
 * 面板要的是「武器兩把、技能四個、心法四格帶主修、奇術四個」，
 * 跟配置器的狀態不同形 —— 那邊是編輯用的，這邊是展示用的。
 * ok=false 表示一行都沒認出來，面板該退回顯示原文而不是顯示空格。
 */
export function toPanel(text, C, IDX) {
  const S = parseNote(text, C, IDX);
  const b = IDX[S.build];
  const weapons = [], skills = [];
  for (const [slot, role] of [['main', '主'], ['off', '副']]) {
    const m = weaponOf(S, IDX, slot);
    if (!m) continue;
    const g = itemOf(S, 'w_' + slot) || {};
    const set = g.set && IDX[g.set] ? IDX[g.set].name : null;
    weapons.push({
      role, art: m.name, arm: m.weapon + (set ? '・' + set : '') + (g.tier ? ' ' + g.tier + '級' : ''),
      img: m.img, weaponImg: m.weaponImg, lv: S.martials[m.key] || null,
    });
    skills.push({ arm: m.name, key: 'Q', n: '武學技' }, { arm: m.name, key: '~', n: '特殊技' });
  }
  return {
    ok: S.parsedLines > 0,
    raw: String(text || ''),
    buildName: b ? b.name : null,
    weapons, skills,
    xinfa: S.minds.filter(Boolean),
    zhu: S.minds[0] || null,
    qishu: S.arts.filter(Boolean).map((a) => ({
      n: a.name, lv: a.lv, k: a.key && IDX[a.key] ? IDX[a.key].cat : '自填',
    })),
    gear: C.gearSlots.map((g) => ({ ...g, ...(itemOf(S, g.id) || {}) })).filter((g) => g.set),
    freeText: S.freeText,
    state: S,
  };
}


/** The registration projection uses the same human-readable format as the editor. */
export function enrollmentCharacter(state, catalog, idx) {
  const arts = formatNote(state, catalog, idx);
  const lines = {};
  for (const line of arts.split('\n')) {
    const match = line.match(LABELS);
    if (match && !(match[1] in lines)) lines[match[1]] = match[2];
  }
  const equipped = allSlots(state, catalog, idx).some(slot => slot.item);
  return {
    style: idx[state.build]?.name || '',
    weapon: lines['武器'] || '',
    equipment: [lines['裝備'], lines['其他']].filter(Boolean).join('｜') || (equipped ? '已配置裝備（未設定套裝）' : '無'),
    arts,
  };
}


(() => {
'use strict';
if (!document.getElementById('world')) return;
window.__LUNJIAN?.destroy?.();

const lifetime = new AbortController();
let destroyed = false;
const timers = new Set(), frames = new Set(), cleanups = [];
let comicTimelines = [], comicTargets = [], comicObserver = null, comicSequence = null;
let chapterTitles=null,bracketTree=null,arenaTicket=null;
let bracketModule=null,ticketModule=null,editorModule=null,bracketEditor=null;
const previewDrafts=Object.create(null);
cleanups.push(()=>{bracketTree?.destroy();arenaTicket?.destroy();bracketEditor?.destroy();});
cleanups.push(()=>chapterTitles?.destroy());
const on = (target, type, fn, options = {}) => target.addEventListener(type, fn,
  { ...(typeof options === 'boolean' ? {capture:options} : options), signal:lifetime.signal });
const addEventListener = (type, fn, options) => on(window, type, fn, options);
const setTimeout = (fn, ms) => { const id = window.setTimeout(() => { timers.delete(id); if (!destroyed) fn(); }, ms); timers.add(id); return id; };
const requestAnimationFrame = fn => { const id = window.requestAnimationFrame(t => { frames.delete(id); if (!destroyed) fn(t); }); frames.add(id); return id; };

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const body = document.body;
import('/lunjian/boot-symbol.js?v=b5718e17a607').then(({createBootSymbol})=>{if(!lifetime.signal.aborted)cleanups.push(createBootSymbol($('#boot'),lifetime.signal));}).catch(()=>{});

const rulesDialog = $('#rules-dialog');
const rulesTrigger = $('.rules-open');
if (rulesDialog && rulesTrigger) {
  on(rulesTrigger,'click',()=>{rulesDialog.showModal();rulesDialog.scrollTop=0;});
  on(rulesDialog.querySelector('[data-rules-close]'),'click',()=>rulesDialog.close());
  on(rulesDialog,'keydown',e=>e.stopPropagation());
  on(rulesDialog,'close',()=>rulesTrigger.focus({preventScroll:true}));
  on(rulesDialog,'click',e=>{
    const r=rulesDialog.getBoundingClientRect();
    if(e.target===rulesDialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))rulesDialog.close();
    if(e.target.closest('a[href^="#"]'))rulesDialog.close();
  });
}

const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => x*x*(3-2*x);
const escapeHTML=value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const playerRank=p=>p?.rankName || RANKS[p?.rank-1]?.name || '待評定';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const qs = new URLSearchParams(location.search);
const managerMode = qs.get('mode') === 'manage';
body.toggleAttribute('data-manager-mode', managerMode);
cleanups.push(()=>body.removeAttribute('data-manager-mode'));
let preview = qs.get('preview') === '1';
body.toggleAttribute('data-preview', preview);
let tournament={kind:'unconfigured',slug:'',players:[],rounds:[],published:false,bestOf:0};
let activity = {kind:'unconfigured',slug:'',status:'報名資訊尚未公布',label:'查看賽制',href:'#rules',phase:-1};

/* ══ 資料（示範）═══════════════════════════════════════
   比賽事實一律「待公布」，示範數字全部由下面這組 fixture 來，
   畫面上不手寫任何比賽數字（BRIEF D11）。 */
const RANKS = [
  {name:'開山', title:'初試之境'}, {name:'斷水', title:'初成之境'},
  {name:'飛花', title:'純熟之境'}, {name:'無我', title:'歷戰之境'},
];
const PHASES = ['報名','報名截止','評段','段位公布','抽籤','比賽中','結束'];
const NAMES = ['聞人夜','白十七','沈青梧','柳三更','陸未晞','崔無咎','南宮燼','謝長庚',
  '溫鶴亭','裴不言','姜斗南','衛拂衣','闕聽雪','孟歸舟','殷折枝','雲藏鋒',
  '獨孤煜','燕辭鏡','傅寒山','蕭聞笛','駱聽泉','卜晚舟','扶蘇影','甯知微'];
const LADDER = ['青鋒','玄鐵','承影','湛盧'];
const BP_PER_GAP = 8;

/* ── 選手配置：依《燕雲十六聲》的備戰方案 ─────────────────────────
   規則來自遊戲本身，不是這場賽事自訂的：

     武器      2 個武器位（主 ／ 副）。決定基礎攻速、攻擊距離、破定能力。
               不同武器的輕重攻擊派生連招，在 PVP 裡是抓閃避、壓起手、拉扯的關鍵。
     武學技能  共 4 個 —— 每把武器各 2 個：武學技（Q）與特殊技（~）。
               核心控制與爆發來源；強度取決於是否附帶霸體、無法閃避、強力擊飛。
     心法      4 格，其中 1 個是主修。主修決定流派走向，給巨額特定屬性加成
               並附帶改變戰局的被動（低血量觸發護盾、受控時減傷…）。
     奇術      4 個主動格（走完「五音啟太平」可擴到 8）。戰術博弈的核心。

   名稱取自遊戲內的備戰方案，這裡是示範資料 —— 正式賽事由選手在報名表自填。 */
const WEAPON_SLOTS = 2, SKILL_SLOTS = 4, XINFA_SLOTS = 4, QISHU_SLOTS = 4;
/** 一套武學配一把兵器。主副各一套。 */
const SCHOOLS = [
  {art:'積矩九劍',   arm:'危寂長劍', q:'蓄力技', s:'重擊'},
  {art:'九曲驚神槍', arm:'危寂長槍', q:'橫掃',   s:'突刺'},
  {art:'無名劍法',   arm:'危寂長劍', q:'蓄力技', s:'劍氣'},
  {art:'無名槍法',   arm:'危寂長槍', q:'挑擊',   s:'迴旋'},
  {art:'八方風雷槍', arm:'雷紋長槍', q:'雷引',   s:'貫穿'},
  {art:'明川藥典',   arm:'藥杵',     q:'施藥',   s:'驅毒'},
];
const XINFA = ['無名心法','易水歌','威猛歌','燎原星火','劍氣縱橫','四時無常','霜天白夜'];
/* 奇術照 PVP 的取向分三種，不是遊戲選單的分頁 —— 對戰帖要說的是
   「這個人準備怎麼贏」，而不是他在哪個頁籤找到這顆技能。 */
const QISHU = [
  {n:'百鬼打穴手', k:'控制'}, {n:'金玉手',   k:'控制'},
  {n:'定海神針',   k:'控制'}, {n:'凌雲踏',   k:'功能'},
  {n:'金剛護體',   k:'解控'}, {n:'太極',     k:'解控'},
  {n:'吸星吐納',   k:'功能'}, {n:'攝星拿月', k:'功能'},
  {n:'葉龍驤首',   k:'控制'}, {n:'清風霽月', k:'功能'},
];

/* 讓武六大類。項目總數與點數區間跟 theatron 的 format.ts 同一份；
   逐項的三十幾條內容不在這裡 —— 那份的權威位置是後端的 seed，
   首頁再抄一份就會有兩個地方要維護。 */
const HANDICAP_CATS = [
  {key:'weapon',  name:'武器限制', what:'限制對手能帶什麼上場',        count:5, cost:[2,20],  eg:'指定對手武學'},
  {key:'skill',   name:'技能限制', what:'封掉對手的招',                count:8, cost:[3,24],  eg:'禁用兩種技能'},
  {key:'defense', name:'防禦與位移', what:'讓對手不能閃、不能擋、不能跑', count:6, cost:[2,20],  eg:'禁用移動鍵'},
  {key:'poison',  name:'下毒',     what:'動對手的操作與資源',          count:4, cost:[10,24], eg:'打亂上下左右鍵'},
  {key:'victory', name:'勝利條件', what:'改寫這一場怎麼算贏',          count:6, cost:[10,24], eg:'撐過 90 秒即獲勝'},
  {key:'rule',    name:'規則限制', what:'加上場外的約束',              count:7, cost:[1,17],  eg:'對手未攻擊時必須待在角落'},
];
const HANDICAP_TOTAL = HANDICAP_CATS.reduce((n,c) => n + c.count, 0);
const CREED = 'BP 不保證弱者獲勝，只賦予後進要求強者以更困難方式取勝的權利。';

/** 用選手序號長出一套備戰方案。固定不亂數 —— 每次重整都換一套會像壞掉。 */
function loadoutFor(i){
  const main = SCHOOLS[(i * 2) % SCHOOLS.length];
  const off  = SCHOOLS[(i * 2 + 1 + (i % 2)) % SCHOOLS.length];
  const xin  = Array.from({length: XINFA_SLOTS}, (_,k) => XINFA[(i * 3 + k) % XINFA.length]);
  const qi   = Array.from({length: QISHU_SLOTS}, (_,k) => QISHU[(i * 5 + k * 3) % QISHU.length]);
  return {
    weapons: [{...main, role:'主'}, {...off, role:'副'}],
    // 4 個技能就是兩把武器各自的 Q 與特殊技，不是另外一個池子
    skills: [
      {arm:main.art, key:'Q', n:main.q}, {arm:main.art, key:'~', n:main.s},
      {arm:off.art,  key:'Q', n:off.q},  {arm:off.art,  key:'~', n:off.s},
    ],
    xinfa: xin,
    zhu: xin[i % XINFA_SLOTS],          // 四格裡哪一格是主修
    qishu: qi,
  };
}

/** 這名選手把手上的 BP 花在哪幾類。總和不超過持有量。 */
function bpPicksFor(i, bp){
  if (!bp) return [];
  const out = []; let left = bp;
  for (let k = 0; k < HANDICAP_CATS.length && left > 0; k++){
    const c = HANDICAP_CATS[(i + k) % HANDICAP_CATS.length];
    const cost = Math.min(left, c.cost[0] + ((i + k) % Math.max(1, c.cost[1] - c.cost[0])));
    if (cost <= 0) continue;
    out.push({cat: c, cost, item: c.eg});
    left -= cost;
  }
  return out;
}

function makePlayers(n){
  return Array.from({length:n}, (_,i) => ({
    id:'p'+String(i+1).padStart(2,'0'),
    name:NAMES[i] || ('示範選手 '+(i+1)),
    rank:(i%4)+1, seed:i+1,
    selfRank:((i+1)%4)+1,
    ladderRank:LADDER[i%4]+' '+((i%3)+1)+' 段',
    ladderScore:(i%5===0) ? 0 : 1600 + ((i*137)%900),
    loadout: loadoutFor(i),
  }));
}
// 造樹：slot s 的勝者晉級到 ⌊s/2⌋。這是 BRACKET-VS §2.3 的假設，不是後端事實。
function buildRounds(players, progressTo, finished){
  const n = players.length;
  const size = 2 ** Math.ceil(Math.log2(Math.max(n,2)));
  const total = Math.log2(size);
  const label = rem => rem===2?'決賽':rem===4?'準決賽':rem===8?'八強':rem===16?'十六強':('第 '+rem+' 強');
  // 輪空分配：size-n 個人直接晉級。前 byes 個籤位各坐一人（輪空），其餘籤位坐兩人。
  const byes = size - n, slots = size/2;
  let seats = [], k = 0;
  for (let s=0; s<slots; s++){
    if (s < byes) seats.push([players[k++]?.id || '', '']);
    else seats.push([players[k++]?.id || '', players[k++]?.id || '']);
  }
  const rounds = [];
  for (let r=1; r<=total; r++){
    const matches = [], winners = [];
    seats.forEach(([a,b], slot) => {
      const bye = a && !b;
      const decided = finished || r <= progressTo;
      const live = !decided && r === progressTo+1 && slot === 0 && a && b;
      let status = 'upcoming';
      if (decided && a) status = 'done';
      else if (live) status = 'live';
      const win = status==='done' ? (bye ? a : (slot%3===0 ? b : a)) : '';
      winners.push(win);
      matches.push({id:'m'+r+'-'+slot, round:r, slot, p1:a, p2:b, winner:win, status, bye,
        kind:'bracket', s1: status==='done' ? (win===a?2:1) : (live?1:0),
        s2: status==='done' ? (win===b?2:1) : 0});
    });
    rounds.push({round:r, label:label(seats.length*2), matches});
    const next = [];
    for (let s=0; s<winners.length/2; s++) next.push([winners[s*2]||'', winners[s*2+1]||'']);
    seats = next;
    if (!seats.length) break;
  }
  return rounds;
}
function oddsFor(v1, v2){
  const t = v1+v2, f = v => {
    const p = (v+5)/(t+10), raw = .92/p;
    return Math.min(12, Math.max(1.05, raw));
  };
  // 兩位小數捨去（MarketBoard 的 formatOdds）
  const cut = x => (Math.floor(x*100)/100).toFixed(2);
  return [cut(f(v1)), cut(f(v2))];
}
const FIXTURES = {
  signup:  {phase:0, players:[], rounds:[], published:false, bestOf:0, demo:false},
  live:    (()=>{ const p=makePlayers(8);
            return {phase:5, players:p, rounds:buildRounds(p,1,false), published:true, bestOf:3, demo:true}; })(),
  finished:(()=>{ const p=makePlayers(8);
            return {phase:6, players:p, rounds:buildRounds(p,3,true), published:true, bestOf:3, demo:true}; })(),
  // 24 人排進 32 格 → 首輪 16 場、8 場輪空 → 觸發左右對開
  split:   (()=>{ const p=makePlayers(24);
            return {phase:5, players:p, rounds:buildRounds(p,2,false), published:true, bestOf:3, demo:true}; })(),
};
let PHASE = 'signup';
let sportsbookData=null;
let DATA = FIXTURES.signup;
const byId = id => DATA.players.find(p => p.id === id);

/* ══ 章節與切鏡 ═════════════════════════════════════ */
const chapters = $$('.chapter');
const LABELS = ['宗旨','規則說明','讓武','報名','比武','賽程','獎賞'];
// 章節順序可調整，場景與鏡位仍以各章的 data-shot 綁定。
const shotFor = i => Number(chapters[i].dataset.shot);

// 分頁大標：兩個字，與軌上的印、狀態列同一套命名
const GRID_WORDS = ['論劍','賽制','讓武','報名','比武','賽程','獎賞'];
// 章題下面那行 mono 小標。跟紙卡上的 HANDICAP / 003 是同一套命名，
// 所以浮在場景上的題字跟卡上的編號讀起來是同一個系統。
const GRID_EN = ['THE GATE','THE FORMAT','HANDICAP','THE ENTRY',
                 'THE DUEL','THE SCHEDULE','THE REWARDS'];
// 場景小字：說的是「現在站在哪裡」，所以跟章名放在一起
const inkStyle = ['bloom','flow','mist'].includes(qs.get('ink')) ? qs.get('ink') : 'flow';
const CUT_TOTAL = {bloom:2800,flow:3200,mist:3600}[inkStyle], CUT_COVER = CUT_TOTAL * .46, CUT_HOLD = CUT_TOTAL * .05;
// 進到一格之後，章內進度自己走完這麼久再停住。
// 沒有捲動可以當進度來源了，但相機的呼吸、三步案例、賽制尾段的靜默
// 都是「章內進度」的函式，所以進度改由時間帶，走完就停在 1。
const DWELL = 11000;
const inkEl = $('#ink-wipe');
// 試映頁與整站共用同一個渲染器。失敗時仍有可操作的淡紙備援。
let inkRenderer = null;
if (!reduced.matches) import('/lunjian/ink-transitions.js').then(module => {
  if (destroyed) return;
  inkRenderer = module.createInkTransition($('#ink-canvas'),{style:inkStyle});
  inkRenderer?.prepare(innerWidth,Math.max(100,innerHeight-$('.site-header').getBoundingClientRect().height));
  inkEl.toggleAttribute('data-renderer',!!inkRenderer);
  cleanups.push(() => inkRenderer?.dispose());
}).catch(() => {});
function paintInkBloom(cover,reveal){
  const progress = reveal > 0 ? .51 + reveal * .49 : cover * .46;
  inkEl.dataset.progress = progress.toFixed(4);
  inkEl.style.setProperty('--ink-fallback-opacity',String(smooth(cover)*(1-smooth(reveal))));
  inkRenderer?.render(progress);
}
const rail = $('#progress-rail');
rail.querySelectorAll('.rail-seg').forEach(node => node.remove());
// 刻度位置 = 該格起點佔全站長度的比例。跨距長的格，刻度間距就寬。
const SPANS = chapters.map(c => parseFloat(getComputedStyle(c).getPropertyValue('--span')) || 1);
const SPAN_TOTAL = SPANS.reduce((a,b) => a+b, 0);
let acc = 0;
const TICK_AT = SPANS.map(sp => { const at = acc / SPAN_TOTAL; acc += sp; return at; });
// 段長 = 那一格的跨距佔全站的比例。所以第 3 格的段看起來就是最長的。
rail.insertAdjacentHTML('beforeend', chapters.map((c,i) =>
  `<a class="rail-seg" href="#${c.id}"
      style="top:${(TICK_AT[i]*100).toFixed(2)}%;height:${(SPANS[i]/SPAN_TOTAL*100).toFixed(2)}%"
      aria-label="${LABELS[i]}"><span class="rail-name">${LABELS[i]}</span></a>`).join(''));
const railLinks = $$('#progress-rail .rail-seg');

let pendingChapterFocus=null;
function finishChapterFocus(){
  if(!pendingChapterFocus || body.hasAttribute('data-cut') || body.hasAttribute('data-intro'))return;
  if(chapters[S.shown]?.id!==pendingChapterFocus.chapter)return;
  const target=pendingChapterFocus.resolve();pendingChapterFocus=null;
  if(target?.isConnected){target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
}
const S = {shown:0, target:0, shot:0, frac:0, dwell:0, cut:null, lean:0, tlean:0, last:0, selectedMatchId:qs.get('match') || '',
           vw:innerWidth, vh:innerHeight};
function measure(){ S.vh = innerHeight; S.vw = innerWidth; }

function prepareComicAssets(c){
  const target=c.to;
  c.assetsReady=false; c.assetWait=0;
  const images=[...chapters[target].querySelectorAll('[data-comic-frame] img')];
  images.forEach(image => image.loading='eager');
  Promise.allSettled(images.map(image => typeof image.decode === 'function' ? image.decode() : Promise.resolve())).then(() => {
    if (!destroyed && S.cut === c && c.to === target) c.assetsReady=true;
  });
}
function startCut(from, to){
  if (from === to) return;
  if (reduced.matches){ swapTo(to); return; }
  S.cut = {from, to, t:0, last:performance.now(), phase:'cover'};
  prepareComicAssets(S.cut);
  stopComicMotion();
  paintInkBloom(0,0);
  body.dataset.cut = '1';
}
function swapTo(k){
  S.shown = k; S.shot = shotFor(k); body.dataset.grid = String(S.shot);
  S.dwell = 0;                 // 新的一格，章內進度從頭走
  S.frac = 0;
  markNav(k);
  applyGrid(k);
  // 章節依 data-shot 選鏡位；報名與對決共用擂台，換鏡在墨幕下完成。
  if (S.scene3d) S.scene3d.seek(S.shot);
}
function tickCut(now){
  const c = S.cut; if (!c) return;
  const dt = Math.max(0,now-c.last); c.last=now;
  c.assetWait += dt;
  c.t += dt;
  // Decode incoming sprites under coverage; bound failure waits and never reveal an empty frame.
  if (!c.assetsReady && c.assetWait < CUT_COVER + 1800) c.t = Math.min(c.t,CUT_COVER);
  if (c.phase === 'cover' && c.t >= CUT_COVER && (c.assetsReady || c.assetWait >= CUT_COVER + 1800)){
    // Even after a stalled frame, swap beneath a fully opaque cover. Start the
    // reveal on the next frame so old content never shows through a partial wipe.
    c.t = CUT_COVER; paintInkBloom(1,0); c.phase = 'reveal';
    swapTo(c.to); playComicScene(chapters[c.to],true); return;
  }
  const cover = clamp01(c.t / CUT_COVER);
  const reveal = clamp01((c.t - CUT_COVER - CUT_HOLD) / (CUT_TOTAL - CUT_COVER - CUT_HOLD));
  paintInkBloom(cover,reveal);
  if (reveal >= 1){
    body.removeAttribute('data-cut'); S.cut = null;
    if (S.target !== S.shown) startCut(S.shown,S.target);
    else {comicSequence?.drain();finishChapterFocus();}
    // Release the existing queue; never hide/restart the incoming page after the reveal.
  }
}

/* ══ 2D 前景層表（ART.md §3.2 逐格）═════════════════
   每一筆的 box/pos 都是從 bbox.json 的可見外框推的，不是憑盒寬猜的。
   gain 沿 plan.json 已落地值；標〔定〕的是本輪新給的起始值。
   換格時整組換（BRIEF D4），不做漸變。 */
const ART = {
  railing:{f:'fg-railing.webp',      w:1672,h:941},
  moon:   {f:'fx-moon.webp',         w:900, h:900},
  plumV3: {f:'fg-plum-branch-v3.webp',w:1536,h:1024},
  bamboo: {f:'fg-bamboo.webp',       w:900, h:1080},
  canopy: {f:'fg-canopy.webp',       w:1536,h:1024},
  pine:   {f:'fg-pine.webp',         w:1024,h:1438},
  figureA:{f:'fg-figure-a.webp',      w:1024,h:1536},
  snowPlum:{f:'fg-snow-plum.webp',   w:1536,h:1024},
  brazier:{f:'fg-brazier.webp',      w:900, h:935},
  bannerB:{f:'fg-banner-black.webp', w:800, h:1200},
  bannerW:{f:'fg-banner-white.webp', w:800, h:1200},
  lantern:{f:'fg-lantern.webp',      w:900, h:1080},
  /* 這一批是從素材庫挑出來、用 tools/cutout.py 鍵掉平底色的。
     原本七格只有竹與一截梅枝在輪，同一棵竹在四格出現，看久了很枯燥。 */
  snowPine:{f:'fg-snow-pine.webp',      w:1100,h:1005},   // 雪松，枝幹橫張
  oldTree: {f:'fg-ancient-tree.webp',   w:1200,h:800},    // 古樹，盤根
  treeRock:{f:'fg-tree-rock.webp',      w:1100,h:917},    // 紫藤巨樹連岩
  grove:   {f:'fg-frost-grove.webp',    w:1200,h:1097},   // 霜林，幾株細木
  stoneLamp:{f:'fg-spirit-lantern.webp',w:633, h:760},    // 石燈籠
  bridge:  {f:'fg-arched-bridge.webp',  w:1200,h:675},    // 拱橋
  gallery: {f:'fg-twin-gallery.webp',   w:1300,h:732},    // 雙廊
  crestCurtain:{f:'fg-crest-curtain.webp',w:1000,h:667},  // 鴉紋布幕
};
const LAYERS = [
  /* 近景的兩條規則，是被畫面打回來五次之後定下來的：

     一、**有輪廓的東西不能被切。**
        燈籠、旗、建築這種一眼認得出形狀的，切一半就只剩一團看不懂的東西；
        枝條、欄杆、樹林、橋這種線性或有機的，從邊緣進來反而是自然的取景。

     二、**3D 開著的時候，近景要讓路。**
        那座場景本身就有屋宇、欄杆、燈、旗、樹、雪與梅瓣，
        再疊一層 2D 剪影上去，不是加了層次，是把畫面弄髒 ——
        使用者連著指了燈籠、雙廊、黑旗、火盆、古樹說「太多餘」，指的都是這件事。
        所以幾乎每一件都標 flat:true（只有純 2D 才掛）；
        3D 那邊只留從上緣角落垂進來的一枝梅，那是 3D 沒有、而且擋不到任何東西的。

     純 2D 是另一回事：底是一張平的照片，沒有近景就沒有深度，所以那邊照擺。 */

  // 0 山門
  [ {a:'railing',  css:'width:126vw;left:-13vw;bottom:-22vh',                   g:2.6, fl:'brightness(.62) saturate(.5) blur(1.1px)', flat:true},
    {a:'snowPine', css:'width:min(46vw,620px);left:-9vw;bottom:-6vh',  rot:1.5, g:4.4, fl:'brightness(.66) saturate(.6)', flat:true},
    {a:'bridge',   css:'width:min(52vw,720px);right:-6vw;bottom:-11vh', rot:.5, g:2.9, fl:'brightness(.56) saturate(.55)', flat:true},
    {a:'plumV3',   css:'width:min(32vw,440px);right:-1vw;top:-2vh',    rot:-1.5,g:3.2, fl:'brightness(.84) saturate(1.02)'} ],

  // 1 戰帖
  // 遞帖的人站在左邊 —— 這一格講的是「有人把帖送到你面前」，
  // 沒有人就只是一張紙浮在半空。兩種舞台都掛，3D 也沒有這個人。
  [ {a:'figureA',      css:'width:min(30vw,400px);left:6vw;bottom:-2vh',           g:2.2, fl:'brightness(.86) saturate(.95) drop-shadow(0 14px 30px #0009)'},
    {a:'oldTree',      css:'width:min(44vw,580px);left:-12vw;bottom:-10vh', rot:-1, g:4.0, fl:'brightness(.56) saturate(.58)', flat:true},
    {a:'snowPlum',     css:'width:min(28vw,380px);right:-2vw;top:-4vh',  rot:-5, g:2.8, fl:'brightness(.72) saturate(.95)'} ],

  // 2 賽制
  [ {a:'grove',   css:'width:min(44vw,600px);left:-8vw;bottom:-8vh',   rot:-1, g:3.8, fl:'brightness(.62) saturate(.5)', flat:true},
    {a:'lantern', css:'width:min(12vw,160px);right:9vw;top:2vh',       rot:2,  g:1.5, fl:'brightness(1.02) saturate(1.1) drop-shadow(0 0 20px rgba(255,160,70,.24))', flat:true},
    {a:'plumV3',  css:'width:min(26vw,350px);left:-3vw;top:-5vh',      rot:2,  g:2.6, fl:'brightness(.7) saturate(.9)'} ],

  // 3 比武：兩種舞台都不掛旗子前景。
  [],

  // 4 獎賞　主角是那四方朱印，旁邊不要有東西搶。
  [ {a:'treeRock', css:'width:min(42vw,570px);left:-8vw;bottom:-10vh',  rot:-1, g:3.6, fl:'brightness(.64) saturate(.7)', flat:true},
    {a:'snowPlum', css:'width:min(26vw,350px);right:-2vw;top:-4vh',     rot:-6, g:2.6, fl:'brightness(.66) saturate(.9)'} ],

  // 5 賽程
  // 橋原本橫在下緣，但賽程樹是全寬的，橋的兩端剛好從樹的左右兩側冒出來，
  // 看起來是兩塊不相干的石頭。拿掉，這一格的主角是那棵樹。
  [ {a:'pine',    css:'width:min(28vw,380px);left:-5vw;bottom:-6vh',    rot:-1, g:3.4, fl:'brightness(.56) saturate(.5)', flat:true},
    {a:'plumV3',  css:'width:min(24vw,330px);right:0;top:-5vh',         rot:-2, g:2.6, fl:'brightness(.68) saturate(.9)'} ],

  // 6 報名
  // 左下原本有盞石燈，整個被狀態列與畫面邊切掉，看不出是什麼。
  // 左下這個位置沒有合適的素材就空著 —— 寧可空，不要放一塊認不出來的東西。
  [ {a:'grove',    css:'width:min(42vw,580px);right:-9vw;bottom:-8vh',  rot:1,  g:3.8, fl:'brightness(.6) saturate(.5)', flat:true},
    {a:'snowPlum', css:'width:min(30vw,410px);left:-1vw;top:-3vh',      rot:-5, g:2.6, fl:'brightness(.66) saturate(.9)'} ],
];
const fgHost = $('#foreground');
function renderForeground(i){
  if ((chapters[i].dataset.layout === 'editorial' || chapters[i].classList.contains('folio-chapter') || chapters[i].id === 'schedule')) { fgHost.replaceChildren(); return; }
  // flat:true 的層只有純 2D 時才掛。3D 舞台已經有同一件東西的立體版，
  // 兩邊都掛就是兩個月亮、兩排欄杆。
  const only2d = body.dataset.stage !== '3d';
  const set = (LAYERS[shotFor(i)] || []).filter(L => only2d || !L.flat);
  fgHost.innerHTML = set.map(L => {
    const a = ART[L.a];
    // 從哪一邊飄進來：看它自己貼在哪一側。左邊的從左、右邊的從右、
    // 只有下緣的從下 —— 每一層從自己該來的方向進場，畫面才像慢慢聚攏。
    const from = /left:/.test(L.css) ? 'left' : /right:/.test(L.css) ? 'right'
               : /bottom:/.test(L.css) ? 'bottom' : 'top';
    return `<img class="fg${L.fixed?' fg-moon':''}" data-from="${from}" src="/lunjian/art/${a.f}" alt="" width="${a.w}" height="${a.h}"
      decoding="async" style="${L.css};--gain:${L.g};--rot:${L.rot||0}deg;--alpha:${L.al===undefined?1:L.al};filter:${L.fl}">`;
  }).join('');
  requestAnimationFrame(() => fgHost.querySelectorAll('.fg').forEach(el => el.setAttribute('data-on','')));
}
function applyGrid(i, {animate=true} = {}){
  invalidateDuelGeometry();
  if(chapters[i].id!=='duel') resetDuelProximity(true);
  railLinks.forEach((a,j) => j===i ? a.setAttribute('aria-current','location') : a.removeAttribute('aria-current'));
  chapters.forEach((c,j) => {
    const on = j === i;
    c.toggleAttribute('data-on', on);
    const sh = c.querySelector('.chapter-sticky');
    if (sh) sh.inert = !on && !body.classList.contains('reading');
  });
  $$('#stage .shot').forEach(el => el.toggleAttribute('data-on', Number(el.dataset.shot) === shotFor(i)));
  if(animate)renderForeground(i);
  $('#announcement').textContent = `第 ${i+1} 格，${LABELS[i]}`;
  // 分頁大標：每格一個兩字墨字，進格才寫、每格只寫一次。
  // 第 0 格的大標就是首屏的「論劍」本身，不再另外掛一個。
  const gt = $('#grid-title'), gw = $('#grid-title-wrap'), sec = chapters[i];
  if (sec.querySelector('[data-chapter-title]') || i === 0 || sec.dataset.layout === 'editorial' || sec.classList.contains('folio-chapter')){
    gw.removeAttribute('data-on');
    // 開場簾還在的時候不寫 —— 旗還沒燒完就把站名寫好，入關時就沒東西可看了。
    if (!body.hasAttribute('data-intro')) playWordmark();
  } else {
    const word = GRID_WORDS[i];
    if (gt.dataset.word !== word){
      gt.dataset.word = word;
      gt.dataset.ink = word;
      delete gt.dataset.inkDone;
      gt.innerHTML = '';
      if (reduced.matches) gt.textContent = word; else mountInk(gt, {dur:2600, gap:40, charGap:200});   // 一個元素＝一筆
      gt.querySelectorAll('.ink-svg').forEach(el => delete el.dataset.played);
    }
    $('#grid-title-no').textContent = String(i + 1).padStart(2, '0');
    $('#grid-title-en').textContent = GRID_EN[i] || '';
    // 紙卡在右 → 大標在左；紙卡在左或置中 → 大標在右（避開右邊的印章軌用 9.4vw）
    gw.dataset.side = [1,4,6].includes(shotFor(i)) ? 'left' : 'right';
    // 第 2 格（資料表）與第 5 格（賽程樹）是全寬的，題字收進內容自己的標題列
    const slot = sec && sec.querySelector('.ink-slot');
    gw.dataset.pos = slot ? 'inline' : 'top';
    if (slot && !reduced.matches){ mountInk(slot, {dur:2200, gap:36, charGap:170}); playInk(slot); }
    gw.setAttribute('data-on','');
    if (!reduced.matches) playInk(gt);
  }
  if(animate){chapterTitles?.enter(chapters[i]);playComicScene(chapters[i]);}
}
/** 換格。整站唯一的導覽入口 —— 導覽列、進度軌、卡上的連結、鍵盤都走這裡。 */
function goTo(k, opts = {}){
  k = Math.max(0, Math.min(chapters.length - 1, k | 0));
  pendingChapterFocus=opts.focus ? {chapter:chapters[k].id,resolve:opts.focus} : null;
  if (!opts.history && location.hash !== '#' + chapters[k].id) history.pushState(null, '', '#' + chapters[k].id);
  document.dispatchEvent(new CustomEvent('lunjian:chapter-change'));
  if (body.classList.contains('reading')){
    S.shown = S.target = k; markNav(k);
    chapters[k].scrollIntoView({behavior: opts.instant || reduced.matches ? 'instant' : 'smooth', block:'start'});
    finishChapterFocus();return;
  }
  if (k === S.target && k === S.shown){finishChapterFocus();return;}
  S.target = k;
  if (opts.instant || reduced.matches){ S.cut = null; body.removeAttribute('data-cut'); swapTo(k);finishChapterFocus(); }
  else if (!S.cut) startCut(S.shown, k);
  else if (S.cut.phase === 'cover' && S.cut.to !== k) { S.cut.to = k; prepareComicAssets(S.cut); } // 揭幕中保留目前畫面，下一次接到最後目標。

}

/** 章內進度。沒有捲動了，所以由時間帶：進格之後走 DWELL 毫秒到 1，然後停住。 */
function updateDeck(dt){
  if (body.classList.contains('reading')) return;
  if (S.dwell < DWELL) S.dwell = Math.min(DWELL, S.dwell + dt);
  S.frac = clamp01(S.dwell / DWELL);
  const g = S.shown;
  // 位置點：走在當前那一段裡面，所以「這一格走到哪」也看得到。
  const at = TICK_AT[g] + (SPANS[g] / SPAN_TOTAL) * S.frac;
  $('#rail-pos').style.top = (at * 100).toFixed(2) + '%';
  // Rules are persistent content; scene time never controls readability.
  $$('.case-step').forEach(el => { el.setAttribute('data-on',''); el.removeAttribute('aria-hidden'); });
  const tbl = $('#rules .rule-table');
  tbl.style.removeProperty('opacity');
  tbl.style.removeProperty('transition');
}

/* ══ 首屏書寫「論劍」════════════════════════════════
   真品用 hanzi-writer medians 逐筆走筆（MOTION §5）。
   這支工作檔用簡化骨架驗時間軸與版位：論 15 筆、劍 15 筆，
   900ms + 250ms 停 + 900ms = 2050ms，只播一次。 */
function buildWordmark(){
  if (reduced.matches) { $('#wordmark').textContent = '論劍'; return; }
  const el = $('#wordmark');
  el.classList.add('ink-title');
  el.dataset.ink = '論劍';
  mountInk(el, {track:.14, dur:2400, gap:44, charGap:300});
}
function playWordmark(){
  if (reduced.matches || body.classList.contains('reading')) return;
  // 只播一次的旗標在 playInk 裡（每張 svg 自己記），這裡不再多包一層 ——
  // 多包一層會在字形還沒載入時就把旗標燒掉，載入後反而不播。
  playInk($('#wordmark'));
}

/* ══ 三態 ═══════════════════════════════════════════ */
function setPhase(name){
  PHASE = preview ? name : activity.phase===5 ? 'live' : activity.phase===6 ? 'finished' : 'signup';
  DATA = preview && sportsbookData ? sportsbookData : preview ? (previewDrafts[name] || FIXTURES[name] || FIXTURES.signup) : {...tournament,phase:activity.phase,demo:false};
  body.dataset.phase = PHASE;
  $$('.phase-pick button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.phase === name)));
  $('#demo-tag').hidden = !preview;
  $('.phase-pick').hidden = !preview;
  renderPhaseTrack();
  renderPrizes();
  renderDuel();
  renderBracket();
  renderRegister();
}
function renderPhaseTrack(){
  $('#phase-track').innerHTML = PHASES.map((p,i) =>
    i === DATA.phase ? `<b>${p}</b>` : `<span>${p}</span>`).join('<span aria-hidden="true">·</span>');
}
function renderPrizes(){
  $$('[data-prize-name]').forEach((el,index) => {
    if(sportsbookData){
      const all=DATA.rounds.flatMap(r=>r.matches),final=all.filter(m=>m.kind!=='third').sort((a,b)=>b.round-a.round)[0],third=all.find(m=>m.kind==='third');
      const m=index<2?final:third,id=m?.status==='done'?(index===1?(m.winner===m.p1?m.p2:m.p1):m.winner):'';
      const p=DATA.players.find(p=>p.id===id);el.textContent=p?p.name:'待揭曉';
      const source=el.parentElement.querySelector('[data-prize-source]');source.hidden=!p;source.textContent=p?'本機賽果':'';return;
    }
    const known = preview && PHASE === 'finished' && index < 2 && DATA.players.length >= 2;
    el.textContent = known ? DATA.players[index === 0 ? 1 : 0].name : '待揭曉';
    const source=el.parentElement.querySelector('[data-prize-source]');source.hidden=!known;source.textContent=known?'示範':'';
  });
}
// 填樹：分出勝負的節點依輪次逐一點亮，間隔 60ms（MOTION §7.2）
function fillTree(){
  const lit = $$('#bracket-host .bnode.lit');
  if (!lit.length || reduced.matches) return;
  anime.remove(lit);
  anime({ targets:lit, opacity:[0,1], translateY:[6,0],
          delay:anime.stagger(60), duration:280, easing:'easeOutQuad' });
}
function rankMarks(lv, cls){
  return `<span class="${cls||'rank-marks'}">${[1,2,3,4].map(i => `<i class="${i<=lv?'on':''}"></i>`).join('')}</span>`;
}
// 讓武 BP：段位差 × 每段 BP，低段位方持有。同段回 0。
function handicap(a, b){
  if (!a?.rank || !b?.rank) return {bp:0, holder:null};
  const gap = a.rank - b.rank;
  if (gap === 0) return {bp:0, holder:null};
  return {bp:Math.abs(gap)*BP_PER_GAP, holder: gap < 0 ? a : b};
}
function activeMatch(){
  for (const r of DATA.rounds){
    const live = r.matches.find(m => m.status === 'live');
    if (live) return live;
  }
  for (const r of DATA.rounds){
    const pend = r.matches.find(m => m.status !== 'done' && m.p1 && m.p2);
    if (pend) return pend;
  }
  const last = DATA.rounds[DATA.rounds.length-1];
  return last ? last.matches[0] : null;
}
const DUEL_STUDY_PLAYERS = [0,1].map(i => ({
  id:'study-'+i,name:i===0?'左方俠客':'右方俠客',rank:2,seed:i+1,selfRank:2,
  ladderRank:'示範資料',ladderScore:0,demo:true,
  loadout:{...loadoutFor(i),equipment:[{slot:'武學裝備',name:'46 級武庫裝備（示範）'},{slot:'其他裝備',name:'未填寫'}]},
}));
let duelPeople={left:null,right:null},duelContext={hc:{holder:null,bp:0},match:null};
const DUEL_OUTCOMES = {
  dominant:{s1:2,s2:0,winner:'left',label:'輾壓',title:'毫髮未亂，勝負已定。',status:'左方 2：0 輾壓勝利 · 右方慘敗',left:'/lunjian/art/duel-dominant.webp',right:'/lunjian/art/duel-crushed.webp',description:'左方從容站立、垂劍負手，右方垂頭跪倒慘輸'},
  crushed:{s1:0,s2:2,winner:'right',label:'慘輸',title:'一敗塗地，仍有來日。',status:'左方 0：2 慘輸 · 右方勝出',left:'/lunjian/art/duel-crushed.webp',right:'/lunjian/art/duel-dominant.webp',description:'左方垂頭跪倒慘輸，右方從容站立勝出'},
  narrow:{s1:2,s2:1,winner:'left',label:'險勝',title:'一劍之差，險勝。',status:'左方 2：1 險勝 · 右方落敗',left:'/lunjian/art/duel-victor.webp',right:'/lunjian/art/duel-defeated.webp',description:'左方負傷險勝，右方倒地落敗'},
  draw:{s1:1,s2:1,winner:null,label:'平手',title:'劍已倦，勝負未分。',status:'雙方 1：1 · 平手姿態示範',left:'/lunjian/art/duel-draw-left.webp',right:'/lunjian/art/duel-draw-right.webp',description:'兩位俠客皆筋疲力盡，仍持劍站立，勝負未分'},
};
function renderDuel(){
  const study = S.duelPreview || null, outcome = S.duelOutcome || 'narrow';
  const result = DUEL_OUTCOMES[outcome];
  $('#duel').toggleAttribute('data-empty', !DATA.published && !study);
  const m = study ? ({before:{status:'upcoming',s1:0,s2:0},live:{status:'live',s1:1,s2:1},after:{...result,status:'done'}}[study]) : DATA.published ? (S.selectedMatchId ? findMatch(S.selectedMatchId) : activeMatch()) : null;
  const p1 = study ? DUEL_STUDY_PLAYERS[0] : m && byId(m.p1), p2 = study ? DUEL_STUDY_PLAYERS[1] : m && byId(m.p2);
  const hc = handicap(p1, p2);
  $('#duel-index').textContent = study ? (study==='after' && outcome==='draw' ? '平手姿態示範' : '示範資料 / BO3') : m ? `第 ${m.round} 輪 · 第 ${m.slot+1} 場` : '';
  $('#duel-title').textContent = study ? ({before:'交鋒之前',live:'各取一局，勝負未分。',after:result.title}[study]) : m ? (m.status==='done' ? (byId(m.winner)?.name ? `${byId(m.winner).name} ${m.bye?(m.p1 && m.p2?'不戰而勝':'輪空晉級'):'勝出'}。` : '比賽已結束。') : '下一場對戰') : '交鋒之前';
  // 每個人腳下掛自己那一份：定段的、自填的、讓的，分開列。
  // 自填欄（自評段位、遊戲內積分）依 BACKEND-GAPS 是報名表欄位，
  // 目前只在這裡示意，正式上線前要先確認選手同意公開。
  const side = (p, nm, dos) => {
    $(nm).textContent = p ? p.name : nm.endsWith('-l') ? '左方選手' : '右方選手';
    if (!p){ $(dos).innerHTML = '<dt>段位</dt><dd>待評定</dd><dt>武器</dt><dd>待公開</dd>'; return; }
    const demoProfile=DATA.demo && !p.character && dossierDemoData ? dossierDemoData.profiles[Array.from(String(p.id)).reduce((n,c)=>n+c.charCodeAt(0),0)%dossierDemoData.profiles.length] : null;
    const rows = demoProfile ? [['主武學',escapeHTML(demoProfile.mainArt),''],['雙武器',escapeHTML(demoProfile.weapons),''],['稱號',escapeHTML(demoProfile.epithet)+' · 示範',''],['段位',escapeHTML(demoProfile.rank),'']] : [
      ['段位', `${rankMarks(p.rank)}${escapeHTML(playerRank(p))}`, ''],
      ['主武學',escapeHTML(p.character?.style || '待公開'),''],
      ['稱號',escapeHTML(p.title || '待公開'),''],
      ['雙武器', escapeHTML(p.character?.weapon || (managerMode?p.loadout?.weapons.map(w=>w.art).join('／'):null) || '待公開'), ''],
    ];
    if (hc.holder === p) rows.push(['讓武', `${hc.bp} BP`, 'hi']);
    $(dos).innerHTML = rows.map(([k, v, c]) =>
      `<dt>${k}</dt><dd${c ? ` class="${c}"` : ''}>${v}</dd>`).join('');
  };
  side(p1, '#duel-name-l', '#duel-dos-l');
  side(p2, '#duel-name-r', '#duel-dos-r');
  if(study){ $('#duel-name-l').textContent='左方俠客'; $('#duel-name-r').textContent='右方俠客'; }
  duelPeople={left:p1 || {name:'左方選手',pending:true},right:p2 || {name:'右方選手',pending:true}};
  duelContext={hc,match:m,demo:!!study || !!DATA.demo};
  for(const el of $$('#duel .fighter,#duel .duelist')){
    const person=duelPeople[el.dataset.side];
    el.classList.add('is-clickable');el.tabIndex=0;el.setAttribute('role','button');
    el.setAttribute('aria-label',`看 ${person.name} 的備戰方案`);
  }
  $('#duel-score').textContent = (m && (study || (DATA.bestOf > 1 && m.status !== 'upcoming'))) ? `${m.s1} : ${m.s2}` : '';
  $('#duel-status').textContent = study ? ({before:'尚未開打 · 0：0',live:'決勝局前 · 雙方各取一勝',after:result.status}[study]) : !m ? '對戰表還沒公布。'
    : m.status === 'live' ? '比賽進行中。'
    : m.bye ? (m.p1 && m.p2?'不戰而勝。':'輪空晉級。')
    : m.status === 'done' ? '比賽已結束。'
    : !p1 || !p2 ? '等待另一位晉級選手。'
    : !p1.rank || !p2.rank ? ''
    : hc.bp === 0 ? '同段對決，本場無讓武。' : '備戰中，等開打。';
  const stamp = $('#duel-stamp');
  stamp.hidden = !!study || !DATA.demo || !(m && (m.status === 'live' || PHASE === 'finished'));
  if (!stamp.hidden){
    const t = PHASE === 'finished' ? ['首','座'] : ['封','盤'];
    stamp.querySelector('.seal-a').textContent = t[0];
    stamp.querySelector('.seal-b').textContent = t[1];
  }
  const act = $('#duel-action');
  act.innerHTML = '';
  S.duelOdds = DATA.demo && !study && m && PHASE === 'live' ? oddsFor(20, 8) : null;
  if(!S.duelOdds){ $('#duel-odds').textContent=''; $('#duel-odds').removeAttribute('data-show'); }
  renderDuelArtwork(m,study);
  renderDuelActions(m,study);
  applyLean();
}
function renderDuelArtwork(match,study){
  invalidateDuelGeometry();
  const arena=$('#duel .arena-composition');
  const knownWinner=!!match?.winner && [match.p1,match.p2].includes(match.winner);
  const done=match?.status==='done' && (study==='after' || (knownWinner && !match.bye && !!byId(match.p1) && !!byId(match.p2)));
  const result=study==='after' ? DUEL_OUTCOMES[S.duelOutcome || 'narrow'] : null;
  const leftWins=result ? result.winner==='left' : match?.winner===match?.p1;
  const draw=result?.winner===null;
  arena.dataset.outcome=done ? (draw ? 'draw' : leftWins ? 'left' : 'right') : 'none';
  arena.dataset.phase=match?.status || 'upcoming';
  arena.setAttribute('aria-label',done ? (result?.description || (leftWins ? '左方勝出，右方倒地落敗' : '右方勝出，左方倒地落敗')) : '兩位黑影俠客在擂台相向對峙');
  const left=$('#arena-left-art'),right=$('#arena-right-art');
  left.src=done ? (result?.left || (leftWins?'/lunjian/art/duel-victor.webp':'/lunjian/art/duel-defeated.webp')) : '/lunjian/art/player-attacker-right.webp';
  right.src=done ? (result?.right || (leftWins?'/lunjian/art/duel-defeated.webp':'/lunjian/art/duel-victor.webp')) : '/lunjian/art/player-defender-left.webp';
  // Intrinsic dimensions follow each independent image; aspect ratios must not inherit the silhouette.
  for(const img of [left,right]){
    const wide=/attacker|defeated|crushed/.test(img.src), defender=/defender/.test(img.src);
    img.width=wide ? 1536 : defender ? 1254 : 1024;
    img.height=wide ? 1024 : defender ? 1254 : 1536;
  }
  $('#arena-result').hidden=!done;
  $('#arena-result').textContent=result?.label || '勝出';
  $('#duel-vs-slot').hidden=done;
  $('#duel-preview-note').hidden=!study;
  $('#duel-preview-note').textContent=draw ? '示範資料 · 平手僅示範姿態，並非正式 BO3 賽果' : '示範資料 · 此比分與人物姿態僅供演出預覽';
  $('#duel-outcomes').hidden=study!=='after';
  $('[data-duel-reset]').hidden=!study;
  $$('[data-duel-preview]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.duelPreview===study)));
  $$('[data-duel-outcome]').forEach(button => button.setAttribute('aria-pressed',String(study==='after' && button.dataset.duelOutcome===(S.duelOutcome || 'narrow'))));
}
$$('[data-duel-preview]').forEach(button => on(button,'click',() => {
  if(!managerMode)return;
  S.duelPreview=button.dataset.duelPreview;
  renderDuel(); renderRegister();
}));
$$('[data-duel-outcome]').forEach(button => on(button,'click',() => {
  if(!managerMode)return;
  S.duelPreview='after'; S.duelOutcome=button.dataset.duelOutcome;
  renderDuel(); renderRegister();
}));
on($('[data-duel-reset]'),'click',() => { S.duelPreview=null; S.duelOutcome=null; renderDuel(); renderRegister(); $('[data-duel-preview="before"]').focus(); });
function renderRegister(){
  const homeURL=new URL('/home',location.href);
  for(const key of ['preview','sportsEvent','slug']){const value=new URLSearchParams(location.search).get(key);if(value)homeURL.searchParams.set(key,value);}
  $('.brand').href=homeURL.pathname+homeURL.search;

  const view = sportsbookData ? {kind:'preview', slug:'', status:sportsbookData.registration?.open?'本機活動 · 開放報名':sportsbookData.published?'本機活動 · 對局已發布':'本機活動 · 等待排賽', label:'我的參賽與角色設定', href:'/sportsbook?event='+encodeURIComponent(sportsbookData.sportsEventId)+'&tab=participation'} : preview ? {
    ...activity, kind:'preview', slug:'', href:PHASE === 'signup' ? '#register' : '#schedule',
    status:PHASE === 'signup' ? '示範資料 · 報名期' : PHASE === 'live' ? '示範資料 · 比賽中' : '示範資料 · 已結束',
    label:PHASE === 'signup' ? '查看報名說明' : '查看示範對戰表'
  } : activity;
  $$('[data-activity-status]').forEach(el => { el.textContent = view.status; });
  $$('[data-activity-cta]').forEach(a => { a.textContent = view.label; a.href = view.href; });
  const localRegistration = !!sportsbookData || preview || !activity.slug;
  const registrationLink = $('#register-cta');
  registrationLink.toggleAttribute('data-registration-entry',localRegistration);
  registrationLink.textContent=localRegistration ? (sportsbookData && !sportsbookData.registration ? '查看參賽資訊' : '開始報名') : view.label;
  if(localRegistration){
    registrationLink.href='/sportsbook?entry=registration&tab=participation'+(sportsbookData?'&event='+encodeURIComponent(sportsbookData.sportsEventId):'');
    $('#register-status').textContent=sportsbookData?view.status:'本機報名 · 填寫資料、設定角色、確認赴約';
  }
  const loadoutURL = new URL('/loadout', location.href);
  const context = new URLSearchParams(location.search);
  for (const key of ['sportsEvent','slug','preview','stage','mode','view']) {
    const value = context.get(key); if (value) loadoutURL.searchParams.set(key, value);
  }
  if (sportsbookData) loadoutURL.searchParams.set('sportsEvent', sportsbookData.sportsEventId);
  else if (activity.slug) loadoutURL.searchParams.set('slug', activity.slug);
  $$('[data-loadout]').forEach(a => { const url = new URL(loadoutURL); if(a.hasAttribute('data-my-loadout'))url.searchParams.set('returnTo','register'); a.href = url.pathname + url.search; });
  $$('.activity-retry').forEach(button => { button.hidden = view.kind !== 'error'; });
  body.dataset.activity = view.kind;
  $('#local-event-tools').hidden=!sportsbookData;
  if(sportsbookData){ const url='/sportsbook?event='+encodeURIComponent(sportsbookData.sportsEventId); $('#local-event-register').href=url+'&tab=participation';$('#local-event-manage').href=url+'&mode=manage'; }
}
function updateActivity(view){ activity = view; if (!preview) setPhase('signup'); else renderRegister(); }
function updateTournament(view){
  if(destroyed || JSON.stringify(tournament)===JSON.stringify(view)) return;
  tournament=view;if(!preview) setPhase(PHASE);
}


/* The bracket module owns its DOM, responsive rounds, and branch geometry. */
function bracketLayout(){return 'split';}
function renderBracket(){
  const host=$('#bracket-host'),status=$('#schedule-state');
  const tools=$('#bracket-tools');tools.hidden=!managerMode || !preview || !DATA.published || !!sportsbookData;
  if(managerMode && preview && DATA.published && !sportsbookData){
    if(bracketEditor)bracketEditor.sync(FIXTURES[PHASE],PHASE);
    else if(!editorModule){
      editorModule=import('/lunjian/bracket-editor.js?v=c52452300c8d').then(({createBracketEditor})=>{
        if(destroyed || sportsbookData)return;
        bracketEditor=createBracketEditor({host:tools,bracketHost:host,signal:lifetime.signal,onChange:next=>{
          if(destroyed || !preview)return;
          previewDrafts[PHASE]=next;DATA=next;renderPrizes();renderDuel();renderBracket();
        }});
        bracketEditor.sync(FIXTURES[PHASE],PHASE);
      }).catch(()=>{editorModule=null;if(!destroyed)tools.textContent='示範管理載入失敗，切換章節後可重試。';});
    }
  }else bracketEditor?.close();
  $('[data-tournament-retry]').hidden=preview || !activity.slug;
  if(!DATA.published || !DATA.rounds.length){
    status.textContent=!preview && tournament.kind==='loading' ? '正在讀取賽程…' : !preview && tournament.kind==='error' ? '賽程讀取失敗，請重新整理。' : '抽籤後公布完整賽程與選手名單。';
  }else status.textContent=DATA.demo ? '體驗賽程' : `${DATA.players.length} 位選手 · ${DATA.rounds.length} 輪`;
  if(bracketTree){bracketTree.render(DATA);bracketEditor?.refreshSeats();return;}
  if(!bracketModule){
    host.textContent='正在展開對戰樹…';
    bracketModule=import('/lunjian/bracket-tree.js?v=2f89b0bb96c8').then(({createBracketTree})=>{
      if(destroyed) return;
      bracketTree=createBracketTree({host,previewEmpty:true,onSelect:selectScheduleMatch,onPlayer:selectBracketPlayer,signal:lifetime.signal,championArt:'/lunjian/art/manga-champion.webp'});bracketTree.render(DATA);bracketEditor?.refreshSeats();
      return createBracketTree;
    }).catch(()=>{if(!destroyed)host.textContent='對戰樹載入失敗，請重新整理頁面。';bracketModule=null;});
  } else bracketModule.then(create=>{
    if(destroyed || !create || bracketTree)return;
    bracketTree=create({host,previewEmpty:true,onSelect:selectScheduleMatch,onPlayer:selectBracketPlayer,signal:lifetime.signal,championArt:'/lunjian/art/manga-champion.webp'});bracketTree.render(DATA);bracketEditor?.refreshSeats();
  });
}
on($('[data-tournament-retry]'),'click',()=>document.dispatchEvent(new Event('lunjian:retry-tournament')));
function selectScheduleMatch(matchId,trigger){
  if(preview && bracketEditor?.editing){bracketEditor.open(matchId,trigger);return;}
  selectDuelMatch(matchId);
}
function selectBracketPlayer(playerId,matchId,trigger){
  if(preview && bracketEditor?.editing){bracketEditor.open(matchId,trigger);return;}
  const m=findMatch(matchId),p=byId(playerId);
  if(!m || !p || ![m.p1,m.p2].includes(playerId))return;
  openDossier(p,handicap(byId(m.p1),byId(m.p2)),m,trigger,{fromBracket:true});
}
function selectDuelMatch(id){
  if(!findMatch(id)) return;
  S.selectedMatchId=id;S.duelPreview=null;S.duelOutcome=null;
  arenaTicket?.close();closeDossier(false);
  const url=new URL(location.href);url.searchParams.set('match',id);url.hash='duel';history.pushState(null,'',url);
  renderDuel();goTo(chapters.findIndex(ch=>ch.id==='duel'),{history:true,focus:()=>$('#duel .duelist[data-side="left"]')});
  $('#announcement').textContent='已選取場次，進入比武。可點選人物查看備戰方案。';
}
function bettingLink(m,p){
  if(!activity.slug || !m?.id || !p?.id) return '';
  return `/t/${encodeURIComponent(activity.slug)}/m/${encodeURIComponent(m.id)}?player=${encodeURIComponent(p.id)}#markets`;
}
function betActionHTML(m,p,side,demo){
  if(!m || !p?.id) return '';
  if(demo){
    if(!managerMode && !sportsbookData)return '';
    if(m.status==='done' || !duelPeople.left?.id || !duelPeople.right?.id)return '';
    return `<button type="button" class="duel-bet" data-arena-bet="${side}">選 ${escapeHTML(p.name)} · ${sportsbookData?'下注':'模擬下注'}</button>`;
  }
  const href=bettingLink(m,p);
  return href ? `<a class="duel-bet" href="${escapeHTML(href)}">${m.status==='done' ? '查看' : '選'} ${escapeHTML(p.name)} · ${m.status==='done' ? '盤口結果' : '前往下注'}</a>` : '';
}
function renderDuelActions(m,study){
  $('#duel-match-label').textContent=!m && S.selectedMatchId ? '此場次目前無法讀取，請返回賽程重新選擇。' : '';
  const center = S.selectedMatchId && !m ? '' : !DATA.demo && activity.slug && m?.id
    ? `<a class="duel-bet" href="/t/${encodeURIComponent(activity.slug)}/m/${encodeURIComponent(m.id)}#markets">觀局雅集</a>`
    : !DATA.demo && activity.slug ? '' : `<button type="button" class="duel-bet" data-duel-center>觀局雅集</button>`;
  $('#duel-bet-actions').innerHTML=center;
}
on($('[data-return-bracket]'),'click',()=>{arenaTicket?.close();goTo(chapters.findIndex(ch=>ch.id==='schedule'),{focus:()=>$$('#bracket-host .tt-node[data-match-id]').find(el=>el.dataset.matchId===S.selectedMatchId && !el.closest('[hidden]')) || $$('#bracket-host .tt-tab[aria-selected="true"]').find(el=>!el.closest('[hidden]')) || $('#schedule .chapter-sticky')});});
on(document,'click',event=>{
  const trigger=event.target.closest('[data-arena-bet]');
  if(!trigger || !duelContext.demo)return;
  if(preview){closeDossier();openSportsbook(duelContext.match?.id,trigger.dataset.arenaBet==='left'?'p1':'p2');return;}
  const side=trigger.dataset.arenaBet,context=duelContext;
  if(!context.match || context.match.status==='done')return;
  closeDossier(false);
  const open=create=>{
    if(destroyed || context!==duelContext || !create)return;
    if(!arenaTicket)arenaTicket=create({signal:lifetime.signal});
    resetDuelProximity(true);
    arenaTicket.open({players:[duelPeople.left,duelPeople.right],side,matchLabel:$('#duel-match-label').textContent || '比武示範',trigger:trigger.isConnected&&!trigger.closest('[hidden]')?trigger:$('#duel .duelist[data-side="'+side+'"]')});
  };
  if(!ticketModule)ticketModule=import('/lunjian/arena-ticket.js?v=c60d96c9f704').then(module=>module.createArenaTicket).catch(()=>{ticketModule=null;$('#announcement').textContent='示範注單載入失敗，請重試。';});
  ticketModule.then(open);
});

function openSportsbook(matchId='',outcome=''){
  document.dispatchEvent(new CustomEvent('lunjian:sports-open',{detail:{eventId:sportsbookData?.sportsEventId,matchId,outcome,...(!sportsbookData && DATA.demo && DATA.players.length>=2?{snapshot:JSON.parse(JSON.stringify({players:DATA.players,rounds:DATA.rounds}))}:{})}}));
}
on($('[data-sports-center]'),'click',()=>document.dispatchEvent(new CustomEvent('lunjian:sports-open',{detail:{member:true,eventId:sportsbookData?.sportsEventId}})));
on($('#duel-bet-actions'),'click',event=>{if(event.target.closest('[data-duel-center]'))openSportsbook(duelContext.match?.id);});
function applySportsbookEvent(view){
  if(destroyed || !view?.sportsEventId)return;
  if(!preview){
    if(new URL(location.href).searchParams.get('sportsEvent')!==view.sportsEventId)return;
    preview=true;
  }
  sportsbookData=view;DATA=view;PHASE=view.phase<4?'signup':view.phase===6?'finished':'live';S.duelPreview=null;
  bracketEditor?.destroy();bracketEditor=null;$('#bracket-host').dataset.editing='false';$('#bracket-host').dataset.placing='false';renderPrizes();renderDuel();renderBracket();renderRegister();
}

/* ══ VS 對立圖 ══════════════════════════════════════ */
const vs = $('#vs');
let vsReturn = null;
function findMatch(id){
  for (const r of DATA.rounds){ const m = r.matches.find(x => x.id === id); if (m) return m; }
  return null;
}
function plateHTML(p, m, hc, side){
  const rod = '<span class="scroll-rod top" aria-hidden="true"></span>';
  const rodB = '<span class="scroll-rod bot" aria-hidden="true"></span>';
  if (!p) return `${rod}<div class="scroll-body"><p class="nm">待定</p></div>${rodB}`;
  if(p.character || !p.rank) return `${rod}<div class="scroll-body"><p class="nm">${escapeHTML(p.name)}</p><p class="row">${escapeHTML(playerRank(p))}</p><p class="row">${escapeHTML(p.character?.weapon || '武器待公開')}</p><p class="more">點看角色配置 →</p></div>${rodB}`;
  const odds = PHASE === 'live' && m.status !== 'done' && S.vsOdds ? S.vsOdds[side==='left'?0:1] : null;
  const lo = p.loadout;
  return `${rod}<div class="scroll-body">
    <p class="nm">${p.name}</p>
    <p class="row">${rankMarks(p.rank)}${RANKS[p.rank-1].name} · ${RANKS[p.rank-1].title}</p>
    <p class="row">籤 ${p.seed}　${lo ? lo.weapons.map(w => w.art).join(' · ') : '—'}</p>
    ${hc.holder === p ? `<p class="row">讓武 ${hc.bp} BP</p>` : ''}
    ${odds ? `<p class="row">賠率 ${odds}</p>` : ''}
    <div class="self">
      <p class="self-head">選手自填</p>
      <p class="row">自評 ${RANKS[p.selfRank-1].name}</p>
      <p class="row">遊戲內段位 ${p.ladderRank}${p.ladderScore ? '　積分 ' + p.ladderScore : ''}</p>
    </div>
    <p class="more">點看配置與讓武 →</p>
  </div>${rodB}`;
}

/* ── 選手詳情：配置、讓武花在哪、下注 ──────────────────────────────
   一張卡塞不下心法四格＋奇術三類＋六類讓武，硬塞只會讓字小到讀不了。
   所以卡上放「這個人是誰」，點下去才看「他帶了什麼、讓了什麼」。 */
const DOSSIER_IMAGES = {"十方破陣": "martial/LIESHI_JUN_SFPZ.png", "斬雪刀法": "martial/LIESHI_JUN_ZXDF.png", "八方風雷槍": "martial/LIESHI_WEI_BFFLQ.png", "嗟夫刀法": "martial/LIESHI_WEI_JFDF.png", "無名劍法": "martial/MINGJIN_HONG_WMJF.png", "無名槍法": "martial/MINGJIN_HONG_WMQF.png", "積矩九劍": "martial/MINGJIN_YING_JJJJ.png", "九曲驚神槍": "martial/MINGJIN_YING_JQJSQ.png", "粟子行雲": "martial/POZHU_CHEN_SZXY.png", "醉夢游春": "martial/POZHU_CHEN_ZMYC.png", "泥犁三垢": "martial/POZHU_FENG_NLSG.png", "粟子游塵": "martial/POZHU_FENG_SZYC.png", "千機索天": "martial/POZHU_YUAN_QJST.png", "天志垂象": "martial/POZHU_YUAN_TZCX.png", "明川藥典": "martial/QIANSI_LIN_MCYD.png", "千香引魂蠱": "martial/QIANSI_LIN_QXYHG.png", "文動霓裳": "martial/QIANSI_YI_WDNC.png", "杏游草野": "martial/QIANSI_YI_XYCY.png", "九重春色": "martial/QIANSI_YU_JCCS.png", "青山執筆": "martial/QIANSI_YU_QSZB.png", "寸草心": "mind/XF_CCX.png", "穿喉決": "mind/XF_CHJ.png", "滄浪劍訣": "mind/XF_CLJJ.png", "春雷篇": "mind/XF_CLP.png", "燈兒亮": "mind/XF_DEL.png", "大卷微身": "mind/XF_DJWS.png", "斷石之構": "mind/XF_DSZG.png", "大唐歌": "mind/XF_DTG.png", "飛仙醉言": "mind/XF_FXZY.png", "扶搖直上": "mind/XF_FYZS.png", "風知意": "mind/XF_FZY.png", "孤忠不辭": "mind/XF_GZBC.png", "葫蘆飛飛": "mind/XF_HLFF.png", "花上月令": "mind/XF_HSYL.png", "君臣藥": "mind/XF_JCY.png", "極樂泣血": "mind/XF_JLQX.png", "劍氣縱橫": "mind/XF_JQZH.png", "困獸心經": "mind/XF_KSXJ.png", "抗造大法": "mind/XF_KZDF.png", "燎原踏": "mind/XF_LYT.png", "燎原星火": "mind/XF_LYXH.png", "凝神章": "mind/XF_NSZ.png", "怒斬馬": "mind/XF_NZM.png", "磐石訣": "mind/XF_PSJ.png", "千山法": "mind/XF_QSF.png", "千絲蠱": "mind/XF_QSG.png", "擒天勢": "mind/XF_QTS.png", "千營一呼": "mind/XF_QYYH.png", "山河絕韻": "mind/XF_SHJY.png", "所恨年年": "mind/XF_SHNN.png", "三窮致知": "mind/XF_SQZZ.png", "四時無常": "mind/XF_SSWC.png", "霜天白夜": "mind/XF_STBY.png", "繩舟行木": "mind/XF_SZXM.png", "天行健": "mind/XF_TXJ.png", "忘川絕響": "mind/XF_WCJX.png", "威猛歌": "mind/XF_WMG.png", "無名心法": "mind/XF_WMXF.png", "杏花不見": "mind/XF_XHBJ.png", "相和歌": "mind/XF_XHG.png", "心彌泥魚": "mind/XF_XMNY.png", "弦墨篇": "mind/XF_XMP.png", "燕別雲岫": "mind/XF_YBYX.png", "移經易武": "mind/XF_YJYW.png", "易水歌": "mind/XF_YSG.png", "一醉千秋": "mind/XF_YZQQ.png", "縱地摘星": "mind/XF_ZDZX.png", "逐狼心經": "mind/XF_ZLXJ.png", "征人歸": "mind/XF_ZRG.png", "指玄篇注": "mind/XF_ZXPZ.png", "劍": "equipment/loadout/EQUIPMENT_WEAPON_SWORD.png", "槍": "equipment/loadout/EQUIPMENT_WEAPON_SPEAR.png", "扇": "equipment/loadout/EQUIPMENT_WEAPON_FAN.png", "傘": "equipment/loadout/EQUIPMENT_WEAPON_UMBRELLA.png", "繩鏢": "equipment/loadout/EQUIPMENT_WEAPON_ROPE.png", "鼓": "equipment/loadout/EQUIPMENT_WEAPON_DRUM.png", "橫刀": "equipment/loadout/EQUIPMENT_WEAPON_BLADE.png", "雙刀": "equipment/loadout/EQUIPMENT_WEAPON_2BLADE.png", "陌刀": "equipment/loadout/EQUIPMENT_WEAPON_BIGBLADE.png", "拳套": "equipment/loadout/EQUIPMENT_WEAPON_FIST.png", "流星動岳": "equipment/cards/EQUIPMENT_WEAPON_FIST.png", "流星碎刃": "equipment/cards/EQUIPMENT_WEAPON_BIGBLADE.png", "流星雙鯉": "equipment/cards/EQUIPMENT_WEAPON_2BLADE.png", "流星斷水": "equipment/cards/EQUIPMENT_WEAPON_BLADE.png", "流星凌波": "equipment/cards/EQUIPMENT_WEAPON_DRUM.png", "流星鳴鏢": "equipment/cards/EQUIPMENT_WEAPON_ROPE.png", "流星雲傘": "equipment/cards/EQUIPMENT_WEAPON_UMBRELLA.png", "流星畫扇": "equipment/cards/EQUIPMENT_WEAPON_FAN.png", "流星羽林": "equipment/cards/EQUIPMENT_WEAPON_SPEAR.png", "流星含光": "equipment/cards/EQUIPMENT_WEAPON_SWORD.png", "吳鉤霜披膊": "equipment/cards/EQUIPMENT_HAND.png", "吳鉤霜冠": "equipment/cards/EQUIPMENT_HEAD.png", "吳鉤霜縛袴": "equipment/cards/EQUIPMENT_SHOES.png", "吳鉤霜甲": "equipment/cards/EQUIPMENT_CLOTH.png", "流星雲瓏": "equipment/cards/EQUIPMENT_RING.png", "流星辟邪": "equipment/cards/EQUIPMENT_PENDANT.png", "裂石鈞": "martial/LIESHI_JUN.png", "裂石威": "martial/LIESHI_WEI.png", "鳴金虹": "martial/MINGJIN_HONG.png", "鳴金影": "martial/MINGJIN_YING.png", "破竹塵": "martial/POZHU_CHEN.png", "破竹風": "martial/POZHU_FENG.png", "破竹鳶": "martial/POZHU_YUAN.png", "破竹樽": "martial/POZHU_ZUN.png", "牽絲霖": "martial/QIANSI_LIN.png", "牽絲翊": "martial/QIANSI_YI.png", "牽絲玉": "martial/QIANSI_YU.png"};
function dossierTile(name, label=''){
  const src=DOSSIER_IMAGES[name];
  return `<figure class="dz-gear${src?'':' dz-gear-text'}">${src?`<img src="/loadout/assets/${src}" alt="" width="160" height="128">`:''}<figcaption>${label?`<small>${escapeHTML(label)}</small>`:''}<strong>${escapeHTML(name)}</strong></figcaption></figure>`;
}
let dossierDemoData;
if(preview) fetch('/lunjian/dossier-demo.json').then(r=>{if(!r.ok)throw new Error('load');return r.json();}).then(data=>{dossierDemoData=data;if(!destroyed)renderDuel();}).catch(()=>{});
function demoDossierHTML(p,data){
 const index=Array.from(String(p.id)).reduce((n,c)=>n+c.charCodeAt(0),0)%data.profiles.length;
 const profile=data.profiles[index];
 const tile=(item,kind)=>`<figure class="demo-item demo-${kind}"><div class="demo-item-art">${item.image?`<img src="${item.image}" alt="" loading="lazy">`:''}<figcaption><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.note)}</small></figcaption></div>${item.stats?.length?`<dl class="demo-stats">${item.stats.map(([k,v])=>`<div><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join('')}</dl>`:''}</figure>`;
 return `<header class="dz-head"><p class="dz-kicker">示範配置 · 非選手實際配裝</p><h3 class="dz-name" id="dz-title">${escapeHTML(p.name)}</h3><p>${escapeHTML(profile.title)}</p></header>`+
 profile.sections.map(section=>`<section class="dz-sec"><h4>${escapeHTML(section.title)}</h4><div class="demo-grid demo-grid-${section.kind}">${section.kind==='martial'&&profile.build?`<div class="demo-build"><div class="demo-build-title"><img src="${profile.build.image}" alt=""><strong>${escapeHTML(profile.build.name)}</strong></div><img class="demo-build-watermark" src="${profile.build.familyImage}" alt=""><div class="demo-build-arts">${section.items.map(item=>`<div><img src="${item.image}" alt=""><strong>${escapeHTML(item.name)}</strong></div>`).join('')}</div></div>`:section.items.map(item=>tile(item,section.kind)).join('')}</div></section>`).join('')+
 `<section class="dz-sec demo-bp"><h4>對方點名的 BP 限制 · 示範</h4>${profile.bpReceived.length ? `<table><thead><tr><th>限制項目</th><th>BP</th><th>本場效果</th></tr></thead><tbody>${profile.bpReceived.map(bp=>`<tr><th scope="row">${escapeHTML(bp.name)}<small>${escapeHTML(bp.target)}</small></th><td>${bp.cost}</td><td>${escapeHTML(bp.effect)}</td></tr>`).join('')}</tbody></table>` : '<p>本場未受對方點名限制。</p>'}</section>`+'<div class="dz-actions" id="dz-actions"></div>';
}
function dossierHTML(p, hc){
  const head=`<header class="dz-head"><p class="dz-kicker">備戰方案</p><h3 class="dz-name" id="dz-title">${escapeHTML(p.name)}</h3></header>`;
  const end='<div class="dz-actions" id="dz-actions"></div>';
  if(p.character){
    const c=p.character;
    const names=String(c.weapon||'').split(/[、，,\n／/]+/).map(x=>x.trim()).filter(Boolean);
    return head+`<section class="dz-sec"><h4>武器</h4><div class="dz-gear-grid">${names.length?names.map(n=>dossierTile(n)).join(''):'<p>待公開</p>'}</div></section>${c.style?`<p class="dz-note">${escapeHTML(c.style)}</p>`:''}<details class="dz-details"><summary>裝備與武學</summary>${[['equipment','裝備'],['arts','武學']].map(([k,n])=>`<h4>${n}</h4><p class="dz-note">${escapeHTML(c[k]||'待公開')}</p>`).join('')}</details>`+end;
  }
  if(p.pending || !p.loadout || (!managerMode && (p.demo || preview))) return head+'<p class="dz-empty">武器與裝備待公開</p>'+end;
  const lo=p.loadout;
  return head+`<section class="dz-sec"><h4>武器</h4><div class="dz-gear-grid">${lo.weapons.map(w=>dossierTile(w.art,w.role+'武器')).join('')}</div></section>
    <section class="dz-sec"><h4>心法</h4><div class="dz-mind-grid">${lo.xinfa.map(n=>dossierTile(n,n===lo.zhu?'主修':'')).join('')}</div></section>
    <details class="dz-details"><summary>其餘配置</summary><h4>裝備</h4><p class="dz-note">${(lo.equipment||[]).map(x=>escapeHTML(x.name)).join(' · ')||'待公開'}</p><h4>武學</h4><p class="dz-note">${lo.skills.map(x=>escapeHTML(x.n)).join(' · ')}</p><h4>奇術</h4><p class="dz-note">${lo.qishu.map(x=>escapeHTML(x.n)).join(' · ')}</p></details><p class="dz-note" data-manager-only>示範配置</p>`+end;
}

function openVS(id, fromEl){
  const m = findMatch(id); if (!m) return;
  const p1 = byId(m.p1), p2 = byId(m.p2), hc = handicap(p1,p2);
  S.vsOdds = PHASE === 'live' && m.status !== 'done' ? oddsFor(20,8) : null;
  const isFinal = m.round === DATA.rounds.length;
  $('#vs-round').textContent = `第 ${m.round} 輪 · 第 ${m.slot+1} 場${DATA.demo ? '　示範資料' : ''}`;
  $('#vs-status').textContent = m.status === 'live' ? '比賽進行中。'
    : m.status === 'done' ? `${byId(m.winner)?.name || ''} ${m.bye ? '不戰而勝。' : '勝出。'}`
    : m.p1 && m.p2 ? '備戰中，等開打。' : '等上一輪分出勝負，對手到齊才開盤。';
  $('#vs-score').textContent = DATA.bestOf > 1 && m.status !== 'upcoming' ? `${m.s1} : ${m.s2}` : '';
  $('#vs-format').textContent = DATA.bestOf > 1 ? `${DATA.bestOf} 局 ${Math.floor(DATA.bestOf/2)+1} 勝` : (DATA.bestOf === 1 ? '單場定勝負' : '');
  $('#vs-note').textContent = hc.bp === 0 && p1 && p2 ? '同段對決，本場無讓武。' : '';
  $('#vs-plate-l').innerHTML = plateHTML(p1, m, hc, 'left');
  $('#vs-plate-r').innerHTML = plateHTML(p2, m, hc, 'right');
  $('#vs-plate-l').classList.toggle('won', !!p1 && m.winner === p1.id);
  $('#vs-plate-r').classList.toggle('won', !!p2 && m.winner === p2.id);
  $('#vs-fig-l').classList.toggle('lost', m.status==='done' && !!p1 && m.winner !== p1.id);
  $('#vs-fig-r').classList.toggle('lost', m.status==='done' && !!p2 && m.winner !== p2.id);
  // 印只在決賽、且已分勝負時蓋「首座」——單場勝者不是冠軍
  const cta = [];
  if (PHASE === 'live' && m.status !== 'done') cta.push('<a class="cta" href="#register">去下注</a>');
  if (isFinal && m.status === 'done') cta.push('<span class="cta" aria-hidden="true">首座 · ' + (byId(m.winner)?.name||'') + '</span>');
  $('#vs-cta').innerHTML = cta.join('');
  // 點卡看配置。兩張卡各自記住自己是誰，關掉再開也不會錯人。
  for (const [el, who] of [[$('#vs-plate-l'), p1], [$('#vs-plate-r'), p2]]){
    el.onclick = () => openDossier(who, hc, m);
    el.onkeydown = ev => {
      if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); openDossier(who, hc, m); }
    };
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', who ? `看 ${who.name} 的配置與讓武` : '待定');
  }
  vsReturn = fromEl || null;
  vs.hidden = false;
  requestAnimationFrame(() => {
    vs.setAttribute('data-open','');
    if (reduced.matches) return;
    // 460ms 開層之後才落人與字：先看清楚是誰，再給那一下衝擊。
    anime.timeline({ delay:260 })
      .add({ targets:'#vs-fig-l', translateX:['-3vw',0], opacity:[0,1], duration:320, easing:'easeOutCubic' })
      .add({ targets:'#vs-fig-r', translateX:['3vw',0],  opacity:[0,1], duration:320, easing:'easeOutCubic' }, '-=240')
      .add({ targets:'.vs-mark-art', scale:[1.4,1], opacity:[0,1], duration:420, easing:'cubicBezier(.34,1.56,.64,1)' }, '-=160')
      .add({ targets:'.vs-mark .burst', opacity:[0,.55], duration:180, easing:'easeOutQuad' }, '-=380');
    startVsPulse();
  });
  $('#announcement').textContent = `第 ${m.round} 輪第 ${m.slot+1} 場，${p1?p1.name:'待定'} 對 ${p2?p2.name:'待定'}`;
  $('.vs-close').focus();
}
/* VS 墨印的呼吸與閃動。
   墨是濕的、火是跳的，所以不是等速的脈動：一個慢的呼吸墊底，
   上面疊一串長短不一的閃 —— 等間隔的閃看起來是燈泡壞了，不是活的。 */
let vsPulse = null;
function startVsPulse(){
  stopVsPulse();
  if (reduced.matches) return;
  const art = $('.vs-mark-art'), burst = $('.vs-mark .burst');
  if (!art) return;
  vsPulse = anime.timeline({ loop:true, autoplay:true })
    .add({ targets:art, scale:[1,1.045], duration:1700, easing:'easeInOutSine' })
    .add({ targets:art, opacity:[1,.62], duration:70,  easing:'easeOutQuad' }, 420)
    .add({ targets:art, opacity:[.62,1], duration:130, easing:'easeOutQuad' }, 490)
    .add({ targets:art, opacity:[1,.78], duration:50,  easing:'easeOutQuad' }, 980)
    .add({ targets:art, opacity:[.78,1], duration:90,  easing:'easeOutQuad' }, 1030)
    .add({ targets:art, scale:[1.045,1], duration:1500, easing:'easeInOutSine' })
    .add({ targets:art, opacity:[1,.70], duration:60,  easing:'easeOutQuad' }, 2300)
    .add({ targets:art, opacity:[.70,1], duration:150, easing:'easeOutQuad' }, 2360);
  if (burst){
    anime({ targets:burst, opacity:[.55,.22], scale:[1,1.14],
            duration:2100, easing:'easeInOutSine', direction:'alternate', loop:true });
  }
}
function stopVsPulse(){
  if (vsPulse){ vsPulse.pause(); vsPulse = null; }
  const art = $('.vs-mark-art');
  if (art) anime.remove(art);
  const burst = $('.vs-mark .burst');
  if (burst) anime.remove(burst);
}

/* 對立圖的指標運鏡。
   靠近哪一邊哪一邊放大、變亮、往前站；整個畫面也跟著反方向微移，
   那是「鏡頭跟著看的人走」——第 3 格已經是這個做法，兩邊要一致。 */
const VS_POINTER = { x:0, y:0, tx:0, ty:0 };
function vsPointerFrame(){
  if (vs.hidden){ VS_POINTER.raf = 0; return; }
  const k = 0.12;
  VS_POINTER.x += (VS_POINTER.tx - VS_POINTER.x) * k;
  VS_POINTER.y += (VS_POINTER.ty - VS_POINTER.y) * k;
  vs.style.setProperty('--vs-lean', VS_POINTER.x.toFixed(4));
  vs.style.setProperty('--vs-my', VS_POINTER.y.toFixed(4));
  VS_POINTER.raf = requestAnimationFrame(vsPointerFrame);
}
addEventListener('pointermove', e => {
  if (vs.hidden || e.pointerType === 'touch') return;
  VS_POINTER.tx = e.clientX / innerWidth * 2 - 1;
  VS_POINTER.ty = e.clientY / innerHeight * 2 - 1;
  if (!VS_POINTER.raf) VS_POINTER.raf = requestAnimationFrame(vsPointerFrame);
}, { passive:true });

/* 點卡看配置。卡上放「這個人是誰」，點下去才看「他帶了什麼、讓了什麼」。 */
const dz = $('#psheet');
let dossierReturn=null;
const dossierInert=[];
function openDossier(p,hc,m,trigger,options={}){
  if(!p || destroyed) return;
  if(DATA.demo && !p.character && !options.demoData){
    if(dossierDemoData){openDossier(p,hc,m,trigger,{...options,demoData:dossierDemoData});return;}
    fetch('/lunjian/dossier-demo.json').then(r=>{if(!r.ok)throw new Error('load');return r.json();}).then(data=>{dossierDemoData=data;if(!destroyed && !dz.hidden && $('#dz-title')?.textContent===p.name)openDossier(p,hc,m,trigger,{...options,demoData:data});}).catch(()=>{});
  }
  if(dz.hidden){
    dossierReturn=trigger || document.activeElement;
    for(const node of [$('.skip-link'),$('.site-header'),$('main'),$('.progress-rail'),$('#vs')].filter(Boolean)){
      dossierInert.push([node,node.inert]);node.inert=true;
    }
  }
  $('#dz-body').innerHTML=options.demoData ? demoDossierHTML(p,options.demoData) : dossierHTML(p,hc);
  const acts=$('#dz-actions');
  if(options.fromBracket){
    acts.innerHTML='<button type="button" class="dz-bet" data-dz-match>前往此場比武</button><button type="button" class="dz-bet" data-dz-close>返回賽程</button>';
    $('[data-dz-match]').onclick=()=>selectDuelMatch(m.id);
  }else acts.innerHTML=betActionHTML(m,p,p===duelPeople.right?'right':'left',duelContext.demo)+'<button type="button" class="dz-bet" data-dz-close>返回比武</button>';
  resetDuelProximity(true);
  dz.hidden=false;$('.dz-sheet').scrollTop=0;$('.dz-close').focus({preventScroll:true});
}
function closeDossier(restore=true){
  if(dz.hidden) return;
  dz.hidden=true;
  dossierInert.splice(0).forEach(([node,was])=>{node.inert=was;});
  if(restore){
    const replacement=dossierReturn?.dataset.seat!==undefined ? $$('#bracket-host .tt-player').find(el=>el.dataset.matchId===dossierReturn.dataset.matchId && el.dataset.seat===dossierReturn.dataset.seat) : null;
    (dossierReturn?.isConnected?dossierReturn:replacement)?.focus();
  }
  dossierReturn=null;
}
on(dz,'click',e=>{if(e.target.closest('[data-dz-close]')) closeDossier();});
addEventListener('keydown',e=>{
  if(dz.hidden) return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeDossier();return;}
  if(e.key==='Tab'){
    const tabs=[...dz.querySelectorAll('button:not([disabled]),a[href],summary,[tabindex="0"]')].filter(el=>!el.hidden);
    const first=tabs[0],last=tabs[tabs.length-1];
    if(e.shiftKey && (document.activeElement===first || !dz.contains(document.activeElement))){e.preventDefault();last?.focus();}
    else if(!e.shiftKey && (document.activeElement===last || !dz.contains(document.activeElement))){e.preventDefault();first?.focus();}
  }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) e.stopImmediatePropagation();
},true);
for(const el of $$('#duel .duelist,#duel .fighter')){
  el.setAttribute('aria-haspopup','dialog');
  el.setAttribute('aria-controls','psheet');
  const show=()=>openDossier(duelPeople[el.dataset.side],duelContext.hc,duelContext.match,el);
  on(el,'click',show);
  on(el,'keydown',e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();show();}});
  on(el,'focus',()=>{if(!duelProximity.pointer) setDuelFocus(el.dataset.side);});
  on(el,'blur',()=>{if(dz.hidden && !duelProximity.pointer) setDuelFocus('');});
}
cleanups.push(()=>closeDossier(false));

function closeVS(){
  closeDossier();
  stopVsPulse();
  vs.removeAttribute('data-open');
  setTimeout(() => { vs.hidden = true; }, reduced.matches ? 0 : 300);
  if (vsReturn && document.contains(vsReturn)) vsReturn.focus();
}
on(document, 'click', e => {
  const node = e.target.closest('.bnode.clickable');
  if (node){ selectDuelMatch(node.dataset.match); return; }
  if (e.target.closest('[data-vs-close]')) closeVS();
});
on(document, 'keydown', e => {
  if (e.key === 'Escape' && !vs.hidden) closeVS();
});

/* Proximity uses stable, unscaled actor centers, never hover/hitbox state. */
const duelProximity={left:0,right:0,targetLeft:0,targetRight:0,pointer:false,x:0,y:0,dirty:true,anchors:null};
const duelFigures={left:$('#duel .duelist[data-side="left"]'),right:$('#duel .duelist[data-side="right"]')};
function invalidateDuelGeometry(){duelProximity.dirty=true;}
function resetDuelProximity(immediate=false){
  duelProximity.pointer=false;
  duelProximity.targetLeft=duelProximity.targetRight=0;
  S.tlean=0;
  const arena=$('#duel');if(arena)delete arena.dataset.focusSide;
  if(immediate){duelProximity.left=duelProximity.right=S.lean=0;applyLean();}
}
function setDuelFocus(side){
  if(side) $('#duel').dataset.focusSide=side; else delete $('#duel').dataset.focusSide;
  // Keyboard focus is an outline, never an alternate source of scale.
  duelProximity.targetLeft=duelProximity.targetRight=0;
  duelProximity.left=duelProximity.right=0;applyLean();
}
function updateDuelProximity(){
  const p=duelProximity;
  if(p.dirty){
    const arena=$('#duel .arena-composition').getBoundingClientRect();
    p.anchors={radius:Math.max(220,Math.min(arena.width*.5,innerHeight*.65))};
    for(const side of ['left','right']){
      const el=duelFigures[side];
      p.anchors[side]={x:arena.left+el.offsetLeft+el.offsetWidth*.5,y:arena.top+el.offsetTop+el.offsetHeight*.5};
    }
    p.dirty=false;
  }
  const amount=side=>{
    const center=p.anchors[side],t=Math.max(0,Math.min(1,1-Math.hypot(p.x-center.x,p.y-center.y)/p.anchors.radius));
    return t*t*(3-2*t);
  };
  p.targetLeft=amount('left');p.targetRight=amount('right');
  const side=p.targetLeft>p.targetRight ? 'left' : p.targetRight>p.targetLeft ? 'right' : '';
  if(side) $('#duel').dataset.focusSide=side; else delete $('#duel').dataset.focusSide;
}
function applyLean(){
  S.lean=duelProximity.right-duelProximity.left;
  S.tlean=duelProximity.targetRight-duelProximity.targetLeft;
  body.style.setProperty('--lean', S.lean.toFixed(3));
  for(const side of ['left','right']) duelFigures[side].style.setProperty('--focus',duelProximity[side].toFixed(3));
  const o = $('#duel-odds');
  if(!o)return;
  if (S.duelOdds && Math.abs(S.lean) > .5){
    o.textContent = '';
    o.setAttribute('data-show','');
  } else if (Math.abs(S.lean) < .4) o.removeAttribute('data-show');
}
addEventListener('pointermove', e => {
  if(reduced.matches || body.classList.contains('reading')) return;
  if(!finePointer.matches || e.pointerType==='touch' || arenaTicket?.isOpen() || !dz.hidden || !vs.hidden || chapters[S.shown].id!=='duel'){
    resetDuelProximity();return;
  }
  duelProximity.pointer=true;duelProximity.x=e.clientX;duelProximity.y=e.clientY;
  updateDuelProximity();
}, {passive:true});
addEventListener('pointerleave',()=>{resetDuelProximity();S.tmx=S.tmy=0;});
addEventListener('blur',()=>resetDuelProximity(true));
addEventListener('resize',invalidateDuelGeometry,{passive:true});
on($('#duel .chapter-sticky'),'scroll',invalidateDuelGeometry,{passive:true});
on(reduced,'change',()=>resetDuelProximity(true));
on(finePointer,'change',()=>resetDuelProximity(true));
cleanups.push(()=>resetDuelProximity(true));

/* 指標視差：一個輸入源。X 逆、Y 順（kage 實測方向）。
   阻尼 2.6/s＝半衰期 0.267s。觸控與減少動態時目標歸零。 */
S.tmx = S.tmy = S.mx = S.my = 0;
addEventListener('pointermove', e => {
  if (!finePointer.matches || reduced.matches){ S.tmx = S.tmy = 0; return; }
  S.tmx = e.clientX / innerWidth * 2 - 1;
  S.tmy = -(e.clientY / innerHeight * 2 - 1);
}, {passive:true});

/* ══ 主迴圈 ═════════════════════════════════════════ */
function tick(now){
  if(destroyed||!chapters[0]?.isConnected)return;
  const dt = Math.min(now - (S.last || now), 50); S.last = now;
  updateDeck(dt);
  tickCut(now);
  const k = 1 - Math.exp(-6 * dt/1000);
  if(duelProximity.pointer && duelProximity.dirty) updateDuelProximity();
  let focusChanged=false;
  for(const side of ['left','right']){
    const target=side==='left' ? duelProximity.targetLeft : duelProximity.targetRight;
    if(duelProximity[side]!==target){
      const delta=target-duelProximity[side];
      duelProximity[side]=Math.abs(delta)<.0005 ? target : duelProximity[side]+delta*k;
      focusChanged=true;
    }
  }
  if(focusChanged) applyLean();
  const kp = 1 - Math.exp(-2.6 * dt/1000);
  S.mx += (S.tmx - S.mx) * kp; S.my += (S.tmy - S.my) * kp;
  body.style.setProperty('--mx', S.mx.toFixed(4));
  body.style.setProperty('--my', S.my.toFixed(4));
  body.style.setProperty('--breath', smooth(S.frac).toFixed(3));
  // 3D 每一幀由這裡帶（S.render3d 由下面那支 module 掛上來）。
  // 用同一個 rAF，不另開一圈 —— 兩圈各自跑會在切格那幾幀錯開。
  if (S.render3d) S.render3d(now, dt);
  if (body.hasAttribute('data-debug')) drawHUD();
  requestAnimationFrame(tick);
}
function drawHUD(){
  $('#hud').textContent =
    `grid   ${S.shown} -> ${S.target}  (${LABELS[S.shown]})\n` +
    `frac   ${S.frac.toFixed(3)}\n` +
    `cut    ${S.cut ? S.cut.phase + ' ' + S.cut.t.toFixed(0) + 'ms' : '-'}\n` +
    `lean   ${S.lean.toFixed(3)}\n` +
    `mx/my  ${S.mx.toFixed(3)} ${S.my.toFixed(3)}\n` +
    `phase  ${PHASE}\n` +
    `layout ${DATA.published ? bracketLayout(DATA.rounds) : '-'}\n` +
    `vp     ${S.vw}x${S.vh}`;
}

/* Anime.js v3：分層進場一次，完成即定格；按可視畫格觸發。 */
function stopComicMotion(){
  // Invalidate before pausing: queued observer/complete callbacks must stay inert.
  const previous = comicSequence; comicSequence = null;
  previous?.controller.abort();
  comicObserver?.disconnect(); comicObserver = null;
  comicTimelines.forEach(timeline => timeline.pause());
  if (comicTargets.length) anime.remove(comicTargets);
  comicTargets.forEach(el => { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); el.removeAttribute('data-comic-state'); });
  comicTimelines = []; comicTargets = [];
}
function playComicScene(section,underCover=false){
  stopComicMotion();
  if (reduced.matches || body.classList.contains('reading') || body.hasAttribute('data-intro') || (body.hasAttribute('data-cut') && !underCover) || typeof anime.timeline !== 'function') return;
  const panels = [...section.querySelectorAll('[data-comic-frame]')];
  comicTargets = panels.flatMap(frame => [frame,...frame.querySelectorAll('[data-comic-layer]')]);
  if (!panels.length) return;
  const reader = section.querySelector('.chapter-sticky');
  const sequence = {controller:new AbortController(),visible:new Set(),cursor:0,active:null,timeline:null,started:0,drain:null};
  comicSequence = sequence;
  const current = () => comicSequence === sequence && !destroyed;
  const settle = frame => {
    [frame,...frame.querySelectorAll('[data-comic-layer]')].forEach(el => {
      el.style.removeProperty('opacity'); el.style.removeProperty('transform');
    });
    frame.dataset.comicState='shown';
    comicObserver?.unobserve(frame);
  };
  // Prime once under coverage. DOM follows left-to-right rows on desktop, top-to-bottom on mobile.
  panels.forEach(frame => { frame.style.opacity='0'; frame.dataset.comicState='waiting'; });
  const reveal = frame => {
    frame.dataset.comicState='entering';
    sequence.active=frame; sequence.started++;
    const timeline = anime.timeline({autoplay:false,easing:'easeOutSine',complete:() => {
      if (!current() || sequence.active !== frame) return;
      settle(frame); sequence.active=null; sequence.cursor++;
      sequence.drain();
    }});
    comicTimelines.push(timeline); sequence.timeline=timeline;
    const entryDistance = innerWidth < 768 ? 24 : 44;
    const entrySide = panels.indexOf(frame) % 2 === 0 ? -1 : 1;
    timeline.add({targets:frame,opacity:[0,1],translateX:[entrySide*entryDistance,0],duration:900,easing:'easeOutCubic'},0);
    const layers = kind => [...frame.querySelectorAll(`[data-comic-layer="${kind}"]`)];
    // Finish each layer before the next: scenery, people, foreground, dialogue.
    let layerAt=0;
    for(const [kind,duration] of [['scene',240],['character',360],['foreground',220],['caption',280]]){
      const targets=layers(kind);
      if(!targets.length) continue;
      timeline.add({targets,opacity:target => [0,Number.parseFloat(getComputedStyle(target).opacity)||1],duration},layerAt);
      layerAt+=duration;
    }
    if(layers('stamp').length) timeline.add({targets:layers('stamp'),opacity:[0,1],scale:[1.55,1],rotate:[-7,-5],duration:420,easing:'cubicBezier(.34,1.56,.64,1)'},layerAt);
    timeline.play();
  };
  sequence.drain = () => {
    if (!current()) return;
    if(sequence.active){
      const rect=sequence.active.getBoundingClientRect(), bounds=reader.getBoundingClientRect();
      const top=Math.max(bounds.top,$('.site-header').getBoundingClientRect().bottom);
      if(rect.height<=0 || bounds.height<=0 || (rect.bottom>top && rect.top<bounds.bottom)) return;
      // Scrolling past an in-flight panel must not keep the visible panel waiting.
      const skipped=sequence.active; sequence.active=null;
      sequence.timeline?.pause();
      anime.remove([skipped,...skipped.querySelectorAll('[data-comic-layer]')]);
      settle(skipped); sequence.cursor++;
    }
    // The first panel participates in the center-out page reveal; later panels wait for it to clear.
    if (body.hasAttribute('data-cut') && sequence.started > 0) return;
    while (sequence.cursor < panels.length){
      const frame=panels[sequence.cursor], rect=frame.getBoundingClientRect(), bounds=reader.getBoundingClientRect();
      const top=Math.max(bounds.top,$('.site-header').getBoundingClientRect().bottom);
      if (rect.height > 0 && bounds.height > 0 && rect.bottom <= top){
        // A fast scroll may pass panels between observer batches. Keep them readable, never block the queue.
        settle(frame); sequence.cursor++; continue;
      }
      if (comicObserver && (!sequence.visible.has(frame) || (rect.height > 0 && bounds.height > 0 && rect.top >= bounds.bottom))) return;
      reveal(frame); return;
    }
  };
  if (typeof IntersectionObserver === 'function'){
    comicObserver = new IntersectionObserver(entries => {
      if (!current()) return;
      entries.forEach(entry => {
        if (entry.isIntersecting) sequence.visible.add(entry.target);
        else sequence.visible.delete(entry.target);
      });
      sequence.drain();
    },{root:reader,threshold:0});
    panels.forEach(frame => comicObserver.observe(frame));
  }
  // Opacity does not change layout, so scrolling remains native and never snaps to a panel.
  reader.addEventListener('scroll',sequence.drain,{passive:true,signal:sequence.controller.signal});
  reader.addEventListener('focusin',event => {
    if (!current()) return;
    const frame=event.target.closest('[data-comic-frame]'), index=panels.indexOf(frame);
    if (index < sequence.cursor || index < 0) return;
    // Keyboard focus has priority over decorative staging: never focus an invisible control.
    sequence.active=null;
    comicTimelines.forEach(timeline => timeline.pause());
    const ready=panels.slice(sequence.cursor,index+1);
    anime.remove(ready.flatMap(item => [item,...item.querySelectorAll('[data-comic-layer]')]));
    ready.forEach(settle); sequence.cursor=index+1;
    sequence.drain();
  },{signal:sequence.controller.signal});
  sequence.drain();
}
cleanups.push(stopComicMotion);
on(reduced,'change', () => { if (reduced.matches) { stopComicMotion(); setReading(true); } });

/* 漫畫 BP 示意：只解釋段位差，不是正式讓武配置工具。 */
$$('[data-bp-gap]').forEach(button => on(button, 'click', () => {
  const gap = Number(button.dataset.bpGap);
  $$('[data-bp-gap]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  $('#comic-bp-output').textContent = String(gap * BP_PER_GAP);
  $('#comic-bp-owner').textContent = gap ? '低段位者取得' : '同段交手';
  $('#comic-bp-note').textContent = gap ? '高段位者依配置接受限制。' : '沒有段位差，不進行讓武。';
  if (!reduced.matches) {
    const motion = $('#comic-bp-output').animate?.([{opacity:.5,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}], {duration:240,easing:'ease-out'});
    if (motion) { const cancel = () => motion.cancel(); cleanups.push(cancel); motion.finished.then(() => { const i = cleanups.indexOf(cancel); if (i >= 0) cleanups.splice(i,1); }).catch(() => {}); }
  }
}));
if (reduced.matches || body.classList.contains('reading')) $$('.manga-fulltext,.handicap-group').forEach(d => d.open = true);

const purposeDetails = $('#prologue .manga-fulltext');
if (purposeDetails) {
  const summary = purposeDetails.querySelector('summary');
  let motion = null, targetOpen = purposeDetails.open;
  const reset = () => {motion?.cancel();motion=null;purposeDetails.style.height='';};
  on(summary,'click',e=>{
    if(reduced.matches || body.classList.contains('reading') || !purposeDetails.animate) return;
    e.preventDefault();
    const from = purposeDetails.getBoundingClientRect().height;
    targetOpen = motion ? !targetOpen : !purposeDetails.open;
    reset();
    purposeDetails.open = true;
    const to = targetOpen ? purposeDetails.getBoundingClientRect().height : summary.getBoundingClientRect().height;
    motion = purposeDetails.animate([{height:from+'px'},{height:to+'px'}],{duration:380,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'});
    motion.onfinish=()=>{purposeDetails.open=targetOpen;reset();};
  });
  cleanups.push(reset);
}
cleanups.push(()=>{if(rulesDialog?.open)rulesDialog.close();});


/* ══ 啟動 ═══════════════════════════════════════════ */
$$('.phase-pick button').forEach(b => on(b, 'click', () => setPhase(b.dataset.phase)));
function setReading(on) {
  stopComicMotion();
  if (on) $$('.manga-fulltext,.handicap-group').forEach(d => d.open = true);
  body.classList.toggle('reading', on);
  resetDuelProximity(true);invalidateDuelGeometry();
  chapterTitles?.setStatic(on || reduced.matches);
  S.cut = null; body.removeAttribute('data-cut');
  $$('.rule-table,.case-step').forEach(el => { el.style.removeProperty('opacity'); el.hidden = false; el.inert = false; el.removeAttribute('aria-hidden'); });
  $$('[data-reading-toggle]').forEach(b => { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '返回定格' : '靜態閱讀'; });
  if (on) { enterStage(); chapters.forEach(c => { c.setAttribute('data-on',''); c.querySelector('.chapter-sticky').inert = false; }); }
  else { window.scrollTo(0,0); swapTo(S.shown); }
  if ($('.nav-more').contains(document.activeElement)) $('.nav-more summary').focus();
  $('.nav-more').open = false;
  measure();
  if (on) chapters[S.shown].scrollIntoView({block:'start', behavior:'instant'});
}
$$('[data-reading-toggle]').forEach(b => on(b, 'click', () => setReading(!body.classList.contains('reading'))));
const moreMenu=$('.nav-more');
on(document,'click',event=>{if(moreMenu.open && !moreMenu.contains(event.target)) moreMenu.open=false;});
on(moreMenu,'keydown',event=>{
  if(event.key==='Escape' && moreMenu.open){event.preventDefault();event.stopPropagation();moreMenu.open=false;moreMenu.querySelector('summary').focus();}
});
function handicapHash(hash=location.hash){
  const target=document.getElementById(hash.slice(1));
  return target?.matches('.handicap-group') ? target : null;
}
function revealHandicapGroup(group){
  group.open=true;
  group.querySelector('summary').focus({preventScroll:true});
  group.scrollIntoView({block:'start',behavior:'instant'});
}
function syncHash(){
  const group=handicapHash(), id=group ? 'invitation' : location.hash.slice(1);
  const selected=new URLSearchParams(location.search).get('match') || '';
  if(selected!==S.selectedMatchId){S.selectedMatchId=selected;S.duelPreview=null;renderDuel();}
  const k=chapters.findIndex(c => c.id===id);
  if(k>=0) goTo(k,{instant:true,history:true});
  if(group) revealHandicapGroup(group);
}
addEventListener('popstate', syncHash);
addEventListener('hashchange', syncHash);
addEventListener('scroll', () => {
  if (!body.classList.contains('reading')) return;
  const index = chapters.findIndex(c => c.getBoundingClientRect().bottom > 160);
  if (index >= 0) { S.shown = S.target = index; markNav(index); }
}, {passive:true});
on($('#ignite'), 'click', e => { if ($('#boot').dataset.state === 'ready') S.ignite?.(e); });
on($('#boot'), 'keydown', e => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  ($('#ignite').disabled ? $('#boot') : $('#ignite')).focus({preventScroll:true});
});
$$('.activity-retry').forEach(button => on(button, 'click', () => document.dispatchEvent(new Event('lunjian:retry'))));
addEventListener('resize', measure, {passive:true});

// 導覽列上標出現在在哪一格。七個連結不標，使用者只知道有七格，不知道自己在第幾格。
const navLinks = $$('.site-nav a');
function markNav(k){
  const id = chapters[k] && chapters[k].id;
  navLinks.forEach(a => {
    const current = a.getAttribute('href') === '#' + id;
    a.toggleAttribute('data-here', current);
    if (current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    if (current && innerWidth < 1024) a.scrollIntoView({block:'nearest', inline:'nearest', behavior:'instant'});
  });
}

/* 導覽。整站的站內錨點（導覽列、進度軌、卡上的「去下注」「看對戰表」）
   一律攔下來走 goTo —— 交給瀏覽器跳錨點在定格式版面下什麼都不會發生，
   因為根本沒有可以捲的距離。 */
addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  if (!id) return;
  if(a.matches('.skip-link')){
    e.preventDefault();
    const reader=chapters[S.shown]?.querySelector('.chapter-sticky');
    if(reader){reader.focus({preventScroll:true});reader.scrollIntoView({block:'nearest',behavior:'instant'});}
    return;
  }
  const group=handicapHash('#'+id);
  if(group){
    e.preventDefault();
    if(location.hash!=='#'+id) history.pushState(null,'','#'+id);
    syncHash(); return;
  }
  const k = chapters.findIndex(c => c.id === id);
  if (k < 0) return;                       // 不是章節錨點（例如跳到內容），讓它走原本的
  e.preventDefault();
  goTo(k);
});

/* 鍵盤。左右與上下翻格，Home / End 到頭尾。
   刻意不接滾輪：使用者要的是定格，不是「滾一點點就換一格」。 */
addEventListener('keydown', e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (body.hasAttribute('data-intro')) return;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (body.classList.contains('reading')) return;
  if (arenaTicket?.isOpen() || !$('#vs').hidden || !$('#psheet').hidden || (moreMenu.open && moreMenu.contains(t))) return;            // 對立圖開著時方向鍵不換格
  const reader = (chapters[S.shown].dataset.layout === 'editorial' || chapters[S.shown].classList.contains('folio-chapter') || ['duel','schedule'].includes(chapters[S.shown].id)) && chapters[S.shown].querySelector('.chapter-sticky');
  const vertical = {ArrowDown:64, ArrowUp:-64, PageDown:innerHeight*.75, PageUp:-innerHeight*.75}[e.key];
  if (reader && vertical) { e.preventDefault(); reader.scrollBy({top:vertical, behavior:'instant'}); return; }
  const k = { ArrowRight:1, ArrowDown:1, PageDown:1, ArrowLeft:-1, ArrowUp:-1, PageUp:-1 }[e.key];
  if (k){ e.preventDefault(); goTo(S.target + k); return; }
  if (e.key === 'Home'){ e.preventDefault(); goTo(0); }
  if (e.key === 'End'){ e.preventDefault(); goTo(chapters.length - 1); }
});
// 裝置決定一次就好。之後所有版面規則掛在 body[data-device] 底下，
// 手機和桌機互不干擾 —— 用 media query 疊補丁做不到這件事。
const MOBILE_MAX = 1024;
function setDevice(){
  const m = innerWidth < MOBILE_MAX;
  body.dataset.device = m ? 'mobile' : 'desktop';
  markNav(S.shown);
}
setDevice();
addEventListener('resize', setDevice, {passive:true});

/* 底圖預設是各向異性 Kuwahara 烘出來的筆觸版：把照片攤成一塊塊平色，
   邊界不糊過去，並且沿著結構張量算出的紋理方向拉長筆觸，屋簷和樑就會被
   「順著長邊刷過」而不是化成一顆顆圓斑。圖是靜態的，同一張每幀結果一樣，
   所以離線烘好（tools/kuwahara.html + kuwahara.mjs），執行期零成本。
   ?paint=0 換回原始照片版做對照。 */
/* 中央 VS 採獨立透明墨字，保留舞台；原始提示詞見 VS_ARENA_PROMPT.md。
   圖片失敗時沿用程序生成的筆畫備援。 */
// art/vs-ink.png 一定在（工具已經產了一張同格式的佔位），所以不會有 404。
// 要換成真跡就直接覆蓋那個檔案，程式和 CSS 都不用動。
const VS_ART = '/lunjian/art/vs-arena-ink.webp';
(function mountVS(){
  const slot = $('#duel-vs-slot');
  try { slot.appendChild(inkVS()); }
  catch (e) { console.warn('VS 墨印生不出來：', e.message); }
  const im = new Image();
  im.onload = () => {
    if (destroyed) return;
    // 真跡是黑墨白紙，這裡底是暗的：先反相讓墨變亮、紙變黑，
    // 再用 screen 疊上去 —— screen 對黑色不做事，紙就自己消失了。
    im.className = 'duel-vs-art'; im.alt = '';
    slot.replaceChildren(im);
    document.body.setAttribute('data-vs-art', '');
  };
  im.src = VS_ART;      // 檔案不在就維持程序生成的那顆，不必處理錯誤
})();

if (qs.get('paint') === '0'){
  body.setAttribute('data-paint','off');
  $$('.shot img.bg').forEach(im => { im.src = im.getAttribute('src').replace('/kuwahara/','/'); });
}

if (qs.get('debug') === 'parallax') body.setAttribute('data-debug','');
if (qs.get('view') === 'reading' || reduced.matches) setReading(true);

measure();
setPhase(qs.get('phase') || 'signup');
// 開在哪一格：?g=3 優先，其次是網址後面的錨點（#duel）
let g0 = parseInt(qs.get('g'), 10);
if (!(g0 >= 0 && g0 < chapters.length)){
  const byHash = chapters.findIndex(c => c.id === (handicapHash() ? 'invitation' : location.hash.slice(1)));
  g0 = byHash >= 0 ? byHash : -1;
}
if (g0 >= 0){ S.shown = S.target = g0; swapTo(g0); if (body.classList.contains('reading')) goTo(g0, {instant:true, history:true}); }
else swapTo(0);
if (handicapHash()) revealHandicapGroup(handicapHash());
/* 3D 與 2D 都等待點燃。模組缺失時由 2D 序幕接手，不自動略過。 */
let openingSeen=false;
try{openingSeen=sessionStorage.getItem('lunjian:opening-seen:v1')==='1';}catch{}
if (!openingSeen && g0 <= 0 && !reduced.matches && qs.get('intro') !== '0' && !body.classList.contains('reading')){
  $('#boot').hidden = false;
  beginIntro();
  // 保險絲：stage3d.js 一載進來就會設 window.__stage3d。
  // 只有它整支載不起來（檔案缺了、被擋了）才由這裡提供 2D 點燃，
  // 否則交給它決定 —— 3D 要載十幾秒，用計時器賽跑一定會誤判。
  setTimeout(() => {
    if (body.hasAttribute('data-intro') && !window.__stage3d) prepareFallback();
  }, 2500);
}

// Reload glyphs per runtime revision: shared INK may still hold a previous title alphabet.
INK.glyphs=null;
// 字形資料先到再畫標題；沒到就維持字型版本，不會空白
INK.load('/lunjian/glyphs.json?v=bc72d0cfb6b9').then(() => {
  if (destroyed) return;
  buildWordmark();
  // 大標不在 chapters 裡，載入前那一次 applyGrid 掛不到它 —— 清掉記號再跑一次。
  delete $('#grid-title').dataset.word;
  applyGrid(S.shown, {animate:false});
  import('/lunjian/chapter-titles.js?v=014d26ecfed1').then(({createChapterTitles})=>{
    if(destroyed) return;
    chapterTitles=createChapterTitles({root:document,staticMode:reduced.matches || body.classList.contains('reading')});
    chapterTitles.enter(chapters[S.shown]);
  }).catch(()=>{});
}).catch(() => {});

requestAnimationFrame(tick);
/* 僅供美術採樣：直接繪製指定暈墨進度，不推進換頁狀態或切換內容。
   正式換頁依實際時間推進，稀疏影格也必須先完整覆蓋再揭幕。 */
function holdCut(p = .45){
  body.dataset.cut = '1';
  const time = clamp01(p) * CUT_TOTAL;
  paintInkBloom(clamp01(time / CUT_COVER),clamp01((time-CUT_COVER-CUT_HOLD)/(CUT_TOTAL-CUT_COVER-CUT_HOLD)));
  return true;
}
// startCut 也開出去：用捲動觸發很難穩定落在想看的那一幀
/** 入關：開場簾燒完之後由 stage3d.js 呼叫。介面進場，站名開始寫。 */
/* 入關。旗燒完之後的那一段。
   不是把所有東西同時打開 —— 那樣看起來是頁面載完了，不是戲開演了。
   節奏由 CSS 的 transition-delay 串（見上面那一段），這裡只負責兩件事：
   放行，以及在近景都到位之後才開始寫字。 */
function beginIntro(){
  body.dataset.intro = 'curtain';
  $$('.site-header, main').forEach(n => n.inert = true);
  $('#boot').hidden = false;
  $('#boot').dataset.state = 'loading';
  $('#boot').removeAttribute('data-fallback');
  $('#ignite').disabled = true;
  $('.boot-loading').removeAttribute('aria-hidden');
  introProgress(0, '展開江湖');
  $('#boot').focus({preventScroll:true});
}
function introProgress(value, label){
  $('#load-progress').value = value;
  $('#load-number').textContent = String(value);
  $('#load-label').textContent = label;
}
function readyIntro(ignite){
  if (!body.hasAttribute('data-intro') || destroyed) return;
  introProgress(100, '江湖已開');
  S.ignite = ignite;
  $('#boot').dataset.state = 'ready';
  $('.boot-loading').setAttribute('aria-hidden', 'true');
  $('#ignite').disabled = false;
  $('#ignite').focus({preventScroll:true});
}
function burningIntro(){
  $('#boot').dataset.state = 'burning';
  $('#ignite').disabled = true;
  $('#boot').focus({preventScroll:true});
}
async function prepareFallback(){
  if (S.fallbackStarted || destroyed) return;
  S.fallbackStarted = true;
  body.dataset.stage = '2d';
  if (!body.hasAttribute('data-intro')) return;
  $('#boot').dataset.fallback = '';
  introProgress(85, '迎候來者');
  const pictures = [$('#boot-duel'), $('#boot-shadows')];
  // 素材失敗仍可點燃 2D 布幕，不能卡在載入畫面。
  await Promise.race([Promise.all(pictures.map(picture => picture.decode?.().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 5000))]);
  if (destroyed) return;
  readyIntro(e => {
    if (e.detail) { $('#boot').style.setProperty('--fire-x', e.clientX / innerWidth * 100 + '%'); $('#boot').style.setProperty('--fire-y', e.clientY / innerHeight * 100 + '%'); }
    burningIntro();
    setTimeout(enterStage, 5200);
  });
}
function enterStage(){
  $$('.site-header, main').forEach(n => n.inert = false);
  $('#boot').hidden = true;
  if (!body.hasAttribute('data-intro')) return;
  try{sessionStorage.setItem('lunjian:opening-seen:v1','1');}catch{}
  body.removeAttribute('data-intro');
  playComicScene(chapters[S.shown]);
  $('.site-nav a').focus({preventScroll:true});
  if (reduced.matches || body.classList.contains('reading')) return;
  // 1.15s 之後才寫：前面那些都到位了，注意力才會落在這裡。
  // 用 setTimeout 不用 rAF —— 背景分頁裡 rAF 停擺，計時器照樣會到。
  setTimeout(() => { playWordmark(); startWordmarkShimmer(); }, 1150);
}

/* 寫完之後的微光。
   墨是濕的，乾之前會反光 —— 所以不是等速閃爍，是一個慢呼吸配偶爾一次亮。
   等到 --ink-dur 跑完才開始，寫的過程中閃會把筆順蓋掉。 */
let shimmer = null;
function startWordmarkShimmer(){
  const el = $('#wordmark');
  if (!el || reduced.matches) return;
  const svg = el.querySelector('.ink-svg');
  const dur = svg ? parseFloat(getComputedStyle(svg).getPropertyValue('--ink-dur')) || 2400 : 2400;
  clearTimeout(shimmer);
  shimmer = setTimeout(() => {
    el.setAttribute('data-lit', '');
    anime({ targets:el, opacity:[1,.86], duration:2400,
            easing:'easeInOutSine', direction:'alternate', loop:true });
  }, dur + 260);
}
function destroy(){
  if (destroyed) return;
  destroyed = true; lifetime.abort(); timers.forEach(window.clearTimeout); frames.forEach(window.cancelAnimationFrame);
  cleanups.forEach(fn => fn());
  try { S.scene3d?.dispose?.();  } catch {}
  $$('.site-header, main').forEach(n => n.inert = false);
  anime.remove(document.querySelectorAll('#main *,#wordmark,.foreground *'));
  body.classList.remove('reading'); ['intro','cut','stage','preview','device','grid','phase','activity','inkwave'].forEach(k => delete body.dataset[k]);
  window.__stage3d = false; delete window.__LUNJIAN; delete window.__inkStep;
}
window.__LUNJIAN = {destroy, applySportsbookEvent, updateActivity, updateTournament, selectDuelMatch, beginIntro, introProgress, readyIntro, burningIntro, prepareFallback, lifetime, cleanups, S, DATA, setPhase, openVS, bracketLayout, FIXTURES,
                    startCut, swapTo, holdCut, goTo, enterStage, applyGrid};
document.dispatchEvent(new Event('lunjian:ready'));
window.__inkStep = (l,t) => paintInkBloom(l,t);   // 驗證用
})();

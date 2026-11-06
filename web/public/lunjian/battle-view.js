import { createBracketTree as createLegacyTree } from '/lunjian/bracket-tree.js?v=5f3d12eb9fc9';
import { bracketRounds, sideOf, nextMatch, championOf, finalOf, scheduleLayout, scheduleHeading, duelLayout, entrantsOf, imageOf, historyOf, matchesOf, publicBattle, rankNames, rankFrames, teamRoute, teamSize } from '/lunjian/battle-model.js?v=1b8067c88d34';

// Art is shared with the approved HTML studies. Names, scores and ranks are live text.
const ASSET = '/battle-preview/assets/';
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const produced = name => ASSET + 'battle-produced/' + name + '.webp';
const art = name => ASSET + 'champion-reference-v2/' + name + '.webp';
const rank = p => p?.rankName || rankNames[Number(p?.rank)] || '待評定';
const frame = p => rankFrames[Number(p?.rank)] || 'pending';
const frameArt = (p, cls) => frame(p)==='pending' ? '' : img(produced(`rank-${frame(p)}-v1`),cls);
const img = (src, cls = '') => `<img src="${e(src)}" class="${cls}" alt="" decoding="async">`;
const SILHOUETTE = '<svg viewBox="0 0 100 120" aria-hidden="true"><circle cx="50" cy="32" r="21"/><path d="M12 118V100C12 56 88 56 88 100V118"/></svg>';
// A missing game photo is an honest empty state (a faceless ink silhouette), never a borrowed portrait.
const EMPTY_ART = `<img src="${produced('portrait-empty-v1')}" class="portrait-empty-art" alt="" decoding="async">`;
const photo = (p, cls = '') => imageOf(p) ? img(imageOf(p), cls + ' portrait-photo') : `<span class="portrait-empty ${cls}" role="img" aria-label="尚未提供遊戲照片">${EMPTY_ART}</span>`;
const byId = (data, id) => (data.players || []).find(p => p.id === id);
// The phone round panel and the desktop tree carry the same controls; only the rendered one can take focus.
const rendered = (root, selector) => { const all = [...root.querySelectorAll(selector)]; return all.find(el => el.getClientRects().length) || all[0] || null; };
// Kept for the champion boards (I/J), whose approved heading carries context above the title.
const heading = (h, cls = '') => `<header class="draft-heading ${cls}"><p class="draft-context">${e(h.context)}</p><h2 class="draft-title">${e(h.title)}</h2><p class="draft-status">${e(h.status)}</p></header>`;
// A–H follow the reference sheets: big title, then a ruled subtitle beneath it.
const sceneTitle = (title, sub, cls = '') => `<header class="scene-title ${cls}"><h2>${e(title)}</h2>${sub ? `<p class="scene-sub"><span>${e(sub)}</span></p>` : ''}</header>`;
const matchNumber = (m) => m.kind === 'third' ? '季軍賽' : `第${m.slot + 1}場`;
const scoreOf = (m, mine) => mine ? `${m.p1 === mine ? m.s1 : m.s2}:${m.p1 === mine ? m.s2 : m.s1}` : `${m.s1 ?? 0}:${m.s2 ?? 0}`;
const DIGITS = '零一二三四五六七八九';
const cn = n => n < 10 ? DIGITS[n] : n < 20 ? '十' + (n % 10 ? DIGITS[n % 10] : '') : DIGITS[Math.floor(n / 10)] + '十' + (n % 10 ? DIGITS[n % 10] : '');
const sceneArt = () => `<div class="scene-art" aria-hidden="true"><i class="far"></i><div class="papers"><i class="strip"></i><i class="wing red"></i><i class="wing blue"></i></div></div>`;

// Must match the page's one-screen media query in battle-live.css and battle-embed.css.
const FULL_SCREEN = '(min-width: 901px), (min-width: 761px) and (orientation: landscape)';
function surface(host, signal) {
  const mount = document.createElement('div');
  mount.className = 'battle-art-host';
  const root = mount.attachShadow({mode:'open'});
  root.innerHTML = '<link rel="stylesheet" href="/lunjian/battle-art.css?v=fd6239009dd9"><div class="battle-surface"></div>';
  const body = root.querySelector('.battle-surface');
  // data-battle-theme, not data-theme: the site paints every [data-theme] element with its base surface.
  const sync = () => mount.dataset.battleTheme = document.documentElement.dataset.colorMode || 'light';
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {attributes:true,attributeFilter:['data-color-mode']});
  sync(); host.append(mount);
  let interactions = null;
  const resetInteractions = () => { interactions?.abort(); interactions = new AbortController(); return interactions.signal; };
  const destroy = () => { interactions?.abort(); observer.disconnect(); root.querySelector('dialog')?.close(); mount.remove(); };
  signal?.addEventListener('abort', destroy, {once:true});
  // One screen on landscape screens: content taller than the room between the nav and the footer row
  // scales down as a whole; the paper art behind it stays full-bleed.
  const fit = () => {
    if (!mount.isConnected) return;
    const target = root.querySelector('.battle-scene > .scene-body, .champion-body') || body;
    target.style.removeProperty('transform'); target.style.removeProperty('margin-bottom');
    if (!matchMedia(FULL_SCREEN).matches) return;
    const page = getComputedStyle(mount);
    // The phone bar's --nav-h is a calc() with the safe area, which parseFloat cannot read; measure the bar then.
    // Under a large-screen zoom (app/large-screen.css) the room is counted in the scene's own pixels.
    const zoom = mount.currentCSSZoom || 1;
    const nav = parseFloat(page.getPropertyValue('--nav-h')) || (document.querySelector('header[data-site-nav]')?.getBoundingClientRect().bottom || 112) / zoom, footer = parseFloat(page.getPropertyValue('--battle-footer')) || 0;
    const room = innerHeight / zoom - nav - footer - 18, natural = target.offsetHeight;
    if (natural <= room + 1) return;
    const scale = Math.max(.5, room / natural);
    target.style.transformOrigin = 'top center'; target.style.transform = `scale(${scale})`;
    target.style.marginBottom = `${-natural * (1 - scale)}px`;
  };
  const fitting = new ResizeObserver(() => requestAnimationFrame(fit)); fitting.observe(mount);
  const fitLife = new AbortController(); addEventListener('resize', fit, {signal: fitLife.signal});
  signal?.addEventListener('abort', () => { fitting.disconnect(); fitLife.abort(); }, {once:true});
  // Camera sway (landscape, fine pointer, motion allowed): the pointer pans the art layers by depth;
  // the content layer stays still so every control remains where it was aimed.
  const wide = matchMedia(FULL_SCREEN), calm = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
  let aim = {x:0, y:0}, cam = {x:0, y:0}, swayFrame = 0;
  const pan = () => {
    cam.x += (aim.x - cam.x) * .08; cam.y += (aim.y - cam.y) * .08;
    for (const art of root.querySelectorAll('.scene-art')) { art.style.setProperty('--cam-x', cam.x.toFixed(4)); art.style.setProperty('--cam-y', cam.y.toFixed(4)); }
    swayFrame = Math.abs(aim.x - cam.x) + Math.abs(aim.y - cam.y) > .001 ? requestAnimationFrame(pan) : 0;
  };
  const steer = (x, y) => { if (!mount.getClientRects().length) return; aim = wide.matches && calm.matches ? {x, y} : {x:0, y:0}; if (!swayFrame) swayFrame = requestAnimationFrame(pan); };
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') steer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, {passive:true, signal: fitLife.signal});
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) steer(0, 0); }, {signal: fitLife.signal});
  for (const q of [wide, calm]) q.addEventListener('change', () => steer(0, 0), {signal: fitLife.signal});
  signal?.addEventListener('abort', () => cancelAnimationFrame(swayFrame), {once:true});
  return {root, body, mount, destroy, resetInteractions, fit};
}

/* ── Shared pieces ───────────────────────────────────────────────────────── */
function plate(p, side, matchId, teamLabel = '') {
  return `<button type="button" class="nameplate ${side}${side==='blue'?' mirror':''}" data-player="${e(p.id)}" data-side="${side}" data-match="${e(matchId)}" aria-label="查看${e(p.name)}資料"><span class="plate-portrait-mask">${photo(p,'portrait')}</span>${frameArt(p,'plate-frame')}${teamLabel?'':frameArt(p,'plate-frame plate-frame-front')}<span class="identity"><strong>${e(p.name)}</strong><span class="rank">${e(teamLabel || rank(p))}</span></span></button>`;
}
/** Status stamp of one entrant in one match, as on the A/B sheet: 勝出 / 待賽 / 輪空 + BO score. */
function seatStatus(data, m, p) {
  const bo = data.bestOf ? `BO${data.bestOf}` : '';
  const known = m.status === 'done' && m.winner && [m.p1, m.p2].includes(m.winner);
  const score = known || m.status === 'live' ? scoreOf(m, p?.id) : '-:-';
  // The entrant with the empty seat advances; the gold 輪空 stamp belongs to the empty seat itself.
  if (m.bye && (!m.p1 || !m.p2)) return {label: '勝出', cls: 'won', note: '輪空晉級'};
  if (known && m.bye) return {label: m.winner === p?.id ? '勝出' : '棄賽', cls: m.winner === p?.id ? 'won' : 'lost', note: '不戰而勝'};
  if (known) return {label: m.winner === p?.id ? '勝出' : '落敗', cls: m.winner === p?.id ? 'won' : 'lost', note: `${bo} ${score}`.trim()};
  if (m.status === 'live') return {label: '比武中', cls: 'live', note: `${bo} ${score}`.trim()};
  return {label: '待賽', cls: 'waiting', note: `${bo} ${score}`.trim()};
}
/** One horizontal nameplate in the bracket. The player and the match are sibling buttons. */
function seat(data, m, index, side, {seed = false} = {}) {
  const id = index === 0 ? m.p1 : m.p2, p = id ? byId(data, id) : null;
  const key = `${m.id}:${index}`;
  const isBye = !id && m.bye && (m.p1 || m.p2);
  if (isBye) return `<div class="seat bye ${side}" data-seat="${e(key)}"><span class="seat-portrait">${EMPTY_ART}</span><span class="seat-name"></span><span class="seat-status bye"><b>輪空</b><small>直接晉級</small></span></div>`;
  const st = seatStatus(data, m, p);
  const statusButton = `<button type="button" class="seat-status ${st.cls}" data-match-open="${e(m.id)}" aria-label="${e(matchNumber(m))}，${e(st.label)}${st.note ? '，' + e(st.note) : ''}，查看比武"><b>${e(st.label)}</b><small>${e(st.note)}</small></button>`;
  if (!p) return `<div class="seat pending ${side}" data-seat="${e(key)}"><span class="seat-portrait">${EMPTY_ART}</span><span class="seat-name"><strong aria-label="席位待定"></strong></span>${statusButton}</div>`;
  const team = entrantsOf(p).length > 1;
  const seedNo = seed && Number(p.seed) > 0 ? `<span class="seat-seed">${e(p.seed)}號</span>` : '';
  return `<div class="seat ${side} ${st.cls}" data-seat="${e(key)}" data-rank="${frame(p)}">${seedNo}<button type="button" class="seat-player" data-player="${e(p.id)}" data-side="${side}" data-match="${e(m.id)}" aria-label="查看${e(p.name)}資料"><span class="seat-portrait">${imageOf(p) ? img(imageOf(p), 'portrait-photo') : EMPTY_ART}</span><span class="seat-name"><strong>${e(p.name)}</strong><small>${team ? `${entrantsOf(p).length} 人` : e(rank(p))}</small></span></button>${statusButton}</div>`;
}

/* ── A / B: two-sided tree on full-bleed paper, centre crown panel ──────── */
function bracketSubtitle(data, rounds) {
  const count = (data.players || []).length;
  const byes = rounds[0]?.matches.filter(m => m.bye && (!m.p1 || !m.p2)).length || 0;
  return `${cn(count)}強單淘汰賽${byes ? `（${cn(byes)}組輪空）` : ''}`;
}
function bracket(data) {
  const rounds = bracketRounds(data), final = finalOf(data), champion = championOf(data);
  const sideRounds = final ? rounds.slice(0, -1) : rounds;
  const column = (round, index, side) => {
    const matches = round.matches.filter(m => sideOf(round, m) === side);
    const items = index === 0
      ? matches.map(m => `<div class="ab-pair">${seat(data, m, 0, side, {seed: true})}${seat(data, m, 1, side, {seed: true})}</div>`)
      : matches.flatMap(m => [seat(data, m, 0, side), seat(data, m, 1, side)]);
    return `<div class="ab-col" data-col="${index}" aria-label="${e(round.label || '第 ' + round.round + ' 輪')}">${items.join('')}</div>`;
  };
  const side = tone => {
    const cols = sideRounds.map((r, i) => column(r, i, tone));
    return `<section class="ab-side ${tone}" aria-label="${tone === 'red' ? '紅方' : '藍方'}" style="--cols:${Math.max(1, sideRounds.length)}">${(tone === 'red' ? cols : cols.reverse()).join('')}</section>`;
  };
  const crownPanel = `<div class="ab-crown-panel" data-final-anchor><span class="ab-moon"></span><span class="tree-crown"></span><strong class="ab-crown-word">冠軍</strong></div>`;
  const championBox = champion
    ? `<div class="ab-champion won">${seat(data, final, final.p1 === champion.id ? 0 : 1, final.p1 === champion.id ? 'red' : 'blue')}</div>`
    : `<div class="ab-champion"><span class="ab-champion-mark">${SILHOUETTE}</span><span class="ab-champion-rule" aria-hidden="true">—</span><strong>待定</strong></div>`;
  const finalStatus = final ? (() => {
    const st = final.status === 'done' && final.winner ? {label: '已結束', cls: 'won', note: scoreOf(final)} : final.status === 'live' ? {label: '比武中', cls: 'live', note: scoreOf(final)} : {label: '待賽', cls: 'waiting', note: data.bestOf ? `BO${data.bestOf}` : ''};
    return `<button type="button" class="ab-final-status ${st.cls}" data-match-open="${e(final.id)}" aria-label="決賽，${e(st.label)}，查看比武"><span>${e(rounds.at(-1)?.label || '決賽')}</span><b>${e(st.label)}</b><small>${e(st.note)}</small></button>`;
  })() : '';
  const center = `<section class="ab-center" aria-label="決賽">${crownPanel}${championBox}${finalStatus}</section>`;
  const legend = `<ul class="ab-legend" aria-label="狀態說明"><li class="won"><b>勝出</b><span>已晉級下一輪</span></li><li class="waiting"><b>待賽</b><span>尚未進行比賽</span></li><li class="bye"><b>輪空</b><span>不需比賽，直接晉級</span></li></ul>`;
  const title = (data.players || []).some(p => entrantsOf(p).length > 1) ? '團隊戰局' : '個人戰局';
  return `<div class="battle-scene scene-ab">${sceneArt()}<div class="scene-body">${sceneTitle(title, bracketSubtitle(data, rounds))}${mobileRounds(rounds)}<div class="ab-scroll" tabindex="0" role="region" aria-label="完整晉級圖，可左右滑動"><div class="ab-tree"><svg class="ab-lines" aria-hidden="true"></svg>${side('red')}${center}${side('blue')}</div></div>${legend}</div></div>`;
}
function mobileRounds(rounds) {
  if (!rounds.length) return '';
  const tabs = rounds.map((r, i) => `<button type="button" role="tab" id="round-tab-${i}" aria-controls="round-panel" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-round="${i}">${e(r.label || '第 ' + r.round + ' 輪')}</button>`).join('');
  return `<section class="mobile-rounds" aria-label="依輪次查看賽程"><div class="round-tabs-new" role="tablist" aria-label="比賽輪次">${tabs}</div><div id="round-panel" role="tabpanel" tabindex="0" aria-labelledby="round-tab-0"></div><button type="button" class="overview-toggle" aria-expanded="false">查看完整晉級圖</button></section>`;
}
function mobileRound(data, rounds, index) {
  const round = rounds[index], champion = championOf(data), isFinal = round.matches.length === 1 && index === rounds.length - 1;
  return round.matches.map(m => {
    const side = sideOf(round, m), next = nextMatch(rounds, m), tone = side === 'center' ? 'red' : side;
    const bye = m.bye && (!m.p1 || !m.p2), byeName = byId(data, m.p1 || m.p2)?.name;
    const destination = isFinal
      ? `<p class="match-destination">${champion ? '冠軍 ' + e(champion.name) : '冠軍待定'}</p>`
      : `<p class="match-destination">${bye && byeName ? `${e(byeName)}輪空，直接晉級${e(next ? rounds[index + 1]?.label || '' : '')}` : `勝者晉級${e(rounds[index + 1]?.label || '下一輪')}`}</p>`;
    return `<article class="round-match ${side === 'center' ? 'final-match-mobile' : side}${bye ? ' has-bye' : ''}"><header><h3>${e(isFinal ? round.label || '決賽' : matchNumber(m))}</h3>${side === 'center' ? '' : `<b>${side === 'red' ? '紅方' : '藍方'}</b>`}</header><div class="match-entrants">${seat(data, m, 0, tone, {seed: index === 0})}${seat(data, m, 1, side === 'center' ? 'blue' : side, {seed: index === 0})}</div>${destination}</article>`;
  }).join('');
}

/* ── I / J: champion boards from the approved reference ─────────────────── */
function history(data, p, side) {
  const rows = historyOf(data, p.id);
  return `<aside class="side-history ${side}"><div class="side-heading"><h2>${side==='red'?'紅方':'藍方'}</h2></div>${plate(p,side,finalOf(data)?.id)}<details open><summary>晉級歷程</summary><h3>晉級歷程</h3><table class="history-table"><caption>晉級歷程</caption><thead class="sr-only"><tr><th>輪次</th><th>選手</th><th>比分</th><th>對手</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${e(r.round)}</th><td>${e(p.name)}</td><td><button type="button" class="history-match" data-match-open="${e(r.match.id)}" aria-label="查看${e(r.round)}比武">${e(r.score)}</button></td><td>${e(r.opponent?.name|| (r.match.bye?'輪空':'席位待定'))}</td></tr>`).join('')}</tbody></table></details></aside>`;
}
function solo(data, winner, h) {
  const f=finalOf(data), red=byId(data,f.p1), blue=byId(data,f.p2), side = winner.id===f.p1?'red':'blue';
  const hero = imageOf(winner) ? img(imageOf(winner),'hero-cutout portrait-photo') : `<span class="portrait-empty hero-empty" role="img" aria-label="尚未提供遊戲照片">${EMPTY_ART}<small>遊戲照片待提供</small></span>`;
  return `<div class="draft-main">${sceneTitle(h.title, h.context, 'champion-heading')}</div><section class="champion-board solo-board" aria-label="個人冠軍與晉級紀錄"><div class="faction-art">${img(art('i-wings-v3'))}</div>${red?history(data,red,'red'):''}<section class="champion-focus"><div class="champion-portrait"><div>${img(art('i-moon-ink-v2'),'moon-ink')}</div><button type="button" class="hero-portrait-button${imageOf(winner)?'':' without-photo'}" data-player="${e(winner.id)}" data-match="${e(f.id)}" data-side="${side}" aria-label="查看冠軍${e(winner.name)}資料">${hero}</button></div><h2 class="champion-word">冠軍</h2><button type="button" class="laurel-name" data-player="${e(winner.id)}" data-match="${e(f.id)}" data-side="${side}">${img(art('i-laurel-plaque-v2'))}<span>${e(winner.name)}</span><span class="rank-seal">${e(rank(winner))}</span></button><p class="final-score">決賽 ${e(f.s1)} : ${e(f.s2)}</p><p class="event-ended">賽事已結束</p><button type="button" class="paper-action" data-results>完整賽果</button></section>${blue?history(data,blue,'blue'):''}</section>`;
}
function teamSide(data, finalist, side, champion) {
  const route = teamRoute(data, finalist.id, finalOf(data).round);
  const leaves = [], edges = [], scores = [];
  const depth = node => node.children?.length ? 1 + Math.max(...node.children.map(depth)) : 0;
  const levels = Math.max(1, depth(route));
  function place(node) {
    if (!node.children?.length) {
      const y = 42 + leaves.length * 96;
      leaves.push({player:node.player,y});
      return {x:258,y};
    }
    const children = node.children.map(place);
    const point = {x:278 + depth(node) / levels * 108,y:children.reduce((sum,p)=>sum+p.y,0)/children.length};
    children.forEach((child,i)=>edges.push(`<path class="${champion && node.children[i].player?.id===finalist.id?'winner':''}" d="M${child.x} ${child.y}H${point.x}V${point.y}"/>`));
    scores.push({match:node.match,...point});
    return point;
  }
  const end=place(route),height=Math.max(180,leaves.length*96);
  edges.push(`<path class="${champion?'winner':''}" d="M${end.x} ${end.y}H400"/>`);
  return `<aside class="side-history team-history ${side}"><div class="side-heading"><h2>${side==='red'?'紅方':'藍方'}</h2></div><div class="live-team-route" style="--route-height:${height}px"><svg viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true">${edges.join('')}</svg>${leaves.map(({player,y})=>player?`<div class="route-team" style="top:${y-37}px">${plate(player,side,finalOf(data).id,`${entrantsOf(player).length} 人`)}</div>`:'').join('')}${scores.map(({match,x,y})=>`<button type="button" class="route-score${champion && match.winner===finalist.id?' won':''}" style="--route-x:${x/4}%;top:${y}px" data-match-open="${e(match.id)}" aria-label="查看第 ${match.round} 輪比武">${e(match.s1)} : ${e(match.s2)}</button>`).join('')}</div></aside>`;
}
function team(data, winner, h) {
  const f=finalOf(data), red=byId(data,f.p1), blue=byId(data,f.p2);
  const members=entrantsOf(winner), side = winner.id===f.p1?'red':'blue';
  return `<div class="draft-main">${sceneTitle(h.title, h.context, 'champion-heading')}</div><section class="champion-board team-board" aria-label="團隊冠軍與晉級紀錄"><div class="faction-art">${img(art('j-wings-v3'))}</div>${red?teamSide(data,red,'red',winner.id===red.id):''}<section class="champion-focus team-focus">${img(art('j-champion-backdrop-v4'),'team-halo')}<h2 class="champion-word">冠軍</h2><div class="team-crown-frame">${img(art('j-team-panel-v5'),'team-frame-art')}<h3>${e(winner.name)}</h3><div class="champion-members">${members.slice(0,4).map(p=>`<button type="button" class="member-portrait${imageOf(p)?'':' without-photo'}" data-player="${e(p.id)}" data-side="${side}" data-match="${e(f.id)}" aria-label="查看${e(p.name)}資料"><span class="member-art">${photo(p)}</span><span class="member-name"><strong>${e(p.name)}</strong><small>${e(rank(p))}</small></span></button>`).join('')}</div></div><p class="final-score">決賽 ${e(f.s1)} : ${e(f.s2)}</p><button type="button" class="paper-action" data-roster="${e(winner.id)}" data-side="${side}">完整名單 · ${members.length} 人</button></section>${blue?teamSide(data,blue,'blue',winner.id===blue.id):''}</section>`;
}

/* ── Dialog and shared click handling ───────────────────────────────────── */
// Live updates rebuild the body, dialog included. Call before rebuilding; the returned function reopens
// an open dialog from the same button after rebinding, or puts focus on the scene if that button is gone.
function keepDialog(view) {
  const key=view.root.querySelector('#champion-dialog[open]')?.dataset.invoker;
  return ()=>{if(!key)return;const b=rendered(view.root,key);if(b)b.click();else rendered(view.root,'.battle-scene button')?.focus({preventScroll:true});};
}
function bindInteractions(view, getData, {onSelect,onPlayer,onResults}={}) {
  const signal=view.resetInteractions();
  const dialog=document.createElement('dialog');
  dialog.id='champion-dialog';
  dialog.setAttribute('aria-labelledby','dialog-title');
  dialog.innerHTML='<header class="dialog-header"><h2 id="dialog-title">選手資料</h2><button type="button" class="dialog-close ink-close" aria-label="關閉選手資料">×</button></header><div id="dialog-content"></div><footer class="dialog-actions"><button type="button" class="dialog-done">完成</button></footer>';
  view.body.append(dialog);
  let invoker=null;
  const close=()=>{dialog.close();invoker?.focus({preventScroll:true});};
  // Return focus after the page's own Escape handlers have run, and keep that Escape inside the dialog.
  dialog.addEventListener('close',()=>requestAnimationFrame(()=>invoker?.focus({preventScroll:true})));
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
  view.body.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.matches('.dialog-close,.dialog-done')){close();return;}
    if(b.hasAttribute('data-results')){onResults?.();return;}
    if(b.dataset.matchOpen){onSelect?.(b.dataset.matchOpen,b);return;}
    if(b.dataset.configuration){close();onPlayer?.(b.dataset.configuration,b.dataset.match,invoker);return;}
    const data=getData(),all=(data.players||[]).flatMap(p=>[p,...(p.members||[])]);
    if(!dialog.contains(b)&&(b.dataset.player||b.dataset.roster))dialog.dataset.invoker=['player','roster','match'].filter(k=>b.dataset[k]).map(k=>`[data-${k}="${CSS.escape(b.dataset[k])}"]`).join('');
    if(b.dataset.player){
      const p=all.find(p=>String(p.id)===b.dataset.player);if(!p)return;
      invoker=b;dialog.dataset.kind='player';dialog.dataset.side=b.dataset.side||'red';
      dialog.querySelector('#dialog-title').textContent='選手資料';
      dialog.querySelector('#dialog-content').innerHTML=`<section class="player-summary"><div class="player-summary__portrait">${photo(p)}</div><div class="player-summary__identity"><h3>${e(p.name)}</h3><dl><div><dt>段位</dt><dd>${e(rank(p))}</dd></div></dl>${!imageOf(p)?'<p class="player-note">遊戲照片待管理員提供</p>':''}${onPlayer&&b.dataset.match&&(data.players||[]).some(entry=>entry.id===p.id)?`<button type="button" class="paper-action" data-configuration="${e(p.id)}" data-match="${e(b.dataset.match)}">查看比武配置</button>`:''}</div></section>`;
      if(!dialog.open)dialog.showModal();else dialog.querySelector('.dialog-close').focus();
    }
    if(b.dataset.roster){
      const p=all.find(p=>String(p.id)===b.dataset.roster);if(!p)return;
      invoker=b;dialog.dataset.kind='roster';dialog.querySelector('#dialog-title').textContent=p.name+' · 完整名單';
      dialog.querySelector('#dialog-content').innerHTML='<div class="dialog-roster">'+entrantsOf(p).map(m=>plate(m,b.dataset.side||'red',b.dataset.match||finalOf(data)?.id)).join('')+'</div>';
      if(!dialog.open)dialog.showModal();
    }
  },{signal});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
}

// Project the existing permission-aware controls into the unpublished notice.
// Keep their DOM/React portal identity; return them before the editor hides the bracket.
function pendingActions(host, view) {
  const chapter=host.closest('#schedule'), panel=chapter?.querySelector('#bracket-panel');
  const toolbar=chapter?.querySelector('.schedule-heading .panel-head');
  if(!panel||!toolbar)return {sync(){},destroy(){}};
  const anchor=document.createComment('schedule controls home');
  toolbar.before(anchor);
  const originalSlot=toolbar.getAttribute('slot');
  let disposed=false;
  const restore=()=>{
    if(anchor.parentNode&&toolbar.parentNode!==anchor.parentNode)anchor.after(toolbar);
    toolbar.removeAttribute('data-pending-actions');
    if(originalSlot===null)toolbar.removeAttribute('slot');else toolbar.setAttribute('slot',originalSlot);
  };
  const sync=()=>{
    if(disposed)return;
    const inside=!!view.root.querySelector('.scene-waiting')&&!panel.hasAttribute('data-schedule-editing');
    const focus=toolbar.contains(document.activeElement)?document.activeElement:null;
    if(inside){toolbar.slot='pending-actions';toolbar.setAttribute('data-pending-actions','');if(toolbar.parentNode!==view.mount)view.mount.append(toolbar);}
    else restore();
    focus?.focus({preventScroll:true});
    requestAnimationFrame(view.fit);
  };
  const watch=new MutationObserver(sync);
  watch.observe(panel,{attributes:true,attributeFilter:['data-schedule-editing']});
  const size=new ResizeObserver(()=>requestAnimationFrame(view.fit));size.observe(toolbar);
  return {sync,destroy(){if(disposed)return;disposed=true;watch.disconnect();size.disconnect();restore();anchor.remove();}};
}

/* ── Schedule chapter: tree (A/B) or champion board (I/J) ───────────────── */
export function createBracketTree(options) {
  const {host,signal,onSelect,onPlayer}=options;
  host.replaceChildren();
  host.classList.add('battle-live');
  const view=surface(host,signal);
  const actions=pendingActions(host,view);
  signal?.addEventListener('abort',()=>actions.destroy(),{once:true});
  // The legacy tree stays for the manager's seat editor and as a complete results table.
  const complete=document.createElement('details');complete.className='battle-results';
  complete.innerHTML='<summary>完整對戰表</summary>';
  const treeHost=document.createElement('div');complete.append(treeHost);host.append(complete);
  const legacy=createLegacyTree({...options,host:treeHost,previewEmpty:false});
  let current={}, rounds=[], activeRound=0, overview=false, drawFrame=0;
  const observer=new ResizeObserver(()=>schedule());
  observer.observe(host);
  // Entering the manager's edit mode opens the full table at once, so its seats can be dragged.
  const editingWatch=new MutationObserver(()=>{if(host.dataset.editing==='true'){complete.hidden=false;complete.open=true;}});
  editingWatch.observe(host,{attributes:true,attributeFilter:['data-editing']});
  const schedule=()=>{cancelAnimationFrame(drawFrame);drawFrame=requestAnimationFrame(()=>{draw();view.fit();});};
  // Bracket lines follow the rendered nameplates, so they stay right at every width and after fonts load.
  function draw(){
    const tree=view.root.querySelector('.ab-tree'),svg=tree?.querySelector('.ab-lines');
    if(!tree||!svg)return;
    // Between phone and desktop the full tree is scaled to fit instead of being cropped.
    const scroll=view.root.querySelector('.ab-scroll'),avail=scroll?.clientWidth||0;
    if(scroll&&avail>0&&avail<1180&&getComputedStyle(scroll).display!=='none'){const fit=avail/1180;scroll.dataset.fit='';scroll.style.setProperty('--fit',String(fit));scroll.style.height=`${Math.ceil(tree.offsetHeight*fit)+12}px`;}
    else if(scroll){delete scroll.dataset.fit;scroll.style.removeProperty('--fit');scroll.style.removeProperty('height');}
    // Lines are drawn in the tree's own (unscaled) coordinates, whatever scales it on screen
    // (the width fit here, or the one-screen fit of the whole scene).
    const raw=tree.getBoundingClientRect();if(!raw.width)return;
    const scale=raw.width/(tree.offsetWidth||raw.width);
    const box={left:raw.left,top:raw.top,width:raw.width/scale,height:raw.height/scale};
    const rect=el=>{const r=el.getBoundingClientRect();return {left:(r.left-raw.left)/scale+raw.left,right:(r.right-raw.left)/scale+raw.left,top:(r.top-raw.top)/scale+raw.top,height:r.height/scale};};
    svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);svg.replaceChildren();
    const sideRounds=finalOf(current)?rounds.slice(0,-1):rounds;
    const anchor=tree.querySelector('[data-final-anchor]');
    const seatEl=key=>tree.querySelector(`.ab-side .seat[data-seat="${CSS.escape(key)}"]`);
    for(const [index,round] of sideRounds.entries())for(const m of round.matches){
      const side=sideOf(round,m);if(side==='center')continue;
      const next=index<sideRounds.length-1?nextMatch(rounds,m):null;
      const to=next?seatEl(`${next.id}:${m.slot%2}`):anchor;
      if(!to)continue;
      const b=rect(to);
      const tx=(side==='red'?b.left:b.right)-box.left,ty=(next?b.top+b.height/2:b.top+b.height*0.62)-box.top;
      for(const seatIndex of [0,1]){
        const from=seatEl(`${m.id}:${seatIndex}`);if(!from)continue;
        const a=rect(from);
        const x=(side==='red'?a.right:a.left)-box.left,y=a.top+a.height/2-box.top,mid=x+(tx-x)/2;
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',`M ${x} ${y} H ${mid} V ${ty} H ${tx}`);
        const id=seatIndex===0?m.p1:m.p2;
        if(m.status==='done'&&m.winner&&m.winner===id)path.classList.add('win');
        svg.append(path);
      }
    }
  }
  function renderRound(){
    const panel=view.root.querySelector('#round-panel');if(!panel||!rounds.length)return;
    activeRound=Math.min(activeRound,rounds.length-1);
    panel.setAttribute('aria-labelledby',`round-tab-${activeRound}`);
    panel.innerHTML=mobileRound(current,rounds,activeRound);
    view.root.querySelectorAll('[data-round]').forEach(b=>{const on=Number(b.dataset.round)===activeRound;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
  }
  view.root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.round!==undefined){activeRound=Number(b.dataset.round);renderRound();b.focus({preventScroll:true});}
    else if(b.classList.contains('overview-toggle')){overview=!overview;b.setAttribute('aria-expanded',String(overview));b.textContent=overview?'收起完整晉級圖':'查看完整晉級圖';view.root.querySelector('.scene-ab')?.classList.toggle('overview-open',overview);schedule();}
  });
  view.root.addEventListener('keydown',event=>{
    const tab=event.target.closest?.('[role=tab][data-round]');if(!tab||!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
    event.preventDefault();const n=rounds.length;let next=Number(tab.dataset.round);
    next=event.key==='Home'?0:event.key==='End'?n-1:(next+(event.key==='ArrowRight'?1:n-1))%n;
    activeRound=next;renderRound();view.root.querySelector(`[data-round="${next}"]`)?.focus();
  });
  return {
    render(input){
      current=publicBattle(input);rounds=bracketRounds(current);
      const h=scheduleHeading(current),layout=h.layout,winner=championOf(current);
      // Live updates re-render in place: keep the reader's focus, tree scroll and open sections.
      const active=view.root.activeElement,keep=['matchOpen','player','round','roster'].find(k=>active?.dataset?.[k]!==undefined);
      const restore={key:keep,value:keep&&active.dataset[keep],scroll:view.root.querySelector('.ab-scroll')?.scrollLeft||0,details:[...view.root.querySelectorAll('details')].map(d=>d.open)};
      const reopen=keepDialog(view);
      view.resetInteractions();
      host.dataset.battleLayout=layout;
      // Loading and errors are announced by the page's own status line; an unpublished bracket gets a readable notice here.
      const waiting=!current.published&&(!current.kind||current.kind==='ready'||current.kind==='unconfigured');
      view.mount.hidden=!current.published&&!waiting;
      view.body.className='battle-surface layout-draft produced '+(winner?'champion-preview mode-'+layout:'battle-bracket-view');
      view.body.dataset.layout=layout;view.body.dataset.variant=layout;
      view.body.innerHTML=!current.published
        ?(waiting?`<div class="battle-scene scene-ab scene-waiting">${sceneArt()}<div class="scene-body">${sceneTitle('比賽賽程','賽程待公布')}<div class="battle-notice"><strong>對戰表尚未公布</strong><span>完成抽籤後，完整晉級路線將在這裡公開。</span><div class="battle-notice-actions"><slot name="pending-actions"></slot></div></div></div></div>`:'')
        :winner?`<div class="champion-body">${layout==='J'?team(current,winner,h):solo(current,winner,h)}</div>`:bracket(current);
      actions.sync();
      // The legacy table stays for the manager's seat editor; readers see it only once a bracket is published.
      const editing=host.dataset.editing==='true';
      complete.hidden=!current.published&&!editing;
      if(editing)complete.open=true;
      legacy.render(current);
      if(current.published)bindInteractions(view,()=>current,{onSelect,onPlayer,onResults(){complete.open=true;complete.scrollIntoView({block:'start',behavior:'smooth'});complete.querySelector('summary').focus();}});
      if(!winner&&current.published){renderRound();document.fonts?.ready.then(schedule);schedule();}
      if(overview&&!winner){const toggle=view.root.querySelector('.overview-toggle');if(toggle){toggle.setAttribute('aria-expanded','true');toggle.textContent='收起完整晉級圖';}view.root.querySelector('.scene-ab')?.classList.add('overview-open');}
      [...view.root.querySelectorAll('details')].forEach((d,i)=>{if(restore.details[i]!==undefined)d.open=restore.details[i];});
      const scroll=view.root.querySelector('.ab-scroll');if(scroll)scroll.scrollLeft=restore.scroll;
      view.fit();
      if(restore.key){const attr='data-'+restore.key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());rendered(view.root,`[${attr}="${CSS.escape(restore.value)}"]`)?.focus({preventScroll:true});}
      if(current.published)reopen();
    },
    focusMatch(id){
      // Only the match that was open is a valid return point; an unknown id returns to the chapter.
      const target=id?rendered(view.root,`[data-match-open="${CSS.escape(id)}"]`):null;
      if(target){target.scrollIntoView({block:'center',behavior:'instant'});target.focus({preventScroll:true,focusVisible:false});}
      return !!target;
    },
    destroy(){actions.destroy();cancelAnimationFrame(drawFrame);observer.disconnect();editingWatch.disconnect();legacy.destroy();view.destroy();complete.remove();host.classList.remove('battle-live');delete host.dataset.battleLayout;},
  };
}

/* ── Duel chapter: C–H ──────────────────────────────────────────────────── */
const GROUP_NAMES = ['一組','二組','三組','四組','五組','六組','七組','八組'];
function duelPortrait(p) {
  return p && imageOf(p) ? img(imageOf(p), 'portrait-photo') : EMPTY_ART;
}
function duelEntrant(p, tone, matchId, size) {
  if (size === 1) {
    if (!p) return `<div class="duel-hero empty ${tone}"><span class="duel-hero-art">${EMPTY_ART}</span><span class="duel-hero-plate"><strong>席位待定</strong></span></div>`;
    return `<button type="button" class="duel-hero ${tone}" data-rank="${frame(p)}" data-player="${e(p.id)}" data-side="${tone}" data-match="${e(matchId)}" aria-label="查看${e(p.name)}資料"><span class="duel-hero-art">${duelPortrait(p)}</span><span class="duel-hero-plate"><strong>${e(p.name)}</strong><small>${e(rank(p))}</small></span></button>`;
  }
  if (!p) return `<div class="duel-plate empty ${tone}"><span class="duel-plate-art">${EMPTY_ART}</span><span class="duel-plate-text"><strong>席位待定</strong></span></div>`;
  return `<button type="button" class="duel-plate ${tone}" data-rank="${frame(p)}" data-player="${e(p.id)}" data-side="${tone}" data-match="${e(matchId)}" aria-label="查看${e(p.name)}資料"><span class="duel-plate-art">${duelPortrait(p)}</span><span class="duel-plate-text"><strong>${e(p.name)}</strong><small>${e(rank(p))}</small></span></button>`;
}
export function createBattleDuel({host,signal,onPlayer,onReturn}) {
  const view=surface(host,signal);let data={},match=null,side='red',group={red:0,blue:0};
  function draw(){
    const layout=duelLayout(data,match),left=byId(data,match?.p1),right=byId(data,match?.p2);
    const count=Math.max(entrantsOf(left).length,entrantsOf(right).length,1),wide=count>=8,many=count>=16;
    view.mount.dataset.battleLayout=layout;
    view.body.className='battle-surface layout-draft produced battle-duel-view';view.body.dataset.layout=layout;view.body.dataset.variant=layout;
    const roster=(p,tone)=>{
      const members=p?entrantsOf(p):[];
      const visible=many?members.slice(group[tone]*4,group[tone]*4+4):members;
      const title=count>1&&p?p.name:(tone==='red'?'紅方':'藍方');
      const range=many?`${group[tone]*4+1} - ${Math.min(members.length,group[tone]*4+4)} / ${members.length}`:'';
      const head=`<header class="duel-team">${many?`<span class="team-emblem ${tone}" aria-hidden="true"></span>`:''}<h3>${e(title)}</h3>${wide&&p?`<span class="duel-count">${members.length} 人</span>`:''}</header>`;
      const tabs=many&&p?`<div class="duel-groups" role="group" aria-label="${e(title)}分組">${Array.from({length:Math.ceil(members.length/4)},(_,i)=>`<button type="button" aria-pressed="${group[tone]===i}" data-group="${i}" data-roster-side="${tone}">${GROUP_NAMES[i]||`第${i+1}組`}</button>`).join('')}<span class="duel-range">${e(range)}</span></div>`:'';
      const list=visible.length?visible.map(m=>duelEntrant(m,tone,match?.id,count)).join(''):(count===1?duelEntrant(null,tone,match?.id,1):duelEntrant(null,tone,match?.id,count));
      const more=many&&p?`<button type="button" class="duel-more" data-roster="${e(p.id)}" data-side="${tone}" data-match="${e(match?.id)}">展開完整名單</button>`:'';
      return `<section class="duel-roster ${tone}${side!==tone?' mobile-hidden':''}" aria-label="${tone==='red'?'紅方':'藍方'}名單">${head}${tabs}<div class="duel-list">${list}</div>${more}</section>`;
    };
    const score=v=>match&&match.status!=='upcoming'?e(v??0):'0';
    const status=!match?'尚未選取場次':match.status==='done'?'已結束':match.status==='live'?'比武中':'待開賽';
    const center=`<section class="duel-center" aria-label="比分">${wide?'<h2 class="duel-center-title">比武</h2>':(round=>round?`<h3 class="duel-round">${e(round)}</h3>`:'')(data.rounds?.find(r=>r.round===match?.round)?.label)}<span class="duel-moon" aria-hidden="true"></span><p class="duel-score"><span class="red">${score(match?.s1)}</span><span class="colon" aria-hidden="true">:</span><span class="blue">${score(match?.s2)}</span></p><p class="duel-status${wide?' arrows':''}">${e(status)}</p>${data.bestOf?`<p class="duel-bo">BO${e(data.bestOf)}</p>`:''}<button type="button" class="duel-back" data-back-schedule>返回賽程</button></section>`;
    const sideControls=count>1?`<div class="side-controls" role="group" aria-label="選擇隊伍"><button type="button" data-side-pick="red" aria-pressed="${side==='red'}">${e(left?.name||'紅方')}</button><button type="button" data-side-pick="blue" aria-pressed="${side==='blue'}">${e(right?.name||'藍方')}</button></div>`:'';
    const reopen=keepDialog(view);
    view.body.innerHTML=`<div class="battle-scene scene-duel" data-size="${count}" data-side="${side}">${sceneArt()}<div class="scene-body">${wide?'':sceneTitle('比武')}${sideControls}<div class="duel-grid">${roster(left,'red')}${center}${roster(right,'blue')}</div></div></div>`;
    bindInteractions(view,()=>data,{onPlayer});
    reopen();
    view.fit();
  }
  view.root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.sidePick){side=b.dataset.sidePick;draw();view.root.querySelector(`[data-side-pick="${side}"]`)?.focus();}
    if(b.dataset.group){const n=Number(b.dataset.group);group[b.dataset.rosterSide]=n;draw();view.root.querySelector(`[data-roster-side="${b.dataset.rosterSide}"][data-group="${n}"]`)?.focus();}
    if(b.hasAttribute('data-back-schedule'))onReturn?.();
  });
  return {render(input,selected){
    data=publicBattle(input);
    if(match?.id!==selected?.id)group={red:0,blue:0};
    match=matchesOf(data).find(m=>m.id===selected?.id)||null;
    for(const [tone,id] of [['red',match?.p1],['blue',match?.p2]]){
      const count=entrantsOf(byId(data,id)).length;
      group[tone]=Math.min(group[tone],Math.max(0,Math.ceil(count/4)-1));
    }
    draw();
  },focus(){view.root.querySelector('[data-player], [data-back-schedule]')?.focus({preventScroll:true,focusVisible:false});},destroy:view.destroy};
}

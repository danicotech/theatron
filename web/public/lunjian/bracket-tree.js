/**
 * A mirrored elimination tree: independent player seats, match junctions, central final.
 * Real data connects explicit nextMatchId edges or a confirmed winner occupying
 * exactly one seat in the immediate next round. Unresolved or ambiguous API
 * links are never guessed. Only complete, regular demo brackets infer slot / 2.
 * nextSlot is zero-based: 0 -> p1, 1 -> p2. Third-place matches never advance.
 */
const instances = new WeakMap();
let serial = 0;
const SVG = 'http://www.w3.org/2000/svg';
const NODE_WIDTH = 128, COLUMN_GAP = 48, HEADER = 72;

export function createBracketTree({host, onSelect, onPlayer, signal, previewEmpty=false, matchActionLabel='查看比武', playerActionLabel='查看選手資料', championArt='art/manga-champion.webp'} = {}) {
  if (!host) throw new TypeError('A bracket host is required');
  instances.get(host)?.destroy();
  const doc = host.ownerDocument, view = doc.defaultView;
  const id = 'tournament-tree-' + (++serial);
  const hadClass = host.classList.contains('tournament-tree');
  const mobile = view.matchMedia?.('(max-width: 767px)');
  let disposed = false, generation = 0, selectedRound = null;
  let previousResults = new Map(), lastReplay = null;
  let cleanups = [], observer = null, raf = 0;
  host.classList.add('tournament-tree');

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function listen(node, event, listener) {
    node.addEventListener(event, listener);
    cleanups.push(() => node.removeEventListener(event, listener));
  }
  function clearRender() {
    generation++;
    cleanups.splice(0).forEach(cleanup => cleanup());
    observer?.disconnect(); observer = null;
    if (raf) view.cancelAnimationFrame(raf);
    raf = 0;
  }
  function render(input = {}) {
    if (disposed) return;
    const active = doc.activeElement;
    const ownedFocus = !!active && host.contains(active);
    const focusMatch = ownedFocus ? active.closest('[data-match-id]')?.dataset.matchId : null;
    const focusSeat = ownedFocus ? active.dataset.seat : undefined;
    const focusRound = ownedFocus ? active.closest('[data-round]')?.dataset.round : null;
    const focusTab = ownedFocus && active.classList.contains('tt-tab');
    const focusChampion=ownedFocus && active.classList.contains('tt-champion');
    const oldViewport = host.querySelector('.tt-viewport');
    const scroll = {left: oldViewport?.scrollLeft || 0, top: oldViewport?.scrollTop || 0};
    clearRender();
    const token = generation;
    host.replaceChildren();
    const showEmpty = message => {
      const empty = el('p', 'tt-empty', message);
      host.append(empty);
      if (ownedFocus) { empty.tabIndex = -1; empty.focus({preventScroll:true}); }
    };
    delete host.dataset.links;
    const placeholder = previewEmpty && (!input?.published || !input?.rounds?.some(round=>round?.matches?.length));
    host.toggleAttribute('data-placeholder',placeholder);
    // A display-only outline, never written back into tournament state.
    const data = placeholder ? {
      published:true, players:[], bestOf:0,
      rounds:[{round:1,label:'準決賽',matches:[0,1].map(slot=>({
        id:`outline-${slot}`,slot,status:'upcoming',nextMatchId:'outline-final',nextSlot:slot,
      }))},{round:2,label:'決賽',matches:[{id:'outline-final',slot:0,status:'upcoming'}]}],
    } : input || {};
    host.dataset.tones=['blue-left','white-left'].includes(data.tones)?'blue-left':'red-left';
    const replay=data.effectRevision!==lastReplay;lastReplay=data.effectRevision;
    const nextResults=new Map();
    if (!data.published) {
      showEmpty('對戰表尚未公布。完成抽籤後，完整晉級路線將在這裡公開。');
      return;
    }
    const players = new Map((data.players || []).filter(Boolean).map(player => [String(player.id), player]));
    const seen = new Set();
    const rounds = (data.rounds || []).filter(Boolean).map((round, index) => ({
      round: Number(round.round) || index + 1,
      label: String(round.label || `第${Number(round.round) || index + 1}輪`),
      matches: (round.matches || []).filter(match => {
        if (!match || !match.id || seen.has(String(match.id))) return false;
        seen.add(String(match.id)); return true;
      }).map(match => ({...match, id: String(match.id), round: Number(round.round) || index + 1,
        slot: Math.max(0, Number(match.slot) || 0), kind: match.kind === 'third' ? 'third' : 'bracket'}))
        .sort((a, b) => (a.kind === 'third') - (b.kind === 'third') || a.slot - b.slot),
    })).filter(round => round.matches.length).sort((a, b) => a.round - b.round);
    if (!rounds.length) {
      showEmpty('尚無對戰安排，請等待大會公布賽程。');
      return;
    }
    const all = rounds.flatMap(round => round.matches);
    const byId = new Map(all.map(match => [match.id, match]));
    const treeRounds = rounds.map(round => ({...round, matches: round.matches.filter(match => match.kind === 'bracket')}))
      .filter(round => round.matches.length);
    const lastRound = treeRounds.at(-1);
    const explicit = all.some(match => match.nextMatchId);
    const regularDemo = !!data.demo && !explicit && treeRounds.length > 0 && lastRound.matches.length === 1 &&
      treeRounds.every((round, i) => round.matches.length === 2 ** (treeRounds.length - 1 - i) &&
        round.matches.every((match, slot) => match.slot === slot));
    const edges = [];
    const incoming = new Map();
    function connect(from, to, seat) {
      if (!to || from.kind !== 'bracket' || to.kind !== 'bracket' || to.round <= from.round || (seat !== 0 && seat !== 1)) return;
      const key = `${to.id}:${seat}`;
      if(incoming.has(key)){
        // Conflicting sources do not create two plausible-looking routes into one seat.
        for(let i=edges.length-1;i>=0;i--)if(edges[i].to.id===to.id && edges[i].seat===seat)edges.splice(i,1);
        incoming.set(key,null);return;
      }
      edges.push({from, to, seat});incoming.set(key,from);
    }
    if (explicit) {
      all.forEach(match => {
        if (match.nextMatchId) connect(match, byId.get(String(match.nextMatchId)), match.nextSlot);
      });
    } else if (regularDemo) {
      treeRounds.slice(0, -1).forEach((round, i) => round.matches.forEach(match =>
        connect(match, treeRounds[i + 1].matches[Math.floor(match.slot / 2)], match.slot % 2)));
    }
    if (!data.demo) {
      treeRounds.slice(0, -1).forEach((round, index) => {
        const next = treeRounds[index + 1];
        if (next.round !== round.round + 1) return;
        round.matches.forEach(match => {
          if (match.nextMatchId || match.status !== 'done' || !match.winner ||
              ![match.p1, match.p2].includes(match.winner)) return;
          // Duplicate winners or duplicated next-round seats make the relation ambiguous.
          if (round.matches.filter(other => other.status === 'done' && other.winner === match.winner).length !== 1) return;
          const seats = next.matches.flatMap(target => [0, 1].flatMap(seat =>
            target[seat === 0 ? 'p1' : 'p2'] === match.winner ? [{target, seat}] : []));
          if (seats.length !== 1) return;
          const {target, seat} = seats[0];
          if (incoming.has(`${target.id}:${seat}`)) return;
          connect(match, target, seat);
        });
      });
    }
    const expectedEdges = treeRounds.slice(0, -1).reduce((count, round) => count + round.matches.length, 0);
    host.dataset.links = edges.length === expectedEdges ? 'complete' : edges.length ? 'partial' : 'unknown';
    const meta = el('div', 'tt-meta');
    meta.append(el('p', 'tt-format', placeholder ? '賽程示意 · 實際輪次與籤位待公布' : `${players.size} 位選手${Number(data.bestOf) > 1 ? ` · BO${Number(data.bestOf)}` : ''}`));
    if (data.demo) meta.append(el('strong', 'tt-demo', '示範資料'));
    if (edges.length < expectedEdges) meta.append(el('p', 'tt-connection-note', '部分晉級關係待公布；尚未確認的路線不連線。'));
    if(data.slug && !data.demo){
      const judge=el('a','tt-judge-link','裁判台');judge.href=`/judge/${encodeURIComponent(data.slug)}`;meta.append(judge);
    }
    host.append(meta);
    const tabs = el('div', 'tt-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '選擇賽程輪次');
    const viewport = el('div', 'tt-viewport');
    viewport.tabIndex = 0; viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', '完整賽程，左右兩路會合於決賽，過寬時可在圖內橫向捲動，上下隨頁面閱讀');
    const canvas = el('div', 'tt-canvas');
    const lines = doc.createElementNS(SVG, 'svg');
    lines.classList.add('tt-connectors'); lines.setAttribute('aria-hidden', 'true');
    canvas.append(lines); viewport.append(canvas); host.append(tabs, viewport);
    listen(viewport, 'keydown', event => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) {
        // Keep native horizontal tree / vertical page scrolling without changing chapters.
        event.stopPropagation();
      }
    });
    const groups = new Map(), cards = new Map();
    const buttons = new Map(), panels = new Map(), tabButtons = new Map(), positions = new Map();
    const roundKeys = rounds.map(round => String(round.round));
    if (!roundKeys.includes(selectedRound)) {
      selectedRound = String((rounds.find(round => round.matches.some(match => match.status === 'live')) ||
        rounds.find(round => round.matches.some(match => match.status !== 'done')) || rounds.at(-1)).round);
    }
    const seatText = (match, seat) => {
      if(placeholder)return '席位待定';
      const playerId = match[seat === 0 ? 'p1' : 'p2'];
      const player = playerId ? players.get(String(playerId)) : null;
      if (player) return String(player.name || '選手名稱待公布');
      if (playerId) return '選手資料待公布';
      if (match.bye) return '輪空';
      const predecessor = incoming.get(`${match.id}:${seat}`);
      if (predecessor) return `第${predecessor.round}輪第${predecessor.slot + 1}場勝者`;
      return match.round === rounds[0].round ? '參賽選手待定' : '待上一輪勝者';
    };
    function matchButton(match) {
      const group = el('div', 'tt-match');
      group.dataset.round = String(match.round);
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', `${match.kind === 'third' ? '季軍賽' : `第${match.round}輪第${match.slot+1}場`}：${seatText(match,0)} 對 ${seatText(match,1)}`);
      const status = ['upcoming','live','done'].includes(match.status) ? match.status : 'upcoming';
      const knownWinner = status === 'done' && match.winner && [match.p1,match.p2].includes(match.winner);
      const state = placeholder ? '待公布' : match.bye ? (!match.p1 || !match.p2 ? '輪空' : '不戰而勝') : ({upcoming:'待開賽',live:'交鋒中',done:'已結束'})[status];
      const button = el('button', 'tt-node'); button.type = 'button';
      button.disabled=placeholder;
      button.dataset.matchId = match.id; button.dataset.round = String(match.round); button.dataset.kind = match.kind;
      button.dataset.status = status;
      const scoreLabel=status!=='upcoming' && !match.bye && Number(data.bestOf)>1 && Number.isFinite(match.s1) && Number.isFinite(match.s2) ? `，${match.s1} 比 ${match.s2}` : '';
      button.setAttribute('aria-label', `${group.getAttribute('aria-label')}，${state}${scoreLabel}，${matchActionLabel}`);
      if(placeholder)button.setAttribute('aria-label',`${group.getAttribute('aria-label')}，賽程待公布`);
      button.append(el('span','tt-match-number',match.kind === 'third' ? '季軍賽' : `第${match.slot+1}場`),
        el('span','tt-junction-score',status === 'upcoming' || match.bye ? '比武' : `${match.s1 ?? 0}:${match.s2 ?? 0}`),el('span','tt-state',state));
      listen(button,'click',()=>{if(!disposed && generation===token)onSelect?.(match.id,button);});
      // The match junction and the two player controls are siblings, never nested buttons.
      group.append(button); buttons.set(match.id,button); groups.set(match.id,group);
      [0,1].forEach(seat=>{
        const playerId=match[seat===0?'p1':'p2'], player=playerId ? players.get(String(playerId)) : null;
        const row=el('button','tt-player');row.type='button';
        row.disabled=placeholder;
        row.dataset.matchId=match.id;row.dataset.round=String(match.round);row.dataset.seat=String(seat);
        if(player)row.dataset.playerId=String(playerId);
        row.dataset.status=status;
        const resultKey=`${match.id}:${seat}`, signature=`${playerId}:${status}:${match.winner}`;
        if(replay || previousResults.get(resultKey)!==signature)row.dataset.resultEnter='true';
        nextResults.set(resultKey,signature);
        if(knownWinner && playerId===match.winner)row.dataset.winner='true';
        else if(knownWinner && player)row.dataset.eliminated='true';
        row.setAttribute('aria-label',`${seatText(match,seat)}，${player ? playerActionLabel : matchActionLabel}`);
        if(placeholder)row.setAttribute('aria-label','席位待定');
        const seal=el('span','tt-player-seal',player ? Array.from(String(player.name || '').trim())[0] || '俠' : '候');
        seal.setAttribute('aria-hidden','true');
        const identity=el('span','tt-identity');identity.append(el('span','tt-name',seatText(match,seat)));
        row.append(seal,identity);
        if(row.dataset.winner){const stamp=el('span','tt-victory-stamp','勝');stamp.setAttribute('aria-hidden','true');row.append(stamp);}
        if(row.dataset.eliminated){const stamp=el('span','tt-defeat-stamp','敗');stamp.setAttribute('aria-hidden','true');row.append(stamp);}
        if(row.dataset.eliminated){
          // Decorative split faces leave one accessible name and one click target.
          for(const half of ['upper','lower']){
            const piece=el('span','tt-cut-piece');piece.dataset.half=half;piece.setAttribute('aria-hidden','true');row.append(piece);
          }
          const slash=el('span','tt-cut-flash');slash.setAttribute('aria-hidden','true');
          const blade=doc.createElementNS(SVG,'svg');blade.setAttribute('viewBox','0 0 100 100');blade.setAttribute('preserveAspectRatio','none');blade.setAttribute('focusable','false');
          const cut=doc.createElementNS(SVG,'path');cut.setAttribute('d','M 96 0 L 4 100');blade.append(cut);slash.append(blade);row.append(slash);
        }
        const score=match[seat===0?'s1':'s2'];
        row.append(el('span','tt-score',Number(data.bestOf)>1 && status!=='upcoming' && !match.bye && Number.isFinite(score)?score:'—'));
        listen(row,'click',()=>{
          if(disposed || generation!==token)return;
          if(player && onPlayer)onPlayer(String(playerId),match.id,row);else onSelect?.(match.id,row);
        });
        const highlight=()=>highlightPlayer(playerId);
        listen(row,'pointerenter',highlight);listen(row,'focus',highlight);
        listen(row,'pointerleave',()=>highlightPlayer(null));listen(row,'blur',()=>highlightPlayer(null));
        group.append(row);cards.set(`${match.id}:${seat}`,row);
      });
      return group;
    }
    function highlightPlayer(playerId){
      for(const item of canvas.querySelectorAll('[data-player-id]')){
        item.toggleAttribute('data-highlight',!!playerId && item.dataset.playerId===String(playerId));
      }
    }
    rounds.forEach((round, index) => {
      const key = String(round.round), tab = el('button', 'tt-tab', round.label);
      tab.type = 'button'; tab.id = `${id}-tab-${index}`; tab.dataset.round = key;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `${id}-round-${index}`);
      const panel = el('section', 'tt-round'); panel.id = `${id}-round-${index}`; panel.dataset.round = key;
      panel.setAttribute('aria-labelledby', tab.id);
      round.matches.forEach(match => panel.append(matchButton(match)));
      tabs.append(tab); canvas.append(panel); panels.set(key, panel); tabButtons.set(key, tab);
      listen(tab, 'click', () => selectRound(key));
      listen(tab, 'keydown', event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (offset || event.key === 'Home' || event.key === 'End') {
          event.preventDefault(); event.stopPropagation();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? roundKeys.length - 1 :
            (roundKeys.indexOf(key) + offset + roundKeys.length) % roundKeys.length;
          selectRound(roundKeys[next], true);
        } else if (event.key === 'ArrowDown') {
          event.preventDefault(); event.stopPropagation(); panel.querySelector('button')?.focus();
        }
      });
    });
    const count = Math.max(1,treeRounds.length);
    const hasFinal=lastRound?.matches.length===1;
    const sideCount=hasFinal ? count-1 : count;
    const crownGap=16, crownWidth=128;
    const minimumWidth=(sideCount*2+2)*112+sideCount*2*COLUMN_GAP+crownWidth+crownGap*2;
    const availableWidth=()=>Math.max(0,(host.clientWidth || viewport.clientWidth)-24);
    const isCompact=()=>!!mobile?.matches || data.layoutPreference==='round' || (data.layoutPreference!=='tree' && availableWidth()>0 && availableWidth()<minimumWidth);
    let nodeWidth=NODE_WIDTH, centerWidth=0, centerX=0, width=0;
    const columnLabels=[];
    function selectRound(key, focus = false) {
      if (disposed || generation !== token || !panels.has(key)) return;
      selectedRound = key;
      const compact = isCompact();
      host.dataset.view = compact ? 'round' : 'tree';
      tabs.hidden = !compact;
      viewport.tabIndex = compact ? -1 : 0;
      panels.forEach((panel, round) => {
        panel.hidden = compact && round !== key;
        panel.setAttribute('role', compact ? 'tabpanel' : 'group');
        const tab = tabButtons.get(round);
        tab.setAttribute('aria-selected', String(round === key)); tab.tabIndex = round === key ? 0 : -1;
      });
      const activeTab = tabButtons.get(key);
      if (compact) tabs.scrollLeft = Math.max(0, activeTab.offsetLeft - (tabs.clientWidth - activeTab.offsetWidth) / 2);
      if (focus) activeTab.focus();
    }
    // Polling must not move a keyboard user to another round or back to the body.
    if (focusMatch && buttons.has(focusMatch)) selectedRound = buttons.get(focusMatch).dataset.round;
    else if (focusRound && panels.has(focusRound)) selectedRound = focusRound;
    selectRound(selectedRound);
    if(sideCount){
      for(const side of ['left','right']){
        const heading=el('p','tt-side-heading',side==='left'?'左路群俠 →':'← 右路群俠');
        heading.dataset.side=side;heading.setAttribute('aria-hidden','true');canvas.append(heading);
      }
    }
    const finalMatch=hasFinal ? lastRound.matches[0] : null;
    const champion=finalMatch?.status==='done' && finalMatch.winner && [finalMatch.p1,finalMatch.p2].includes(finalMatch.winner) ? players.get(String(finalMatch.winner)) : null;
    const finalCrest=el('button','tt-final-crest tt-champion');finalCrest.type='button';
    finalCrest.disabled=placeholder;
    finalCrest.setAttribute('aria-label',champion ? `冠軍 ${champion.name}，查看決賽` : '冠軍待定，查看決賽');
    if(placeholder)finalCrest.setAttribute('aria-label','冠軍待定');
    const championSignature=champion?`${finalMatch.id}:${champion.id}`:'';
    nextResults.set('champion',championSignature);
    if(champion){
      finalCrest.dataset.confirmed='true';
      if(replay || previousResults.get('champion')!==championSignature)finalCrest.dataset.resultEnter='true';
      const stamp=el('span','tt-champion-stamp','魁');stamp.setAttribute('aria-hidden','true');finalCrest.append(stamp);
    }
    const championImage=el('img','tt-champion-art');championImage.src=championArt;championImage.alt='';championImage.width=1024;championImage.height=1536;
    finalCrest.append(el('span','tt-champion-label',placeholder ? '冠軍' : '百業試鋒 · 冠軍'),championImage,el('span','tt-champion-name',champion?.name || '冠軍待定'));
    if(finalMatch){
      groups.get(finalMatch.id).replaceChildren(cards.get(`${finalMatch.id}:0`),finalCrest,cards.get(`${finalMatch.id}:1`),buttons.get(finalMatch.id));
      listen(finalCrest,'click',()=>{if(!disposed && generation===token)onSelect?.(finalMatch.id,finalCrest);});
    }
    treeRounds.forEach((round,index)=>{
      const central=hasFinal && index===count-1;
      for(const side of central ? ['final'] : ['left','right']){
        const label=el('p','tt-column-title',round.label);label.dataset.side=side;
        columnLabels.push({label,side,index,central});
        label.setAttribute('aria-hidden','true');canvas.append(label);
      }
    });
    function layout(){
      raf=0;if(disposed || generation!==token)return;
      const focused=doc.activeElement;
      const focusedRound=host.contains(focused)?focused.closest('[data-round]')?.dataset.round:null;
      selectRound(focusedRound && panels.has(focusedRound)?focusedRound:selectedRound);
      if(!isCompact() && focused?.classList.contains('tt-tab'))panels.get(selectedRound)?.querySelector('button')?.focus({preventScroll:true});
      const available=availableWidth();
      nodeWidth=available>0?Math.max(112,Math.min(144,(available-sideCount*2*COLUMN_GAP-crownWidth-crownGap*2)/(sideCount*2+2))):NODE_WIDTH;
      centerWidth=nodeWidth*2+crownWidth+crownGap*2;
      centerX=sideCount*(nodeWidth+COLUMN_GAP);
      width=centerX*2+centerWidth;
      canvas.style.setProperty('--tree-node-width',`${nodeWidth}px`);
      canvas.style.removeProperty('--tree-seat-height');
      finalCrest.style.width=`${crownWidth}px`;
      columnLabels.forEach(({label,side,index,central})=>{
        const x=side==='final'?centerX:side==='left'?index*(nodeWidth+COLUMN_GAP):width-nodeWidth-index*(nodeWidth+COLUMN_GAP);
        label.style.left=`${x}px`;label.style.width=`${central?centerWidth:nodeWidth}px`;
      });
      // Measure single seats, not a pair container; long names enlarge every row consistently.
      const height=Math.max(68,...[...cards.values()].map(card=>Math.ceil(card.getBoundingClientRect().height || card.scrollHeight || 0)));
      const seats=Math.max(2,...treeRounds.map(round=>Math.ceil(round.matches.length/2)*2));
      const crownHeight=Math.max(156,Math.ceil(finalCrest.getBoundingClientRect().height || finalCrest.scrollHeight || 0));
      const bodyHeight=Math.max(crownHeight+height*2+80,seats*(height+28));
      const mid=HEADER+bodyHeight/2, thirds=all.filter(match=>match.kind==='third');
      const thirdTop=mid+Math.max(height,crownHeight)+120;
      const totalHeight=Math.max(HEADER+bodyHeight,thirds.length?thirdTop+thirds.length*(height*2+88):0)+20;
      canvas.style.width=`${width}px`;canvas.style.height=`${totalHeight}px`;
      canvas.style.setProperty('--tree-seat-height',`${height}px`);positions.clear();
      function place(match,side,xy,junction){
        const button=buttons.get(match.id);button.dataset.side=side;groups.get(match.id).dataset.side=side;
        button.style.left=`${junction.x-24}px`;button.style.top=`${junction.y-28}px`;
        xy.forEach((point,seat)=>{
          const card=cards.get(`${match.id}:${seat}`);card.style.left=`${point.x}px`;card.style.top=`${point.y-height/2}px`;
          card.dataset.side=side;
          const left=side==='left' || ((side==='final'||side==='third') && seat===0);
          card.dataset.tone=(host.dataset.tones==='red-left'?left:!left)?'red':'blue';
          card.setAttribute('aria-label',`${card.dataset.tone==='red'?'紅方':'藍方'}，${seatText(match,seat)}，${card.dataset.playerId?playerActionLabel:matchActionLabel}`);
        });
        positions.set(match.id,{side,seats:xy,junction});
      }
      treeRounds.forEach((round,index)=>{
        const central=hasFinal && index===count-1, split=Math.ceil(round.matches.length/2);
        round.matches.forEach((match,order)=>{
          if(central){place(match,'final',[{x:centerX,y:mid},{x:centerX+centerWidth-nodeWidth,y:mid}],{x:centerX+centerWidth/2,y:mid+crownHeight/2+42});return;}
          const side=order<split?'left':'right',local=side==='left'?order:order-split;
          const total=side==='left'?split:round.matches.length-split;
          const x=side==='left'?index*(nodeWidth+COLUMN_GAP):width-nodeWidth-index*(nodeWidth+COLUMN_GAP);
          const xy=[0,1].map(seat=>({x,y:HEADER+(local*2+seat+.5)*bodyHeight/(total*2)}));
          place(match,side,xy,{x:x+(side==='left'?nodeWidth+COLUMN_GAP/2:-COLUMN_GAP/2),y:(xy[0].y+xy[1].y)/2});
        });
      });
      if(finalMatch){finalCrest.style.left=`${centerX+(centerWidth-crownWidth)/2}px`;finalCrest.style.top=`${mid-crownHeight/2}px`;finalCrest.style.width=`${crownWidth}px`;}
      thirds.forEach((match,i)=>{
        const y=thirdTop+i*(height*2+88);
        place(match,'third',[{x:centerX,y},{x:centerX+centerWidth-nodeWidth,y}],{x:centerX+centerWidth/2,y});
      });
      lines.replaceChildren();lines.setAttribute('width',String(width));lines.setAttribute('height',String(totalHeight));
      function path(d,className,playerId,won){
        const item=doc.createElementNS(SVG,'path');item.setAttribute('d',d);item.setAttribute('class',className);
        if(playerId)item.dataset.playerId=String(playerId);if(won)item.dataset.winner='true';lines.append(item);
        if(won){const flow=item.cloneNode(false);flow.setAttribute('class','tt-flow');flow.setAttribute('pathLength','100');lines.append(flow);}
        return item;
      }
      for(const match of all){
        const position=positions.get(match.id);if(!position)continue;
        const {side,seats:xy,junction:j}=position;
        xy.forEach((point,seat)=>{
          const pid=match[seat===0?'p1':'p2'];
          const sx=point.x+(side==='right' || (side==='final'||side==='third')&&seat===1?0:nodeWidth);
          const crownEdge=centerX+(centerWidth-crownWidth)/2+(seat===1?crownWidth:0);
          const route=side==='final' ? `M ${sx} ${point.y} H ${crownEdge}` : `M ${sx} ${point.y} H ${j.x} V ${j.y}`;
          path(route,'tt-branch',pid,match.status==='done' && !!pid && match.winner===pid);
        });
      }
      edges.forEach(({from,to,seat})=>{
        const a=positions.get(from.id),b=positions.get(to.id);
        if(!a || !b || (seat!==0 && seat!==1))return;
        const target=b.seats[seat],sx=a.junction.x,sy=a.junction.y;
        const ex=target.x+(a.side==='right'?nodeWidth:0);
        const won=from.status==='done' && from.winner && [from.p1,from.p2].includes(from.winner);
        const item=path(`M ${sx} ${sy} H ${(sx+ex)/2} V ${target.y} H ${ex}`,'tt-advance',won?from.winner:null,won);
        item.dataset.from=from.id;item.dataset.to=to.id;
      });
    }
    function requestLayout() {
      if (!disposed && generation === token && !raf) raf = view.requestAnimationFrame(layout);
    }
    layout();
    previousResults=nextResults;
    viewport.scrollLeft = oldViewport ? scroll.left : Math.max(0,(width-viewport.clientWidth)/2); viewport.scrollTop = scroll.top;
    if (ownedFocus) {
      const target = focusChampion && finalMatch && finalCrest || (focusSeat !== undefined && cards.get(`${focusMatch}:${focusSeat}`)) || focusMatch && buttons.get(focusMatch) ||
        ((focusTab || focusRound) && isCompact() ? tabButtons.get(selectedRound) : viewport);
      target?.focus({preventScroll:true});
    }
    if (view.ResizeObserver) {
      observer = new view.ResizeObserver(requestLayout);
      observer.observe(host); cards.forEach(card => observer.observe(card));if(finalMatch)observer.observe(finalCrest);
    }
    listen(view, 'resize', requestLayout);
    if (mobile?.addEventListener) listen(mobile, 'change', () => {
      const focused = doc.activeElement;
      const focusedRound = host.contains(focused) ? focused.closest('[data-round]')?.dataset.round : null;
      selectRound(focusedRound && panels.has(focusedRound) ? focusedRound : selectedRound);
      if (!isCompact() && focused?.classList.contains('tt-tab')) {
        panels.get(selectedRound)?.querySelector('button')?.focus({preventScroll:true});
      }
      requestLayout();
    });
  }
  function destroy() {
    if (disposed) return;
    disposed = true; clearRender();
    signal?.removeEventListener('abort', destroy);
    host.replaceChildren();
    delete host.dataset.links; delete host.dataset.view; delete host.dataset.tones; delete host.dataset.placeholder;
    if (!hadClass) host.classList.remove('tournament-tree');
    if (instances.get(host) === controller) instances.delete(host);
  }
  const controller = {render, destroy};
  instances.set(host, controller);
  if (signal?.aborted) destroy(); else signal?.addEventListener('abort', destroy, {once:true});
  return controller;
}

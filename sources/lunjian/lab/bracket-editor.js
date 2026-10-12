/** Local preview editor. Never calls an API or writes a real result. */
const clone=value=>JSON.parse(JSON.stringify(value));
function treeRounds(data){
  return data.rounds.map(round=>({...round,matches:round.matches.filter(m=>m.kind!=='third').sort((a,b)=>a.slot-b.slot)})).filter(r=>r.matches.length).sort((a,b)=>a.round-b.round);
}
function resetMatch(match){match.winner='';match.status='upcoming';match.s1=0;match.s2=0;}
function reconcileResults(data,rounds){
  // Only changed participants invalidate later results. Correcting a score with
  // the same winner leaves that player's already-confirmed later matches intact.
  for(let r=1;r<rounds.length;r++){
    const previous=rounds[r-1].matches;
    for(const target of rounds[r].matches){
      const participants=[0,1].map(seat=>{const from=previous[target.slot*2+seat];return from.status==='done' && [from.p1,from.p2].includes(from.winner)?from.winner:'';});
      if(target.p1!==participants[0] || target.p2!==participants[1]){
        [target.p1,target.p2]=participants;target.bye=false;resetMatch(target);
      }
    }
  }
  // Third place follows the semifinal losers, independently of the champion.
  const semis=rounds.at(-2)?.matches;
  for(const third of data.rounds.flatMap(r=>r.matches).filter(m=>m.kind==='third')){
    if(semis?.length!==2)continue;
    const losers=semis.map(m=>m.status==='done' && m.winner && [m.p1,m.p2].includes(m.winner)?(m.winner===m.p1?m.p2:m.p1):'');
    if(third.p1!==losers[0] || third.p2!==losers[1]){[third.p1,third.p2]=losers;resetMatch(third);}
  }
}

export function applyBracketEdit(source,matchId,patch){
  if(!source?.demo)throw new Error('只能編輯示範資料；正式結果請使用裁判台。');
  const data=clone(source),rounds=treeRounds(data),all=rounds.flatMap(r=>r.matches);
  if(!rounds.length || !rounds.every((r,i)=>r.matches.length===2**(rounds.length-i-1) && r.matches.every((m,j)=>m.slot===j)))throw new Error('此示範籤表不是完整淘汰樹，無法安全調整。');
  const match=all.find(m=>m.id===matchId);if(!match)throw new Error('找不到此場次。');
  const ids=new Set(data.players.map(p=>p.id)),need=Math.floor(data.bestOf/2)+1;
  const first=rounds[0].matches.includes(match);
  const p1=String(patch.p1 || ''),p2=String(patch.p2 || '');
  if(!ids.has(p1) || (!match.bye && !ids.has(p2)) || p1===p2)throw new Error('請選擇兩位不同的參賽者。');
  if(!first && (p1!==match.p1 || p2!==match.p2))throw new Error('晉級選手由前場勝者帶入；請先修改前一場。');
  if(match.bye && p2!==match.p2)throw new Error('輪空席位不可增加對手，請交換已有選手。');
  const a=Number(patch.s1),b=Number(patch.s2),status=patch.status,winner=String(patch.winner || '');
  if(!['upcoming','live','done'].includes(status) || !Number.isInteger(a) || !Number.isInteger(b) || a<0 || b<0 || a>need || b>need)throw new Error(`比分必須是 0 至 ${need} 的整數。`);
  if(match.bye){if(status!=='done' || winner!==p1 || a!==0 || b!==0)throw new Error('輪空直接晉級，比分必須是 0：0。');}
  else if(status==='done'){
    if(![p1,p2].includes(winner) || (winner===p1?a:b)!==need || (winner===p1?b:a)>=need)throw new Error(`BO${data.bestOf} 須由勝者取得 ${need} 勝，且對手尚未達勝場。`);
  }else if(winner || a>=need || b>=need || status==='upcoming' && (a!==0 || b!==0))throw new Error('尚未完成的比賽不能指定贏家；待開賽比分須為 0：0。');
  if(first){
    for(const [seat,id] of [['p1',p1],['p2',p2]]){
      if(match[seat]===id)continue;
      const owner=rounds[0].matches.find(m=>m.p1===id || m.p2===id);
      if(!owner)throw new Error('找不到選手原始籤位。');
      const ownerSeat=owner.p1===id?'p1':'p2',old=match[seat];
      owner[ownerSeat]=old;match[seat]=id;resetMatch(owner);
      if(owner.bye){owner.status='done';owner.winner=owner.p1;}
    }
  }
  Object.assign(match,{p1,p2,s1:a,s2:b,status,winner});
  reconcileResults(data,rounds);
  return data;
}

/** Replace a first-round seat or swap two entrants; later results are derived. */
export function applyRosterAssignment(source,matchId,seat,player){
  if(!source?.demo)throw new Error('只能編輯示範資料；正式結果請使用裁判台。');
  const data=clone(source),rounds=treeRounds(data);
  if(!rounds.length || !rounds.every((r,i)=>r.matches.length===2**(rounds.length-i-1) && r.matches.every((m,j)=>m.slot===j)))throw new Error('此籤表無法安全調整。');
  const match=rounds[0].matches.find(m=>m.id===matchId);
  if(!match || !['p1','p2'].includes(seat))throw new Error('請選擇首輪籤位；後續選手由晉級結果決定。');
  if(!match[seat])throw new Error('輪空席位不能放入選手，請先增加參賽人數。');
  if(!player || typeof player.id!=='string' || !player.id || typeof player.name!=='string' || !player.name.trim())throw new Error('請選擇有效的報名者。');
  if(match[seat]===player.id)return data;
  const old=match[seat],owner=rounds[0].matches.find(m=>m.p1===player.id || m.p2===player.id);
  if(owner){
    owner[owner.p1===player.id?'p1':'p2']=old;resetMatch(owner);
  }else{
    data.players=data.players.filter(p=>p.id!==old && p.id!==player.id);data.players.push(clone(player));
  }
  match[seat]=player.id;resetMatch(match);
  for(const changed of new Set([match,owner].filter(Boolean))){if(changed.bye){changed.status='done';changed.winner=changed.p1;}}
  reconcileResults(data,rounds);return data;
}

/** Deterministic local fixture; odd counts have first-round byes, never fake opponents. */
export function createPreviewBracket(source,count,mode='finished'){
  if(!source?.demo)throw new Error('只能調整示範資料。');
  if(!Number.isInteger(count) || count<2 || count>64)throw new Error('請輸入 2 至 64 的整數人數。');
  if(!['upcoming','live','finished'].includes(mode))throw new Error('未知示範狀態。');
  const data=clone(source),size=2**Math.ceil(Math.log2(count)),slots=size/2,byes=size-count;
  data.players=Array.from({length:count},(_,i)=>source.players[i]?clone(source.players[i]):{id:`demo-extra-${i+1}`,name:`示範俠客 ${i+1}`,rank:i%4+1,seed:i+1,ladderRank:'示範資料',ladderScore:0});
  const byeSlots=new Set(Array.from({length:byes},(_,i)=>Math.floor(i*slots/byes)));
  let cursor=0,seats=Array.from({length:slots},(_,i)=>[data.players[cursor++].id,byeSlots.has(i)?'':data.players[cursor++].id]);
  data.rounds=[];data.bestOf=3;data.published=true;data.phase=mode==='finished'?6:5;
  let liveAssigned=false;
  for(let r=1;seats.length;r++){
    const matches=seats.map(([p1,p2],slot)=>{
      const bye=r===1 && !p2;
      const done=bye || mode==='finished';
      const live=mode==='live' && !liveAssigned && !!p1 && !!p2;
      if(live && !done)liveAssigned=true;
      const winner=done?(bye?p1:(r+slot)%2?p1:p2):'';
      return {id:`m${r}-${slot}`,round:r,slot,p1,p2,bye,kind:'bracket',status:done?'done':live?'live':'upcoming',winner,s1:bye?0:done?(winner===p1?2:1):live?1:0,s2:bye?0:done?(winner===p2?2:1):0};
    });
    const remaining=seats.length*2;
    data.rounds.push({round:r,label:remaining===2?'決賽':remaining===4?'準決賽':remaining===8?'八強':`${remaining} 強`,matches});
    if(matches.length===1)break;
    seats=Array.from({length:matches.length/2},(_,i)=>[matches[i*2].winner,matches[i*2+1].winner]);
  }
  return data;
}

export function createBracketEditor({host,bracketHost,onChange,signal}={}){
  if(!host)throw new TypeError('Editor host required');
  const doc=host.ownerDocument,view=doc.defaultView,abort=new AbortController();
  let registrants=[],picked='',dragged='';
  let original=null,profileCount=0,profileMode='finished',layoutPreference='auto';
  let disposed=false,key='',base=null,current=null,commands=[],editing=false,tones='red-left',replay=0,selected='',returnTo=null,resetArmed=false;
  const listen=(node,event,fn)=>node.addEventListener(event,fn,{signal:abort.signal});
  const element=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const button=(text,action)=>{const b=element('button',text);b.type='button';listen(b,'click',action);return b;};
  host.classList.add('bracket-editor-tools');
  const modes=element('div');modes.className='be-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','賽程模式');
  const inspect=button('檢視',()=>setEditing(false)),toggle=button('編輯',()=>setEditing(true));modes.append(inspect,toggle);
  const choose=button('選場編輯',()=>open(current?.rounds.flatMap(r=>r.matches).find(m=>m.id===selected)?.id || current?.rounds[0]?.matches[0]?.id,choose));
  const toneLabel=element('label','卡面 '),toneSelect=element('select');toneSelect.setAttribute('aria-label','紅藍方配置');
  for(const [value,text] of [['red-left','左紅 · 右藍'],['blue-left','左藍 · 右紅']]){const o=element('option',text);o.value=value;toneSelect.append(o);}toneLabel.append(toneSelect);
  const previewControls=element('fieldset');previewControls.className='be-preview';previewControls.append(element('legend','參賽設定'));
  const countLabel=element('label','人數 '),countInput=element('input');countInput.type='number';countInput.min='2';countInput.max='64';countInput.step='1';countInput.setAttribute('aria-label','示範人數');countLabel.append(countInput);
  const presets=element('div');presets.className='be-presets';
  for(const n of [8,16,32,64]){const b=button(`${n} 人`,()=>switchProfile(n,profileMode));b.dataset.count=String(n);presets.append(b);}
  const applyCount=button('套用人數',()=>switchProfile(Number(countInput.value),profileMode));
  const countError=element('p');countError.className='be-form-error';countError.id='bracket-count-error';countError.setAttribute('role','alert');countError.hidden=true;countInput.setAttribute('aria-describedby',countError.id);
  const modeLabel=element('label','進度 '),modeSelect=element('select');modeSelect.setAttribute('aria-label','示範比賽進度');
  for(const [v,t] of [['upcoming','比賽前'],['live','比賽中'],['finished','完成比賽']]){const o=element('option',t);o.value=v;modeSelect.append(o);}modeLabel.append(modeSelect);
  const viewLabel=element('label','檢視 '),viewSelect=element('select');viewSelect.setAttribute('aria-label','賽程檢視方式');
  for(const [v,t] of [['auto','自動排版'],['tree','完整樹狀圖'],['round','分輪閱讀']]){const o=element('option',t);o.value=v;viewSelect.append(o);}viewLabel.append(viewSelect);
  const sizeNote=element('p');sizeNote.className='be-size-note';
  previewControls.append(presets,countLabel,applyCount,modeLabel,countError,sizeNote);
  const replayButton=button('重播勝敗效果',()=>{replay++;emit();});
  const undo=button('復原上一步',()=>{commands.pop();rebuild();const stored=save();emit();if(stored)status.textContent='已復原上一步。';});
  const reset=button('還原本階段示範',()=>{
    if(!resetArmed){resetArmed=true;reset.textContent='再次點選，確認還原';return;}
    commands=[];rebuild();const stored=save();emit();resetArmed=false;reset.textContent='還原本階段示範';if(stored)status.textContent='已還原此階段示範資料。';
  });
  const status=element('p','示範管理 · 修改僅儲存在此瀏覽器，不提交正式賽果。');status.setAttribute('role','status');
  const editControls=element('div');editControls.className='be-edit-controls';
  const roster=element('section');roster.className='be-roster';roster.setAttribute('aria-label','報名者');
  const rosterTitle=element('h3','報名者'),rosterNote=element('p','拖曳姓名到首輪卡片即可換人；已排入的選手會互換。也可點選姓名，再選籤位。');
  const search=element('input');search.type='search';search.placeholder='搜尋報名者';search.setAttribute('aria-label','搜尋報名者');
  const addName=element('input');addName.maxLength=40;addName.placeholder='報名者姓名';addName.setAttribute('aria-label','新增報名者姓名');
  const add=button('新增報名者',()=>{
    const name=addName.value.trim();if(!name){status.textContent='請填寫報名者姓名。';addName.focus();return;}
    if(registrants.length>=256){status.textContent='示範報名者上限為 256 位。';return;}
    const player={id:`local-${view.crypto.randomUUID()}`,name};registrants.push(player);picked=player.id;addName.value='';
    const stored=saveRoster();renderRoster();refreshSeats();if(stored)status.textContent=`已新增 ${name}；選擇首輪籤位即可排入。`;
  });
  const rosterActions=element('div');rosterActions.className='be-roster-actions';rosterActions.append(search,addName,add);
  const rosterList=element('div');rosterList.className='be-roster-list';
  const placement=element('div');placement.className='be-placement';
  const selectedNote=element('span','尚未選擇報名者'),seatSelect=element('select');seatSelect.setAttribute('aria-label','目標首輪籤位');
  const place=button('放入籤位',()=>{const target=JSON.parse(seatSelect.value || 'null');if(target)assign(target[0],target[1],picked);});
  const cancelPick=button('取消選取',()=>{picked='';renderRoster();refreshSeats();});
  placement.append(selectedNote,seatSelect,place,cancelPick);roster.append(rosterTitle,rosterNote,rosterActions,rosterList,placement);
  editControls.append(previewControls,roster,choose,toneLabel,replayButton,undo,reset);
  host.append(modes,viewLabel,editControls,status);
  const dialog=element('dialog');dialog.className='bracket-editor-dialog';dialog.setAttribute('aria-labelledby','bracket-editor-title');
  dialog.innerHTML='<form novalidate><header><div><p class="be-eyebrow">示範資料 · 僅存於此瀏覽器</p><h3 id="bracket-editor-title">編輯這場比武</h3></div><button type="button" data-close aria-label="關閉編輯">×</button></header><label>選擇場次<select name="match"></select></label><div class="be-sides"><fieldset><legend>選手一</legend><label>參賽選手<select name="p1"></select></label><label class="be-score">勝局<input name="s1" type="number" min="0" step="1" required></label><button type="button" data-win="p1" aria-pressed="false">此方獲勝</button></fieldset><fieldset><legend>選手二</legend><label>參賽選手<select name="p2"></select></label><label class="be-score">勝局<input name="s2" type="number" min="0" step="1" required></label><button type="button" data-win="p2" aria-pressed="false">此方獲勝</button></fieldset></div><p data-participants-note></p><label>比賽狀態<select name="status"><option value="upcoming">比賽前</option><option value="live">比賽中</option><option value="done">完成比賽</option></select></label><select name="winner" hidden aria-label="本場贏家"></select><p class="be-summary" data-summary aria-live="polite"></p><p data-error role="alert"></p><footer><button type="button" data-close>取消</button><button type="submit">儲存這場比分</button></footer></form>';
  doc.body.append(dialog);
  const form=dialog.querySelector('form'),field=name=>form.elements.namedItem(name),error=dialog.querySelector('[data-error]');
  error.tabIndex=-1;
  listen(form,'input',()=>{error.textContent='';});
  listen(form,'change',()=>{error.textContent='';});
  const matches=()=>current?.rounds.flatMap(r=>r.matches).filter(m=>m.kind!=='third') || [];
  const isOriginal=()=>profileCount===original.players.length && profileMode===(key==='finished'?'finished':'live');
  const storageKey=()=>`lunjian.bracket-editor.v1.${key}${isOriginal()?'':`.${profileCount}.${profileMode}`}`;
  const fingerprint=()=>base.players.map(p=>p.id).join('|')+';'+base.rounds.flatMap(r=>r.matches).map(m=>m.id).join('|');
  function rebuild(){current=commands.reduce((data,cmd)=>cmd.type==='assign'?applyRosterAssignment(data,cmd.id,cmd.seat,cmd.player):applyBracketEdit(data,cmd.id,cmd.patch),clone(base));}
  function saveRoster(){try{view.localStorage.setItem(`lunjian.bracket-roster.v1.${key}`,JSON.stringify(registrants));return true;}catch{status.textContent='瀏覽器無法儲存；本次修改只保留到離開頁面。';return false;}}
  function mergeRoster(){for(const p of [...(original?.players || []),...(current?.players || [])])if(!registrants.some(r=>r.id===p.id))registrants.push(clone(p));}
  function renderRoster(){
    mergeRoster();const focused=doc.activeElement?.dataset.registrantId,query=search.value.trim().toLocaleLowerCase();
    rosterList.replaceChildren();const ids=new Set(current?.players.map(p=>p.id));
    const filtered=registrants.filter(p=>p.name.toLocaleLowerCase().includes(query));
    for(const p of filtered){const b=element('button');b.type='button';b.draggable=editing;b.dataset.registrantId=p.id;b.setAttribute('aria-pressed',String(picked===p.id));
      b.append(element('span',p.name),element('small',ids.has(p.id)?'已排入':'待排入'));b.setAttribute('aria-label',`${p.name}，${ids.has(p.id)?'已排入':'待排入'}`);rosterList.append(b);
    }
    if(!filtered.length)rosterList.append(element('p','沒有符合的報名者。'));
    const old=seatSelect.value;seatSelect.replaceChildren();
    for(const m of current?treeRounds(current)[0].matches:[])for(const seat of ['p1','p2'])if(m[seat]){
      const p=current.players.find(p=>p.id===m[seat]),o=element('option',`第 ${m.slot+1} 場 · ${seat==='p1'?'一':'二'}席 · ${p?.name || '待定'}`);o.value=JSON.stringify([m.id,seat]);seatSelect.append(o);
    }
    if([...seatSelect.options].some(o=>o.value===old))seatSelect.value=old;
    selectedNote.textContent=picked?`已選：${registrants.find(p=>p.id===picked)?.name || ''}`:'尚未選擇報名者';place.disabled=!picked;cancelPick.disabled=!picked;
    if(focused)rosterList.querySelectorAll('button').forEach(b=>{if(b.dataset.registrantId===focused)b.focus();});
  }
  function clearDrag(){dragged='';bracketHost?.querySelectorAll('[data-drop-target]').forEach(n=>delete n.dataset.dropTarget);}
  function refreshSeats(){
    if(!bracketHost)return;bracketHost.dataset.editing=String(editing);bracketHost.dataset.placing=String(editing && !!picked);
    const first=current?treeRounds(current)[0].round:null;
    bracketHost.querySelectorAll('.tt-player').forEach(node=>{
      const eligible=editing && Number(node.dataset.round)===first && !!node.dataset.playerId;
      node.draggable=eligible;node.dataset.rosterSeat=String(eligible);
    });
  }
  function assign(id,seat,playerId){
    if(!editing || !playerId)return;
    try{
      if(commands.length>=300)throw new Error('已累積 300 次修改，請先復原或還原示範。');
      const player=registrants.find(p=>p.id===playerId);if(!player)throw new Error('找不到報名者。');
      const match=matches().find(m=>m.id===id);if(match?.[seat]===playerId){picked='';renderRoster();refreshSeats();return;}
      const next=applyRosterAssignment(current,id,seat,player);mergeRoster();current=next;commands.push({type:'assign',id,seat,player:clone(player)});
      picked='';clearDrag();const rosterStored=saveRoster(),stored=save();emit();
      if(stored && rosterStored)status.textContent=`已調整 ${player.name} 的籤位；受影響的後續賽果已清除，可復原。`;
    }catch(e){status.textContent=e.message;clearDrag();}
  }
  listen(search,'input',renderRoster);
  listen(rosterList,'click',event=>{const b=event.target.closest('[data-registrant-id]');if(!editing || !b)return;picked=picked===b.dataset.registrantId?'':b.dataset.registrantId;renderRoster();refreshSeats();});
  listen(addName,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();add.click();}});
  const dragType='application/x-lunjian-player';
  function startDrag(event){
    if(!editing)return;const node=event.target.closest('[data-registrant-id],.tt-player[data-roster-seat="true"]');
    if(!node)return;dragged=node.dataset.registrantId || node.dataset.playerId;
    event.dataTransfer?.setData(dragType,dragged);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
  }
  listen(rosterList,'dragstart',startDrag);listen(rosterList,'dragend',clearDrag);
  if(bracketHost){
    listen(bracketHost,'dragstart',startDrag);listen(bracketHost,'dragend',clearDrag);
    listen(bracketHost,'dragover',event=>{const node=event.target.closest('.tt-player[data-roster-seat="true"]');if(!editing || !dragged || !node)return;event.preventDefault();bracketHost.querySelectorAll('[data-drop-target]').forEach(n=>delete n.dataset.dropTarget);node.dataset.dropTarget='true';if(event.dataTransfer)event.dataTransfer.dropEffect='move';});
    listen(bracketHost,'dragleave',event=>{const node=event.target.closest('[data-drop-target]');if(node && !node.contains(event.relatedTarget))delete node.dataset.dropTarget;});
    listen(bracketHost,'drop',event=>{if(!editing || !dragged)return;event.preventDefault();const node=event.target.closest('.tt-player[data-roster-seat="true"]'),id=dragged;clearDrag();if(node)assign(node.dataset.matchId,node.dataset.seat==='0'?'p1':'p2',id);});
    bracketHost.addEventListener('click',event=>{
      if(!editing || !picked)return;const node=event.target.closest('.tt-player');if(!node)return;
      event.preventDefault();event.stopImmediatePropagation();assign(node.dataset.matchId,node.dataset.seat==='0'?'p1':'p2',picked);
    },{capture:true,signal:abort.signal});
  }
  listen(doc,'keydown',event=>{if(event.key==='Escape' && editing && (picked || dragged)){event.preventDefault();picked='';clearDrag();renderRoster();refreshSeats();}});
  function save(){
    try{view.localStorage.setItem(storageKey(),JSON.stringify({version:1,fingerprint:fingerprint(),commands,tones,layoutPreference}));return true;}
    catch{status.textContent='瀏覽器無法儲存；本次修改只保留到離開頁面。';return false;}
  }
  function emit(){if(disposed || !current)return;current.tones=tones;current.layoutPreference=layoutPreference;current.effectRevision=replay;undo.disabled=!commands.length;renderRoster();onChange?.(current);refreshSeats();}
  function setEditing(value){
    editing=value;toggle.setAttribute('aria-pressed',String(value));inspect.setAttribute('aria-pressed',String(!value));editControls.hidden=!value;host.dataset.editing=String(value);
    if(!value){picked='';clearDrag();close();}renderRoster();refreshSeats();
    status.textContent=value?'拖曳或點選報名者安排首輪；點場次可改比分。修改僅儲存在此瀏覽器。':'檢視模式 · 點姓名查看選手，點比分進入比武。';
  }
  function summary(){
    const winner=field('winner').value;
    dialog.querySelectorAll('[data-win]').forEach(b=>{const pid=field(b.dataset.win).value;b.disabled=!pid || field('status').disabled;b.setAttribute('aria-pressed',String(!!winner && winner===pid));});
    const name=current?.players.find(p=>p.id===winner)?.name;
    dialog.querySelector('[data-summary]').textContent=name?`${name} 勝出 · ${field('s1').value} : ${field('s2').value}`:`BO${current?.bestOf || 3} · 改比分，或直接點選獲勝選手。`;
  }
  dialog.querySelectorAll('[data-win]').forEach(b=>listen(b,'click',()=>{field('winner').value=field(b.dataset.win).value;field('winner').dispatchEvent(new view.Event('change'));}));
  listen(form,'input',summary);listen(form,'change',summary);
  function winnerOptions(){
    const select=field('winner'),old=select.value;select.replaceChildren();const none=element('option','尚未產生');none.value='';select.append(none);
    for(const id of [field('p1').value,field('p2').value].filter(Boolean)){const player=current.players.find(p=>p.id===id),o=element('option',player?.name || id);o.value=id;select.append(o);}select.value=old;
  }
  function fill(id){
    const match=matches().find(m=>m.id===id);if(!match)return;
    selected=id;field('match').value=id;error.textContent='';
    const first=match.round===treeRounds(current)[0].round;
    for(const seat of ['p1','p2']){
      const select=field(seat);select.replaceChildren();
      const pending=element('option',match.bye?'輪空':'待前場勝者');pending.value='';select.append(pending);
      for(const player of current.players){const o=element('option',player.name);o.value=player.id;select.append(o);}
      select.value=match[seat];select.disabled=!first || match.bye && seat==='p2';
    }
    for(const name of ['s1','s2']){field(name).value=String(match[name] || 0);field(name).max=String(Math.floor(current.bestOf/2)+1);field(name).disabled=!!match.bye;}
    field('status').value=match.status;field('status').disabled=!!match.bye;winnerOptions();field('winner').value=match.winner;field('winner').disabled=!!match.bye;
    dialog.querySelector('[data-participants-note]').textContent=match.bye?'此選手輪空，直接晉級。':first?'換選手會交換籤位；改贏家會更新後續賽程，可復原。':'選手由前場晉級。換人請改前一輪；改贏家會更新後續賽程。';
    summary();
  }
  function open(id,trigger){
    if(disposed || !current?.demo || !matches().some(m=>m.id===id))return false;
    setEditing(true);returnTo=trigger || doc.activeElement;
    field('match').replaceChildren();for(const m of matches()){const o=element('option',`第 ${m.round} 輪 · 第 ${m.slot+1} 場`);o.value=m.id;field('match').append(o);}fill(id);
    if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
    field('match').focus();return true;
  }
  function restoreFocus(){
    if(disposed)return;
    const replacement=[...doc.querySelectorAll('#bracket-host .tt-node')].find(n=>n.dataset.matchId===selected);
    (returnTo?.isConnected?returnTo:replacement || choose).focus();returnTo=null;
  }
  function close(){if(!dialog.open)return;if(dialog.close)dialog.close();else{dialog.removeAttribute('open');restoreFocus();}}
  listen(dialog,'close',restoreFocus);
  listen(dialog,'keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
  dialog.querySelectorAll('[data-close]').forEach(b=>listen(b,'click',close));
  listen(field('match'),'change',()=>fill(field('match').value));
  for(const seat of ['p1','p2'])listen(field(seat),'change',()=>{
    const match=matches().find(m=>m.id===selected);winnerOptions();
    if(match.bye){field('winner').value=field('p1').value;return;}
    field('status').value='upcoming';field('winner').value='';field('s1').value='0';field('s2').value='0';
  });
  listen(field('winner'),'change',()=>{
    const winner=field('winner').value,need=Math.floor(current.bestOf/2)+1;
    if(!winner)return;
    const won=winner===field('p1').value?'s1':'s2',lost=won==='s1'?'s2':'s1';field(won).value=String(need);field(lost).value=String(Math.min(need-1,Number(field(lost).value)||0));field('status').value='done';summary();
  });
  for(const name of ['s1','s2'])listen(field(name),'input',()=>{
    const need=Math.floor(current.bestOf/2)+1,a=Number(field('s1').value),b=Number(field('s2').value);
    if(a===need && b<need || b===need && a<need){field('status').value='done';field('winner').value=field(a===need?'p1':'p2').value;}
    else{field('winner').value='';field('status').value='live';}
  });
  listen(field('status'),'change',()=>{
    if(field('status').value==='done')return;
    field('winner').value='';const cap=field('status').value==='upcoming'?0:Math.floor(current.bestOf/2);
    for(const name of ['s1','s2'])field(name).value=String(Math.min(cap,Number(field(name).value)||0));
  });
  listen(form,'submit',event=>{
    event.preventDefault();error.textContent='';
    try{
      if(commands.length>=300)throw new Error('此階段已累積 300 次修改，請復原或還原示範後繼續。');
      const patch=Object.fromEntries(['p1','p2','s1','s2','status','winner'].map(name=>[name,field(name).value]));
      if(!field('s1').value || !field('s2').value)throw new Error('請填寫雙方比分。');
      current=applyBracketEdit(current,selected,patch);commands.push({id:selected,patch});
      const stored=save();emit();if(stored)status.textContent='已套用示範變更並儲存在此瀏覽器；未提交正式賽果。';close();
    }catch(e){error.textContent=e.message;error.focus();}
  });
  listen(toneSelect,'change',()=>{tones=toneSelect.value;save();emit();});
  function loadProfile(){
    base=isOriginal()?clone(original):createPreviewBracket(original,profileCount,profileMode);
    commands=[];current=clone(base);resetArmed=false;reset.textContent='還原本階段示範';
    try{
      const saved=JSON.parse(view.localStorage.getItem(storageKey()) || 'null');
      if(saved?.version===1 && saved.fingerprint===fingerprint() && Array.isArray(saved.commands) && saved.commands.length<=300){
        commands=saved.commands;rebuild();tones=['blue-left','white-left'].includes(saved.tones)?'blue-left':'red-left';
        layoutPreference=['tree','round'].includes(saved.layoutPreference)?saved.layoutPreference:'auto';
      }
    }catch{commands=[];current=clone(base);status.textContent='儲存的示範無法讀取，已使用原始示範。';}
    countInput.value=String(profileCount);modeSelect.value=profileMode;viewSelect.value=layoutPreference;toneSelect.value=tones;
    presets.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.count)===profileCount)));
    const size=2**Math.ceil(Math.log2(profileCount));
    sizeNote.textContent=`${profileCount} 位選手 · ${size} 籤位 · ${size-profileCount} 位輪空。各人數與進度分開儲存；手機使用分輪閱讀。`;
    selected=matches()[0]?.id || '';emit();
  }
  function switchProfile(count,mode){
    if(!original)return;
    if(!Number.isInteger(count) || count<2 || count>64){countError.textContent='請輸入 2 至 64 的整數人數。';countError.hidden=false;countInput.setAttribute('aria-invalid','true');countInput.focus();return;}
    countError.hidden=true;countError.textContent='';countInput.removeAttribute('aria-invalid');close();picked='';clearDrag();saveRoster();profileCount=count;profileMode=mode;loadProfile();
    try{view.localStorage.setItem(`lunjian.bracket-size.v1.${key}`,JSON.stringify({count,mode}));status.textContent='已切換示範；原本的人數與比分修改仍保留。';}
    catch{status.textContent='瀏覽器無法儲存人數偏好，本次切換只保留到離開頁面。';}
  }
  listen(modeSelect,'change',()=>switchProfile(Number(countInput.value),modeSelect.value));
  listen(viewSelect,'change',()=>{layoutPreference=viewSelect.value;save();emit();});
  listen(countInput,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();switchProfile(Number(countInput.value),profileMode);}});
  function sync(nextBase,nextKey){
    if(disposed || key===nextKey || !nextBase?.demo)return;
    close();picked='';clearDrag();key=nextKey;registrants=[];
    try{const saved=JSON.parse(view.localStorage.getItem(`lunjian.bracket-roster.v1.${key}`) || '[]');if(Array.isArray(saved))registrants=saved.filter(p=>typeof p?.id==='string' && typeof p?.name==='string' && p.id && p.name.trim()).slice(0,256);}catch{}
    original=clone(nextBase);profileCount=original.players.length;profileMode=key==='finished'?'finished':'live';
    try{const saved=JSON.parse(view.localStorage.getItem(`lunjian.bracket-size.v1.${key}`) || 'null');if(Number.isInteger(saved?.count) && saved.count>=2 && saved.count<=64 && ['upcoming','live','finished'].includes(saved.mode)){profileCount=saved.count;profileMode=saved.mode;}}catch{}
    loadProfile();
  }
  function destroy(){if(disposed)return;editing=false;clearDrag();refreshSeats();disposed=true;close();abort.abort();signal?.removeEventListener('abort',destroy);host.replaceChildren();dialog.remove();}
  setEditing(false);if(signal?.aborted)destroy();else signal?.addEventListener('abort',destroy,{once:true});
  return {sync,open,close,destroy,refreshSeats,get editing(){return editing;},get key(){return key;}};
}

/** A local demonstration receipt. No API calls, storage, or balance mutation. */
export function createArenaTicket({signal}={}){
  const life=new AbortController();
  const dialog=document.createElement('dialog');
  dialog.className='arena-ticket';dialog.id='arena-ticket';
  dialog.setAttribute('aria-labelledby','arena-ticket-title');
  dialog.innerHTML=`<button type="button" class="at-close" data-ticket-close aria-label="關閉示範投注單">×</button><p class="at-demo">示範資料 · 不扣代幣</p><h2 id="arena-ticket-title">選一方，立下戰帖。</h2><p class="at-match"></p><form novalidate><fieldset><legend>選擇勝方</legend><div class="at-players"></div></fieldset><label class="at-stake-label" for="arena-stake">本金（示範代幣）</label><input id="arena-stake" name="stake" type="text" inputmode="numeric" autocomplete="off" maxlength="5" aria-describedby="arena-stake-help arena-stake-error"><p id="arena-stake-help">輸入 1–10,000 枚。</p><p id="arena-stake-error" role="alert"></p><dl class="at-totals"><div><dt>示範賠率</dt><dd class="at-odds">1.85</dd></div><div><dt>預估總回報（含本金）</dt><dd class="at-payout">—</dd></div></dl><p class="at-review" tabindex="-1" hidden></p><div class="at-actions"><button type="button" data-ticket-edit hidden>返回修改</button><button type="submit" class="at-primary">檢查示範注單</button></div></form><div class="at-receipt" tabindex="-1" hidden><h3>示範注單已產生</h3><p class="at-receipt-detail"></p><p>未提交正式注單，也未扣除任何代幣。</p><button type="button" data-ticket-close>返回比武</button></div>`;
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector);
  let data=null,stage='edit',returnFocus=null,disposed=false;
  const on=(node,type,fn)=>node.addEventListener(type,fn,{signal:life.signal});
  const amount=()=>/^[1-9]\d{0,4}$/.test($('#arena-stake').value) ? BigInt($('#arena-stake').value) : 0n;
  const format=value=>value.toLocaleString('zh-TW');
  const chosen=()=>Number($('input[name="winner"]:checked')?.value ?? -1);
  function update(){
    const stake=amount();$('.at-payout').textContent=stake>0n && stake<=10000n ? format(stake*1850n/1000n)+' 枚' : '—';
    $('#arena-stake-error').textContent='';$('#arena-stake').removeAttribute('aria-invalid');
  }
  function edit(){
    stage='edit';$('fieldset').disabled=false;$('#arena-stake').readOnly=false;
    $('.at-review').hidden=true;$('[data-ticket-edit]').hidden=true;
    $('button[type="submit"]').textContent='檢查示範注單';
  }
  function close(restore=true){
    if(dialog.open){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
    data=null;
    if(restore && returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }
  on(dialog,'click',event=>{
    if(event.target.closest('[data-ticket-close]'))close();
    if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}
  });
  on(dialog,'cancel',event=>{event.preventDefault();close();});
  on(dialog,'keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='Tab'){
      const tabs=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(el=>!el.closest('[hidden]'));
      const first=tabs[0],last=tabs[tabs.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
    event.stopPropagation();
  });
  on($('#arena-stake'),'input',update);on($('.at-players'),'change',update);
  on($('[data-ticket-edit]'),'click',()=>{edit();$('#arena-stake').focus();});
  on($('form'),'submit',event=>{
    event.preventDefault();if(!data)return;
    const stake=amount(),index=chosen();
    if(index<0 || !data.players[index] || stake<1n || stake>10000n){
      $('#arena-stake-error').textContent='請選擇勝方，並輸入 1–10,000 的整數本金。';
      $('#arena-stake').setAttribute('aria-invalid','true');$('#arena-stake').focus();return;
    }
    const detail=data.players[index].name+' · '+format(stake)+' 枚 · 示範賠率 1.85 · 預估總回報 '+format(stake*1850n/1000n)+' 枚';
    if(stage==='edit'){
      stage='review';$('fieldset').disabled=true;$('#arena-stake').readOnly=true;
      $('.at-review').textContent=detail;$('.at-review').hidden=false;
      $('[data-ticket-edit]').hidden=false;$('button[type="submit"]').textContent='產生示範注單';$('.at-review').focus();
    }else if(stage==='review'){
      stage='receipt';$('form').hidden=true;$('.at-receipt-detail').textContent=detail;
      $('.at-receipt').hidden=false;$('.at-receipt').focus();
    }
  });
  function open(options){
    if(disposed || signal?.aborted || !options.players?.every(p=>p?.id))return;
    data=options;returnFocus=options.trigger || document.activeElement;
    edit();$('form').hidden=false;$('.at-receipt').hidden=true;
    $('.at-match').textContent=options.matchLabel;
    $('.at-players').replaceChildren(...options.players.map((player,index)=>{
      const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');
      input.type='radio';input.name='winner';input.value=String(index);input.checked=index===(options.side==='right'?1:0);
      name.textContent=player.name;label.append(input,name);return label;
    }));
    $('#arena-stake').value='100';update();
    if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
    $('#arena-stake').focus();
  }
  function destroy(){if(disposed)return;disposed=true;close(false);life.abort();dialog.remove();signal?.removeEventListener('abort',destroy);}
  signal?.addEventListener('abort',destroy,{once:true});
  if(signal?.aborted)destroy();
  return {open,close,isOpen:()=>dialog.open,destroy};
}

// 由 scrollcraft/builds/lunjian/lab/tools/loadout-to-theatron.py 生成，不要手改。
// 來源是 lab/loadout.html 的 <body>；改版面請改那一份再重跑腳本。
export const LOADOUT_MARKUP = String.raw`

<header class="top">
  <!-- 品牌就是回主站的路。這一頁不掛 theatron 的 SiteNav（兩套頁首會打架，
       見 MERGE.md），所以「怎麼回去」必須由這一頁自己負責。
       href 由 JS 依所在位置決定：theatron 上是 /，lab 上是隔壁那支 html。 -->
  <h1 class="brand">
    <a id="home" href="/" aria-label="回論劍首頁"><b>論劍</b></a><span>我的武學配置</span>
  </h1>
  <a class="act return-duel" id="return-duel" href="/?intro=0#duel">← 返回比武</a>
  <div class="roles" id="roles"></div>
  <!-- 手機上這四顆收進 ⋯：頁首本來會換成四行、吃掉 17% 的視窗 -->
  <div class="acts" id="acts">
    <!-- 選單第一項就是出口。只靠左上角的品牌字當連結，手機上沒人看得出來那可以點。 -->
    <a class="act navhome" id="navhome" href="/">← 返回比武</a>
    <button class="act" id="btn-guide">規則</button>
    <button class="act" id="btn-import">匯入</button>
    <button class="act" id="btn-export">匯出 JSON</button>
    <button class="act" data-primary id="btn-copy">複製配置</button>
  </div>
  <button class="act more-btn" id="btn-more" type="button"
          aria-label="選單" aria-expanded="false" hidden>☰</button>
</header>

<main class="wrap" id="main">
  <section class="start-guide" aria-label="備戰順序">
    <p><button type="button" id="step-build">1 選流派</button><span>→ 2 配置武學與裝備 → </span><button type="button" id="step-check">3 檢查與前往報名</button></p>
    <p id="storage-status" data-state="pending"><span id="storage-message" role="status">正在讀取本機配置…</span><button type="button" id="storage-retry" hidden>重試儲存</button><button type="button" id="backup-export">匯出 JSON 備份</button></p>
    <p id="empty-actions">先選流派或新增配置，即可複製與匯出。</p>
  </section>
  <!-- 左欄 -->
  <div class="col col-1">
    <div class="bpick bhead" id="build-card"><button type="button" class="build-trigger" id="bhead" disabled aria-label="選擇流派" aria-haspopup="dialog" aria-controls="pick"></button></div>

    <section class="card">
      <h2>心法<span class="cap">4 格 · 1 主修</span></h2>
      <div class="slots" data-kind="mind" id="minds"></div>
      <p class="hint">主修給巨額屬性加成，外加一條會改變戰局的被動；副修三格只給屬性。<br>金點是你流派列為必備的心法，但不擋你亂配。</p>
    </section>

    <section class="card">
      <h2>奇術<span class="cap">4 主動格</span></h2>
      <div class="slots" data-kind="art" id="arts"></div>
      <p class="hint">走完五音啟太平可擴到 8。控制、解控與防禦、功能各帶一個比較不會被卡死。<br>奇術沒有官方圖，用墨印代替；清單也一定不完整，可以自己打。</p>
    </section>

    <section class="card">
      <h2>裝備<span class="cap" id="strip-cap"></span><button class="more" id="set-bonus" type="button">套裝加成</button></h2>
      <div class="strip" id="strip"></div>
      <p class="hint">點任一格，中欄的倉庫就篩成那個部位，把這一格的候選攤在旁邊；要改數值在卡片上按「編輯」。底下那條金線代表六條詞條都填了。</p>
    </section>

    <section class="card">
      <h2>裝備屬性<span class="cap">詞條小計</span><button class="more" id="attr-src" type="button">來源明細</button><button class="more" id="attr-more" type="button">查看更多</button></h2>
      <div id="gear-attr"></div>
      <p class="hint">只算你在裝備上填的調律與定音詞條。括號是「這幾條全部滾滿會是多少」。</p>
    </section>
  </div>

  <!-- 中欄 -->
  <div class="col col-2">
    <section class="card">
      <div class="vault-head">
        <div>
          <span class="kicker">EQUIPMENT</span>
          <h2>裝備倉庫</h2>
        </div>
        <div class="right">
          <!-- 只留這一顆。匯入配置／匯出 JSON／使用說明原本擺在這裡，
               但它們就是頁首的匯入／匯出／規則（綁同一個函式），
               而頁首是 sticky 的永遠碰得到 —— 重複四顆只是把這一塊擠爆，
               而且四顆同樣是金框，重量分不出主次。 -->
          <button class="act-gold" id="btn-tools">倉庫工具 ⌄</button>
        </div>
      </div>
      <!-- 控制（分類／排序／篩選）與部位頁籤分成兩條。
           原本全部塞在 #tabs 裡靠 flex-wrap 斷行，於是「全部 16」這顆頁籤
           會被擠到控制那一條的尾巴，看起來像個孤兒。 -->
      <div class="vbar" id="vbar"></div>
      <div class="tabs" id="tabs"></div>
      <div class="vault" id="vault"></div>
      <p class="hint">這裡放的是你<b>擁有</b>的每一件，不是身上那八件。同一個部位可以放好幾件（爆傷一頂、減傷一頂），換裝只是換掛哪一件，沒掛上的那件數值原封不動留著。<br>左四湊一套影響輸出，右四湊另一套影響防禦。只有武器出武器增傷；環與佩出全武學增傷；護腿與護腕出首領增傷。</p>
    </section>

  </div>

  <!-- 右欄 -->
  <div class="col col-3">
    <!-- 右欄本來是三張卡疊起來，高 1472px，而視窗只有 1000px ——
         永遠有東西看不到。改成三個分頁，每一頁都在一屏內。 -->
    <div class="rtabs" id="rtabs" role="tablist" aria-label="右欄分頁"></div>
    <section class="card" data-pane="power">
      <h2>戰力<span class="cap">當前 vs 全滿</span></h2>
      <div class="grad"><b id="grad">–</b><span>畢業率</span></div>
      <div class="gradbar"><i id="gradbar" style="width:0"></i></div>
      <p id="radar-empty" class="hint">配置裝備與詞條後，即可比較屬性。</p>
      <svg class="radar" id="radar" viewBox="0 0 260 216" role="img" aria-label="屬性雷達圖"></svg>
      <div class="legend">
        <span><i style="background:var(--red-soft)"></i>當前</span>
        <span><i style="background:var(--gold)"></i>全部滾滿</span>
      </div>
      <div id="totals"></div>
      <p class="hint">畢業率 ＝ 你填的詞條值 ÷ 這些詞條全部滾滿的值。空著的格子不算分母，所以它衡量的是「已有的裝備滾得好不好」，不是「配齊了沒有」。</p>
    </section>

    <section class="card" data-pane="goal">
      <h2>屬性目標<span class="cap" id="goal-cap">尚未設定</span>
        <button class="more" id="goal-add" type="button">加入屬性</button>
        <button class="more" id="goal-seed" type="button">用目前數值帶入</button>
      </h2>
      <div class="grad"><b id="goal-rate">–</b><span>達成率</span></div>
      <div class="gradbar"><i id="goalbar" style="width:0"></i></div>
      <div id="goals"></div>
      <p class="hint">目標是<b>你自己訂的</b>。畢業率回答「裝備滾得好不好」，答不了「這樣夠不夠打」——
        夠不夠得跟一個目標比，而那個目標只有你知道要打什麼、卡哪條線。<br>
        每一條算 min(1, 你的值 ÷ 目標)，整體取平均；封頂在 100% 是刻意的，
        某條超標三倍不該把還沒達標的蓋過去。</p>
    </section>

    <section class="card" data-pane="sheet">
      <!-- 這一頁的終點就是報名，所以這一區要一眼看出「是誰的、還差什麼、按哪裡送出」。
           原本只是一塊「報名欄位」：一段文字、三顆同重量的小鈕、一個要自己打代號的框。 -->
      <h2>準備報名<span class="cap" id="reg-who">—</span></h2>

      <!-- 還差什麼。完成不是一個感覺，是四個數字。 -->
      <ul class="ready" id="ready"></ul>

      <label class="reg-fld" for="slug">
        <span>賽事代號</span>
        <input id="slug" type="text" placeholder="例 bai-ye" spellcheck="false"
               autocomplete="off" enterkeyhint="go">
      </label>
      <button class="reg-go" id="btn-go" type="button">帶入配置並前往報名</button>
      <p class="hint" id="reg-why"></p>
      <p class="warn" id="warn" hidden></p>

      <details class="reg-adv">
        <summary>帶入報名表的文字</summary>
        <pre class="sheet" id="sheet"></pre>
        <div class="mini">
          <button data-copy>複製文字</button>
          <button data-export>匯出 JSON</button>
          <button data-reset>清空</button>
        </div>
      </details>
    </section>
  </div>
  <!-- 浮層放在 <main> 裡面。它是 position:fixed，放哪裡都不影響版面，
       但放在地標外面就會被算成「散在地標外的內容」（axe 的 region 規則）。
       tooltip 這個 role 不在 region 的豁免清單裡，所以要靠位置解決。 -->
  <div class="tip" id="tip" role="tooltip" aria-hidden="true"></div>
</main>

<!-- 挑選 -->
<dialog class="pick" id="pick" role="dialog" aria-modal="true" aria-labelledby="pick-title">
  <div class="pick-box">
    <div class="pbh">
      <h3 id="pick-title">選擇</h3>
      <input type="search" id="pick-q" placeholder="搜尋" spellcheck="false">
      <div class="filters" id="pick-filters"></div>
      <button class="pick-close" id="pick-close" aria-label="關閉">×</button>
    </div>
    <p class="pick-note" id="pick-note" hidden></p>
    <div class="grid" id="pick-grid"></div>
    <div class="pick-foot" id="pick-foot" hidden>
      <input type="text" id="pick-custom" placeholder="清單沒有？自己打一個">
      <button id="pick-add">加入</button>
      <button class="clear" id="pick-clear">清空這格</button>
    </div>
  </div>
</dialog>

<!-- 確認框。**不用原生的 confirm()** —— Chrome 連跳幾次之後會給使用者
     一個「不要讓這個網頁再建立對話方塊」的勾選框，勾了之後 confirm() 直接回 false，
     按鈕就變成完全沒反應也沒訊息。自己畫一個就不會被瀏覽器關掉。 -->
<dialog class="pick" id="ask" role="alertdialog" aria-modal="true" aria-labelledby="ask-title" aria-describedby="ask-body">
  <div class="pick-box ask-box"
      >
    <div class="pbh">
      <h3 id="ask-title">請確認</h3>
      <button class="pick-close" id="ask-x" aria-label="關閉">×</button>
    </div>
    <div class="ask-body" id="ask-body"></div>
    <div class="pick-foot">
      <button id="ask-no">取消</button>
      <button id="ask-yes" class="ok">確定</button>
    </div>
  </div>
</dialog>

<!-- 屬性來源明細：總計拆回四個來源 -->
<dialog class="pick" id="src" role="dialog" aria-modal="true" aria-labelledby="src-title">
  <div class="pick-box src-box">
    <div class="pbh">
      <h3 id="src-title">屬性來源明細</h3>
      <button class="pick-close" id="src-close" aria-label="關閉">×</button>
    </div>
    <p class="src-sub">照武學、心法、套裝、裝備屬性的順序，列出這份方案的每個數字是誰給的。</p>
    <!-- tabindex 是必要的：這一塊會捲，不能聚焦的話只有滑鼠捲得動，
         鍵盤使用者根本到不了下面那幾層。 -->
    <div class="src-body" id="src-body" tabindex="0" role="group" aria-label="屬性來源"></div>
    <div class="pick-foot">
      <button id="src-ok" class="ok">關閉</button>
    </div>
  </div>
</dialog>

<!-- 快速添加：照預設一次補一整套 -->
<dialog class="pick" id="qadd" role="dialog" aria-modal="true" aria-labelledby="qadd-title">
  <div class="pick-box qadd-box">
    <div class="pbh">
      <h3 id="qadd-title">快速添加</h3>
      <button class="pick-close" id="qadd-close" aria-label="關閉">×</button>
    </div>
    <div class="qadd-bar">
      <label class="qadd-fld"><span>流派</span><select id="qadd-build"></select></label>
      <div class="qadd-modes" id="qadd-modes" role="group" aria-label="預設模式"></div>
      <button id="qadd-all" type="button">全選</button>
      <button id="qadd-none" type="button">取消全選</button>
    </div>
    <!-- 同上：手機一欄八張卡一定要捲。 -->
    <div class="qadd-grid" id="qadd-grid" tabindex="0" role="group" aria-label="要加入的裝備"></div>
    <p class="hint" id="qadd-note" style="margin:10px 15px 0"></p>
    <div class="pick-foot">
      <button id="qadd-cancel">取消</button>
      <button id="qadd-ok" class="ok">加入倉庫</button>
    </div>
  </div>
</dialog>

<!-- 裝備編輯 -->
<dialog class="pick" id="edit" role="dialog" aria-modal="true" aria-labelledby="edit-title">
  <div class="pick-box">
    <div class="pbh">
      <h3 id="edit-title">修改裝備</h3>
      <button class="pick-close" id="edit-close" aria-label="關閉">×</button>
    </div>
    <div class="ed-wrap">
      <!-- 紙娃娃：邊調邊看。窄螢幕會落到表單上面，不會被擠掉 -->
      <aside class="ed-side" id="edit-side"></aside>
      <div class="ed" id="edit-body"></div>
    </div>
    <p id="edit-feedback" class="edit-feedback" role="status"></p>
    <div class="pick-foot">
      <button id="edit-clear" class="clear">清空這件</button>
      <button id="edit-cancel">取消</button>
      <button id="edit-save" class="ok">儲存</button>
    </div>
  </div>
</dialog>

<!-- 武器套裝・弓箭・武庫。三個分區一個彈窗，照工具站那個。 -->
<dialog class="pick" id="eqsel" role="dialog" aria-modal="true" aria-labelledby="eqsel-title">
  <div class="pick-box eqsel-box">
    <div class="pbh">
      <h3 id="eqsel-title">選擇武器套裝、弓箭與武庫</h3>
      <button class="pick-close" id="eqsel-close" aria-label="關閉">×</button>
    </div>
    <div class="ed" id="eqsel-body"></div>
    <div class="pick-foot">
      <button id="eqsel-cancel">取消</button>
      <button id="eqsel-ok" class="ok">確認</button>
    </div>
  </div>
</dialog>

<!-- 匯入 / 匯出 -->
<dialog class="pick" id="io-modal" role="dialog" aria-modal="true" aria-labelledby="io-title">
  <div class="pick-box" style="width:min(680px,100%)">
    <div class="pbh">
      <h3 id="io-title">匯入 / 匯出</h3>
      <button class="pick-close" id="io-close" aria-label="關閉">×</button>
    </div>
    <div class="grid io" id="io-body" style="display:block;padding:0"></div>
    <div class="pick-foot" id="io-foot"></div>
  </div>
</dialog>

<!-- 角色管理 -->
<dialog class="pick" id="roles-modal" role="dialog" aria-modal="true" aria-labelledby="rm-title">
  <div class="pick-box" style="width:min(640px,100%)">
    <div class="pbh">
      <h3 id="rm-title">角色管理</h3>
      <button class="pick-close" id="rm-close" aria-label="關閉">×</button>
    </div>
    <div class="rm" id="rm-body"></div>
    <div class="pick-foot">
      <button id="rm-delete" class="danger">刪除角色</button>
      <button id="rm-cancel" style="margin-left:auto">取消</button>
      <button id="rm-save" class="save">保存</button>
    </div>
  </div>
</dialog>

<!-- 匯入 / 規則 -->
<dialog class="pick" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="pick-box">
    <div class="pbh">
      <h3 id="modal-title">說明</h3>
      <button class="pick-close" id="modal-close" aria-label="關閉">×</button>
    </div>
    <div class="grid io" id="modal-body" tabindex="0" role="region" aria-labelledby="modal-title"></div>
    <div class="pick-foot" id="modal-foot" hidden><button id="modal-ok" class="ok">匯入</button></div>
  </div>
</dialog>

<!-- aria-label 是預設名字；真的打開時 openPop() 會換成那次的標題。
     role=dialog 沒有名字，螢幕報讀器只會唸「對話方塊」。 -->
<!-- 手機的分區列。桌機不出現（三欄本來就同時看得到）。
     固定在底部是因為拇指構得到；padding-bottom 要吃 safe-area，
     不然在有 home indicator 的機型上最後一排會被蓋住。 -->
<nav class="secbar" id="secbar" aria-label="分區" hidden></nav>

<dialog class="pop" id="pop" role="dialog" aria-modal="true" aria-label="選擇"><div class="pop-box" id="pop-box"></div></dialog>
<!-- role=status：它就是狀態訊息，這樣螢幕報讀器才會唸出來
     （而且有角色的元素不會被算成「散在地標外面的內容」）。 -->
<div class="toast" id="toast" role="status" aria-live="polite"></div>

<!-- ?v= 是快取破除。改完 js 忘了帶版本，瀏覽器會繼續用舊的，
     畫面對不上程式碼，很難查。改 js 時一起把這個數字換掉。 -->
`;

// 內容雜湊，給 <link> 與 <script> 當 ?v= 破快取用。
export const LOADOUT_VERSION = "77ed090f87";

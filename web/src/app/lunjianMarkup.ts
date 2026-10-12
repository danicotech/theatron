// 由 scrollcraft/builds/lunjian/lab/tools/to-theatron.py 生成，不要手改。
// 來源是 lab/lunjian-layout.html 的 <body>；改版面請改那一份再重跑腳本。
export const LUNJIAN_REVISION = "e23f970747ef";
export const LUNJIAN_MARKUP = String.raw`

<a class="visually-hidden skip-link" href="#main">跳到內容</a>

<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="ink-rough" x="-14%" y="-14%" width="128%" height="128%"
          filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
    <!-- 紙的纖維把墨的邊緣咬開。參數沿 theatron InkFilters：
         baseFrequency .013/.028、4 octaves、seed 4713、位移 26。 -->
    <feTurbulence type="fractalNoise" baseFrequency="0.013 0.028" numOctaves="4" seed="4713" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="bleed-edge" x="-35%" y="-35%" width="170%" height="170%">
    <!-- 墨在生宣上不是圓的，是沿著纖維爬。把顯影的邊緣推歪，
         它就從「一個圓在放大」變成「墨在化開」。 -->
    <feTurbulence type="fractalNoise" baseFrequency="0.0055 0.0075" numOctaves="4" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="150" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="paper-edge" x="-6%" y="-4%" width="112%" height="108%">
    <!-- 手撕紙邊：clip-path 切出來的鋸齒太規則，用低頻位移把它揉亂 -->
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="2" seed="5" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="ink-jh" x="-40%" y="-40%" width="180%" height="180%"
          filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB">
    <!-- 真正的墨，順序是有理由的：

         1 濕  feGaussianBlur 讓墨往外漲，相鄰筆畫開始互相黏。
         2 收  feColorMatrix 把 alpha 乘上去再減掉（斜率 19、截距 -8），
               把柔邊逼回硬邊。這兩步合起來就是 gooey filter 的原理，
               用在墨上比用在泡泡上更對：墨在生宣上就是先漲再定。
         3 糙  **收完之後**才用紙纖維把輪廓推歪。先糙後收會被模糊磨平，
               那是我第一版錯的地方。
         4 枯  沿筆勢的細長雜訊挖掉一部分＝飛白。
         5 暈  外緣留一圈很淡的水痕。

         RGB 用單位矩陣保色，只動 alpha；color-interpolation-filters="sRGB"
         是必要的，不然模糊會在預乘色域裡把邊緣壓黑。 -->
    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="wet"/>
    <feColorMatrix in="wet" type="matrix"
                   values="1 0 0 0 0
                           0 1 0 0 0
                           0 0 1 0 0
                           0 0 0 26 -12" result="swollen"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="3" seed="7" result="fib"/>
    <feDisplacementMap in="swollen" in2="fib" scale="7"
                       xChannelSelector="R" yChannelSelector="G" result="ragged"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.075" numOctaves="3" seed="23" result="streak"/>
    <feColorMatrix in="streak" type="matrix"
                   values="0 0 0 0 0
                           0 0 0 0 0
                           0 0 0 0 0
                           4.1 0 0 0 -3.05" result="dry"/>
    <feComposite in="ragged" in2="dry" operator="out" result="inked"/>
    <feGaussianBlur in="inked" stdDeviation="14" result="halo"/>
    <feColorMatrix in="halo" type="matrix"
                   values="1 0 0 0 0
                           0 1 0 0 0
                           0 0 1 0 0
                           0 0 0 .28 0" result="haloSoft"/>
    <feMerge><feMergeNode in="haloSoft"/><feMergeNode in="inked"/></feMerge>
  </filter>
</svg>
<!-- 3D 場地。模組是從 KAGE-STYLE-PREVIEW.html 的 importmap 拆出來的真實檔案
     （tools/extract-3d.md 有拆法），所以這裡可以逐檔改，不用再動那個 18MB 的單檔。 -->
<canvas id="world" aria-hidden="true"></canvas>
<!-- 開場：一面背光的殘旗。點它就燒起來，燒完才入關。
     只有 3D 跑得起來時才掛（stage3d.js 負責開關），因為旗是場景裡的布料模擬。 -->
<!-- 開場：一面背光的殘旗，後面兩道人影。點畫面上任何一點，火就從那一點起。
     沒有按鈕、沒有說明 —— 一圈一圈擴出去的環就是「這裡可以點」的全部訊息。 -->
<div id="boot" data-state="loading" role="dialog" aria-modal="true" aria-label="論劍序幕" tabindex="-1" hidden>
  <div class="boot-fallback" aria-hidden="true"><picture><source id="boot-duel-portrait" media="(max-aspect-ratio: 1/1)" srcset="/lunjian/art/intro-duel-mobile.png"><img id="boot-duel" src="/lunjian/art/intro-duel.png" alt=""></picture><div class="boot-fabric"><span class="boot-shadow boot-shadow-left"></span><span class="boot-shadow boot-shadow-right"></span></div><img id="boot-shadows" src="/lunjian/art/curtain-figures.webp" alt="" hidden></div>
  <div class="boot-loading">
    <div class="boot-core">
      <canvas class="boot-mark" width="580" height="600" role="img" aria-label="疏影越月：梅枝、山峰與月環"></canvas>
      <div class="boot-signature"><p class="boot-title">夜鴨爭鋒</p><span class="boot-seal" aria-hidden="true">夜鴨閣</span></div>
      <div class="boot-meter"><progress id="load-progress" value="0" max="100" aria-label="場景準備進度"></progress><canvas class="boot-plume" width="1140" height="180" aria-hidden="true"></canvas><div class="boot-caption"><span id="load-label" role="status">展開江湖</span><span class="boot-percent"><b id="load-number">0</b>%</span></div></div>
    </div>
  </div>
  <button id="ignite" type="button" disabled aria-label="點擊畫面，點燃布幕"><span class="ignite-prompt"><span class="ignite-mark" aria-hidden="true"></span><span id="boot-hint">點擊畫面，點燃布幕</span><span class="ignite-note" aria-hidden="true">CLICK TO IGNITE</span></span></button>
</div>
<div id="scene-shade" aria-hidden="true"></div>

<div id="stage" aria-hidden="true">
  <div class="shot" data-shot="0" data-anchor="center"><img class="bg" src="/lunjian/art/bg/kuwahara/scene-gate.webp" alt="" width="1672" height="941" decoding="async" style="object-position:50% 46%;filter:saturate(.92) brightness(1.02)"><img class="snow-far" src="/lunjian/art/bg/fx-snow-far.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="snow-near" src="/lunjian/art/bg/fx-snow-near.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><span class="scrim"></span></div>
  <div class="shot" data-shot="1" data-anchor="right"><img class="bg" src="/lunjian/art/bg/kuwahara/scene-lodge.webp" alt="" width="1672" height="941" decoding="async" loading="lazy" style="object-position:58% 52%;filter:saturate(.9)  brightness(1.06)"><img class="snow-far" src="/lunjian/art/bg/fx-snow-far.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="snow-near" src="/lunjian/art/bg/fx-snow-near.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="petals" src="/lunjian/art/bg/fx-petals.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><span class="scrim"></span></div>
  <div class="shot" data-shot="2" data-anchor="left"><img class="bg" src="/lunjian/art/bg/kuwahara/scene-hall.webp" alt="" width="1672" height="941" decoding="async" loading="lazy" style="object-position:46% 44%;filter:saturate(.88) brightness(1.0)"><img class="snow-far" src="/lunjian/art/bg/fx-snow-far.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="snow-near" src="/lunjian/art/bg/fx-snow-near.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><span class="scrim"></span></div>
  <div class="shot" data-shot="3" data-anchor="bottom"><img class="bg" src="/lunjian/art/bg/kuwahara/scene-arena.webp" alt="" width="1672" height="941" decoding="async" loading="lazy" style="object-position:50% 58%;filter:saturate(.82) brightness(.94)"><img class="snow-far" src="/lunjian/art/bg/fx-snow-far.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="snow-near" src="/lunjian/art/bg/fx-snow-near.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><span class="scrim"></span></div>
  <div class="shot" data-shot="4" data-anchor="right"><img class="bg" src="/lunjian/art/bg/kuwahara/scene-crow.webp" alt="" width="1672" height="941" decoding="async" loading="lazy" style="object-position:52% 50%;filter:saturate(.95) brightness(1.04)"><img class="snow-far" src="/lunjian/art/bg/fx-snow-far.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="snow-near" src="/lunjian/art/bg/fx-snow-near.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><span class="scrim"></span></div>
  <div class="shot" data-shot="5" data-anchor="left"><img class="bg" src="/lunjian/art/bg/kuwahara/scene-approach.webp" alt="" width="1672" height="941" decoding="async" loading="lazy" style="object-position:46% 58%;filter:saturate(.86) brightness(1.16)"><img class="snow-far" src="/lunjian/art/bg/fx-snow-far.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="snow-near" src="/lunjian/art/bg/fx-snow-near.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><span class="scrim"></span></div>
  <div class="shot" data-shot="6" data-anchor="right"><img class="bg" src="/lunjian/art/bg/kuwahara/scene-door.webp" alt="" width="1672" height="941" decoding="async" loading="lazy" style="object-position:50% 54%;filter:saturate(.94) brightness(1.20)"><img class="snow-far" src="/lunjian/art/bg/fx-snow-far.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="snow-near" src="/lunjian/art/bg/fx-snow-near.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><img class="petals" src="/lunjian/art/bg/fx-petals.webp" alt="" width="1672" height="941" decoding="async" loading="lazy"><span class="scrim"></span></div>
</div>

<div class="foreground" id="foreground" aria-hidden="true"></div>
<div class="grid-title-wrap" id="grid-title-wrap" aria-hidden="true">
  <p class="grid-title-kicker"><span class="no" id="grid-title-no">01</span><span class="en" id="grid-title-en"></span></p>
  <div class="grid-title ink-title" id="grid-title"></div>
</div>
<div id="vignette" aria-hidden="true"></div>

<header class="site-header">
  <div class="header-inner">
  <a class="brand" href="/home" aria-label="百業試鋒首頁">
    <span class="brand-seal" aria-hidden="true">劍</span>
    <span>論劍<small class="mono">LUNJIAN</small></span>
  </a>
  <nav class="site-nav" aria-label="主要導覽">
    <a href="#prologue">宗旨</a><a href="#rules">規則說明</a><a href="#invitation">讓武</a><a href="#register">報名</a><a href="#duel">比武</a><a href="#schedule">賽程</a><a href="#rewards">獎賞</a>
  </nav>
  <div class="header-actions">
    <a class="nav-loadout" data-loadout href="/loadout">我的武學配置</a>
    <a class="nav-activity" data-activity-cta href="#rules">查看賽制</a>
    <button type="button" class="nav-sports" data-sports-center aria-label="會員專區"><span data-member-label>會員專區</span><small data-sports-member>登入／註冊</small></button>
    <details class="nav-more"><summary aria-label="更多選單">更多</summary>
      <div class="nav-menu">
        <a data-activity-cta href="#rules">查看賽制</a>
        <a data-loadout href="/loadout">我的武學配置 ↗</a>
        <a href="#duel">比武 · 觀局雅集 ↗</a>
        <button type="button" data-match-tools>對局小工具</button>
        <button type="button" data-reading-toggle aria-pressed="false">靜態閱讀</button>
        <a data-manager-only class="motion-study-link" href="/lunjian/motion-study.html">墨韻版本試映 ↗</a>
        <div data-manager-only class="phase-pick" role="group" aria-label="賽事階段（示範）">
    <button data-phase="signup" aria-pressed="true">報名前</button>
    <button data-phase="live" aria-pressed="false">進行中</button>
    <button data-phase="finished" aria-pressed="false">頒獎</button>
  </div>
      </div>
    </details>
  </div>
  </div>
</header>

<main id="main">

  <!-- 0 宗旨 -->
  <section id="prologue" class="chapter hero manga-chapter" data-shot="0" style="--span:1" aria-labelledby="prologue-title" data-on data-layout="editorial">
    <div class="chapter-sticky" tabindex="0" role="region" aria-label="宗旨漫畫與全文，可上下捲動">
      <div id="wordmark" class="hero-wordmark" aria-hidden="true" hidden></div>
      <div class="manga-page manga-purpose">
        <header class="manga-heading"><h1 id="hero-name" class="visually-hidden">百業試鋒</h1><h2 id="prologue-title" class="chapter-heading-label"><span class="chapter-calligraphy" data-chapter-title="宗旨" data-chapter-seal="序" style="--title-chars:2" aria-hidden="true">宗旨</span><span class="visually-hidden">宗旨</span></h2></header>
        <div class="comic-board purpose-board" aria-label="宗旨四格漫畫">
          <figure class="ink-frame frame-novice" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="figure-window"><div class="figure-layer novice-close" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-eyes.webp" width="1536" height="1024" alt="" loading="lazy"></div></div><div class="foreground-layer pine-layer" data-comic-layer="foreground" aria-hidden="true"><img src="/lunjian/art/manga-pine-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-caption"><small>一 · 初入江湖</small><h3>我，才剛開始。</h3></figcaption></figure>
          <figure class="ink-frame frame-veteran" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="figure-window"><div class="figure-layer veteran-solo" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-veteran-layer.webp" width="1024" height="1536" alt="" loading="lazy"></div></div><div class="foreground-layer pine-layer" data-comic-layer="foreground" aria-hidden="true"><img src="/lunjian/art/manga-pine-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-caption"><small>二 · 歷經千戰</small><h3>他，早已身經百戰。</h3></figcaption></figure>
          <figure class="ink-frame frame-stage" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="figure-layer novice-breakout" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-breakout.webp" width="1024" height="1536" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-speech"><small>三 · 以讓武，補上差距</small><h3>這一場，<br>也包括<br><em>現在的你。</em></h3><p>拿走高手的慣用手段，<br>讓新人的本事有機會出場。</p></figcaption></figure>
          <figure class="ink-frame frame-resolve" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-gate.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="figure-window"><div class="figure-layer novice-pair" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-breakout.webp" width="1024" height="1536" alt="" loading="lazy"></div><div class="figure-layer veteran-pair" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-veteran-layer.webp" width="1024" height="1536" alt="" loading="lazy"></div></div><div class="foreground-layer pine-layer" data-comic-layer="foreground" aria-hidden="true"><img src="/lunjian/art/manga-pine-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-caption"><small>四 · 同場試鋒</small><h3>不因段位拒絕任何人。<br>也不要求任何人假裝變弱。</h3></figcaption></figure>
        </div>
        <p class="manga-small manga-conclusion">不是只找最強的人，而是讓不同程度的人，認真打一場。</p>
        <details class="manga-fulltext"><summary>讀完整宗旨 <span>辦賽理念與邀請</span></summary><div class="document-body purpose-copy">
          <h3>我們為什麼想辦「百業試鋒」？</h3>
          <p>百業裡有人打了幾千場論劍，也有人幾乎沒有接觸過對戰。如果只是按照原本的實力直接交手，很多比賽其實在開始以前，大家心裡就已經知道結果了。</p>
          <p>但我們覺得，這樣有點可惜。</p>
          <p>試鋒不是為了找出「誰最強」，也不是只有高手才有資格參加。我們更想做的，是讓不同程度的人都有理由走進場上，真正和彼此打一場。</p>
          <p>所以我們設計了段位與「讓武」規則。實力差距越大，較低段位的一方就能取得更多 BP，限制高手原本擅長的武器、技能、操作方式，甚至改變勝利條件。</p>
          <p>這不是要高手故意放水，也不保證較弱的一方一定能贏。高手依然要全力取勝，只是必須在更多限制之下重新想辦法；經驗較少的人，也不再只是上場等著被輾過，而是真的有機會把自己會的東西打出來。</p>
          <p class="document-emphasis"><strong>所以，不管你是打了幾千場的老手，還是幾乎沒碰過論劍的新人，我們都希望你來。</strong></p>
          <p>對高手來說，這是一場把慣用手段拿走之後，看看自己還剩多少本事的挑戰；對新手來說，這是一個不用先變成高手，也能和大家一起玩的機會。</p>
          <p>我們希望最後大家記得的，不只是誰拿了第一名，而是那些平常根本不可能出現的對局——高手被逼著用陌生的方法解題，新手第一次真的逼高手認真應戰，同門之間也因此多了一場值得笑、值得聊、甚至值得再約一次的比賽。</p>
          <p>這就是我們想辦「百業試鋒」的原因。</p>
          <p class="document-creed"><strong>不因段位拒絕任何人，也不要求任何人假裝變弱。</strong><br>讓不同程度的人，都能在同一個場上，各自試試自己的鋒芒。</p>
        </div></details>
        <nav class="chapter-nav" data-chapter-pagination aria-label="宗旨章節導覽"><a class="chapter-nav__link chapter-nav__link--prev" href="/home" aria-label="返回：首頁"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">返回</span><span class="chapter-nav__title">首頁</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#rules" aria-label="下一章：規則說明"><span class="chapter-nav__text"><span class="chapter-nav__direction">下一章</span><span class="chapter-nav__title">規則說明</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
      </div>
    </div>
  </section>

  <!-- 1 規則說明 -->
  <section id="rules" class="chapter manga-chapter" data-shot="2" data-layout="editorial" style="--span:1.2" aria-labelledby="rules-title">
    <div class="chapter-sticky" tabindex="0" role="region" aria-label="規則漫畫與全文，可上下捲動">
      <div class="manga-page rule-table">
        <header class="manga-heading"><h2 id="rules-title" class="chapter-heading-label"><span class="chapter-calligraphy" data-chapter-title="規則說明" data-chapter-seal="壹" style="--title-chars:4" aria-hidden="true">規則說明</span><span class="visually-hidden">規則說明</span></h2></header>
        <div class="comic-board rules-board" aria-label="規則三格漫畫">
          <figure class="ink-frame frame-assess" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="figure-layer judge-layer" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-judge.webp" width="1024" height="1536" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-caption"><small>一 · 報名，評段</small><h3>先看實力與經驗。</h3><p>大會依實際 PVP 能力分段。<br>開山 → 斷水 → 飛花 → 無我</p></figcaption></figure>
          <figure class="ink-frame frame-limit" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="foreground-layer closeup-layer" data-comic-layer="foreground" aria-hidden="true"><img src="/lunjian/art/manga-surrender-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-caption"><small>二 · 讓武，補上差距</small><h3>每差一段，8 BP。</h3><p>低段位者選擇限制，<br>高段位者換個方法取勝。</p></figcaption></figure>
          <figure class="ink-frame frame-battle" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="figure-window"><div class="figure-layer novice-pair" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-breakout.webp" width="1024" height="1536" alt="" loading="lazy"></div><div class="figure-layer veteran-pair" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-veteran-layer.webp" width="1024" height="1536" alt="" loading="lazy"></div></div><figcaption data-comic-layer="caption" class="frame-caption"><small>三 · 隨機配對，階梯式晉級</small><h3><b>BO3</b>，先取兩勝。</h3><p>最終取前四。<strong>讓武配置，三局固定。</strong></p></figcaption></figure>
        </div>
        <section data-manager-only class="manga-bp" aria-labelledby="bp-demo-title">
          <div><p class="manga-kicker">試試看 · 段位差</p><h3 id="bp-demo-title">這一戰，可以讓多少？</h3><div class="bp-options" role="group" aria-label="選擇段位差"><button type="button" data-bp-gap="0" aria-pressed="false">同段</button><button type="button" data-bp-gap="1" aria-pressed="false">差 1 段</button><button type="button" data-bp-gap="2" aria-pressed="true">差 2 段</button><button type="button" data-bp-gap="3" aria-pressed="false">差 3 段</button></div></div>
          <div class="bp-result" id="comic-bp-result" role="status" aria-live="polite"><p id="comic-bp-owner">低段位者取得</p><p><strong id="comic-bp-output">16</strong> <span>BP</span></p><p id="comic-bp-note">高段位者依配置接受限制。</p></div>
        </section>
        <p class="manga-referee">開賽前公開確認配置，由裁判檢查設定。<strong>雙方全力取勝，不得放水。</strong></p>
        <button type="button" class="rules-open" aria-haspopup="dialog" aria-controls="rules-dialog">查看完整規則 <span>五節 · 含裁判與爭議處理</span></button>
        
        <dialog id="rules-dialog" class="rules-dialog" aria-labelledby="rules-dialog-title"><header><h2 id="rules-dialog-title">完整規則</h2><button type="button" data-rules-close aria-label="關閉完整規則">×</button></header><div class="document-body rules-copy">
          <article class="rule-section" aria-labelledby="rule-part-1">
            <h3 id="rule-part-1"><span>一</span> 參賽與段位</h3>
            <p>百業試鋒不設實力門檻，所有成員皆可報名參加。</p>
            <p>報名後，由大會依選手實際 PVP 實力與經驗，裁定為「無我、飛花、斷水、開山」四個段位之一。</p>
            <p>試鋒段位不是榮譽、排名或永久實力評價，主要用途是衡量雙方實力差距，並計算讓武 BP。</p>
          </article>
          <article class="rule-section" aria-labelledby="rule-part-2">
            <h3 id="rule-part-2"><span>二</span> 讓武原則</h3>
            <p>同段位交手不進行讓武；每相差一個段位，較低段位者獲得 <strong>8 BP</strong>。</p>
            <table class="bp-scale"><caption>段位差與讓武額度</caption><thead><tr><th scope="col">同段</th><th scope="col">差 1 段</th><th scope="col">差 2 段</th><th scope="col">差 3 段</th></tr></thead><tbody><tr><td>0 BP</td><td>8 BP</td><td>16 BP</td><td>24 BP</td></tr></tbody></table>
            <p>BP 僅由較低段位的一方取得，並於賽前用來選擇對高段位者施加的限制。</p>
            <p>讓武不保證低段位者獲勝，也不是要求高段位者放水。雙方仍須以取勝為目的，全力完成比賽。</p>
            <p>各項 BP 限制與執行方式，請至<a href="#invitation">「讓武」頁</a>查看。</p>
          </article>
          <article class="rule-section" aria-labelledby="rule-part-3">
            <h3 id="rule-part-3"><span>三</span> 賽制與晉級</h3>
            <p>參賽者完成分段後，由大會進行隨機配對。</p>
            <p>每組對決採 <strong>BO3</strong>，率先取得兩勝者取得該場勝利。</p>
            <p>賽事採階梯式方式進行，最終取前四名，依序為：</p>
            <ol class="placing-list"><li>冠軍</li><li>亞軍</li><li>季軍</li><li>殿軍</li></ol>
            <p class="document-emphasis"><strong>每組對決的讓武配置於 BO3 開始前一次決定，三局全程固定，不得於局間重新配置。</strong></p>
          </article>
          <article class="rule-section" aria-labelledby="rule-part-4">
            <h3 id="rule-part-4"><span>四</span> 比賽執行</h3>
            <p>讓武配置於賽前公開確認。需要修改武學、技能、按鍵、裝備或其他設定的項目，必須於開賽前依裁判指示完成。</p>
            <p>裁判確認雙方設定符合規則後，方可正式開始比賽。</p>
            <p>高段位者即使受到讓武限制，仍必須正常比賽並全力取勝；不得以讓武為由故意放水。</p>
            <p>比賽中涉及特殊限制、特殊勝利條件或需要目視認定的情況，均由當場裁判負責判定。</p>
          </article>
          <article class="rule-section" aria-labelledby="rule-part-5">
            <h3 id="rule-part-5"><span>五</span> 裁判與爭議</h3>
            <p>裁判負責配對抽籤、讓武配置確認、限制執行、特殊勝利條件以及比賽結果的認定。</p>
            <p><strong>裁判不得僅因限制組合過於強勢，而否決合法的 BP 配置。</strong></p>
            <p>僅當限制效果實際重疊、因遊戲機制造成未預期的額外限制，或使另一項已支付 BP 的限制完全失去作用時，裁判得要求重新配置。</p>
            <p>操作難度提高、慣用連段失效、戰術價值下降，或替代方案變差，本身不視為 BP 效果重疊。</p>
            <p>如比賽中發生規則未明確涵蓋的情況，由裁判依本屆試鋒規則與讓武原則進行仲裁，並以裁判最終判定為準。</p>
          </article>
          <nav class="chapter-nav" aria-label="完整規則相關章節"><a class="chapter-nav__link chapter-nav__link--prev" href="#prologue" aria-label="上一章：宗旨"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">上一章</span><span class="chapter-nav__title">宗旨</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#invitation" aria-label="下一章：讓武"><span class="chapter-nav__text"><span class="chapter-nav__direction">下一章</span><span class="chapter-nav__title">讓武</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
        </div></dialog>
        <nav class="chapter-nav" data-chapter-pagination aria-label="規則說明章節導覽"><a class="chapter-nav__link chapter-nav__link--prev" href="#prologue" aria-label="上一章：宗旨"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">上一章</span><span class="chapter-nav__title">宗旨</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#invitation" aria-label="下一章：讓武"><span class="chapter-nav__text"><span class="chapter-nav__direction">下一章</span><span class="chapter-nav__title">讓武</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
      </div>
    </div>
  </section>

  <!-- 2 讓武 -->
  <section id="invitation" class="chapter manga-chapter" data-shot="1" data-layout="editorial" style="--span:.9" aria-labelledby="invitation-title">
    <div class="chapter-sticky" tabindex="0" role="region" aria-label="讓武漫畫與分類，可上下捲動">
      <div class="manga-page manga-handicap">
        <header class="manga-heading"><h2 id="invitation-title" class="chapter-heading-label"><span class="chapter-calligraphy" data-chapter-title="讓武" data-chapter-seal="貳" style="--title-chars:2" aria-hidden="true">讓武</span><span class="visually-hidden">讓武</span></h2></header>
        <div class="comic-board handicap-board" aria-label="讓武情境漫畫與分類">
          <figure class="ink-frame frame-pledge" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="foreground-layer closeup-layer" data-comic-layer="foreground" aria-hidden="true"><img src="/lunjian/art/manga-surrender-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-caption"><small>一 · 接下限制</small><h3>少了慣用招式，<br>我還有別的辦法。</h3></figcaption></figure>
          <figure class="ink-frame frame-tools" data-comic-frame><div class="frame-art"><img data-comic-layer="scene" src="/lunjian/art/manga-courtyard-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><div class="foreground-layer closeup-layer" data-comic-layer="foreground" aria-hidden="true"><img src="/lunjian/art/manga-referee-layer.webp" width="1536" height="1024" alt="" loading="lazy"></div><figcaption data-comic-layer="caption" class="frame-caption"><small>二 · 賽前公開確認</small><h3>條件，由你來選。</h3></figcaption></figure>
          <section class="manga-catalog" data-comic-frame aria-labelledby="handicap-catalog-title">
            <p class="manga-kicker">六類限制 · 36 項</p>
            <h3 id="handicap-catalog-title">由你，出題。</h3>
            <ol class="handicap-categories" aria-label="讓武限制分類">
              <li><a href="#handicap-group-weapon"><span>武器限制</span><b>5 <small>項</small></b></a></li>
              <li><a href="#handicap-group-skill"><span>技能限制</span><b>8 <small>項</small></b></a></li>
              <li><a href="#handicap-group-movement"><span>防禦與位移限制</span><b>6 <small>項</small></b></a></li>
              <li><a href="#handicap-group-poison"><span>下毒</span><b>4 <small>項</small></b></a></li>
              <li><a href="#handicap-group-victory"><span>勝利條件</span><b>6 <small>項</small></b></a></li>
              <li><a href="#handicap-group-rule"><span>規則限制</span><b>7 <small>項</small></b></a></li>
            </ol>
            <details class="handicap-group" id="handicap-group-weapon">
              <summary><span>武器限制</span><b>5 項</b></summary>
              <article class="handicap-item">
                <h4><span class="handicap-cost">20 BP</span> 指定對手武學</h4>
                <div class="handicap-description">
                  <p>你可以指定對手的武學組合。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">12 BP</span> 隨機武學</h4>
                <div class="handicap-description">
                  <p>對手的武學將被裁判隨機指定。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">12 BP</span> 禁止切換武器</h4>
                <div class="handicap-description">
                  <p>對手的切換武器按鍵將被裁判要求移除，對手若仍能切換武器則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">5 BP</span> 雙方使用46級武庫武學裝備</h4>
                <div class="handicap-description">
                  <p>雙方一律使用46級武庫的武學裝備。注意：此項對你自己同樣生效。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">2 BP</span> 禁武學特效</h4>
                <div class="handicap-description">
                  <p>對手開賽前必須在設定中關閉。開打後畫面仍出現武學特效則視為違規。</p>
                </div>
              </article>
            </details>
            <details class="handicap-group" id="handicap-group-skill">
              <summary><span>技能限制</span><b>8 項</b></summary>
              <article class="handicap-item">
                <h4><span class="handicap-cost">24 BP</span> 禁用兩種技能（特殊技、武學技）</h4>
                <div class="handicap-description">
                  <p>對手的特殊技、武學技按鍵將被裁判要求移除，對手若仍能使用特殊技、武學技則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">16 BP</span> 禁用奇術</h4>
                <div class="handicap-description">
                  <p>對手全場無法使用任何奇術。若同時買了「禁用任意奇術」，將經裁判確認後返還禁用任意奇術的 BP。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">12 BP</span> 禁用一種技能（特殊技、武學技）</h4>
                <div class="handicap-description">
                  <p>對手的特殊技、武學技其中一個按鍵將被裁判要求移除，對手若仍能使用特殊技或武學技則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">12 BP</span> 禁用普通攻擊</h4>
                <div class="handicap-description">
                  <p>對手只能靠技能造成傷害。攻擊鍵的基礎攻擊被裁判要求移除，對手若仍能觸發普通攻擊則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">12 BP</span> 禁用重蓄力</h4>
                <div class="handicap-description">
                  <p>對手的重蓄力按鍵將被裁判要求移除，對手若仍能觸發重蓄力則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">8 BP</span> 禁用處決</h4>
                <div class="handicap-description">
                  <p>對手的處決按鍵將被裁判要求移除，對手若仍能觸發處決則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">5 BP</span> 指定並更改技能位子（可重複）</h4>
                <div class="handicap-description">
                  <p>選購時逐次寫下「哪個技能移到哪個鍵位」。</p>
                  <p><em>例：武學技移動到 ALT+4；太白醉月移動到 Q；手把玩家依相對應按鍵調整。</em></p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">3 BP</span> 禁用任意奇術（可重複）</h4>
                <div class="handicap-description">
                  <p>選購時逐次指定一個奇術名稱。裁判將依禁用清單要求對手移除該奇術，對手若仍能觸發該奇術則視為違規。</p>
                </div>
              </article>
            </details>
            <details class="handicap-group" id="handicap-group-movement">
              <summary><span>防禦與位移限制</span><b>6 項</b></summary>
              <article class="handicap-item">
                <h4><span class="handicap-cost">20 BP</span> 禁用移動鍵</h4>
                <div class="handicap-description">
                  <p>對手的移動鍵（預設 WASD）將被裁判要求移除，靠奇術、技能的位移不算違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">8 BP</span> 禁用解控</h4>
                <div class="handicap-description">
                  <p>對手將無法攜帶解控奇術上場，對手若仍能發動解控則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">8 BP</span> 禁用迴避</h4>
                <div class="handicap-description">
                  <p>對手的迴避按鍵將被要求移除，對手若仍能使用迴避則視為違規，奇術、技能的迴避效果不在此限。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">5 BP</span> 禁用卸勢</h4>
                <div class="handicap-description">
                  <p>對手的卸勢按鍵將被要求移除，對手若仍能使用卸勢則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">5 BP</span> 禁用防禦</h4>
                <div class="handicap-description">
                  <p>對手的防禦按鍵將被要求移除，對手若仍能使用防禦則視為違規。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">2 BP</span> 禁跳躍</h4>
                <div class="handicap-description">
                  <p>對手的跳躍按鍵將被要求移除，對手若仍能使用跳躍則視為違規，奇術、技能的跳躍效果不在此限。</p>
                </div>
              </article>
            </details>
            <details class="handicap-group" id="handicap-group-poison">
              <summary><span>下毒</span><b>4 項</b></summary>
              <article class="handicap-item">
                <h4><span class="handicap-cost">24 BP</span> 對手讓出守關元</h4>
                <div class="handicap-description">
                  <p>開局時由對手主動受擊，直到對手觸發守關元後，雙方必須脫離糾纏，接著直接進入正式決鬥。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">24 BP</span> 打亂上下左右鍵</h4>
                <div class="handicap-description">
                  <p>上下左右的打亂方式由裁判隨機指定。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">12 BP</span> 互換任意兩個按鍵</h4>
                <div class="handicap-description">
                  <p>由你指定哪兩個鍵互換，且不限於方向鍵。</p>
                  <p><em>例：Q 跟 ～ 互換；W 跟 Q 互換；S 跟 ALT+4 互換。</em></p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">10 BP</span> 對手讓出半條血量</h4>
                <div class="handicap-description">
                  <p>開局時由對手主動受擊，直到對手血量明顯低於一半時，你必須主動停手並且雙方脫離糾纏，接著才進入正式決鬥。</p>
                </div>
              </article>
            </details>
            <details class="handicap-group" id="handicap-group-victory">
              <summary><span>勝利條件</span><b>6 項</b></summary>
              <article class="handicap-item">
                <h4><span class="handicap-cost">24 BP</span> 撐過90秒即獲勝</h4>
                <div class="handicap-description">
                  <p>你只要撐過90秒並且比賽沒有進入結算畫面，即判定獲勝。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">20 BP</span> 撐過120秒即獲勝</h4>
                <div class="handicap-description">
                  <p>你只要撐過120秒並且比賽沒有進入結算畫面，即判定獲勝。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">16 BP</span> 撐過180秒即獲勝</h4>
                <div class="handicap-description">
                  <p>你只要撐過180秒並且比賽沒有進入結算畫面，即判定獲勝。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">10 BP</span> 時間結束即勝利</h4>
                <div class="handicap-description">
                  <p>時間結束時你仍沒被擊倒，即使結算為對手獲勝，仍判定你獲勝。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">20 BP</span> 對手明顯損失半條血量即落敗</h4>
                <div class="handicap-description">
                  <p>以對手血條掉到一半以下為準，傷害來源不限（含他自己的失誤）。「明顯」由裁判認定；若有爭議即不符合「明顯」原則，將不會判定對手落敗。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">10 BP</span> 打出守關元即勝利</h4>
                <div class="handicap-description">
                  <p>你打出對手的守關元瞬間即獲勝，不必再完成擊倒。</p>
                </div>
              </article>
            </details>
            <details class="handicap-group" id="handicap-group-rule">
              <summary><span>規則限制</span><b>7 項</b></summary>
              <article class="handicap-item">
                <h4><span class="handicap-cost">17 BP</span> 對手不能主動追擊</h4>
                <div class="handicap-description">
                  <p>對手在你脫離接戰後不得向你移動接近；他可以原地防守，也可以反擊你送上門的進攻。</p>
                  <p>脫離判定：透過迴避、卸勢、處決、防禦反擊中斷對手攻勢並主動脫離戰鬥，即完成脫離。</p>
                  <p><em>在比賽可看性以及時間壓力上，裁判會有積極進攻的要求；若不服從裁判要求則可能被判輸。</em></p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">17 BP</span> 對手未攻擊時必須待在角落</h4>
                <div class="handicap-description">
                  <p>對手只有在進行攻擊動作時可以離開角落，攻擊動作結束後必須返回。場地依九宮格劃分後的四個四方角為角落，攻擊、追擊結束時必須回到角落。</p>
                  <p><em>在比賽可看性以及時間壓力上，裁判會有積極進攻的要求；若不服從裁判要求則可能被判輸。</em></p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">2 BP</span> 獲得8秒的先手權</h4>
                <div class="handicap-description">
                  <p>在決鬥開始前8秒，你的對手不能主動攻擊你，直到你先發動攻擊。</p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">1 BP</span> 指定對手外觀（可全身指定）</h4>
                <div class="handicap-description">
                  <p><em>例：帶光頭＋沒有衣服。</em></p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">1 BP</span> 對手必須在開賽前落下一句狠話</h4>
                <div class="handicap-description">
                  <p>開打前對手必須打字公開說一句狠話，眾人見證此話的前提下才能進入會場進行決鬥，內容不限，但不得辱罵或人身攻擊。</p>
                  <p><em>例：你好像很勇哦，讓我看看！</em></p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">1 BP</span> 對手若輸了必須聽從勝者的一個要求（可以拒絕）</h4>
                <div class="handicap-description">
                  <p><em>例：你輸了就要當我的俠緣。（我拒絕）</em></p>
                </div>
              </article>
              <article class="handicap-item">
                <h4><span class="handicap-cost">1 BP</span> 指定對手開局時講一句話（8個字），沒講出來不能進行攻擊（可以先複製好）</h4>
                <div class="handicap-description">
                  <p><em>例：夜鴉所至，萬敵皆寂！</em></p>
                </div>
              </article>
            </details>
          </section>
        </div>
        <div class="manga-vow"><p>讓的是條件。<br><strong>不讓求勝的心。</strong></p><div><p>BP 不保證弱者獲勝，只賦予後進要求強者以更困難方式取勝的權利。</p><p class="manga-small">裁判將依 BP 說明進行仲裁，若有爭議則大會擁有最終解釋權。</p></div></div>
        <nav class="chapter-nav" data-chapter-pagination aria-label="讓武章節導覽"><a class="chapter-nav__link chapter-nav__link--prev" href="#rules" aria-label="上一章：規則說明"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">上一章</span><span class="chapter-nav__title">規則說明</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#register" aria-label="下一章：報名"><span class="chapter-nav__text"><span class="chapter-nav__direction">下一章</span><span class="chapter-nav__title">報名</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
      </div>
    </div>
  </section>

  <!-- 3 報名 -->
  <section id="register" class="chapter folio-chapter hybrid-chapter" data-shot="3" data-layout="minimal" style="--span:1.1" aria-labelledby="register-title">
    <div class="chapter-sticky" tabindex="0" role="region" aria-label="叁 · 報名赴約，可上下捲動"><div class="registration-stage">
      <h2 id="register-title" class="registration-chapter-title" tabindex="-1" aria-label="報名參賽"><span class="chapter-calligraphy" data-chapter-title="報名" data-chapter-seal="參" aria-hidden="true">報名</span></h2>
      <div class="registration-desk">
        <div id="registration-inline"></div>
        <div class="registration-invitation">
          <h3 class="registration-heading">報名參賽</h3>
          <p class="registration-intro">填寫參賽資料，準備角色配置，確認後送出報名。</p>
          <ol class="registration-route"><li>了解賽制</li><li>填寫資料</li><li>設定角色</li><li>確認報名</li></ol>
          <a class="cta" id="register-cta" data-activity-cta href="#rules">開始報名</a>
          <span id="register-status" data-activity-status></span>
          <button type="button" class="activity-retry" hidden>重新讀取活動</button>
        </div>
      </div>
      <nav class="chapter-nav" data-chapter-pagination aria-label="報名章節導覽"><a class="chapter-nav__link chapter-nav__link--prev" href="#invitation" aria-label="上一章：讓武"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">上一章</span><span class="chapter-nav__title">讓武</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#duel" aria-label="下一章：比武"><span class="chapter-nav__text"><span class="chapter-nav__direction">下一章</span><span class="chapter-nav__title">比武</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
    </div></div>
  </section>

  <!-- 4 對決 -->
  <section id="duel" class="chapter duel hybrid-chapter" data-shot="3" data-layout="bleed" style="--span:2" aria-labelledby="duel-title">
    <div class="chapter-sticky" tabindex="0" role="region" aria-label="肆 · 比武，可上下捲動">
      <div class="duel-calligraphy" aria-hidden="true"><span class="chapter-calligraphy" data-chapter-title="比武" data-chapter-seal="肆">比武</span></div>
      <div class="arena-composition" role="group" aria-label="兩位黑影俠客在擂台相向對峙">
        <button type="button" class="duelist arena-fighter arena-left" data-side="left" aria-label="看左方選手的備戰方案"><img id="arena-left-art" src="/lunjian/art/player-attacker-right.webp" width="1536" height="1024" alt=""></button>
        <button type="button" class="duelist arena-fighter arena-right" data-side="right" aria-label="看右方選手的備戰方案"><img id="arena-right-art" src="/lunjian/art/player-defender-left.webp" width="1254" height="1254" alt=""></button>
        <div class="duel-vs">
          <div class="arena-verdict" aria-hidden="true"><span class="duel-vs-slot" id="duel-vs-slot"></span><span class="arena-result" id="arena-result" hidden>險勝</span></div>
          <p class="sc" id="duel-score"></p>
          <p class="fmt" id="duel-index">對局待公布</p>
        </div>
      </div>
      <div class="duel-wrap" role="group" aria-label="下一場對戰">
      <h2 id="duel-title" class="visually-hidden">下一場對戰</h2>
      <div class="duel-stage">
        <article class="fighter" data-side="left">
          <p class="nm" id="duel-name-l">待公布</p>
          <dl class="dossier" id="duel-dos-l"></dl>
        </article>
        <article class="fighter" data-side="right">
          <p class="nm" id="duel-name-r">待公布</p>
          <dl class="dossier" id="duel-dos-r"></dl>
        </article>
      </div>
      <div class="duel-foot">
        <span id="duel-status" role="status" aria-live="polite"></span>
        <span class="odds-float" id="duel-odds"></span>
        <span id="duel-action"></span>
        <span class="duel-seal paper-stamp" id="duel-stamp" aria-hidden="true" hidden><svg viewBox="0 0 100 100"><path class="seal-body" d="M6 10 L10 6 L90 6 L94 11 L94 90 L89 94 L11 94 L6 89 Z"/><path class="seal-inner" d="M15 15 H85 V85 H15 Z"/><text class="seal-text seal-a" x="50" y="32" text-anchor="middle" dominant-baseline="central" font-size="34">封</text><text class="seal-text seal-b" x="50" y="68" text-anchor="middle" dominant-baseline="central" font-size="34">盤</text></svg></span>
      </div>
      <div class="duel-match-actions" id="duel-match-actions"><p id="duel-match-label" role="status"></p><div class="duel-bet-actions" id="duel-bet-actions"></div><button type="button" class="duel-return" data-return-bracket>← 返回賽程</button></div>
      <div data-manager-only class="duel-study" aria-label="比武演出預覽">
        <span id="duel-study-label" class="visually-hidden">切換查看示範比分與勝敗姿態</span>
        <div class="duel-study-buttons" role="group" aria-label="選擇比賽狀態">
          <button type="button" data-duel-preview="before" aria-pressed="false">比賽前</button><button type="button" data-duel-preview="live" aria-pressed="false">比賽中</button><button type="button" data-duel-preview="after" aria-pressed="false">完成比賽</button><button type="button" data-duel-reset hidden>返回賽事資訊</button>
        </div>
        <div id="duel-outcomes" class="duel-outcomes" role="group" aria-label="選擇勝敗姿態，均為示範" hidden>
          <button type="button" data-duel-outcome="dominant" aria-pressed="false">輾壓勝利</button><button type="button" data-duel-outcome="crushed" aria-pressed="false">慘輸</button><button type="button" data-duel-outcome="narrow" aria-pressed="false">險勝</button><button type="button" data-duel-outcome="draw" aria-pressed="false">平手</button>
        </div>
        <p id="duel-preview-note" role="status" hidden>示範資料 · 此比分僅供演出預覽</p>
      </div>
    </div>
      <nav class="chapter-nav" data-chapter-pagination aria-label="比武章節導覽"><a class="chapter-nav__link chapter-nav__link--prev" href="#register" aria-label="上一章：報名"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">上一章</span><span class="chapter-nav__title">報名</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#schedule" aria-label="下一章：賽程"><span class="chapter-nav__text"><span class="chapter-nav__direction">下一章</span><span class="chapter-nav__title">賽程</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
    </div>
  </section>

  <!-- 5 賽程 -->
  <section id="schedule" class="chapter schedule" data-shot="5" data-layout="wide" style="--span:.9" aria-labelledby="schedule-title">
    <div class="chapter-sticky" tabindex="0" role="region" aria-label="伍 · 賽程，可上下捲動">
      <div class="schedule-heading">
        <div><h2 id="schedule-title"><span class="chapter-calligraphy" data-chapter-title="賽程" data-chapter-seal="伍" aria-hidden="true">賽程</span><span class="visually-hidden">比賽賽程</span></h2></div>
        
      </div>
      <div class="panel" id="bracket-panel">
        <div class="panel-head"><div class="phase-track" id="phase-track"></div><span class="demo-tag" id="demo-tag" hidden>示範資料</span><button type="button" class="schedule-refresh" data-tournament-retry hidden>重新整理賽程</button></div>
        <p id="schedule-state" role="status"></p><div id="local-event-tools" data-manager-only hidden><a id="local-event-register">我的參賽</a> · <a id="local-event-manage">管理活動與對局 ↗</a></div><div id="bracket-tools" data-manager-only hidden></div><div id="bracket-host"></div>
      </div>
      <nav class="chapter-nav" data-chapter-pagination aria-label="賽程章節導覽"><a class="chapter-nav__link chapter-nav__link--prev" href="#duel" aria-label="上一章：比武"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">上一章</span><span class="chapter-nav__title">比武</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#rewards" aria-label="下一章：獎賞"><span class="chapter-nav__text"><span class="chapter-nav__direction">下一章</span><span class="chapter-nav__title">獎賞</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
    </div>
  </section>

  <!-- 6 獎賞 -->
  <section id="rewards" class="chapter folio-chapter hybrid-chapter awards-chapter" data-shot="4" data-layout="wall" style="--span:.8" aria-labelledby="rewards-title">
    <div class="chapter-sticky" id="prize-card" tabindex="0" role="region" aria-label="陸 · 獎賞，可上下捲動">
      <div class="awards-stage"><header class="awards-heading"><h2 id="rewards-title" class="manga-kicker chapter-heading-label" aria-label="獎賞"><span class="chapter-calligraphy" data-chapter-title="獎賞" data-chapter-seal="陸" style="--title-chars:2" aria-hidden="true">獎賞</span></h2></header>
      <div class="podium-board" id="prize-wall" aria-label="冠軍、亞軍、季軍漫畫頒獎席">
        <figure class="podium-frame podium-1" data-comic-frame>
          <div class="podium-art"><img data-comic-layer="scene" src="/lunjian/art/manga-awards-arena-gate.webp" width="1536" height="1024" alt="" loading="lazy"><div class="podium-figure" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-champion.webp" width="1024" height="1536" alt="" loading="lazy"></div></div>
          <span class="podium-stamp" data-comic-layer="stamp" aria-hidden="true"><span>冠軍</span></span>
          <figcaption data-comic-layer="caption"><h3>冠軍</h3><div class="podium-name"><p data-prize-name="1">待揭曉</p><small data-prize-source hidden></small></div></figcaption>
        </figure>
        <figure class="podium-frame podium-2" data-comic-frame>
          <div class="podium-art"><img data-comic-layer="scene" src="/lunjian/art/manga-awards-arena-lake.webp" width="1536" height="1024" alt="" loading="lazy"><div class="podium-figure" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-runnerup.webp" width="1024" height="1536" alt="" loading="lazy"></div></div>
          <span class="podium-stamp" data-comic-layer="stamp" aria-hidden="true"><svg class="podium-seal-lines" viewBox="0 0 78 78" focusable="false"><path d="M9 2H69L76 9V69L69 76H9L2 69V9Z"/><path d="M18 8H8V18H13V13H18V8H60V13H65V18H70V8H60M18 70H8V60H13V65H18V70H60V65H65V60H70V70H60M8 23V55M70 23V55"/></svg><span>亞軍</span></span>
          <figcaption data-comic-layer="caption"><h3>亞軍</h3><div class="podium-name"><p data-prize-name="2">待揭曉</p><small data-prize-source hidden></small></div></figcaption>
        </figure>
        <figure class="podium-frame podium-3" data-comic-frame>
          <div class="podium-art"><img data-comic-layer="scene" src="/lunjian/art/manga-awards-arena-bamboo.webp" width="1536" height="1024" alt="" loading="lazy"><div class="podium-figure" data-comic-layer="character" aria-hidden="true"><img src="/lunjian/art/manga-third.webp" width="1024" height="1536" alt="" loading="lazy"></div></div>
          <span class="podium-stamp" data-comic-layer="stamp" aria-hidden="true"><span>季軍</span></span>
          <figcaption data-comic-layer="caption"><h3>季軍</h3><div class="podium-name"><p data-prize-name="3">待揭曉</p><small data-prize-source hidden></small></div></figcaption>
        </figure>
      </div><div class="awards-note"><p>獎金、獎品與領獎方式將於定案後公布。<br>賽制另取殿軍；完整名次以正式賽果為準。</p><a data-activity-cta href="#rules">查看賽制</a> · <a data-loadout href="/loadout">我的武學配置</a></div></div>
      <nav class="chapter-nav" data-chapter-pagination aria-label="獎賞章節導覽"><a class="chapter-nav__link chapter-nav__link--prev" href="#schedule" aria-label="上一章：賽程"><span class="chapter-nav__arrow" aria-hidden="true">←</span><span class="chapter-nav__text"><span class="chapter-nav__direction">上一章</span><span class="chapter-nav__title">賽程</span></span></a><a class="chapter-nav__link chapter-nav__link--next" href="#prologue" aria-label="回到：宗旨"><span class="chapter-nav__text"><span class="chapter-nav__direction">回到</span><span class="chapter-nav__title">宗旨</span></span><span class="chapter-nav__arrow" aria-hidden="true">→</span></a></nav>
    </div>
  </section>

  <div class="tail" aria-hidden="true"></div>
</main>

<div id="ink-wipe" class="ink-wipe" aria-hidden="true"><div class="ink-fallback"></div><canvas id="ink-canvas"></canvas></div>

<nav class="progress-rail" aria-label="章節進度" id="progress-rail">
  <span class="rail-pos" id="rail-pos" aria-hidden="true"></span>
</nav>

<!-- VS 對立圖 -->
<div class="vs" id="vs" role="dialog" aria-modal="true" aria-labelledby="vs-round" hidden>
  <div class="vs-scrim" data-vs-close></div>
  <button class="vs-close" data-vs-close aria-label="關閉對立圖">×</button>
  <div class="vs-head">
    <p class="rnd" id="vs-round">第 1 輪 · 第 1 場</p>
    <p class="st" id="vs-status"></p>
  </div>
  <figure class="vs-fig" data-side="left" id="vs-fig-l" aria-hidden="true"><img src="/lunjian/art/player-attacker-right.webp" alt="" width="1536" height="1024"></figure>
  <figure class="vs-fig" data-side="right" id="vs-fig-r" aria-hidden="true"><img src="/lunjian/art/player-defender-left.webp" alt="" width="1254" height="1254"></figure>
  <div class="vs-mark" aria-hidden="true">
    <span class="burst"></span>
    <img class="vs-mark-art" src="/lunjian/art/vs-ink.png" alt="" width="586" height="586">
  </div>
  <div class="vs-mid">
    <p class="vs-score" id="vs-score"></p>
    <p class="vs-format" id="vs-format"></p>
  </div>
  <p class="vs-note micro" id="vs-note"></p>
  <div class="vs-plate" data-side="left" id="vs-plate-l" tabindex="0"></div>
  <div class="vs-plate" data-side="right" id="vs-plate-r" tabindex="0"></div>
  <div class="vs-cta" id="vs-cta"></div>

</div>

  <!-- 選手詳情。一張卡塞不下心法四格＋奇術三類＋六類讓武，
       硬塞只會讓字小到讀不了，所以點卡才開這一層。 -->
  <div class="psheet" id="psheet" hidden>
    <div class="dz-scrim" data-dz-close></div>
    <article class="dz-sheet" role="dialog" aria-modal="true" aria-labelledby="dz-title" tabindex="-1">
      <button class="dz-close" type="button" data-dz-close aria-label="關閉選手配置">×</button>
      <div class="dz-body" id="dz-body"></div>
    </article>
  </div>

<pre id="hud" aria-hidden="true"></pre>
<p id="announcement" class="visually-hidden" aria-live="polite"></p>

<!-- 裸名稱對應到真實檔案。原本這一整塊是 15MB 的 data: URL，
     現在只是一張表，模組本身在 jz/ 與 preview/ 底下。 -->
<!-- 3D 場地。放在主腳本之後：它要讀 __LUNJIAN.S，而那是上面那支掛出來的。 -->
`;

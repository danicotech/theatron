/**
 * 序幕的三段 GLSL。
 *
 * 分成一個檔案而不是塞在 prologueScene 裡,是因為這裡是**畫面本身**,
 * 而 prologueScene 只是把它接上 three 的生命週期。要改布的質感、裂口的毛邊、
 * 血墨的滲法,改這裡;要改什麼時候發生,改 stages.ts;要改哪一格,改 panels.ts。
 *
 * 五條共同規矩:
 *
 *  1. **一切由 uProgress 系的 uniform 決定。** 這裡出現的 `uTime` 只用在布的
 *     擺動與霧的流動 —— 那是環境,不是劇情。劇情的每一格都可以由進度重算,
 *     所以正著刮跟倒著刮得到同一張畫面。
 *  2. **人不是畫出來的。** 兩道身影是 `public/shadow/duel-*.svg` 兩張真的剪影
 *     素材,由 silhouette.ts 畫進離屏 canvas 當成貼圖餵進來。這裡只做一件事:
 *     **透過布**去看那張貼圖。用 SDF 把四肢串成粗管子的版本已經刪掉了 ——
 *     那讀起來是兩隻熊,不是兩個人。
 *  3. **只有劍會發光。** 整份 shader 裡唯一做加法混色的地方就是裂口那一段
 *     (劍鋒剛穿過去的那一道)。剪影是影子,影子不發光。
 *  4. **顏色全部是 uniform。** 色盤住在 world3d/palette.ts,由 landing/palette.ts
 *     轉成線性空間送進來,GLSL 裡一個色值都不寫死。
 *  5. **風是別人的。** 布不自己造一陣風,它注入 world3d/wind 的 `WIND_GLSL`,
 *     吃跟竹林同一支 `windAt()`、同一組 uniform、同一個時間。
 */

import { WIND_GLSL } from '../../world3d/wind';

/** 噪聲。值域 0…1,可重現(同一個 uv 永遠同一個值),給毛邊與滲透用。 */
const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // 五次淡入淡出:三次的版本在格點上二階不連續,放大之後看得出格線。
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += amp * vnoise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }
`;

/**
 * 遠景:月、霧、夜。
 *
 * 它不是「一張背景圖」,是布幕**外面**那個世界。布幕自己的光源是布後面那盞燈
 * (見 CLOTH_FRAG),所以這一層在第一幕幾乎看不到 —— 它要等布破了才進場。
 */
export const BACKDROP_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uMoon;
  uniform float uBleed;
  uniform vec2 uAspect;
  uniform vec3 cNight;
  uniform vec3 cMist;
  uniform vec3 cMoon;

  ${NOISE}

  void main() {
    vec2 p = (vUv - 0.5) * uAspect;

    // 夜空:上深下淺,地平線那一帶被霧提起來。
    vec3 col = mix(cNight * 0.55, cNight, smoothstep(-0.6, 0.5, p.y));

    // 月。halo 用兩段不同斜率的 falloff —— 單一 falloff 的月亮是一顆貼紙。
    vec2 m = p - vec2(0.16, 0.26);
    float d = length(m);
    float disc = 1.0 - smoothstep(0.115, 0.128, d);
    float halo = exp(-d * 5.2) * 0.34 + exp(-d * 1.6) * 0.12;
    // 月面的麻點。沒有它,月亮是一個發光的圓,不是一顆石頭。
    float pit = fbm(m * 26.0) * 0.16;
    col += cMoon * (disc * (0.82 - pit) + halo) * (0.55 + 0.45 * uMoon);

    // 遠霧:一層很慢的橫向流動。它負責讓地面「就這樣停住」,不必畫到天邊。
    float mist = fbm(vec2(p.x * 1.6 - uTime * 0.012, p.y * 3.4 + uTime * 0.006));
    col = mix(col, cMist, smoothstep(0.35, 0.95, mist) * smoothstep(0.45, -0.25, p.y) * 0.5);

    // 血墨滲開之後,連背後的夜色都被壓暗一階 —— 紅要能吃掉整個畫面的注意力。
    col *= 1.0 - 0.35 * uBleed;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * 布。
 *
 * 這一支只做一件事:算出布面在每一點的**離面位移**,以及它沿 x 的斜率。
 * 兩個值都 varying 出去,因為 fragment 需要的不是法線,是「光穿過這一點時
 * 被推開多少」—— 剪影是透過布看到的,不是印在布上的。
 */
export const CLOTH_VERT = /* glsl */ `
  ${WIND_GLSL}
  ${NOISE}

  varying vec2 vUv;
  /** 離面位移。fragment 拿它決定擴散半徑,以及取樣座標的垂直偏移。 */
  varying float vFold;
  /** 沿 x 的斜率。影子被布推開的方向就是它。 */
  varying float vSlopeX;
  /** 離掛繩多遠。旗落與破下襬都靠它。 */
  varying float vFree;

  uniform float uBillow;
  uniform float uFall;
  uniform float uShudder;
  /** 這面旗掛在世界的哪裡,以及它有多寬(公尺)。風是位置的函式,旗要有位置。 */
  uniform vec2 uAnchor;
  uniform float uSpan;

  // 布面在 (u,v) 的離面位移。垂掛的布有兩種結構疊在一起:
  //   · 沿 x 的垂直摺(掛起來自然形成的直褶),頻率高
  //   · 大面積的緩慢起伏(風推的),頻率低
  // 上緣釘死,不然布會像一張飄在空中的紙。
  //
  // 「風推的」那一項吃的是場上共用的那一陣風(world3d/wind):它只調**幅度**,
  // 相位留給布自己的低頻噪聲 —— 駐波是「面」才有的東西,竹子沒有。這樣旗與
  // 竹林仍然是一起鼓起來的,而旗不會變成一支跟著風向擺動的旗桿。
  float sheet(vec2 uv, float t) {
    float pin = pow(1.0 - uv.y, 1.35);
    float drape = sin(uv.x * 38.0 + vnoise(uv * 3.0 + t * 0.05) * 4.0) * 0.055;
    float billow = (vnoise(uv * 2.2 + vec2(t * 0.07, t * 0.03)) - 0.5) * 0.42;
    vec2 worldXZ = uAnchor + vec2((uv.x - 0.5) * uSpan, 0.0);
    float gust = 1.0 + windAt(worldXZ, t) * uWindStrength * 0.9;
    return (drape + billow * uBillow * gust) * pin;
  }

  void main() {
    vUv = uv;
    vFree = 1.0 - uv.y;

    float fold = sheet(uv, uTime);
    vFold = fold;

    // 前向差分,步長就是相鄰頂點的距離(平面細分 220×150)。再細是在放大噪聲,
    // 再粗就會把直褶整個平均掉 —— 而直褶正是這塊布唯一的結構。
    float e = 0.0045;
    vSlopeX = (sheet(uv + vec2(e, 0.0), uTime) - fold) / e;

    vec3 pos = position;
    pos.z += fold;

    // 旗落:繞上緣倒下去,而不是整面往下平移 —— 它還掛在朽樑上。
    pos.y -= uFall * vFree * 1.9;
    pos.z += uFall * vFree * 1.15;

    // 刺穿那一下的顫。是進度的凸起(見 stages.ts),所以倒著刮會再顫一次。
    pos.x += uShudder * sin(uv.y * 22.0) * 0.012;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

/**
 * 布的表面 + 透過布看到的剪影 + 裂口 + 血墨。
 *
 * # 皮影的四件事
 *
 *  1. **背光**,不是平均照明。燈在布後面,中心亮、四周急衰 —— 第一幕整個畫面
 *     就是這塊被一盞燈照亮的布,那盞燈是規格說的「唯一暖點」。
 *  2. **取樣座標被布的斜率推開**。影子不是貼在布上,是**透過布**看到的:
 *     布凸起來的地方,光穿過去的路徑就偏了。這是整個效果的核心。
 *  3. **擴散半徑隨褶深加大**。褶深的地方布厚,光在纖維裡散得更開。
 *  4. **織紋 band-limit**。布是斜的又被褶壓縮,同一支 shader 在畫面不同地方的
 *     取樣率差很多倍,固定頻率的織紋一定會出摩爾紋。
 *
 * # 剩下三件是布自己的事
 *
 * 裂口是一條 SDF 線段,毛邊靠把 fbm 加進距離場(不是把邊緣模糊掉):
 * 模糊得到的是一條糊邊,加噪聲得到的才是**扯開的纖維**。
 *
 * 血墨用 `smoothstep(radius - fbm)`:半徑隨 uBleed 長,而 fbm 讓滲透的前緣不規則。
 * 再加兩件事 —— 往下流的滴痕、以及低頻的宣紙芯吸(沿纖維走得比逆纖維快)。
 *
 * 殘旗的下襬是一排長短不一的布條,不是一條裁齊的邊。
 */
export const CLOTH_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vFold;
  varying float vSlopeX;
  varying float vFree;

  /** 這一格與上一格的剪影。換格是離散的,由 uSilWipe 那道墨暈換掉。 */
  uniform sampler2D uSilCur;
  uniform sampler2D uSilPrev;
  uniform float uSilWipe;
  /** 剪影在布上佔多大。 */
  uniform float uSilScale;
  /** 素材的長寬比與布的不一樣,這個把它擺回原本的比例。 */
  uniform vec2 uSilFit;
  /** 布本身的長寬比。UV 是方的,布不是 —— 凡是「圓的」東西都要除回去。 */
  uniform float uClothAspect;
  /** 身影還在不在。布被劃破之後他們就不在了。 */
  uniform float uDuel;

  uniform float uLampSize;
  uniform float uDiffuse;
  uniform float uRefract;

  uniform float uTear;
  uniform float uBleed;
  uniform float uFall;
  uniform float uMoon;
  uniform vec3 cCloth;
  uniform vec3 cLamp;
  uniform vec3 cMoon;
  uniform vec3 cBlood;
  uniform vec3 cBlade;

  ${NOISE}

  // 裂口:從布的右上往左下的一道斜線,隨 uTear 從刺穿點往兩端拖開。
  float tearDist(vec2 uv) {
    vec2 a = vec2(0.62, 0.74);
    vec2 b = vec2(0.24, 0.20);
    // 刺穿點在 a,拖到 b —— 所以終點是 uTear 的函式,不是整條線一起變粗。
    vec2 end = mix(a, b, smoothstep(0.05, 1.0, uTear));
    float d = sdSeg(uv, a, end);
    // 毛邊:把噪聲加進距離場。加在距離上是「纖維被扯開」,乘在 alpha 上只是糊掉。
    d += (fbm(uv * 26.0) - 0.5) * 0.030;
    return d;
  }

  /**
   * 這一點的光被擋掉多少。
   *
   * 分支吃的是 uniform,所以整個 draw call 走同一邊 —— 換格那 150ms 以外,
   * 上一格那張貼圖一次都不會被取樣。
   */
  float blocked(vec2 uv, float mask) {
    float now = texture2D(uSilCur, uv).a;
    if (uSilWipe >= 0.999) return now;
    return mix(texture2D(uSilPrev, uv).a, now, mask);
  }

  void main() {
    // ── 背光。燈在布**後面**,中心亮、四周急衰。
    //    布比高寬,UV 的距離不是世界的距離 —— 不除回去的話那盞燈會是一個
    //    直立的橢圓,而燈是圓的。
    float lampD = length((vUv - vec2(0.5, 0.54)) * vec2(1.0, 1.0 / uClothAspect));
    float lamp = exp(-pow(lampD / uLampSize, 2.0) * 1.5);

    // ── 取樣座標被布的斜率推開。少了這兩行,剪影會像一張貼紙黏在一塊會動的布上。
    vec2 suv = (vUv - 0.5) / (uSilScale * uSilFit) + 0.5;
    suv.x += vSlopeX * uRefract;
    suv.y += vFold * uRefract * 0.6;

    // 墨暈。淡入淡出會在中間留下兩個姿勢疊在一起的鬼影,而這一幕是分鏡不是動畫。
    float mask = clamp(uSilWipe * 1.5 - fbm(vUv * 6.0) * 0.5, 0.0, 1.0);

    // ── 擴散。九點黃金角 —— 均勻取樣會在影子邊緣留下格狀痕跡。
    float r = uDiffuse * (1.0 + abs(vFold) * 6.0);
    float shade = 0.0;
    for (int i = 0; i < 9; i++) {
      float a = float(i) * 2.39996;
      float k = sqrt((float(i) + 0.5) / 9.0) * r;
      shade += blocked(suv + vec2(cos(a), sin(a)) * k, mask);
    }
    shade *= uDuel / 9.0;

    // ── 織紋。取樣率追不上的地方就把它收掉;收掉的代價只是那裡看不到紗,
    //    不收的代價是整塊布浮出一層會爬的格網。
    float wf = 620.0;
    float cycles = fwidth(vUv.x) * wf;
    float weaveAmp = 1.0 - smoothstep(0.35, 0.9, cycles);
    float warp = sin(vUv.x * wf) * 0.5 + 0.5;
    float weft = sin(vUv.y * wf * 0.62) * 0.5 + 0.5;
    // 紗的粗細不勻。少了它,經緯是一張完美的方格,讀起來是紗窗不是布 ——
    // 頻率刻意壓得比經緯低很多,不然這一項自己就成了下一個會出摩爾紋的東西。
    float slub = 0.7 + 0.6 * fbm(vUv * vec2(21.0, 13.0));
    float weave = mix(1.0, 0.92 + 0.16 * (warp * 0.6 + weft * 0.4) * slub, weaveAmp);

    // ── 摺的明暗:斜率朝著燈的那一面亮。這就是「看得出這是一塊布」的全部。
    float drape = clamp(0.74 + vSlopeX * 0.085, 0.34, 1.30);

    float through = lamp * drape * weave;

    // 暖 → 撕裂 → 冷。第一幕的光全部來自布後面那盞燈;布被劃破之後月光從裂口
    // 進來,整段戲就一路涼下去。兩個顏色都從色盤來,這裡一個色值都沒有。
    vec3 lit = mix(cLamp, cMoon, uMoon);
    vec3 col = cCloth * (0.30 + through * 2.4) + lit * through * 1.15;

    // 影子是**光被擋住的形狀**,所以它是減的,不是另外疊上去的一塊黑。
    col *= 1.0 - shade * 0.90;

    // ── 裂口。負距離的地方布沒了,月光直接灌進來。
    float d = tearDist(vUv);
    float lip = 1.0 - smoothstep(0.003, 0.032, d);
    float open = 1.0 - smoothstep(-0.002, 0.006, d);
    // 裂口邊緣要更亮:光從薄掉的纖維邊穿過來,那是「劃破」讀得出來的原因。
    // 0.34 而不是 0.55:再亮一點就變成一道發光的傷口,而這個站只有劍會發光。
    col += cMoon * lip * 0.34 * uMoon;
    col += cBlade * lip * 0.10 * uTear;

    // ── 血墨。從裂口往外滲,前緣由 fbm 咬出不規則。
    float wick = fbm(vUv * vec2(5.5, 9.0)) * 0.16;    // 宣紙芯吸:低頻、沿緯向走得遠
    float grain = fbm(vUv * 34.0) * 0.06;             // 纖維級的碎邊
    // 半徑從**負的**起跳:起點是 0 的話,smoothstep(0, -0.1, 負數) 會回 1,
    // 於是血墨在 uBleed 還是零的時候就已經淹掉半塊布了。這是這支 shader 裡
    // 最容易寫錯、而且要等到實機上才看得出來的一行。
    float radius = uBleed * 1.22 - 0.27;
    float ink = smoothstep(radius, radius - 0.10, max(d, 0.0) - wick - grain);
    // 再上一道保險:一滴都還沒滲的時候,整項就是零。
    ink *= smoothstep(0.0, 0.03, uBleed);

    // 滴痕:裂口下方一道一道往下流。每一道的長度由該欄的雜湊決定,所以不會等長。
    float column = floor(vUv.x * 42.0);
    float lane = hash21(vec2(column, 7.0));
    float dripLen = (0.10 + 0.55 * lane) * uBleed;
    float below = clamp((0.74 - vUv.y) / max(dripLen, 1e-4), 0.0, 1.0);
    float drip = (1.0 - smoothstep(0.55, 1.0, below))
               * step(0.55, lane)
               * smoothstep(0.18, 0.55, uBleed)
               * (1.0 - smoothstep(0.02, 0.06, abs(fract(vUv.x * 42.0) - 0.5) * 0.1 + 0.02));
    ink = max(ink, drip * 0.9);

    // 四角留藍:紅淹掉大半個畫面,但角落與裂口內側活下來。
    vec2 q = abs(vUv - 0.5) * 2.0;
    float corner = smoothstep(0.62, 1.0, max(q.x, q.y)) * smoothstep(0.55, 1.0, min(q.x, q.y) + 0.35);
    ink *= 1.0 - corner * 0.85;

    col = mix(col, cBlood, clamp(ink, 0.0, 1.0) * 0.94);

    // ── 殘旗的下襬。它已經破了很多年,所以下緣是一排長短不一的布條,
    //    不是一條裁齊的邊。這是「殘」讀得出來的地方 —— 少了它就只是一面旗。
    float hem = 0.05 + 0.13 * fbm(vec2(vUv.x * 6.0, 11.3));
    float tatter = 0.16 * fbm(vec2(vUv.x * 22.0, 4.7));
    float ragged = smoothstep(hem - 0.012, hem + 0.012, vUv.y - tatter * step(vUv.y, 0.34));

    // ── 旗落時化墨:噪聲門檻吃掉布,不是整面淡出。
    float dissolve = smoothstep(0.0, 1.0, uFall * 1.45 - fbm(vUv * 7.0) * 0.9 - vFree * 0.25);
    float alpha = (1.0 - open) * (1.0 - clamp(dissolve, 0.0, 1.0)) * ragged;

    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * 序幕的四段 GLSL。
 *
 * 分成一個檔案而不是塞在 prologueScene 裡,是因為這裡是**畫面本身**,
 * 而 prologueScene 只是把它接上 three 的生命週期。要改布的質感、裂口的毛邊、
 * 血墨的滲法,改這裡;要改什麼時候發生,改 stages.ts。
 *
 * 四條共同規矩:
 *
 *  1. **一切由 uProgress 系的 uniform 決定。** 這裡出現的 `uTime` 只用在布的
 *     擺動與霧的流動 —— 那是環境,不是劇情。劇情的每一格都可以由進度重算,
 *     所以正著刮跟倒著刮得到同一張畫面。
 *  2. **只有劍會發光。** 整份 shader 裡唯一做加法混色的地方就是劍那一段。
 *  3. **顏色全部是 uniform。** 色盤住在 world3d/palette.ts,由 landing/palette.ts
 *     轉成線性空間送進來,GLSL 裡一個色值都不寫死。
 *  4. **風是別人的。** 布不自己造一陣風,它注入 world3d/wind 的 `WIND_GLSL`,
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
 * 它不是「一張背景圖」,是布幕的**光源**。皮影戲的光必須在被照的東西後面,
 * 所以月亮的位置決定了布上哪裡透光、剪影落在哪裡 —— 這一層的構圖一動,
 * 前面兩層全部跟著變。
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
 * 皮影:旗後的兩道身影。
 *
 * 規格只准剪影:背光、沒有五官。所以整段只算一個有號距離場,再用它當遮罩把
 * 背景壓黑 —— 沒有任何一個地方在「畫一個人」,畫的是**光被擋住的形狀**。
 *
 * 袖、帶、髮吃的是 uPoseLag(比 uPose 慢 100–200ms 的阻尼值),所以身體停了
 * 之後布料還會追上來一下。這是唯一一個不由進度決定的東西,理由寫在 stages.ts。
 */
export const FIGURES_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uPose;
  uniform float uPoseLag;
  uniform float uDuel;
  uniform float uTear;
  uniform vec2 uAspect;
  uniform vec3 cBlade;

  ${NOISE}

  // 一個人。dir = +1 站左往右打,-1 站右往左守。
  // 回傳 x 是身體的距離場,y 是劍的距離場 —— 兩個要分開,因為只有劍會發光。
  vec2 figure(vec2 p, float t, float lag, float dir, vec2 root) {
    // p 先整個鏡射,之後的計算全部在鏡射後的空間裡 —— 所以 root 也要用鏡射後的值,
    // 不能再乘一次 dir。乘兩次的話兩個人會疊在同一邊,劍還會往畫面外拖一條長光。
    p.x *= dir;
    vec2 o = root;

    float lunge = smoothstep(0.1, 0.95, t);
    // 每一段的長度都要讓**全出手時**劍尖落在布裡面:兩把劍要在中間交會,
    // 不是各自穿出畫面。穿出去的話讀起來是兩個人背對背,不是在對劍。
    vec2 hip = o + vec2(0.12 * lunge, -0.04 * lunge);
    vec2 shoulder = hip + vec2(0.02 + 0.04 * lunge, 0.28);
    vec2 head = shoulder + vec2(0.03 + 0.03 * lunge, 0.10);
    vec2 footFront = hip + vec2(0.18 + 0.14 * lunge, -0.29);
    vec2 footBack = hip + vec2(-0.19 - 0.04 * lunge, -0.29);
    vec2 hand = shoulder + vec2(0.13 + 0.20 * lunge, 0.01 + 0.06 * lunge);
    vec2 tip = hand + vec2(0.26 + 0.16 * lunge, 0.06 + 0.04 * lunge);

    // 半徑刻意細:影子的四肢一粗就糊成一團,讀起來是兩隻熊不是兩個人。
    float body = 1e9;
    body = min(body, sdSeg(p, hip, shoulder) - 0.040);
    body = min(body, length(p - head) - 0.042);
    body = min(body, sdSeg(p, hip, footFront) - 0.024);
    body = min(body, sdSeg(p, hip, footBack) - 0.024);
    body = min(body, sdSeg(p, shoulder, hand) - 0.022);

    // 袖、帶、髮:同一組骨架,吃比較慢的那個姿勢,而且更寬更軟。
    float lagLunge = smoothstep(0.1, 0.95, lag);
    vec2 lhip = o + vec2(0.12 * lagLunge, -0.04 * lagLunge);
    vec2 lshoulder = lhip + vec2(0.02 + 0.04 * lagLunge, 0.28);
    vec2 lhand = lshoulder + vec2(0.13 + 0.20 * lagLunge, 0.01 + 0.06 * lagLunge);
    float cloth = 1e9;
    // 袖:從肩到手,往下垂。
    cloth = min(cloth, sdSeg(p, lshoulder, lhand + vec2(0.0, -0.08)) - 0.042);
    // 下襬:腰往下一片。
    cloth = min(cloth, sdSeg(p, lhip + vec2(0.0, 0.02), lhip + vec2(-0.06, -0.26)) - 0.058);
    // 髮:後腦往後下方一束。
    vec2 lhead = lshoulder + vec2(0.035 + 0.03 * lagLunge, 0.10);
    cloth = min(cloth, sdSeg(p, lhead, lhead + vec2(-0.10, -0.12)) - 0.022);

    body = min(body, cloth);
    float blade = sdSeg(p, hand, tip) - 0.0045;
    return vec2(body, blade);
  }

  void main() {
    // 人站在這一片的下半:頭在中線附近,腳踩在片底。整個往上推一點,
    // 因為影子是被投在布上的,布的下緣已經破了。
    vec2 p = ((vUv - 0.5) * uAspect + vec2(0.0, 0.01)) / 1.06;

    // 兩個人分站兩邊,中間留一段空。站太近的話劍還沒出手就已經交在一起,
    // 讀起來是兩個人在推擠,不是對劍。
    vec2 a = figure(p, uPose, uPoseLag, 1.0, vec2(-0.54, -0.04));
    // 守方的招式比攻方晚一點起,不然兩個人像在跳同一支舞。
    vec2 b = figure(p, clamp(uPose - 0.12, 0.0, 1.0), clamp(uPoseLag - 0.12, 0.0, 1.0),
                    -1.0, vec2(-0.50, -0.04));

    float body = min(a.x, b.x);
    float blade = min(a.y, b.y);

    // 剪影邊緣要糊:光穿過布再穿過人,影子本來就沒有硬邊。
    float silhouette = (1.0 - smoothstep(-0.008, 0.022, body)) * 0.92;
    silhouette *= uDuel;

    // 劍是整個序幕唯一會發光的東西。刺穿那一刻(uTear 起步)最亮。
    float glow = exp(-max(blade, 0.0) * 78.0) * uDuel * (0.45 + 0.7 * uTear);
    float core = (1.0 - smoothstep(0.0, 0.003, blade)) * uDuel;

    vec3 col = cBlade * (glow * 0.34 + core * 0.85);
    // alpha 同時承載「擋住光」與「發出光」:擋住的部分交給下面的 blend 壓黑。
    gl_FragColor = vec4(col, max(silhouette, min(1.0, glow + core)));
  }
`;

/**
 * 布。
 *
 * 頂點位移 = 層疊噪聲的鼓起 + 風場(uWind 由 world3d/wind 的同一陣風餵進來)。
 * 位移沿「離掛繩越遠越大」加權 —— 旗是掛著的,上緣不會動,下緣才甩得開。
 *
 * 法線不用 three 算好的那一組:那是平面的法線,位移之後就不對了。這裡把同一個
 * 高度函式取兩次差分自己算 —— 絲的光澤全靠法線,法線錯了就只是一塊亮布。
 */
export const CLOTH_VERT = /* glsl */ `
  ${WIND_GLSL}

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vFree;
  uniform float uBillow;
  uniform float uFall;
  uniform float uShudder;
  /** 這面旗掛在世界的哪裡,以及它有多寬(公尺)。風是位置的函式,旗要有位置。 */
  uniform vec2 uAnchor;
  uniform float uSpan;
  /** 位移在世界上有多深。同時決定法線的斜率 —— 兩者必須是同一個數字。 */
  uniform float uDepth;

  float height(vec2 uv) {
    float free = 1.0 - uv.y;

    // 場上共用的那一陣風。竹林吃的是同一支 windAt、同一組 uniform、同一個時間,
    // 所以旗與竹子是一起倒的 —— 旗自己抖自己的,是「風是假的」最明顯的破綻。
    // 沿旗寬取樣:同一時刻,靠旗竿那一端已經鼓起來了,旗尾還沒開始。
    vec2 worldXZ = uAnchor + vec2((uv.x - 0.5) * uSpan, 0.0);
    float gust = windAt(worldXZ, uTime);

    // 布自己的鼓盪疊在風上面(不是取代它):布是一個面,它有自己的駐波,
    // 那是竹子沒有的東西。
    // 三個空間頻率:一道大的鼓起、幾道中等的摺、以及沿垂直方向的細波。
    // 只給一個頻率的話布只會整面前後晃,看不出「摺」—— 而絲的光澤全靠摺。
    float w1 = sin(uv.x * 5.2 + uTime * 1.5);
    float w2 = sin(uv.x * 12.6 - uTime * 1.05 + uv.y * 2.2) * 0.45;
    float w3 = sin(uv.y * 7.3 + uv.x * 3.1 + uTime * 0.8) * 0.35;
    float billow = w1 + w2 + w3;

    // free 的平方:靠近掛繩的地方要真的不動,線性衰減會讓整面布像一塊板子在搖。
    return (gust * uWindStrength * 1.8 + billow) * free * free * 0.52 * uBillow;
  }

  void main() {
    vUv = uv;
    vFree = 1.0 - uv.y;

    vec3 pos = position;
    pos.z += height(uv);

    // 旗落:繞上緣倒下去,而不是整面往下平移 —— 它還掛在朽樑上。
    pos.y -= uFall * vFree * 1.9;
    pos.z += uFall * vFree * 1.15;

    // 刺穿那一下的顫。是進度的凸起(見 stages.ts),所以倒著刮會再顫一次。
    pos.x += uShudder * sin(uv.y * 22.0) * 0.012;

    // 法線:同一個高度函式取差分。eps 取 uv 的一格左右,再細就是在放大噪聲。
    //
    // 斜率要乘 uDepth:高度函式算的是 local 單位,而 mesh 的 z 被放大過
    // (旗在世界上有厚度,見 prologueScene 的 layout)。不乘的話算出來的法線
    // 幾乎都是 (0,0,1) —— 那就是一塊沒有摺的板子,而絲的光澤全靠摺。
    float e = 0.012;
    float hx = height(vUv + vec2(e, 0.0)) - height(vUv - vec2(e, 0.0));
    float hy = height(vUv + vec2(0.0, e)) - height(vUv - vec2(0.0, e));
    vNormal = normalize(vec3(-hx / (2.0 * e) * uDepth, -hy / (2.0 * e) * uDepth, 1.0));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

/**
 * 布的表面 + 裂口 + 血墨。
 *
 * 絲不是「亮」,是**各向異性**與**透光**:
 *  - 透光(背光)決定基本亮度 —— 月在布後面,所以布本身就是光源的一部分。
 *  - 各向異性的高光沿織紋方向拉成一條,不是一顆圓點。橫紋與直紋各一條,
 *    兩條的權重不同,布才有「經緯」而不是「金屬」。
 *  - 織紋的高頻噪聲只調制透光量,不調制顏色 —— 調顏色會讓布看起來髒。
 *
 * 裂口是一條 SDF 線段,毛邊靠把 fbm 加進距離場(不是把邊緣模糊掉):
 * 模糊得到的是一條糊邊,加噪聲得到的才是**扯開的纖維**。
 *
 * 血墨用 `smoothstep(radius - fbm)`:半徑隨 uBleed 長,而 fbm 讓滲透的前緣不規則。
 * 再加兩件事 —— 往下流的滴痕、以及低頻的宣紙芯吸(沿纖維走得比逆纖維快)。
 */
export const CLOTH_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vFree;

  uniform float uTear;
  uniform float uBleed;
  uniform float uFall;
  uniform float uMoon;
  uniform vec3 cCloth;
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

  void main() {
    // ── 織紋。兩個方向的高頻,經緯不同密度。
    float weave = fbm(vec2(vUv.x * 220.0, vUv.y * 90.0)) * 0.5
                + fbm(vec2(vUv.x * 70.0, vUv.y * 260.0)) * 0.5;

    vec3 n = normalize(vNormal);
    vec3 view = vec3(0.0, 0.0, 1.0);
    // 月在布**後面**(皮影的光必須在被照的東西後面),所以光是朝著鏡頭走的。
    vec3 toLight = normalize(vec3(-0.18, -0.30, 1.0));

    // ── 背光透射。面向月的那一側透得最多,背過去的摺立刻暗下來 ——
    //    這個明暗差就是「看得出這是一塊布」的全部。
    float back = clamp(dot(n, toLight), 0.0, 1.0);
    // 下限不能是零:剪影要落在**被照亮的**布上才讀得出來,全黑的地方影子等於不存在。
    float trans = mix(0.20, 1.0, pow(back, 1.5));
    trans *= 0.72 + 0.56 * weave;

    // ── 絲的各向異性高光(Ward)。
    //    絲不是「亮」,是光沿著經紗被拉成**一條**而不是一顆。所以兩個方向的
    //    粗糙度差一個量級:沿紗很光滑(ax 小),垂直紗很粗(ay 大)。
    //    切線要投影回這一點的切平面上,不然摺起來的地方高光會貼著世界軸走。
    vec3 h = normalize(toLight + view);
    vec3 t = normalize(vec3(1.0, 0.0, 0.0) - n * dot(n, vec3(1.0, 0.0, 0.0)));
    vec3 b = cross(n, t);
    float nh = max(dot(n, h), 1e-4);
    float th = dot(t, h);
    float bh = dot(b, h);
    float ax = 0.075;
    float ay = 0.55;
    float e2 = -2.0 * ((th * th) / (ax * ax) + (bh * bh) / (ay * ay)) / (1.0 + nh);
    float sheen = exp(e2) * 0.55;
    // 纖維的不勻:高光不該是一條乾淨的線,那是金屬。
    sheen *= 0.55 + 0.9 * weave;

    vec3 col = cCloth * trans * 1.9 + cMoon * sheen * (0.35 + 0.65 * uMoon);

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

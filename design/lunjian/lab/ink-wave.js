/* ══════════════════════════════════════════════════════════
   墨浪：GPU 波動模擬驅動的轉場

   波方程與阻尼、吸收邊界的寫法取自本專案的
   stylized-components/src/components/waterFloor/components/
   WaterWaveSimulation/shaders/wave.ts
   （二階波方程 h_next = 2h − h_prev + c²∇²h，R 存 h(t)、G 存 h(t−1)）

   那一包是 React Three Fiber，但有價值的是 GLSL，React 只是宿主。
   這裡用原生 WebGL2 跑同一套式子，不引入 three.js 也不改頁面架構。

   為什麼用波方程而不是雜訊位移：
   墨在生宣上擴散本來就是擴散過程 —— 邊緣會自己長出舌頭、互相干涉、
   遇到阻力就停。雜訊位移只是把一條直線推歪，形狀是靜止的；
   波方程的邊界每一幀都在演化，所以看起來是墨在走，不是遮罩在動。

   ── 第一版錯在哪（留著，因為這兩個錯很容易再犯）──────────────
   1. 注入強度寫成 `hash(floor(uv.y * 26.0))`：沿 y 被切成 26 條各自定值的
      橫帶，帶與帶之間沒有內插。畫面上就是一排長方形階梯，不是墨。
      現在改成內插過的值雜訊，前緣才是連續曲線。
   2. 位移量 0.085，而且是取「目前像素」的波高。取目前像素會讓同一列的
      位移隨 x 變，邊緣被拉斜；加上振幅太小，整條邊幾乎沒動。
      現在改成取「前緣那一欄」的波高，位移只隨 y 變，整列一起推。
   3. 只有一條硬邊。真的墨有三件事：滲開的濃度梯度、飛白（乾筆的白絲）、
      衝在最前面的幾點飛沫。三件都補上了，黑布才會變成墨。
   ══════════════════════════════════════════════════════════ */

const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const NOISE = `
float hash21(vec2 p){
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}
/* 內插過的值雜訊。第一版用的是 floor() 直接取值，沒有這一段 smoothstep
   內插，所以前緣是一階一階的長方形。 */
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i),              hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0,1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){ s += a * vnoise(p); p *= 2.07; a *= 0.5; }
  return s / 0.875;              // 正規化回 0..1
}`;

// 模擬：沿著前緣注入能量，讓它自己擴散
const SIM = `#version 300 es
precision highp float;
uniform sampler2D uWave;
uniform vec2  uRes;
uniform float uFront;     // 前緣位置 0..1
uniform float uSpeed;     // c²
uniform float uDamping;
uniform float uInject;    // 注入強度
uniform float uSeed;
out vec4 o;
${NOISE}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 t  = 1.0 / uRes;

  float cur  = texture(uWave, uv).r;
  float prev = texture(uWave, uv).g;

  // 離散拉普拉斯
  float l = texture(uWave, uv + vec2(-t.x, 0.0)).r;
  float r = texture(uWave, uv + vec2( t.x, 0.0)).r;
  float u = texture(uWave, uv + vec2(0.0,  t.y)).r;
  float d = texture(uWave, uv + vec2(0.0, -t.y)).r;
  float lap = l + r + u + d - 4.0 * cur;

  float next = 2.0 * cur - prev + uSpeed * lap;
  next *= uDamping;

  // 吸收邊界：不做的話上下會反射回來，變成駐波
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  next *= smoothstep(0.0, 0.06, edge);

  // 沿前緣注入。強度沿 y 起伏 → 有的地方衝得快、有的地方慢，那就是舌頭的來源。
  // 兩個頻率疊起來：低頻決定大舌頭在哪，高頻讓每根舌頭自己再分岔。
  float band = 1.0 - smoothstep(0.0, 0.055, abs(uv.x - uFront));
  float bias = 0.34
             + 0.46 * fbm(vec2(uv.y *  4.3, uSeed))
             + 0.20 * fbm(vec2(uv.y * 15.7, uSeed + 31.0));
  next = mix(next, uInject * bias, band * 0.85);

  o = vec4(clamp(next, -1.0, 1.0), cur, 0.0, 1.0);
}`;

// 顯示：把波場當成前緣的位移量，再疊上滲、飛白、飛沫
const DRAW = `#version 300 es
precision highp float;
uniform sampler2D uWave;
uniform vec2  uRes;
uniform float uLead;
uniform float uTrail;
uniform float uWobble;
uniform float uSeed;
out vec4 o;
${NOISE}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;

  // 取「前緣那一欄」的波高，不是取目前像素的。
  // 取目前像素會讓同一列的位移隨 x 改變，整條邊就被拉斜了。
  float hL = texture(uWave, vec2(clamp(uLead,  0.002, 0.998), uv.y)).r;
  float hT = texture(uWave, vec2(clamp(uTrail, 0.002, 0.998), uv.y)).r;

  // 三個尺度的舌頭：大起伏、分岔、細絲
  float big  = fbm(vec2(uv.y *  3.1, uSeed +  7.0)) - 0.5;
  float mid  = fbm(vec2(uv.y * 12.5, uSeed + 19.0)) - 0.5;
  float fine = fbm(vec2(uv.y * 44.0, uSeed + 53.0)) - 0.5;
  // 後緣要用另一組，不然兩條邊會同步起伏，看起來像一條平移的帶子
  float bigT = fbm(vec2(uv.y *  2.7, uSeed + 71.0)) - 0.5;
  float midT = fbm(vec2(uv.y * 10.3, uSeed + 89.0)) - 0.5;

  float lead  = uLead  + hL * uWobble + big * 0.105 + mid * 0.040 + fine * 0.013;
  // 波場只在前緣注入，後緣那一欄的波高幾乎是 0 —— 第一版因此讓後緣變成
  // 一條死直線。後緣的形狀改由自己的雜訊負責，振幅還要比前緣大：
  // 墨被拖走的那一邊本來就比衝出去的那一邊散。
  float trail = uTrail + hT * uWobble * 0.5 + bigT * 0.135 + midT * 0.052 + fine * 0.016;

  float d  = lead - uv.x;        // >0 在墨裡面（離前緣多遠）
  float dt = uv.x - trail;       // >0 在墨裡面（離後緣多遠）

  // 兩條邊都是滲開的濃度梯度，不是一刀切。後緣散得更開。
  float ink = smoothstep(-0.004, 0.026, d) * smoothstep(-0.010, 0.042, dt);

  // 飛白：乾筆掃過生宣留下的白絲。
  // 絲要「順著筆走的方向」拉長 —— 墨由左往右走，所以 y 的頻率要低（絲少而粗）、
  // x 的頻率要高（沿途斷斷續續）。第一次寫反了，y 給了 78，結果整片變成掃描線。
  float dry = fbm(vec2(uv.y * 24.0, uv.x * 82.0 + uSeed));
  // 兩條邊各自吃一份。min(d,dt) 是「離最近的那條邊多遠」，
  // 所以墨的兩側都會起飛白，中間那塊才保持實。
  float near = smoothstep(0.16, 0.0, min(d, dt * 0.75));
  ink *= 1.0 - near * smoothstep(0.46, 0.80, dry) * 0.72;

  // 飛沫：前緣外面一小段距離內偶爾幾點，墨鋒才有速度感
  float sp = fbm(vec2(uv.y * 150.0, uv.x * 96.0 - uSeed));
  float ahead = smoothstep(-0.052, -0.004, d) * smoothstep(0.004, -0.004, d);
  ink = max(ink, smoothstep(0.78, 0.96, sp) * ahead * 0.85);
  // 後緣拖出去的殘墨：比飛沫長、比飛沫淡，像筆離開紙面時帶起來的那一道
  float tail = fbm(vec2(uv.y * 58.0, uv.x * 30.0 + uSeed + 11.0));
  float behind = smoothstep(-0.075, -0.004, dt) * smoothstep(0.004, -0.004, dt);
  ink = max(ink, smoothstep(0.66, 0.92, tail) * behind * 0.55);

  // 濃淡：整片不是同一個黑。全蓋滿的那幾幀只剩這一項在做事，
  // 沒有它就是一塊純黑的布 —— 那正是要避免的。
  float body = fbm(vec2(uv.x * 4.0, uv.y * 7.0 + uSeed)) * 0.55
             + fbm(vec2(uv.x * 17.0, uv.y * 23.0 + uSeed + 3.0)) * 0.45;
  vec3 dark = mix(vec3(0.006, 0.010, 0.016), vec3(0.055, 0.068, 0.082), body);

  // 濕邊：前緣那一條窄帶的反光，冷白偏藍，像月光打在還沒乾的墨上。
  // 要窄。寬了就變成一條發光的直邊，反而把墨的形狀蓋掉。
  float rim = smoothstep(0.0, 0.008, d) * smoothstep(0.024, 0.007, d) * step(0.0, dt);

  vec3 col = mix(dark, vec3(0.78, 0.85, 0.92), rim * 0.30);
  o = vec4(col, clamp(ink + rim * 0.14, 0.0, 1.0));
}`;

export function createInkWave(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', { alpha:true, premultipliedAlpha:false, antialias:false });
  if (!gl) return null;
  const RES = opts.res ?? 256;

  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const prog = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    return p;
  };
  const pSim = prog(SIM), pDraw = prog(DRAW);
  if (!pSim || !pDraw) return null;

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.getExtension('EXT_color_buffer_float');
  const mkTarget = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, RES, RES, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo };
  };
  let a = mkTarget(), b = mkTarget();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const U = (p, n) => gl.getUniformLocation(p, n);
  const uSim = { wave:U(pSim,'uWave'), res:U(pSim,'uRes'), front:U(pSim,'uFront'),
                 speed:U(pSim,'uSpeed'), damp:U(pSim,'uDamping'), inj:U(pSim,'uInject'), seed:U(pSim,'uSeed') };
  const uDraw = { wave:U(pDraw,'uWave'), res:U(pDraw,'uRes'), lead:U(pDraw,'uLead'),
                  trail:U(pDraw,'uTrail'), wob:U(pDraw,'uWobble'), seed:U(pDraw,'uSeed') };

  let seed = Math.random() * 100;

  function reset(){
    [a, b].forEach(t => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    seed = Math.random() * 100;
  }

  /** 推一步模擬並畫出來。lead / trail 是 0..1 的前後緣位置。 */
  function step(lead, trail, substeps = 2){
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    gl.useProgram(pSim);
    gl.uniform2f(uSim.res, RES, RES);
    gl.uniform1f(uSim.speed, 0.30);
    gl.uniform1f(uSim.damp, 0.990);
    gl.uniform1f(uSim.inj, 0.95);
    gl.uniform1f(uSim.seed, seed);
    gl.viewport(0, 0, RES, RES);
    for (let i = 0; i < substeps; i++){
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform1i(uSim.wave, 0);
      gl.uniform1f(uSim.front, lead);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const t = a; a = b; b = t;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pDraw);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.uniform1i(uDraw.wave, 0);
    gl.uniform2f(uDraw.res, canvas.width, canvas.height);
    gl.uniform1f(uDraw.lead, lead);
    gl.uniform1f(uDraw.trail, trail);
    gl.uniform1f(uDraw.wob, 0.16);
    gl.uniform1f(uDraw.seed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize(w, h){ canvas.width = w; canvas.height = h; }
  return { step, reset, resize, gl };
}

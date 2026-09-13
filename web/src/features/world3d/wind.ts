import { Object3D, Vector2 } from 'three';

/**
 * 風場 —— 全場共用的一陣風。
 *
 * 移植自 cortiz2894/stylized-components 的 grassField(MIT, Christian Ortiz 2026,
 * 授權全文在同目錄 STYLIZED-COMPONENTS-LICENSE.txt)。原始碼在
 * `design/stylized-components/src/components/grassField/shaders/grassBlade.ts`,
 * 那邊是 React Three Fiber + r182,這裡改寫成與框架無關的原生模組。
 *
 * # 為什麼風必須是「一個」函式
 *
 * 各自抖的話,每一株的相位都是獨立的隨機數,整片竹林會同時往各個方向動,
 * 眼睛讀到的是雜訊,不是風。真正的風是一道**走過去的波**:同一時刻,上風處
 * 已經彎了,下風處還沒開始。所以強度是位置沿風向的投影與時間的函數。
 *
 * 原專案的 README 講得更直接:樹和草要「sway to the same gust」——
 * 葉子、花、草共用同一份 GLSL,只有振幅不同。這裡照辦,而且多做一件事:
 * **CPU 端有一份數值完全相同的鏡像**(`windAt`),所以用 pivot 轉的大東西
 * (旗、招牌、少數幾根大枝)與 GPU 上成千上萬的實例吃的是同一陣風。
 * 兩份公式一旦分開就會漂,所以底下的 GLSL 與 TS 是逐項對照寫的。
 *
 * # 三層正弦,不是一層
 *
 *   primary  沿風向的主波
 *   second   2.6 倍頻、1.8 倍速的諧波,權重 .35 —— 破掉主波的規律
 *   turb     垂直風向的擾動,權重由 turbulence 控制 —— 讓波前不是一條直線
 *
 * 只有主波的話,整片草會像節拍器一樣整齊擺動。
 *
 * # 與上游的一個差異:時間項的正負號
 *
 * 上游寫的是 `sin(along * freq + t * speed)`。把相位固定下來解一次就知道,
 * 那條波的波峰隨時間往 **along 變小**的方向走 —— 也就是往上風處跑。畫面上
 * 看起來還是有風,但它跑錯邊了:下風處的竹子會先彎,上風處才跟上。
 *
 * 這裡改成減號。這不是風格偏好,是這個檔案存在的唯一理由 —— 一陣風要從上風
 * 處走到下風處,不然「同一陣風」跟「每株各自抖」在觀感上就沒有差別了,也就
 * 沒有必要為它寫一個共用的場。`wind.test.ts` 用互相關量這件事。
 *
 * 改了就要兩邊一起改:底下的 `windAt()` 是同一條公式的 CPU 鏡像。
 */

/** 風的參數。GPU 與 CPU 兩邊吃同一份。 */
export interface WindParams {
  /** 吹的方向(世界座標 xz),會被正規化。 */
  direction: Vector2;
  /** 擺動幅度。 */
  strength: number;
  /** 波沿風向前進的速度。 */
  speed: number;
  /** 空間頻率:越大,波長越短。 */
  frequency: number;
  /** 垂直風向的擾動量。 */
  turbulence: number;
  /** 常態的傾倒量 —— 風停時草也不是完全直立的。 */
  lean: number;
}

export const DEFAULT_WIND: WindParams = {
  direction: new Vector2(0.82, 0.57),
  strength: 0.34,
  speed: 1.15,
  frequency: 0.42,
  turbulence: 0.3,
  lean: 0.22,
};

/**
 * 共用的 GLSL。注入到任何 vertex shader 裡就能呼叫 `windAt(vec2 worldXZ, float t)`。
 *
 * 這段與底下的 `windAt()` 必須逐項相同。改一邊就要改另一邊 ——
 * 旗子與竹林吃到不同的風,是這個檔案存在的意義被打破。
 */
export const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform vec2  uWindDir;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindFreq;
uniform float uWindTurb;
uniform float uWindLean;

float windAt(vec2 p, float t) {
  float along   = dot(p, uWindDir);
  float primary = sin(along * uWindFreq - t * uWindSpeed);
  float second  = sin(along * uWindFreq * 2.6 - t * uWindSpeed * 1.8 + 1.3) * 0.35;
  vec2  perp    = vec2(-uWindDir.y, uWindDir.x);
  float turb    = sin(dot(p, perp) * uWindFreq * 1.9 - t * uWindSpeed * 0.7 + 2.6) * uWindTurb;
  return primary + second + turb;
}
`;

/**
 * 把風套到一支 instanced 的草/竹葉 vertex shader 上。
 *
 * 兩個關鍵,都是原專案踩過的坑:
 *
 * 1. **高度遮罩要平方。** `hMask = h * h` 讓根部釘在地上、只有梢在動。
 *    線性遮罩會讓整株平移,草看起來像在地上滑。
 *
 * 2. **風是世界向量,而頂點在 local 空間。** 每個實例有各自的 Y 軸隨機旋轉,
 *    所以 local +X 在每一株指向不同方向 —— 直接加會讓整片草**散開**而不是
 *    一起倒。解法是用 instanceMatrix 的旋轉轉置把風帶回 local。
 *    欄位先正規化以去掉非等比縮放,剩下純旋轉,轉置就是逆。
 *
 * 3. **位移要除以實例的縮放。**(這一條是這個場景加的。)同一個場要同時吹
 *    三十公分的枯草與九公尺的竹子,而兩者用的是同一份單位高度的幾何、
 *    差別全在 instanceMatrix 的 scale。不除的話,local 空間的位移會再被
 *    scale 乘一次:草只動兩公分,竹子動九公尺。除掉之後 `uSway` 的單位是
 *    **世界公尺**,一眼就看得出調的是什麼 —— 草 0.09、竹 0.5。
 *
 * `uSway` 是逐材質的,不在共用的 uniform 袋裡:一陣風只有一個,但一陣風
 * 吹得動草多少、吹得動竹子多少,本來就是兩件事。
 */
export const WIND_VERTEX_CHUNK = /* glsl */ `
  float wH = position.y;
  float hMask = wH * wH;
  vec3 wBase = vec3(instanceMatrix[3].xyz);
  float gust = windAt(wBase.xz, uTime);

  mat3 instRot = mat3(
    normalize(vec3(instanceMatrix[0])),
    normalize(vec3(instanceMatrix[1])),
    normalize(vec3(instanceMatrix[2]))
  );
  vec3 windWorld = vec3(uWindDir.x, 0.0, uWindDir.y);
  vec3 windLocal = transpose(instRot) * windWorld;

  vec3 instScale = vec3(
    length(vec3(instanceMatrix[0])),
    length(vec3(instanceMatrix[1])),
    length(vec3(instanceMatrix[2]))
  );
  vec3 windOffset = windLocal * (uSway * (gust * uWindStrength + uWindLean) * hMask);
  // 往下風傾倒的同時略微下沉:彎腰的東西會變矮,不會原地保持全高。
  windOffset.y -= uSway * abs(gust) * 0.12 * hMask;
  transformed += windOffset / max(instScale, vec3(1e-4));
`;

/** 逐材質的擺幅,單位是世界公尺(梢部在 gust = 1 時走多遠)。 */
export const WIND_SWAY_UNIFORM = /* glsl */ `uniform float uSway;`;

/** 建一組可以直接塞進 material 的 uniform。所有材質共用同一組物件。 */
export function createWindUniforms(params: WindParams = DEFAULT_WIND) {
  const dir = params.direction.clone().normalize();
  return {
    uTime: { value: 0 },
    uWindDir: { value: dir },
    uWindStrength: { value: params.strength },
    uWindSpeed: { value: params.speed },
    uWindFreq: { value: params.frequency },
    uWindTurb: { value: params.turbulence },
    uWindLean: { value: params.lean },
  };
}

export type WindUniforms = ReturnType<typeof createWindUniforms>;

/**
 * CPU 端的鏡像。與 WIND_GLSL 的 `windAt` 逐項相同 —— 這是旗子與竹林
 * 吃到同一陣風的原因。回傳值約在 −1.65…1.65,沒有夾。
 */
export function windAt(x: number, z: number, time: number, u: WindUniforms): number {
  const dx = u.uWindDir.value.x;
  const dz = u.uWindDir.value.y;
  const freq = u.uWindFreq.value;
  const speed = u.uWindSpeed.value;

  const along = x * dx + z * dz;
  const primary = Math.sin(along * freq - time * speed);
  const second = Math.sin(along * freq * 2.6 - time * speed * 1.8 + 1.3) * 0.35;
  // 垂直風向:把方向轉 90°。
  const perp = x * -dz + z * dx;
  const turb = Math.sin(perp * freq * 1.9 - time * speed * 0.7 + 2.6) * u.uWindTurb.value;
  return primary + second + turb;
}

/**
 * 主波從一點走到另一點要多久。
 *
 * 完全由公式導出:相位 `along·freq − t·speed` 固定時,`along` 每秒前進
 * `speed / freq`。測試拿它當預期值,而不是另外抄一個數字 —— 抄的那個數字
 * 在有人調 speed 的那一天就會變成一個沉默的謊。
 */
export function gustTravelTime(distanceAlongWind: number, params: WindParams): number {
  return (distanceAlongWind * params.frequency) / params.speed;
}

interface Swayer {
  pivot: Object3D;
  /** 這一件有多軟:1 是竹子,0.3 是粗枝,2 是布。 */
  give: number;
}

/**
 * 給**少數幾件大東西**用的 pivot 擺動(旗、招牌、大枝)。
 *
 * 為什麼不全部走 GPU:instancing 划算的前提是同一份幾何重複成千上萬次。
 * 一面旗只有一件,為它開一支 instanced shader 是反過來的成本。
 * 但它吃的風必須與草一樣,所以這裡讀的是同一組 uniform。
 */
export interface WindField {
  readonly uniforms: WindUniforms;
  /** 註冊一件會被吹的東西;回傳取消註冊的函式。 */
  add(pivot: Object3D, give?: number): () => void;
  /** 每格呼叫一次:推進時間,並寫好所有 pivot 的姿勢。 */
  update(time: number): void;
  /** 某點某刻的風力。給其他系統(粒子、聲音)取用。 */
  strengthAt(x: number, z: number, time: number): number;
  readonly count: number;
}

export function createWind(params: WindParams = DEFAULT_WIND): WindField {
  const uniforms = createWindUniforms(params);
  const swayers: Swayer[] = [];
  const dir = uniforms.uWindDir.value;

  return {
    uniforms,
    add(pivot, give = 1) {
      const swayer: Swayer = { pivot, give };
      swayers.push(swayer);
      return () => {
        const i = swayers.indexOf(swayer);
        if (i >= 0) swayers.splice(i, 1);
      };
    },
    update(time) {
      uniforms.uTime.value = time;
      for (const s of swayers) {
        const p = s.pivot.position;
        const gust = windAt(p.x, p.z, time, uniforms);
        const bend =
          (gust * uniforms.uWindStrength.value + uniforms.uWindLean.value) * s.give * 0.2;
        // 繞垂直於風向的軸彎:被風吹是倒向下風處,不是原地扭。
        s.pivot.rotation.z = bend * dir.x;
        s.pivot.rotation.x = -bend * dir.y;
      }
    },
    strengthAt(x, z, time) {
      return windAt(x, z, time, uniforms);
    },
    get count() {
      return swayers.length;
    },
  };
}

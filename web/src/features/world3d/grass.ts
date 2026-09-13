import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  Vector3,
  type Texture,
} from 'three';

import { WIND_GLSL, WIND_SWAY_UNIFORM, WIND_VERTEX_CHUNK, type WindUniforms } from './wind';

/**
 * 實例化的植被:荒草與竹子。
 *
 * 移植自 cortiz2894/stylized-components 的 grassField(MIT, Christian Ortiz 2026,
 * 授權全文在同目錄 `STYLIZED-COMPONENTS-LICENSE.txt`)。原始碼是 React Three
 * Fiber + r182,這裡改寫成與框架無關的原生模組;保留的是**三個手法**:
 * 面積加權的散佈、漸縮的葉片幾何、以及兩個把「一片草」跟「一堆草的貼片」
 * 分開的著色決定(強制 +Y 法線、每株只取一次陰影)。
 *
 * 為什麼值得移植而不是自己寫:
 *
 *  - **面積加權**:直覺的做法是在包圍盒裡灑點再往下射線。落在空隙裡的取樣
 *    全部作廢,所以密度要往上灌,灌完還是不均勻。照三角形面積抽,每一個實例
 *    都落在面上,而 `density` 真的就是「每平方公尺幾株」。
 *  - **可重現**:種子亂數。同一塊地永遠長出同一片草 —— 重新載入不會洗牌。
 *  - **強制 +Y 法線**:一片草是有隨機 Y 旋轉的平面,真法線會讓每一株的
 *    NdotL 都不同,整片草在鏡頭移動時會閃。把著色法線壓成 +Y,亮度就只取決於
 *    它**站在哪裡**,不取決於它轉向哪裡。
 *
 * 沒有移植的:泥地遮罩、石頭踐踏、背光透光、debug 視圖。這個場景是夜景,
 * 透光沒有光源可透;泥地與踐踏是另一個世界的問題。
 *
 * **實例化的東西一律不投影。** 上游的 README 講得很清楚:在 vertex shader 裡
 * 位移的東西,shadow pass 的 depth material 並不知道它動過,所以會投出一個
 * 完全靜止的影子 —— 東西在搖、影子不動,比沒有影子更糟。要修得配一支
 * `customDepthMaterial` 重放同一段風的 GLSL。這個場景的方向光只框住大廳那一段
 * (見 world.ts),草與竹本來就在框外,所以這裡選擇不投,而不是多養一支材質。
 */

/** 種子亂數(LCG)。同一顆種子永遠給出同一片草。 */
export function seededLcg(seed: number): () => number {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** 一塊面的三角形與累積面積表。 */
export interface SurfaceSampler {
  /** 每個三角形攤平成 [ax,ay,az, bx,by,bz, cx,cy,cz]。 */
  verts: number[];
  /** cumArea[i] = 到第 i 個三角形為止的總面積。 */
  cumArea: number[];
  totalArea: number;
}

/** 呼叫端要先把 `mesh.matrixWorld` 更新好。 */
export function buildSurfaceSampler(mesh: Mesh): SurfaceSampler {
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  const idx = mesh.geometry.index;
  const mw = mesh.matrixWorld;

  const verts: number[] = [];
  const cumArea: number[] = [];
  let totalArea = 0;

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  const n = new Vector3();

  const triCount = idx === null ? pos.count / 3 : idx.count / 3;
  for (let f = 0; f < triCount; f++) {
    const i0 = idx === null ? f * 3 : idx.getX(f * 3);
    const i1 = idx === null ? f * 3 + 1 : idx.getX(f * 3 + 1);
    const i2 = idx === null ? f * 3 + 2 : idx.getX(f * 3 + 2);
    a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
    b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
    c.fromBufferAttribute(pos, i2).applyMatrix4(mw);

    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    const dbl = n.length(); // = 兩倍的三角形面積
    if (dbl < 1e-8) continue;

    totalArea += dbl * 0.5;
    cumArea.push(totalArea);
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }

  return { verts, cumArea, totalArea };
}

/** 面積加權的隨機一點。先照面積抽三角形(對累積表二分搜),再抽重心座標。 */
export function samplePoint(s: SurfaceSampler, rng: () => number, out: Vector3): Vector3 {
  if (s.cumArea.length === 0) return out.set(0, 0, 0);
  const r = rng() * s.totalArea;
  let lo = 0;
  let hi = s.cumArea.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.cumArea[mid]! < r) lo = mid + 1;
    else hi = mid;
  }
  const t = lo * 9;

  let u = rng();
  let v = rng();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  const w = 1 - u - v;

  return out.set(
    s.verts[t]! * w + s.verts[t + 3]! * u + s.verts[t + 6]! * v,
    s.verts[t + 1]! * w + s.verts[t + 4]! * u + s.verts[t + 7]! * v,
    s.verts[t + 2]! * w + s.verts[t + 5]! * u + s.verts[t + 8]! * v,
  );
}

/**
 * 漸縮的葉片幾何:底寬 1、高 1,躺在 XY 平面上,實際大小由 instanceMatrix 給。
 *
 * ```
 *    v6  ← 梢   (y = 1.00)
 *   v4-v5       (y = 0.66)
 *   v2-v3       (y = 0.33)
 *   v0-v1 ← 根  (y = 0.00)
 * ```
 *
 * `segments` 是**彎曲的品質旋鈕**,也是唯一會吃頂點數的參數。風是逐頂點對著
 * 平方的高度遮罩施加的,所以葉片不是沿著曲線彎,是沿著一條**折線**彎,一段
 * 一個關節。風小的時候三段就夠;風一大,關節就看得出來。
 *
 * 半寬用 `(1-t)^1.2` 而不是線性:指數讓輪廓微微內凹,線性會得到一個直邊的
 * 三角形,而直邊三角形讀起來是紙片,不是草。
 */
export function makeBladeGeometry(segments = 4): BufferGeometry {
  const seg = Math.max(1, Math.round(segments));
  const positions = new Float32Array((seg * 2 + 1) * 3);
  for (let i = 0; i < seg; i++) {
    const t = i / seg;
    const w = 0.5 * Math.pow(1 - t, 1.2);
    positions[i * 6 + 0] = -w;
    positions[i * 6 + 1] = t;
    positions[i * 6 + 3] = w;
    positions[i * 6 + 4] = t;
  }
  positions[seg * 6 + 1] = 1; // 梢,x = 0

  const indices: number[] = [];
  for (let i = 0; i < seg - 1; i++) {
    const l = i * 2;
    indices.push(l, l + 2, l + 1, l + 1, l + 2, l + 3);
  }
  indices.push((seg - 1) * 2, seg * 2, (seg - 1) * 2 + 1);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export interface WindMaterialOptions {
  /** 全場共用的風。所有實例材質都指到同一個物件。 */
  wind: WindUniforms;
  /** 梢部的擺幅,**世界公尺**。草 0.09,竹 0.5。 */
  sway: number;
  /** 根部的顏色。 */
  bottom: number;
  /** 梢部的顏色。根梢同色的草是一片綠漆。 */
  top: number;
  map?: Texture | null;
  alphaTest?: number;
  /** shader 程式的快取鍵。同一個鍵共用一支編譯好的程式。 */
  cacheKey: string;
}

/**
 * 吃風的實例材質。
 *
 * 用 MeshLambertMaterial 而不是裸的 ShaderMaterial:Lambert 已經帶著 three 的
 * 光照與陰影管線,我們只要覆寫 diffuseColor 再插一段位移。裸 shader 要自己把
 * 平行光、環境光、霧全部重接一遍,而那些東西這個場景都在用。
 */
export function makeWindMaterial(options: WindMaterialOptions): MeshLambertMaterial {
  const mat = new MeshLambertMaterial({
    color: 0xffffff,
    side: 2, // DoubleSide。葉片是單面的紙,背面也要看得見。
    map: options.map ?? null,
    alphaTest: options.alphaTest ?? 0,
    transparent: false,
  });

  const bottom = new Color(options.bottom);
  const top = new Color(options.top);

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, options.wind, {
      uSway: { value: options.sway },
      uBottom: { value: bottom },
      uTop: { value: top },
    });

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
${WIND_GLSL}
${WIND_SWAY_UNIFORM}
varying float vBladeH;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
  vBladeH = position.y;
${WIND_VERTEX_CHUNK}`,
    );
    // 著色法線壓成 +Y。真法線會讓每一株的 NdotL 不同,整片在鏡頭移動時會閃。
    shader.vertexShader = shader.vertexShader.replace(
      '#include <defaultnormal_vertex>',
      `#include <defaultnormal_vertex>
  transformedNormal = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );`,
    );

    shader.fragmentShader = `varying float vBladeH;
uniform vec3 uBottom;
uniform vec3 uTop;
${shader.fragmentShader}`;
    // 材質是 DoubleSide,three 會在背面把法線翻過來 —— 月亮在上方,翻過來就等於
    // 從下面打光,背面會變成一塊一塊草形的黑斑。所以這裡在翻面之後再壓一次。
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
  normal = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
  diffuseColor.rgb *= mix( uBottom, uTop, pow( clamp( vBladeH, 0.0, 1.0 ), 1.45 ) );`,
    );
  };

  // 每一支這種材質注入的 GLSL 完全一樣,所以它們必須**共用**一支編譯好的程式。
  // 逐實例的鍵會讓每一片草各編一次,而差異全在 uniform 上,程式是同一支。
  mat.customProgramCacheKey = () => options.cacheKey;
  return mat;
}

export interface ScatterOptions {
  geometry: BufferGeometry;
  material: MeshLambertMaterial;
  /** 每平方公尺幾株。 */
  density: number;
  /** 不管密度算出多少,最多這麼多。 */
  maxCount: number;
  /** 橫向的縮放範圍。 */
  width: readonly [number, number];
  /** 高度的縮放範圍,單位公尺(幾何是單位高)。 */
  height: readonly [number, number];
  /** 隨機歪斜的上限,弧度。 */
  tiltMax: number;
  seed: number;
  /**
   * 哪裡不准長。回傳 true 表示這一點作廢,重抽。
   *
   * 沒有它的話,草會長在台基上、廊道的地板上、以及第一章那條「鏡頭到殘旗」
   * 的視線上 —— 最後一個最要命:那一章有八成的畫面是旗,而一株長在鏡頭前
   * 三十公分的草會擋掉其中一半。
   */
  reject?: (x: number, z: number) => boolean;
}

/**
 * 把實例灑到一塊面上。
 *
 * 被 `reject` 擋掉的點會重抽,最多重抽八次。不是無限重試:如果拒絕域大到
 * 八次都抽不中,那是拒絕域寫錯了,而一個會卡住主執行緒的迴圈不會告訴你這件事。
 * 抽不中就把那個實例縮成零,它不畫、也不佔 draw call 之外的任何成本。
 */
export function scatter(surface: Mesh, options: ScatterOptions): InstancedMesh {
  surface.updateMatrixWorld(true);
  const s = buildSurfaceSampler(surface);
  const count = Math.min(Math.max(1, Math.round(options.density * s.totalArea)), options.maxCount);

  const mesh = new InstancedMesh(options.geometry, options.material, count);
  // 實例是世界座標放的,mesh 自己的包圍盒沒有意義。
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  const rng = seededLcg(options.seed);
  const dummy = new Object3D();
  const p = new Vector3();

  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      samplePoint(s, rng, p);
      if (options.reject === undefined || !options.reject(p.x, p.z)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      dummy.position.set(0, -1000, 0);
      dummy.scale.setScalar(0);
      dummy.rotation.set(0, 0, 0);
    } else {
      dummy.position.copy(p);
      dummy.rotation.set(
        (rng() - 0.5) * 2 * options.tiltMax,
        rng() * Math.PI * 2,
        (rng() - 0.5) * options.tiltMax,
      );
      const w = options.width[0] + rng() * (options.width[1] - options.width[0]);
      dummy.scale.set(w, options.height[0] + rng() * (options.height[1] - options.height[0]), w);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** 讀回第 i 個實例的世界位置。測試與粒子的生成點都要問它。 */
export function instancePosition(mesh: InstancedMesh, i: number, out: Vector3): Vector3 {
  const m = new Matrix4();
  mesh.getMatrixAt(i, m);
  return out.setFromMatrixPosition(m);
}

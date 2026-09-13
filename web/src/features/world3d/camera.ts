import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';

import { clamp, lerp, smoothstep } from './noise';

/**
 * 相機。
 *
 * 整個世界只被**一個數字**驅動:章節進度(0…4,小數就是章與章之間)。
 * 進度餵進兩條 CatmullRom 曲線 —— 一條給相機的位置,一條給它注視的點 ——
 * 於是章節之間永遠是滑過去的,不會有切鏡。「像一本畫冊在 3D 裡移動」
 * 這個感覺的來源就是這兩條曲線,不是任何動畫函式庫。
 *
 * 上面再疊三個修正,每一個都解掉一個具體的壞畫面:
 *   aspectFix  窄畫面把山門切一半
 *   intro      開場直接停在定點,沒有「走進來」
 *   parallax   閱讀段落跟著滑鼠晃
 */

export interface Waypoint {
  /** 相機站在哪。單位公尺,座標系與 world.ts 的場地平面圖同一套。 */
  p: readonly [number, number, number];
  /** 看哪裡。 */
  t: readonly [number, number, number];
  fov: number;
}

/**
 * 五個站位,一章一個。相機走的是**一次連續的參拜**:遠遠看見山門、
 * 走到門下、穿過院子、爬上台階、站到木堂前面。
 *
 * 注視點的 x 一律偏負,因為版面的閱讀欄在畫面左側 —— 注視點往左讓建築落在
 * 右邊,文字才不會壓在最忙的那一塊上。這是構圖決定,不是座標寫錯。
 */
export const WAYPOINTS: readonly Waypoint[] = [
  // 00 序:遠、低,山門逆著月亮成一個剪影,燈籠往深處縮小。
  { p: [2.4, 3.6, 34], t: [-7.5, 9.2, -14], fov: 34 },
  // 01 讓武:貼近、離軸,斗栱與匾額佔住右半,左邊只剩夜色。
  { p: [9.6, 2.5, 6.5], t: [-6.0, 8.6, -15], fov: 52 },
  // 02 段位:升高,越過院子看整段台階;雪在這一章最大。
  { p: [-9.0, 8.2, -6], t: [-6.5, 6.2, -46], fov: 44 },
  // 03 賽程:在院子裡看整段台階通上去 —— 六步的六步,畫面上就是這段飛梯。
  { p: [5.2, 4.0, -18], t: [-2.0, 10.5, -54], fov: 48 },
  // 04 赴約:台階腳下仰望木堂,山門已經在背後。
  //
  // 不站在台階頂:那裡離木堂**正面**只有十二公尺,而木堂有二十二公尺寬 ——
  // 視角裡只裝得下十公尺,整個畫面被格扇填滿,讀起來是一片黃黑條紋而不是
  // 一棟建築。一棟這麼寬的東西要站得出來,鏡頭得退到二十五公尺外。
  { p: [-5.5, 6.4, -34], t: [1.0, 13.5, -64], fov: 44 },
];

export interface PoseInput {
  /** 0…WAYPOINTS.length-1 的連續章節進度。 */
  progress: number;
  /** 視窗寬高比。 */
  aspect: number;
  /** 開場推軌的完成度,0 是最遠、1 是就位。 */
  intro: number;
  /** 已阻尼過的指標偏移,各自 -1…1。 */
  pointerX: number;
  pointerY: number;
}

export interface Pose {
  position: Vector3;
  target: Vector3;
  fov: number;
}

/**
 * 窄畫面的補償量,0…1。
 *
 * 每個 waypoint 都是為寬螢幕構的圖。同一組數字在手機直立時會把山門切一半,
 * 所以相機沿自己的視線軸後退、順便開大 fov,而不是放任兩側掉出畫面。
 * 退後**沿視線軸**是關鍵:往任何別的方向退都會改變構圖的角度。
 */
export function aspectFix(aspect: number): number {
  return clamp((1.62 - aspect) / 1.05, 0, 1);
}

/** 退多遠。乘在 aspectFix 上,單位公尺。 */
const ASPECT_DOLLY = 9.4;
/** 窄畫面同時抬高一點,免得退到後面被地面擋住。 */
const ASPECT_LIFT = 1.2;
/** 開場從多遠推進來。 */
const INTRO_DOLLY = 7.2;

export interface CameraRig {
  /** 算出一個機位。回傳的是內部重複使用的物件 —— 迴圈裡不配置新物件。 */
  sample(input: PoseInput): Pose;
  applyTo(camera: PerspectiveCamera, input: PoseInput): void;
  dispose(): void;
}

export function createCameraRig(waypoints: readonly Waypoint[] = WAYPOINTS): CameraRig {
  const curveP = new CatmullRomCurve3(
    waypoints.map((w) => new Vector3(w.p[0], w.p[1], w.p[2])),
    false,
    'catmullrom',
    0.42,
  );
  const curveT = new CatmullRomCurve3(
    waypoints.map((w) => new Vector3(w.t[0], w.t[1], w.t[2])),
    false,
    'catmullrom',
    0.42,
  );

  const pose: Pose = { position: new Vector3(), target: new Vector3(), fov: 40 };
  const axis = new Vector3();
  const last = waypoints.length - 1;

  function sample(input: PoseInput): Pose {
    const prog = clamp(input.progress, 0, last);
    const u = last === 0 ? 0 : prog / last;
    curveP.getPoint(u, pose.position);
    curveT.getPoint(u, pose.target);

    const i = clamp(Math.floor(prog), 0, Math.max(0, last - 1));
    const f = clamp(prog - i, 0, 1);
    let fov = lerp(waypoints[i]!.fov, waypoints[Math.min(i + 1, last)]!.fov, f);

    const fix = aspectFix(input.aspect);
    if (fix > 0) {
      axis.subVectors(pose.position, pose.target).normalize();
      pose.position.addScaledVector(axis, fix * ASPECT_DOLLY);
      pose.position.y += fix * ASPECT_LIFT;
      fov *= 1 + fix * 0.4;
    }

    // 開場推軌:從更遠、更長焦處推進來。反過來說,intro 到 1 之後這一段是零。
    const out = 1 - clamp(input.intro, 0, 1);
    pose.position.z += out * INTRO_DOLLY;
    pose.position.y += out * 0.8;
    fov += out * 7;

    // 手持視差。進到第二章之後衰減到四成半 —— 敘事段落不該晃,
    // 但完全關掉又會在切章的那一刻「卡住」,所以是衰減不是關閉。
    const hold = 1 - smoothstep(0, 1.4, prog) * 0.55;
    pose.position.x += input.pointerX * 0.7 * hold;
    pose.position.y += input.pointerY * 0.38 * hold;
    pose.target.x -= input.pointerX * 0.22 * hold;
    pose.target.y -= input.pointerY * 0.13 * hold;

    pose.fov = fov;
    return pose;
  }

  return {
    sample,
    applyTo(camera, input) {
      const p = sample(input);
      camera.position.copy(p.position);
      camera.lookAt(p.target);
      if (Math.abs(camera.fov - p.fov) > 1e-4) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
    },
    dispose() {
      // 曲線沒有 GPU 資源,但留這個方法讓呼叫端的收尾長得一致。
    },
  };
}

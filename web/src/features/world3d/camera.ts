import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';

import { clamp, damp, lerp, smoothstep } from './noise';

/**
 * 相機。
 *
 * 整個世界只被**一個數字**驅動:章節進度(0…6,小數就是章與章之間)。
 * 進度餵進兩條 CatmullRom 曲線 —— 一條給相機的位置,一條給它注視的點 ——
 * 於是章節之間永遠是滑過去的,不會有切鏡。「像一本畫冊在 3D 裡移動」這個
 * 感覺的來源就是這兩條曲線,不是任何動畫函式庫。
 *
 * 上面疊四個修正,每一個都解掉一個具體的壞畫面:
 *
 *   damp        捲太快時鏡頭會瞬移,而瞬移過的那幾格是廢格
 *   guardPole   注視點快要正上/正下方時,lookAt 的 roll 會整個翻過去
 *   aspectFix   窄畫面把主體切一半
 *   intro       開場直接停在定點,沒有「走進來」
 */

export interface Waypoint {
  /** 相機站在哪。單位公尺,座標系與 world.ts 的場地平面圖同一套。 */
  p: readonly [number, number, number];
  /** 看哪裡。 */
  t: readonly [number, number, number];
  fov: number;
}

/**
 * 七個站位,一章一個。相機走的是一次連續的**夜行**:從前庭的殘旗底下進門、
 * 穿過竹林與傾斜的牌樓、從門楣上方的欄間進大廳、貼著剝漆的背牆走、抬頭看
 * 從破洞伸進來的梅枝、再退出門外推向那條門縫,最後遠遠地仰望屋脊。
 *
 * 幾個不能動的約束,每一個都來自規格的一句話:
 *
 *  01 殘旗要佔滿八成畫面 → 相機離掛點七公尺半、fov 30。再遠或再廣都不夠滿。
 *     而「月在旗後」要求月亮落在這條視線上 —— 所以 world.ts 的月亮位置與這個
 *     站位是一組的,改一個就要改另一個。
 *  02 橫移穿過竹林 → 站位在東側竹林裡,看向牌樓,竹子夾在中間。
 *  03 高角度推向木桌 → 從門楣上方進屋,俯角三十度。相機**穿牆**是靠欄間
 *     那一段格子爛光了,不是靠關閉碰撞 —— 見 buildings.ts 的 TRANSOM。
 *  06 正面推向門縫 → 從門洞退出去,再推回來。進與出走的是同一個洞。
 *  07 遠、低、仰望屋脊 → 站在竹林外緣、視線掠過迴廊的屋脊線。
 *
 * 注視點的 x 一律略偏,因為版面的閱讀欄在畫面左側 —— 注視點往左讓建築落在
 * 右邊,文字才不會壓在最忙的那一塊上。這是構圖決定,不是座標寫錯。
 */
export const WAYPOINTS: readonly Waypoint[] = [
  // 01 殘旗:正面、微仰。旗的掛點在 (−0.75, 4.58, 18),距離七公尺半。
  { p: [0.6, 2.4, 25.5], t: [-0.75, 4.58, 18], fov: 30 },
  // 02 歸寂:側移穿過竹林,看向傾斜的牌樓與插在地上的兩把劍。
  //    站位必須退到劍的**後面**:劍插在 z ≈ 9,鏡頭原本也在 z 8.5,結果那兩把
  //    劍貼在鏡頭上變成兩道橫過畫面的青光,而牌樓在它們後面小得看不見。
  { p: [12.0, 3.4, 16.0], t: [-1.0, 5.2, 5.4], fov: 46 },
  // 03 破頂:進到堂內,高角度推向斷腿木桌。
  { p: [4.2, 5.7, -25.4], t: [5.0, 1.7, -30.0], fov: 42 },
  // 04 朱印:貼著剝漆的背牆慢慢橫移。四公尺半的距離,fov 34 只裝得下兩公尺
  //    多的牆 —— 這一章要的就是看得見木紋與釘鏽。
  { p: [3.6, 2.5, -37.4], t: [-1.8, 4.9, -42.3], fov: 40 },
  // 05 花信:定鏡。抬頭看從破洞伸進來的梅枝橫過整個畫面。
  { p: [-0.6, 2.3, -31.0], t: [1.6, 7.6, -41.0], fov: 40 },
  // 06 啟門:退到門外,正面推向兩扇門之間那條縫。
  { p: [0.2, 2.6, -6.4], t: [0.0, 2.9, -18.0], fov: 38 },
  // 07 落款:遠、低,仰望屋脊。
  { p: [16.5, 1.4, 16.0], t: [1.0, 10.4, -26.0], fov: 28 },
];

export interface PoseInput {
  /** 0…WAYPOINTS.length-1 的連續章節進度。已經阻尼過。 */
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
 * 每個 waypoint 都是為寬螢幕構的圖。同一組數字在手機直立時會把主體切一半,
 * 所以相機沿自己的視線軸後退、順便開大 fov,而不是放任兩側掉出畫面。
 * 退後**沿視線軸**是關鍵:往任何別的方向退都會改變構圖的角度。
 */
export function aspectFix(aspect: number): number {
  return clamp((1.62 - aspect) / 1.05, 0, 1);
}

/** 退多遠。乘在 aspectFix 上,單位公尺。 */
const ASPECT_DOLLY = 7.6;
/** 窄畫面同時抬高一點,免得退到後面被地面擋住。 */
const ASPECT_LIFT = 0.9;
/** 開場從多遠推進來。 */
const INTRO_DOLLY = 6.0;

/**
 * 進度的阻尼半衰期(秒)。
 *
 * 這是「捲很快不會掉格、不會反向轉」的那一行。捲軸可以在一格之內跳好幾章
 * (拖捲軸、點章節目錄、手機上一甩),而曲線上跳過去的那一段會讓
 * `lookAt` 在一格內轉超過九十度 —— 畫面上讀到的是閃一下,不是運鏡。
 *
 * 半衰期 0.11 秒的意思是:目標跳到哪裡都好,鏡頭大約三格走一半、十格到位。
 * 再短就擋不住瞬移,再長會在正常捲動時拖尾。
 */
const PROGRESS_HALF_LIFE = 0.11;

/**
 * 視線方向與垂直軸的夾角的餘弦上限。
 *
 * `lookAt` 用固定的 up = (0,1,0) 建正交基:視線一旦接近垂直,up 與視線的
 * 外積會退化,rollback 的那一格畫面會整個轉過去(「翻過極點」)。這個世界的
 * 俯仰最多三十幾度,照理碰不到 —— 但 pointer 視差與 aspectFix 都會改站位,
 * 而「照理碰不到」是所有翻轉 bug 的共同開頭。所以夾死。
 */
const POLE_LIMIT = 0.965;

/** 把注視點推開一點,讓視線永遠不會與垂直軸平行。 */
export function guardPole(position: Vector3, target: Vector3): void {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dz = target.z - position.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-5) {
    target.z -= 1;
    return;
  }
  const vertical = dy / len;
  if (Math.abs(vertical) <= POLE_LIMIT) return;
  // 水平分量太小就補一個方向出來,再把它放大到剛好在極限上。
  const flat = Math.hypot(dx, dz);
  const wantFlat = len * Math.sqrt(1 - POLE_LIMIT * POLE_LIMIT);
  if (flat < 1e-5) {
    target.x = position.x;
    target.z = position.z - wantFlat;
  } else {
    const k = wantFlat / flat;
    target.x = position.x + dx * k;
    target.z = position.z + dz * k;
  }
  target.y = position.y + Math.sign(vertical) * len * POLE_LIMIT;
}

export interface CameraRig {
  /** 算出一個機位。回傳的是內部重複使用的物件 —— 迴圈裡不配置新物件。 */
  sample(input: PoseInput): Pose;
  /**
   * 把外面來的生進度推進一格,回傳阻尼過的值。
   *
   * 與 `sample` 分開,因為 `sample` 必須是**純的**:測試要能問「進度 3.5 的
   * 機位在哪」而不必先跑一段時間。阻尼是狀態,狀態留在這裡。
   */
  advance(progress: number, dt: number): number;
  applyTo(camera: PerspectiveCamera, input: PoseInput & { dt: number }): void;
  dispose(): void;
}

export function createCameraRig(waypoints: readonly Waypoint[] = WAYPOINTS): CameraRig {
  const curveP = new CatmullRomCurve3(
    waypoints.map((w) => new Vector3(w.p[0], w.p[1], w.p[2])),
    false,
    'catmullrom',
    0.4,
  );
  const curveT = new CatmullRomCurve3(
    waypoints.map((w) => new Vector3(w.t[0], w.t[1], w.t[2])),
    false,
    'catmullrom',
    0.4,
  );

  const pose: Pose = { position: new Vector3(), target: new Vector3(), fov: 40 };
  const axis = new Vector3();
  const last = waypoints.length - 1;
  let smooth = 0;
  let started = false;

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

    // 開場推軌:從更遠、更長焦處推進來。intro 到 1 之後這一段是零。
    const out = 1 - clamp(input.intro, 0, 1);
    pose.position.z += out * INTRO_DOLLY;
    pose.position.y += out * 0.7;
    fov += out * 6;

    // 手持視差。進到第二章之後衰減到四成半 —— 敘事段落不該晃,但完全關掉
    // 又會在切章的那一刻「卡住」,所以是衰減不是關閉。第三到五章在室內,
    // 鏡頭離牆只有幾公尺,視差再大就會穿牆。
    const hold = 1 - smoothstep(0, 1.4, prog) * 0.55;
    pose.position.x += input.pointerX * 0.5 * hold;
    pose.position.y += input.pointerY * 0.26 * hold;
    pose.target.x -= input.pointerX * 0.16 * hold;
    pose.target.y -= input.pointerY * 0.1 * hold;

    guardPole(pose.position, pose.target);
    pose.fov = fov;
    return pose;
  }

  function advance(progress: number, dt: number): number {
    const want = clamp(progress, 0, last);
    // 第一格不阻尼:重新整理時捲軸可能已經在第五章,從 0 滑過去要好幾秒,
    // 而那幾秒使用者看到的是一段他沒有要求的運鏡。
    if (!started) {
      started = true;
      smooth = want;
      return smooth;
    }
    smooth = damp(smooth, want, PROGRESS_HALF_LIFE, dt);
    return smooth;
  }

  return {
    sample,
    advance,

    applyTo(camera, input) {
      const p = sample({ ...input, progress: advance(input.progress, input.dt) });
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

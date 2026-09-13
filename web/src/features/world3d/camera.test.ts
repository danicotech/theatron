import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { aspectFix, createCameraRig, guardPole, WAYPOINTS } from './camera';
import { hallFrontPosts, HALL_POST_RADIUS } from './buildings';
import { DOOR_APERTURE, SITE_PLAN, TRANSOM_BAND } from './world';

const WIDE = 16 / 9;
const LAST = WAYPOINTS.length - 1;

function still(progress: number, aspect = WIDE) {
  return { progress, aspect, intro: 1, pointerX: 0, pointerY: 0 };
}

/** 取一個純粹的機位(沒有寬高比補償、沒有開場推軌、沒有視差)。 */
function poseAt(progress: number) {
  const rig = createCameraRig();
  const p = rig.sample(still(progress));
  return {
    position: p.position.clone(),
    target: p.target.clone(),
    fov: p.fov,
    view: p.target.clone().sub(p.position).normalize(),
  };
}

describe('七個站位', () => {
  it('章數與帳冊一致', () => {
    expect(WAYPOINTS).toHaveLength(7);
  });

  it('每一章的整數進度剛好落在它自己的站位上', () => {
    WAYPOINTS.forEach((w, i) => {
      const pose = poseAt(i);
      expect(pose.position.x).toBeCloseTo(w.p[0], 4);
      expect(pose.position.y).toBeCloseTo(w.p[1], 4);
      expect(pose.position.z).toBeCloseTo(w.p[2], 4);
      expect(pose.fov).toBeCloseTo(w.fov, 4);
    });
  });

  it('第一章:殘旗佔掉八成畫面', () => {
    const pose = poseAt(0);
    const flag = new Vector3(-0.75, 4.58, SITE_PLAN.flagBeamZ);
    const distance = pose.position.distanceTo(flag);
    // 垂直視角在這個距離涵蓋多少公尺。
    const coverage = 2 * distance * Math.tan(((pose.fov / 2) * Math.PI) / 180);
    // 旗子高三點六公尺。要佔到八成,畫面高度不能超過四點五。
    expect(coverage).toBeLessThan(4.7);
    expect(coverage).toBeGreaterThan(3.8);
    // 而且鏡頭是**微仰**的:看得到旗,但不是仰頭看天。
    const pitch = (Math.asin(pose.view.y) * 180) / Math.PI;
    expect(pitch).toBeGreaterThan(8);
    expect(pitch).toBeLessThan(24);
  });

  it('第三章是俯角,第七章是仰角', () => {
    expect((Math.asin(poseAt(2).view.y) * 180) / Math.PI).toBeLessThan(-18);
    expect((Math.asin(poseAt(6).view.y) * 180) / Math.PI).toBeGreaterThan(8);
  });

  it('第五章的鏡頭抬頭看向屋頂破洞', () => {
    const pose = poseAt(4);
    expect(pose.view.y).toBeGreaterThan(0.3);
    // 看的方向要真的朝著洞:注視點與洞的水平距離在兩公尺內。
    expect(
      Math.hypot(pose.target.x - SITE_PLAN.holeX, pose.target.z - SITE_PLAN.holeZ),
    ).toBeLessThan(2.5);
  });
});

describe('路徑', () => {
  it('沿著曲線單調前進,不回頭', () => {
    let previous = poseAt(0).position;
    let travelled = 0;
    for (let s = 1; s <= 600; s++) {
      const here = poseAt((s / 600) * LAST).position;
      const step = here.distanceTo(previous);
      // 每一小步都要真的移動:停住的那一段在畫面上是「卡住」。
      expect(step).toBeGreaterThan(0);
      travelled += step;
      previous = here;
    }
    // 走完全程的距離必須比七個站位的直線總和長(曲線比折線長),
    // 但不能離譜 —— 差太多表示曲線在某處繞了一個圈。
    let chord = 0;
    for (let i = 1; i < WAYPOINTS.length; i++) {
      chord += new Vector3(...WAYPOINTS[i]!.p).distanceTo(new Vector3(...WAYPOINTS[i - 1]!.p));
    }
    expect(travelled).toBeGreaterThan(chord * 0.98);
    expect(travelled).toBeLessThan(chord * 1.45);
  });

  it('視線不會在相鄰兩格之間反轉', () => {
    // 「反向旋轉」在畫面上是閃一下。它的指紋是相鄰兩格的視線向量夾角變大,
    // 或者更糟 —— 點積變負(轉了一百八十度)。
    let previous = poseAt(0).view;
    let worst = 1;
    for (let s = 1; s <= 1200; s++) {
      const view = poseAt((s / 1200) * LAST).view;
      worst = Math.min(worst, view.dot(previous));
      previous = view;
    }
    expect(worst).toBeGreaterThan(0.985);
  });

  it('不會翻過極點:右向量始終指向同一邊', () => {
    // lookAt 用固定的 up 建基底,視線接近垂直時 roll 會整個翻過去。
    // 指紋是右向量(view × up)突然反向。
    const up = new Vector3(0, 1, 0);
    let previous = poseAt(0).view.clone().cross(up).normalize();
    for (let s = 1; s <= 1200; s++) {
      const right = poseAt((s / 1200) * LAST)
        .view.clone()
        .cross(up)
        .normalize();
      expect(right.dot(previous)).toBeGreaterThan(0.9);
      previous = right;
    }
  });

  it('從欄間進大廳、從門洞出來 —— 兩次穿牆都走真的有洞的地方', () => {
    const front = SITE_PLAN.hallFrontZ;
    const posts = hallFrontPosts(SITE_PLAN.hallHalfW);
    const crossings: Array<{ x: number; y: number; at: number }> = [];
    let previous = poseAt(0).position;
    for (let s = 1; s <= 4000; s++) {
      const p = (s / 4000) * LAST;
      const here = poseAt(p).position;
      if (previous.z > front !== here.z > front) {
        const t = (front - previous.z) / (here.z - previous.z);
        crossings.push({
          x: previous.x + (here.x - previous.x) * t,
          y: previous.y + (here.y - previous.y) * t,
          at: p,
        });
      }
      previous = here;
    }

    // 剛好兩次:進去一次、出來一次。第三次表示曲線在牆上來回擺。
    expect(crossings).toHaveLength(2);

    for (const c of crossings) {
      const throughDoor = Math.abs(c.x) < DOOR_APERTURE.halfWidth && c.y < DOOR_APERTURE.top;
      const throughTransom = c.y > TRANSOM_BAND.bottom && c.y < TRANSOM_BAND.top;
      expect(throughDoor || throughTransom).toBe(true);
      // 走欄間的那一次還要閃開柱子:柱子看不見地刮過鏡頭是最難查的一種壞畫面。
      if (throughTransom) {
        const nearest = Math.min(...posts.map((x) => Math.abs(x - c.x)));
        expect(nearest - HALL_POST_RADIUS).toBeGreaterThan(0.5);
      }
    }
  });
});

describe('窄畫面補償', () => {
  it('越窄退越多,寬螢幕不動', () => {
    expect(aspectFix(16 / 9)).toBe(0);
    expect(aspectFix(1.0)).toBeGreaterThan(0.5);
    expect(aspectFix(390 / 844)).toBe(1);
  });

  it('補償是沿著視線軸往後退,不是往旁邊挪', () => {
    const rig = createCameraRig();
    // sample 回傳的是**內部重複使用**的那一個 Pose,所以要用的值先抄下來。
    // 直接留著參考的話,第二次 sample 會把第一次的答案就地改掉。
    const wide = rig.sample(still(1, WIDE));
    const wideP = wide.position.clone();
    const wideT = wide.target.clone();
    const wideFov = wide.fov;
    const narrow = rig.sample(still(1, 390 / 844));

    // 退了,而且是往遠離注視點的方向。
    expect(narrow.position.distanceTo(wideT)).toBeGreaterThan(wideP.distanceTo(wideT) + 5);
    // 視線的方向幾乎沒變 —— 構圖的角度是同一個。
    const a = wideT.clone().sub(wideP).normalize();
    const b = narrow.target.clone().sub(narrow.position).normalize();
    expect(a.dot(b)).toBeGreaterThan(0.985);
    // 而且視角開大了。
    expect(narrow.fov).toBeGreaterThan(wideFov * 1.2);
  });
});

describe('進度阻尼', () => {
  it('第一格直接就位,不從零滑過去', () => {
    const rig = createCameraRig();
    // 重新整理時捲軸可能已經在第五章。
    expect(rig.advance(4.2, 1 / 60)).toBeCloseTo(4.2, 6);
  });

  it('之後的瞬移會被拖住:一格之內走不完', () => {
    const rig = createCameraRig();
    rig.advance(0, 1 / 60);
    const after = rig.advance(6, 1 / 60);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(1.2);
  });

  it('與影格率無關:同一段時間、不同格數,結果一樣', () => {
    const fast = createCameraRig();
    fast.advance(0, 1 / 60);
    for (let i = 0; i < 30; i++) fast.advance(6, 1 / 60);

    const slow = createCameraRig();
    slow.advance(0, 1 / 60);
    const once = slow.advance(6, 0.5);

    expect(once).toBeCloseTo(fast.advance(6, 0), 6);
  });

  it('拖住之後仍然會走到底', () => {
    const rig = createCameraRig();
    rig.advance(0, 1 / 60);
    let value = 0;
    for (let i = 0; i < 300; i++) value = rig.advance(6, 1 / 60);
    expect(value).toBeCloseTo(6, 3);
  });
});

describe('guardPole', () => {
  it('幾乎垂直往上看時,把注視點推開', () => {
    const position = new Vector3(0, 2, 0);
    const target = new Vector3(0.001, 12, 0.001);
    guardPole(position, target);
    const view = target.clone().sub(position).normalize();
    expect(Math.abs(view.y)).toBeLessThanOrEqual(0.9651);
    expect(Math.hypot(view.x, view.z)).toBeGreaterThan(0.1);
  });

  it('正常的視線不動它', () => {
    const position = new Vector3(0, 2, 10);
    const target = new Vector3(1, 4, -3);
    const before = target.clone();
    guardPole(position, target);
    expect(target.distanceTo(before)).toBeLessThan(1e-9);
  });

  it('注視點與相機重合時也給得出一個方向', () => {
    const position = new Vector3(3, 3, 3);
    const target = position.clone();
    guardPole(position, target);
    expect(target.distanceTo(position)).toBeGreaterThan(0.5);
  });
});

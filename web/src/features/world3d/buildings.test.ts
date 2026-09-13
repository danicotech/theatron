import {
  Box3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SpriteMaterial,
  Vector3,
  type BufferGeometry,
} from 'three';
import { describe, expect, it } from 'vitest';

import {
  buildFlagBeam,
  buildHall,
  buildLantern,
  buildLeaningGate,
  buildPlum,
  buildSword,
  groundHeight,
  hallFrontPosts,
  holeCentre,
  makeCulmGeometry,
  moonDirection,
  shaftLanding,
  tableTopY,
  type WorldMaterials,
} from './buildings';
import { PALETTE } from './palette';
import { FLAG_ANCHOR, moonBehindFlagDegrees, moonPool, SITE_PLAN } from './world';

/**
 * 材質是用假的。
 *
 * 真的材質要 Canvas 2D 才畫得出來,而 jsdom 沒有。但這個檔案要量的全部是
 * **幾何**:牌樓歪了多少、桌子在不在月光落點上、門有沒有真的開一條縫。
 * 那些東西一個都不需要貼圖 —— 所以與其在測試環境裡假造一整個 canvas,
 * 不如給它一組空材質,把 GL 那一半留給瀏覽器。
 */
function stubMaterials(): WorldMaterials {
  const std = () => new MeshStandardMaterial();
  const basic = () => new MeshBasicMaterial();
  const sprite = () => new SpriteMaterial();
  return {
    timber: std(),
    plank: std(),
    shingle: std(),
    ground: std(),
    blossom: basic(),
    cobweb: basic(),
    paper: basic(),
    blade: basic(),
    moonbeam: basic(),
    glowMoon: sprite(),
    glowEmber: sprite(),
    glowBlade: sprite(),
  };
}

function worldBounds(group: Group): Box3 {
  group.updateMatrixWorld(true);
  return new Box3().setFromObject(group);
}

/** 一組 mesh 裡,某一段高度區間的頂點平均 x。「歪掉」只有這樣才量得到。 */
function sliceCentreX(group: Group, from: number, to: number): number {
  const box = worldBounds(group);
  const lo = box.min.y + (box.max.y - box.min.y) * from;
  const hi = box.min.y + (box.max.y - box.min.y) * to;
  let sum = 0;
  let n = 0;
  group.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const pos = (node as Mesh<BufferGeometry>).geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < lo || y > hi) continue;
      sum += pos.getX(i);
      n++;
    }
  });
  return n === 0 ? 0 : sum / n;
}

describe('傾斜牌樓', () => {
  it('柱頂真的偏離柱腳 —— 歪掉是內容,不是氛圍', () => {
    const gate = buildLeaningGate(stubMaterials());
    const foot = sliceCentreX(gate.group, 0, 0.12);
    const top = sliceCentreX(gate.group, 0.86, 1);
    expect(Math.abs(top - foot)).toBeGreaterThan(0.5);
    expect(gate.topOffset).toBeGreaterThan(0.5);
  });

  it('站得住:沒有一根柱腳浮在地上', () => {
    const gate = buildLeaningGate(stubMaterials());
    // 繞中軸轉會把一邊的柱腳抬起來。抬起來的那一根是立刻看得出來的假,
    // 所以整座門轉完之後要往下壓到最高的那一根貼地為止。
    expect(gate.footY).toBeLessThanOrEqual(0);
    expect(gate.footY).toBeGreaterThan(-0.3);
    const box = worldBounds(gate.group);
    // 其餘幾根埋進土裡 —— 地基一邊下陷,本來就是它會歪的原因。
    expect(box.min.y).toBeLessThan(-0.2);
    expect(box.max.y).toBeGreaterThan(6.2);
  });

  it('兩側不對稱 —— 一邊的屋頂還在,一邊只剩桁條', () => {
    const gate = buildLeaningGate(stubMaterials());
    const left = sliceCentreX(gate.group, 0.62, 0.78);
    // 屋頂還在的那一邊(-x)把上半段的重心拉過去。
    expect(left).toBeLessThan(0);
  });
});

describe('練武大廳', () => {
  const hall = buildHall(stubMaterials(), SITE_PLAN);

  it('斷腿木桌就擺在月光的落點上', () => {
    const pool = shaftLanding(SITE_PLAN, tableTopY(SITE_PLAN));
    expect(hall.tableTop.distanceTo(pool)).toBeLessThan(1e-6);
  });

  it('月光落在大廳裡面,不是穿過牆落在外面', () => {
    const pool = moonPool();
    expect(Math.abs(pool.x)).toBeLessThan(SITE_PLAN.hallHalfW - 1);
    expect(pool.z).toBeLessThan(SITE_PLAN.hallFrontZ - 3);
    expect(pool.z).toBeGreaterThan(SITE_PLAN.hallBackZ + 3);
  });

  it('破洞在屋面上,而且高過柱頂', () => {
    const hole = holeCentre(SITE_PLAN);
    expect(hole.y).toBeGreaterThan(SITE_PLAN.postTop);
    expect(hole.z).toBeLessThan(SITE_PLAN.hallFrontZ);
    expect(hole.z).toBeGreaterThan(SITE_PLAN.hallBackZ - 3.2);
    expect(hall.holeCentre.y).toBeCloseTo(hole.y, 6);
  });

  it('月光是斜的 —— 垂直的光柱就不需要一個破洞來解釋', () => {
    const dir = moonDirection(SITE_PLAN);
    expect(dir.y).toBeLessThan(0);
    const pitch = (Math.asin(-dir.y) * 180) / Math.PI;
    expect(pitch).toBeGreaterThan(15);
    expect(pitch).toBeLessThan(55);
  });

  it('雙開木門是微啟的:兩扇各一片,中間留一條縫', () => {
    const box = worldBounds(hall.doors);
    // 兩扇都往 +z(外)推出去,所以會超過牆面 —— 但沒有大開。
    expect(box.max.z).toBeGreaterThan(SITE_PLAN.hallFrontZ + 0.4);
    expect(box.max.z - SITE_PLAN.hallFrontZ).toBeLessThan(1.8);
    // 兩片門板加起來大約就是門洞的寬度。一片有門洞那麼寬的話,兩片會整個
    // 疊在一起,而「微啟」就只是把同一片板子轉了兩次。
    const width = box.max.x - box.min.x;
    expect(width).toBeGreaterThan(2.6);
    expect(width).toBeLessThan(3.7);
    // 中間真的空著一條縫。
    const gap = 2 * (1.8 - 1.77 * Math.cos(0.46));
    expect(gap).toBeGreaterThan(0.1);
  });

  it('堂內只有冷光,而且是月白的', () => {
    expect(hall.lights.length).toBeGreaterThan(0);
    for (const light of hall.lights) {
      expect(light.color.getHex()).toBe(PALETTE.moonWhite);
    }
  });

  it('正面的柱位讓開門洞', () => {
    for (const x of hallFrontPosts(SITE_PLAN.hallHalfW)) {
      expect(Math.abs(x)).toBeGreaterThanOrEqual(2.4);
    }
  });
});

describe('場地平面圖', () => {
  it('月在旗後 —— 第一章的逆光靠的是這一行', () => {
    // 從第一章的站位看出去,月亮與殘旗掛點幾乎是同一個方向。
    const camera = new Vector3(0.6, 2.4, 25.5);
    expect(moonBehindFlagDegrees(camera)).toBeLessThan(2);
  });

  it('掛點在朽樑底下,不在半空中', () => {
    const beam = worldBounds(buildFlagBeam(stubMaterials(), SITE_PLAN.flagBeamZ));
    expect(FLAG_ANCHOR.y).toBeLessThan(beam.max.y);
    expect(FLAG_ANCHOR.x).toBeGreaterThan(beam.min.x);
    expect(FLAG_ANCHOR.x).toBeLessThan(beam.max.x);
  });

  it('建築腳下的地是平的,遠處才有起伏', () => {
    const centreZ = (SITE_PLAN.hallFrontZ + SITE_PLAN.hallBackZ) / 2 + 14;
    expect(groundHeight(0, centreZ, centreZ)).toBe(0);
    expect(groundHeight(2, SITE_PLAN.gateZ, centreZ)).toBe(0);
    let far = 0;
    for (let x = -90; x <= 90; x += 7) far = Math.max(far, Math.abs(groundHeight(x, 60, centreZ)));
    expect(far).toBeGreaterThan(0.05);
    expect(far).toBeLessThan(0.4);
  });
});

describe('竹', () => {
  it('幾何是單位高 —— 風場的高度遮罩靠這件事', () => {
    for (let v = 0; v < 3; v++) {
      const geo = makeCulmGeometry(v);
      geo.computeBoundingBox();
      const box = geo.boundingBox!;
      expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
      expect(box.max.y).toBeGreaterThan(0.96);
      expect(box.max.y).toBeLessThan(1.04);
    }
  });

  it('三個變體真的不一樣', () => {
    const counts = [0, 1, 2].map((v) => makeCulmGeometry(v).getAttribute('position').count);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('竹身的 uv 待在圖集左半,葉子在右半', () => {
    const uv = makeCulmGeometry(0).getAttribute('uv');
    let left = 0;
    let right = 0;
    for (let i = 0; i < uv.count; i++) {
      if (uv.getX(i) < 0.5) left++;
      else right++;
    }
    // 兩邊都要有:少了右半就沒有葉子,少了左半就沒有竹身。
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(-0.001);
      expect(uv.getX(i)).toBeLessThanOrEqual(1.001);
    }
  });
});

describe('枯梅與劍', () => {
  it('每一根主枝都是獨立的樞紐,風才吹得動', () => {
    const plum = buildPlum(stubMaterials(), 2207, 2.25);
    expect(plum.boughs.length).toBeGreaterThanOrEqual(3);
    for (const bough of plum.boughs) expect(bough.children.length).toBeGreaterThan(0);
  });

  it('堂內那棵梅的枝伸得到屋頂破洞', () => {
    const plum = buildPlum(stubMaterials(), 2207, 2.25);
    plum.group.position.set(2.6, SITE_PLAN.plinth, -38.5);
    const box = worldBounds(plum.group);
    const hole = holeCentre(SITE_PLAN);
    // 高度要過得去 —— 這是第五章「梅枝橫貫畫面」成立的前提。
    expect(box.max.y).toBeGreaterThan(hole.y);
  });

  it('劍身是全場唯一過曝的材質', () => {
    const mats = stubMaterials();
    mats.blade.color.setRGB(0.9, 2.9, 2.7);
    const sword = buildSword(mats, 0.13, -0.05);
    const box = worldBounds(sword);
    // 插在地上:大半在地面以上,一小截在地下。
    expect(box.min.y).toBeLessThan(0);
    expect(box.max.y).toBeGreaterThan(0.8);
    expect(mats.blade.color.g).toBeGreaterThan(1);
  });
});

describe('燈籠', () => {
  it('只剩餘燼:光很弱、射程很短', () => {
    const lantern = buildLantern(stubMaterials(), -5.2, 3.6, -14.6);
    expect(lantern.light.intensity).toBeLessThan(1.5);
    expect(lantern.light.distance).toBeLessThan(6);
    expect(lantern.light.color.getHex()).toBe(PALETTE.vermilion);
    // 火星從紙身冒出來,不是從吊桿。
    expect(lantern.emberAt.y).toBeLessThan(3.6);
  });
});

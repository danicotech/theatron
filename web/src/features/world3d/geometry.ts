import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
  type BufferAttribute,
  type InterleavedBufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { clamp, smoothstep } from './noise';

/**
 * 兩個自訂的幾何生成器,外加合批工具。
 *
 * 場景裡沒有模型檔,所有東西都是 Box / Cylinder / Plane 疊出來的。但只靠原始體
 * 會得到一堆「箱子搭的東西」—— 中式木構讀得出來的兩個特徵都不是箱子:
 * 往上翹的橫樑,和往角落翻起的飛簷。這兩件事各需要一個生成器,就是這個檔案。
 */

/** 掃掠與屋頂共用的極小值,用來當除零的下界與有限差分的步長。 */
const EPS = 1e-4;

/** 2D 剖面的一個頂點。[沿副法線的橫向, 沿法線的縱向],單位是公尺。 */
export type ProfilePoint = readonly [number, number];

/**
 * 把一個 2D 多邊形剖面沿著 3D 路徑掃出來。
 *
 * 每個路徑點上建一組正交框架(切線 T、副法線 B、法線 N),在那個平面上放一圈
 * 剖面頂點,相鄰兩圈縫成帶狀,兩端各封一片蓋。
 *
 * 剖面**必須是木構的斷面**(下寬上窄、腰部微凸),不能是矩形 —— 矩形掃出來
 * 的樑立刻讀成鷹架。這不是裝飾上的講究:木構的斷面是刨出來的,邊緣永遠帶
 * 一道斜切,那道斜切在夜景裡是唯一能接到月光的地方。
 */
export function sweepProfile(
  path: readonly Vector3[],
  profile: readonly ProfilePoint[],
): BufferGeometry {
  const segs = path.length;
  const np = profile.length;
  if (segs < 2 || np < 3) {
    throw new Error('sweepProfile:路徑至少兩點,剖面至少三點');
  }

  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  const tangent = new Vector3();
  const binormal = new Vector3();
  const nrm = new Vector3();
  const up = new Vector3(0, 1, 0);
  const fallback = new Vector3(0, 0, 1);

  for (let i = 0; i < segs; i++) {
    const p = path[i]!;
    const before = path[Math.max(0, i - 1)]!;
    const after = path[Math.min(segs - 1, i + 1)]!;
    tangent.subVectors(after, before);
    if (tangent.lengthSq() < EPS * EPS) tangent.set(0, 0, 1);
    tangent.normalize();

    // 路徑正好垂直時 T 與 up 平行,外積會退化成零向量;換一個參考軸就好。
    const reference = Math.abs(tangent.dot(up)) > 0.999 ? fallback : up;
    binormal.crossVectors(tangent, reference).normalize();
    nrm.crossVectors(binormal, tangent).normalize();

    for (let j = 0; j < np; j++) {
      const [u, v] = profile[j]!;
      position.push(
        p.x + binormal.x * u + nrm.x * v,
        p.y + binormal.y * u + nrm.y * v,
        p.z + binormal.z * u + nrm.z * v,
      );
      // 法線用剖面座標本身的方向近似。剖面是凸的,誤差小到看不出來,
      // 而且省掉逐面求平均 —— 樑上不需要精確的法線,需要的是一道連續的高光。
      const len = Math.hypot(u, v) || 1;
      normal.push(
        (binormal.x * u + nrm.x * v) / len,
        (binormal.y * u + nrm.y * v) / len,
        (binormal.z * u + nrm.z * v) / len,
      );
      uv.push(j / np, i / (segs - 1));
    }
  }

  for (let i = 0; i < segs - 1; i++) {
    for (let j = 0; j < np; j++) {
      const j2 = (j + 1) % np;
      const a = i * np + j;
      const b = i * np + j2;
      const c = (i + 1) * np + j2;
      const d = (i + 1) * np + j;
      index.push(a, b, c, a, c, d);
    }
  }

  // 兩端的蓋。用扇形而不是把剖面三角化:剖面是凸的,扇形夠用又不用帶一個切割器。
  for (const [k, ring] of [0, segs - 1].entries()) {
    const centre = path[ring]!;
    const base = position.length / 3;
    position.push(centre.x, centre.y, centre.z);
    normal.push(0, 0, k === 1 ? 1 : -1);
    uv.push(0.5, 0.5);
    for (let j = 0; j < np; j++) {
      const a = ring * np + j;
      const b = ring * np + ((j + 1) % np);
      if (k === 1) index.push(base, a, b);
      else index.push(base, b, a);
    }
  }

  return assemble(position, normal, uv, index);
}

export interface FlaredRoofOptions {
  /** 沿脊方向(x)的半寬,量到簷口。 */
  halfWidth: number;
  /** 垂直脊方向(z)的半深,量到簷口。 */
  halfDepth: number;
  /** 屋脊本身的半長。脊上這一段是平的,從這裡才開始往下走。 */
  ridgeHalf: number;
  /** 脊比簷高多少。 */
  rise: number;
  /** 屋面的厚度。上殼與下殼之間就是這個距離。 */
  thickness: number;
  /** 簷口翻起的強度,以 rise 為單位。0 是沒有飛簷的板子。 */
  flare?: number;
  segX?: number;
  segZ?: number;
  /** UV 的世界尺度:瓦的疏密。 */
  tileScale?: number;
}

/**
 * 飛簷屋頂。
 *
 * 高度是「到屋脊的距離」的**凹函數**(所以屋面是下垂的,不是斜的平面),
 * 而最後五分之一往上翻回來 —— 那道翻起就是整個輪廓。
 *
 * 翻起的權重必須偏向角落(`min(ax, az)`)。平均施加在整條簷上會得到一圈抬起
 * 的邊,屋頂讀成一只碟子;集中在兩條簷相交的地方,它才讀得出是一座殿。
 *
 * 輸出是實心的:上殼、下殼、再加一圈把兩緣縫起來的簷板。簷板自己帶一圈頂點,
 * 法線才能是側向的 —— 少了它,簷口在逆光下會薄成一條線。
 */
export function flaredRoof(options: FlaredRoofOptions): BufferGeometry {
  const {
    halfWidth: A,
    halfDepth: B,
    ridgeHalf: R,
    rise,
    thickness,
    flare = 0.9,
    segX = 40,
    segZ = 26,
    tileScale = 0.16,
  } = options;

  const heightAt = (x: number, z: number): number => {
    const ax = Math.min(1, Math.abs(x) / A);
    const az = Math.min(1, Math.abs(z) / B);
    // 脊沿 x 走,所以 |x| 在 R 之內都還在脊上,從那裡才開始算行程。
    const tx = clamp((Math.abs(x) - R) / Math.max(A - R, EPS), 0, 1);
    const t = Math.min(1, Math.max(tx, az));
    const shell = rise * Math.pow(1 - t, 1.5);
    const lift = flare * rise * smoothstep(0.7, 1, t) * (0.45 + 0.75 * Math.min(ax, az));
    return shell + lift;
  };

  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const perShell = (segX + 1) * (segZ + 1);
  const d = 1e-3;

  for (let k = 0; k < 2; k++) {
    const under = k === 1;
    for (let j = 0; j <= segZ; j++) {
      for (let i = 0; i <= segX; i++) {
        const x = -A + (2 * A * i) / segX;
        const z = -B + (2 * B * j) / segZ;
        const nx = -(heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d);
        const nz = -(heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d);
        const len = Math.hypot(nx, 1, nz) || 1;
        const s = under ? -1 : 1;
        position.push(x, heightAt(x, z) - (under ? thickness : 0), z);
        normal.push((s * nx) / len, s / len, (s * nz) / len);
        uv.push(x * tileScale, z * tileScale);
      }
    }
    for (let j = 0; j < segZ; j++) {
      for (let i = 0; i < segX; i++) {
        const a = k * perShell + j * (segX + 1) + i;
        const b = a + 1;
        const c = a + segX + 2;
        const e = a + segX + 1;
        if (under) index.push(a, c, b, a, e, c);
        else index.push(a, b, c, a, c, e);
      }
    }
  }

  // 簷板:沿著四條邊走一圈,每一步放上下兩個頂點。
  const rim: Array<readonly [number, number]> = [];
  for (let i = 0; i <= segX; i++) rim.push([i, 0]);
  for (let j = 1; j <= segZ; j++) rim.push([segX, j]);
  for (let i = segX - 1; i >= 0; i--) rim.push([i, segZ]);
  for (let j = segZ - 1; j >= 1; j--) rim.push([0, j]);

  const base = position.length / 3;
  for (const [ri, rj] of rim) {
    const x = -A + (2 * A * ri) / segX;
    const z = -B + (2 * B * rj) / segZ;
    const nx = ri === 0 ? -1 : ri === segX ? 1 : 0;
    const nz = rj === 0 ? -1 : rj === segZ ? 1 : 0;
    const len = Math.hypot(nx, nz) || 1;
    const y = heightAt(x, z);
    position.push(x, y, z, x, y - thickness, z);
    normal.push(nx / len, 0, nz / len, nx / len, 0, nz / len);
    uv.push(x * tileScale, 0, x * tileScale, thickness * tileScale);
  }
  for (let i = 0; i < rim.length; i++) {
    const a = base + i * 2;
    const b = a + 1;
    const c = base + ((i + 1) % rim.length) * 2;
    const e = c + 1;
    index.push(a, b, e, a, e, c);
  }

  return assemble(position, normal, uv, index);
}

function assemble(
  position: number[],
  normal: number[],
  uv: number[],
  index: number[],
): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

/**
 * 合批:把一疊幾何併成一個,原料就地釋放。
 *
 * 四十級台階是四十次 draw call,而沒有人會走近到看得出它們是分開的。
 * 併完一定要 dispose 原料 —— 合併是複製,原料留著就是一份沒人用的 GPU 記憶體。
 */
export function mergeGeos(list: readonly BufferGeometry[]): BufferGeometry {
  if (list.length === 0) throw new Error('mergeGeos:沒有東西可以合併');
  if (list.length === 1) return list[0]!;
  const merged = mergeGeometries(list as BufferGeometry[], false);
  if (merged === null) throw new Error('mergeGeos:屬性對不起來,合併失敗');
  for (const g of list) g.dispose();
  return merged;
}

/** 位移一份幾何並回傳它自己。純粹是為了讓組裝的程式碼讀起來是一行一個零件。 */
export function at(geo: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  geo.translate(x, y, z);
  return geo;
}

/** 繞 Y 軸轉。牌坊的側間與燈籠的柱子都要轉。 */
export function turnY(geo: BufferGeometry, radians: number): BufferGeometry {
  geo.applyMatrix4(new Matrix4().makeRotationY(radians));
  return geo;
}

/**
 * 把 UV 乘上一個世界尺度。
 *
 * PlaneGeometry 的 UV 是 0..1,貼到一塊 240 公尺的地上就是一張圖撐滿整片地。
 * 可以改材質的 repeat,但那樣同一張貼圖在不同大小的地面上就得各存一份;
 * 改幾何的 UV 則讓一張貼圖被所有地面共用。
 */
export function scaleUv(geo: BufferGeometry, su: number, sv: number): BufferGeometry {
  const attr = geo.getAttribute('uv') as BufferAttribute | InterleavedBufferAttribute | undefined;
  if (attr === undefined) return geo;
  for (let i = 0; i < attr.count; i++) {
    attr.setXY(i, attr.getX(i) * su, attr.getY(i) * sv);
  }
  attr.needsUpdate = true;
  return geo;
}

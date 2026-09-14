import { CanvasTexture, ClampToEdgeWrapping, LinearMipmapLinearFilter, type Texture } from 'three';

import { worldAsset } from '../world';
import { PANELS, panelAt, panelMatrix, type ProloguePanel } from './panels';

/**
 * 旗後那兩道身影。
 *
 * 他們不是畫出來的 —— 是 `public/shadow/duel-*.svg` 兩張真的剪影素材,畫進一張
 * 離屏 canvas 再包成貼圖。程序生成的人永遠讀起來是「幾根粗管子接在一起」,
 * 而這一幕的全部內容就是兩個人在對劍,人形不對就什麼都不對了。
 *
 * # 為什麼是貼圖而不是每幀重算
 *
 * 第一幕是漫畫分鏡:**格內人物完全不動**(見 panels.ts)。所以整幕只要重畫五次,
 * 其餘時間剪影是一張零成本的貼圖。反過來做 —— 每幀把兩張 SVG 重畫一次 ——
 * 是拿一整條 rasterise 的成本去換一個沒有人看得出來的差別。
 *
 * # 為什麼要兩張貼圖
 *
 * 換格是離散的,不插值(插值出來的是兩個姿勢疊在一起的鬼影,不是分鏡)。
 * 但是硬切會閃,所以新的一格用墨暈**暈**上去 —— 暈需要同時看得到舊的與新的,
 * 於是兩張 canvas 輪流當「上一格」與「這一格」。150ms,與 InkWipe 同一個時長。
 */

/**
 * 離屏 canvas 的解析度。
 *
 * 極近那一格把畫布放大三倍多(camWidth 0.3),所以基準解析度要留得起那個倍率;
 * 1792 寬在極近格等於有效 5900 寬,足夠把劍鋒的邊留成一條線而不是一排階梯。
 * 長寬比跟著素材的 viewBox,不跟著旗 —— 形變的修正在 shader 那邊做(uSilFit),
 * 在這裡壓扁的話素材就再也回不去了。
 */
const CANVAS_WIDTH = 1792;

/** 墨暈把新的一格蓋上去要多久(秒)。 */
const WIPE_SECONDS = 0.15;

/** 兩件剪影的 id。它們登記在 world.json,打錯字在 `worldAsset` 就會炸。 */
const PART_IDS = ['duel-left', 'duel-right'] as const;

export interface SilhouetteOptions {
  /** 不想看到動的人:墨暈直接跳到終點,換格是硬切。 */
  instant: boolean;
  /** 貼圖的非等向過濾上限,由 renderer 給。斜著看的布最需要它。 */
  anisotropy: number;
}

export interface SilhouetteLayer {
  /** 這一格。 */
  readonly current: Texture;
  /** 上一格。墨暈走完之後它與 `current` 內容相同,但物件不同。 */
  readonly previous: Texture;
  /** 墨暈的進度。1 代表已經完全換成 `current`。 */
  readonly wipe: number;
  /** 兩張 SVG 都載好了沒。沒好之前呼叫端不該把剪影乘上去。 */
  readonly ready: boolean;
  /** 素材的長寬比(寬/高)。shader 靠它把貼圖擺回正確的比例。 */
  readonly aspect: number;
  /** 目前這一格的索引。給測試與除錯用。 */
  readonly panel: number;
  /** 餵進度與這一格的時間。只有換格才會真的重畫。 */
  update(progress: number, dt: number): void;
  dispose(): void;
}

interface Sheet {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
}

export function createSilhouetteLayer(options: SilhouetteOptions): SilhouetteLayer {
  const parts = PART_IDS.map((id) => worldAsset(id));
  const source = parts[0]!;
  const aspect = source.width / source.height;
  const width = CANVAS_WIDTH;
  const height = Math.round(CANVAS_WIDTH / aspect);

  const sheets: Sheet[] = [];
  for (let i = 0; i < 2; i += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('拿不到 2D context,剪影畫不出來');
    const texture = new CanvasTexture(canvas);
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    // 換格一幕只有五次,所以 mipmap 的成本一次都不心疼 —— 而少了它,
    // 遠景那兩格的剪影邊緣會在布的褶上抖成一排鋸齒。
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = options.anisotropy;
    sheets.push({ canvas, ctx, texture });
  }

  let front = 0;
  let panel = -1;
  let wipe = 1;
  let ready = false;
  let disposed = false;

  const images = parts.map(() => {
    const img = new Image();
    img.decoding = 'async';
    return img;
  });

  /**
   * 把一格畫進一張 canvas。
   *
   * 兩件共用同一個 viewBox,偏移 0 疊起來就是原圖 —— 所以兩次 drawImage 的
   * 目的地尺寸都是整張畫布,差別只在 dx。素材是 SVG,瀏覽器會照著當下的變換
   * 重新 rasterise,所以極近那一格放大三倍也還是向量的邊。
   */
  function paint(sheet: Sheet, next: ProloguePanel) {
    const { ctx } = sheet;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const [a, b, c, d, e, f] = panelMatrix(next, width, height);
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(images[0]!, next.leftDx * width, 0, width, height);
    ctx.drawImage(images[1]!, next.rightDx * width, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    sheet.texture.needsUpdate = true;
  }

  let pending = images.length;
  for (const [i, img] of images.entries()) {
    img.onload = () => {
      pending -= 1;
      // 兩件都到齊才算數:只畫得出一個人的分鏡比空布更難看。
      if (pending === 0 && !disposed) ready = true;
    };
    // 載不到就整層不亮 —— 序幕退回「一塊被背光照亮的布」,那仍然是完整的畫面。
    img.onerror = () => {
      pending = Number.POSITIVE_INFINITY;
      ready = false;
    };
    img.src = parts[i]!.file;
  }

  return {
    get current() {
      return sheets[front]!.texture;
    },
    get previous() {
      return sheets[1 - front]!.texture;
    },
    get wipe() {
      return wipe;
    },
    get ready() {
      return ready;
    },
    get panel() {
      return panel;
    },
    aspect,

    update(progress, dt) {
      if (!ready || disposed) return;
      const next = panelAt(progress);
      if (next !== panel) {
        const shot = PANELS[next]!;
        if (panel < 0) {
          // 開場的第一格:兩張都畫成它,不然訪客第一眼看到的是一次無來由的墨暈。
          for (const sheet of sheets) paint(sheet, shot);
          wipe = 1;
        } else {
          // 換格:輪到另一張當「這一格」,原本那張就地變成「上一格」。
          // 墨暈還沒走完就又換格也成立 —— 上一格接的是當下畫面上那一張。
          front = 1 - front;
          paint(sheets[front]!, shot);
          wipe = options.instant ? 1 : 0;
        }
        panel = next;
        return;
      }
      if (wipe < 1) wipe = Math.min(1, wipe + dt / WIPE_SECONDS);
    },

    dispose() {
      disposed = true;
      for (const img of images) {
        img.onload = null;
        img.onerror = null;
        img.src = '';
      }
      for (const sheet of sheets) {
        sheet.texture.dispose();
        // 貼圖 dispose 掉的是 GPU 那一份。canvas 自己還佔著幾 MB 的主記憶體,
        // 收成 0×0 才真的還回去 —— 序幕會被捲進捲出很多次。
        sheet.canvas.width = 0;
        sheet.canvas.height = 0;
      }
    },
  };
}

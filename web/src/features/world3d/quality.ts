/**
 * 畫質分級。
 *
 * 一條規則:**永遠不要照單全收 devicePixelRatio**。手機上 DPR 3 表示每格要填
 * 九倍的像素,而這個場景每格有 bloom 的六趟全螢幕 pass —— 一台中階手機會直接
 * 掉到十幾 fps。所以上限寫死在 **1.5**(規格明訂),再由實測的 frame time
 * 往下降。
 *
 * 分級只看兩件事:核心數(CPU 能力的粗略代理)與有沒有滑鼠(有沒有滑鼠幾乎
 * 就等於是不是手機)。不做 UA 嗅探 —— 那份清單永遠會過期。
 */

export type QualityTier = 'low' | 'high';

/** 規格訂死的 DPR 上限。高階也不准超過它。 */
export const DPR_CAP = 1.5;

export interface Quality {
  tier: QualityTier;
  /** setPixelRatio 的上限。 */
  dprCap: number;
  /** 場景 render target 的 MSAA 取樣數。 */
  samples: number;
  /** bloom 的級數。 */
  bloomLevels: number;
  /** 竹林的竹子數。整片是三個 InstancedMesh,所以這個數字只影響頂點與填充。 */
  bambooCount: number;
  /** 荒草的密度,每平方公尺幾株。 */
  weedDensity: number;
  /** 荒草的上限。密度算出來再多也不超過它。 */
  weedMax: number;
  /** 竹葉的粒子數。 */
  leafCount: number;
  /** 塵埃的粒子數。 */
  dustCount: number;
  /** 餘燼的粒子數。全場只有一盞燈,所以本來就不多。 */
  emberCount: number;
  /** 要不要算陰影。低階一律不算 —— 這個構圖靠剪影與霧,不靠投影。 */
  shadows: boolean;
}

const HIGH: Quality = {
  tier: 'high',
  dprCap: DPR_CAP,
  samples: 2,
  bloomLevels: 3,
  bambooCount: 260,
  weedDensity: 5,
  weedMax: 13000,
  leafCount: 700,
  dustCount: 900,
  emberCount: 40,
  shadows: true,
};

const LOW: Quality = {
  tier: 'low',
  dprCap: 1.2,
  samples: 0,
  bloomLevels: 2,
  bambooCount: 96,
  weedDensity: 1.8,
  weedMax: 4400,
  leafCount: 220,
  dustCount: 320,
  emberCount: 18,
  shadows: false,
};

export interface QualityProbe {
  hardwareConcurrency?: number | undefined;
  /** matchMedia('(hover: none)') 的結果。沒有滑鼠幾乎就是手機。 */
  coarsePointer?: boolean | undefined;
}

export function detectQuality(probe: QualityProbe = {}): Quality {
  const cores = probe.hardwareConcurrency ?? 4;
  if (probe.coarsePointer === true || cores <= 4) return LOW;
  return HIGH;
}

/** 從瀏覽器量一份。放在這裡而不是元件裡,是為了讓分級規則有一個測得到的家。 */
export function probeBrowser(): QualityProbe {
  return {
    hardwareConcurrency: navigator.hardwareConcurrency,
    coarsePointer:
      typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches,
  };
}

/** 進一步降級:frame time 持續不好時,把解析度往下砍一階。 */
export function degrade(current: number): number {
  return Math.max(0.7, current - 0.25);
}

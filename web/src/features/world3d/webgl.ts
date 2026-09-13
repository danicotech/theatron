/**
 * 有沒有 WebGL。
 *
 * 單獨一個檔案,而且**不 import three**:這支函式是決定「要不要動態載入
 * three」的那個判斷,它自己要是把 three 拉進來,就沒有東西可以省了。
 */
export function hasWebGL(): boolean {
  try {
    if (typeof WebGLRenderingContext === 'undefined') return false;
    // 探測用一張丟掉的 canvas,不是要拿來用的那一張:一個元素一輩子只能有
    // 一種 context,探測失敗時那張上面已經留著一個壞掉的。
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!gl) return false;
    // 探完立刻歸還。瀏覽器對同時存在的 context 數量有上限,超過之後會默默
    // 殺掉最舊的那一個。
    const lose = gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null;
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * 每一個會動的元件都要說得出自己現在是哪一個狀態。
 *
 * 規格列的七個,一個都不少。寫成共用型別而不是每個元件自己一組字串,理由是
 * 它們最後都會變成 `data-state`,而 CSS 與測試都靠那個屬性認狀態 ——
 * 各寫各的就會出現 `activating` 與 `pressing` 兩種寫法,而 CSS 只認得其中一種。
 *
 * | 狀態 | 看起來 | 這時候能做什麼 |
 * |---|---|---|
 * | loading | 骨架 / 降低對比,永遠**不是空白**,控制項禁用但看得見 | 不能操作 |
 * | idle | 靜止的預設樣子 | 可以操作 |
 * | hover | 指標或鍵盤焦點在上面,細微的提示 | 可以操作 |
 * | activating | 正在發生的那一下(蓋印、墨暈開) | **不接受新輸入**,見下 |
 * | active | 已經發生,結果留在畫面上 | 可以離開 / 連出去 |
 * | done | 完成或暫停,不再變化 | 可以重看,不會重播 |
 * | error | 說清楚壞在哪與怎麼辦 | 可以重試 |
 *
 * **連按的規矩:忽略,不重啟也不中斷。** 蓋印是一個 900ms 的完整動作,中途接手
 * 會看到印章跳回去再蓋一次 —— 那讀起來是壞掉。所以 activating 期間的點擊直接丟掉,
 * 而不是排隊。已經 active 之後再按也不重播:蓋過的印不會再蓋一次。
 */
export type UiState = 'loading' | 'idle' | 'hover' | 'activating' | 'active' | 'done' | 'error';

/** 這個狀態接不接受新的啟動輸入。 */
export function acceptsActivation(state: UiState): boolean {
  return state === 'idle' || state === 'hover' || state === 'error';
}

/** 這個狀態下控制項該不該被禁用。loading 是唯一一個 —— 其他狀態都還能做點什麼。 */
export function isDisabled(state: UiState): boolean {
  return state === 'loading';
}

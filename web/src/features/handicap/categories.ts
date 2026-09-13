import { HandicapCategory } from '../../lib/api/gen/hestia/activity/v1/common_pb';

/**
 * 讓武六大類的顯示順序與標籤。
 *
 * 順序是原始清單的順序(武器 → 技能 → 防禦 → 下毒 → 勝利條件 → 規則),
 * 選手已經照這個順序讀過規則頁,選購頁排一樣才不用重新找。
 * enum 的數值剛好也是這個順序,但那是巧合,不拿來排序。
 */
export interface HandicapCategoryEntry {
  key: HandicapCategory;
  label: string;
  /** 頁內錨點用的短代號(`#hc-weapon`)。 */
  anchor: string;
}

export const HANDICAP_CATEGORIES: readonly HandicapCategoryEntry[] = [
  { key: HandicapCategory.WEAPON, label: '武器限制', anchor: 'weapon' },
  { key: HandicapCategory.SKILL, label: '技能限制', anchor: 'skill' },
  { key: HandicapCategory.DEFENSE, label: '防禦與位移限制', anchor: 'defense' },
  { key: HandicapCategory.POISON, label: '下毒', anchor: 'poison' },
  { key: HandicapCategory.VICTORY, label: '勝利條件', anchor: 'victory' },
  { key: HandicapCategory.RULE, label: '規則限制', anchor: 'rule' },
];

export function categoryLabel(c: HandicapCategory): string {
  return HANDICAP_CATEGORIES.find((e) => e.key === c)?.label ?? '';
}

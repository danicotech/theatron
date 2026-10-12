import { labSource } from '../../../scripts/lab-source';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The user supplied these rules as official copy. Check the canonical lab content;
// publishing still happens through to-theatron.py, never by editing generated HTML.
const source = readFileSync(labSource('lunjian-layout.html'), 'utf8');
const document = new DOMParser().parseFromString(source, 'text/html');
const catalog = document.querySelector('#invitation .manga-catalog')!;
const groups = [...catalog.querySelectorAll<HTMLDetailsElement>('.handicap-group')];
const expected = [
  ['weapon', '武器限制', [20, 12, 12, 5, 2]],
  ['skill', '技能限制', [24, 16, 12, 12, 12, 8, 5, 3]],
  ['movement', '防禦與位移限制', [20, 8, 8, 5, 5, 2]],
  ['poison', '下毒', [24, 24, 12, 10]],
  ['victory', '勝利條件', [24, 20, 16, 10, 20, 10]],
  ['rule', '規則限制', [17, 17, 2, 1, 1, 1, 1]],
] as const;

function item(title: string) {
  const result = [...catalog.querySelectorAll('.handicap-item')].find((article) =>
    article.querySelector('h4')?.textContent?.endsWith(title),
  );
  expect(result, title).toBeDefined();
  return result!;
}

describe('正式讓武條文', () => {
  it('完整保留六類的 36 項與使用者指定的每項 BP', () => {
    expect(groups).toHaveLength(6);
    expect(catalog.querySelectorAll('.handicap-item')).toHaveLength(36);
    expected.forEach(([key, title, costs], index) => {
      const group = groups[index]!;
      expect(group.id).toBe(`handicap-group-${key}`);
      expect(group.querySelector('summary')?.textContent).toBe(`${title}${costs.length} 項`);
      expect(
        [...group.querySelectorAll('.handicap-cost')].map((cost) =>
          Number(cost.textContent?.replace(' BP', '')),
        ),
      ).toEqual(costs);
    });
  });

  it('六個分類入口都指向唯一的原生收合內容，初始不攤開長文', () => {
    const links = [...catalog.querySelectorAll<HTMLAnchorElement>('.handicap-categories a')];
    expect(links).toHaveLength(6);
    links.forEach((link, index) => {
      expect(link.getAttribute('href')).toBe(`#${groups[index]!.id}`);
      expect(document.querySelectorAll(link.getAttribute('href')!)).toHaveLength(1);
    });
    expect(groups.every((group) => !group.open)).toBe(true);
    expect(catalog.textContent).not.toContain('待補齊');
    expect(catalog.querySelectorAll('.handicap-item [data-comic-frame]')).toHaveLength(0);
    expect(catalog.querySelectorAll('.handicap-item[data-comic-frame]')).toHaveLength(0);
  });

  it('保留可重複、退費、自身生效及移動例外的關鍵條款', () => {
    expect(item('禁用奇術').textContent).toContain('將經裁判確認後返還禁用任意奇術的 BP');
    expect(item('雙方使用46級武庫武學裝備').textContent).toContain('此項對你自己同樣生效');
    expect(item('指定並更改技能位子（可重複）').textContent).toContain('手把玩家依相對應按鍵調整');
    expect(item('禁用任意奇術（可重複）').textContent).toContain('逐次指定一個奇術名稱');
    expect(item('禁用移動鍵').textContent).toContain('靠奇術、技能的位移不算違規');
    expect(item('禁用迴避').textContent).toContain('奇術、技能的迴避效果不在此限');
    expect(item('禁跳躍').textContent).toContain('奇術、技能的跳躍效果不在此限');
  });

  it('保留特殊勝利、開局執行、裁判要求及可拒絕的界線', () => {
    for (const seconds of [90, 120, 180]) {
      expect(item(`撐過${seconds}秒即獲勝`).textContent).toContain('比賽沒有進入結算畫面');
    }
    expect(item('時間結束即勝利').textContent).toContain('即使結算為對手獲勝，仍判定你獲勝');
    expect(item('對手明顯損失半條血量即落敗').textContent).toContain(
      '若有爭議即不符合「明顯」原則，將不會判定對手落敗',
    );
    expect(item('對手讓出半條血量').textContent).toContain('你必須主動停手並且雙方脫離糾纏');
    expect(item('對手讓出守關元').textContent).toContain('雙方必須脫離糾纏');
    expect(item('對手不能主動追擊').textContent).toContain(
      '脫離判定：透過迴避、卸勢、處決、防禦反擊',
    );
    for (const title of ['對手不能主動追擊', '對手未攻擊時必須待在角落']) {
      expect(item(title).textContent).toContain('若不服從裁判要求則可能被判輸');
    }
    expect(item('獲得8秒的先手權').textContent).toContain('直到你先發動攻擊');
    expect(item('對手必須在開賽前落下一句狠話').textContent).toContain('不得辱罵或人身攻擊');
    expect(item('對手若輸了必須聽從勝者的一個要求（可以拒絕）').textContent).toContain(
      '（我拒絕）',
    );
    expect(
      item('指定對手開局時講一句話（8個字），沒講出來不能進行攻擊（可以先複製好）').textContent,
    ).toContain('夜鴉所至，萬敵皆寂！');
  });
});

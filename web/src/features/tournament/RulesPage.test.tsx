import { create } from '@bufbuild/protobuf';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HandicapCategory,
  HandicapItemSchema,
  Rank,
  RankInfoSchema,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { RulesPage } from './RulesPage';

const api = vi.hoisted(() => ({ listRanks: vi.fn(), listItems: vi.fn() }));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: { listRanks: api.listRanks },
    handicap: { listItems: api.listItems },
  },
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '開山者' }),
  create(RankInfoSchema, { rank: Rank.DUANSHUI, name: '斷水', title: '斷水者' }),
];

const ITEMS = [
  create(HandicapItemSchema, {
    publicId: 'i1',
    category: HandicapCategory.WEAPON,
    name: '限一階',
    cost: 8n,
    sortOrder: 1,
  }),
  create(HandicapItemSchema, {
    publicId: 'i2',
    category: HandicapCategory.RULE,
    name: '不得後退',
    cost: 4n,
    repeatable: true,
    sortOrder: 2,
  }),
];

describe('RulesPage', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
    api.listItems.mockResolvedValue({ items: ITEMS });
  });

  // 級距逐屆可調,前端寫死就會在第二屆變成錯的 —— 表上的每一格都是 perGap 乘出來的。
  it('BP 級距從伺服器的 bp_per_rank_gap 算,不是寫死的表', async () => {
    render(<RulesPage slug="s" />);
    const notice = await screen.findByRole('heading', { name: /段位差換 BP/ });
    const paper = notice.closest('div');
    expect(paper).not.toBeNull();
    expect(within(paper as HTMLElement).getByText('16 BP')).toBeInTheDocument();
    expect(within(paper as HTMLElement).getByText('24 BP')).toBeInTheDocument();
  });

  it('項目照類別分組,可重複的標出來', async () => {
    render(<RulesPage slug="s" />);
    expect(await screen.findByRole('heading', { name: '武器限制' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '規則限制' })).toBeInTheDocument();
    expect(screen.getByText('限一階')).toBeInTheDocument();
    expect(screen.getByText('可重複')).toBeInTheDocument();
  });

  // 題字是畫面上讀得出來的字,所以也要唸得出來 —— 它不是裝飾用的背景圖。
  it('賽制的題字唸得出來', async () => {
    render(<RulesPage slug="s" />);
    expect(await screen.findByRole('img', { name: '賽制' })).toBeInTheDocument();
  });

  it('三個區塊都有自己的標題,層級不跳級', async () => {
    render(<RulesPage slug="s" />);
    await screen.findByRole('heading', { name: '段位' });
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual(['段位', 'BP 怎麼算', '讓武項目']);
  });

  // 三個表頭改用共用的 SectionHead 之後,section 的 aria-labelledby 還要指得到標題 ——
  // 指不到的話那一區在輔助科技裡就沒有名字,而測不出來的只有空白的名字。
  it('每一區的 aria-labelledby 指得到自己的表頭', async () => {
    render(<RulesPage slug="s" />);
    await screen.findByRole('heading', { name: '段位' });
    ['ranks', 'bp', 'items'].forEach((id) => {
      const region = document.querySelector(`section[aria-labelledby="${id}"]`);
      expect(region).not.toBeNull();
      expect(document.getElementById(id)?.tagName).toBe('H2');
    });
  });

  it('讀不到規則時說清楚,不是空白頁', async () => {
    api.listRanks.mockRejectedValue(new Error('unavailable'));
    render(<RulesPage slug="s" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<RulesPage slug="s" />);
    await screen.findByRole('heading', { name: '讓武項目' });
    await expectNoAxeViolations(container);
  });
});

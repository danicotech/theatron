import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MyCeremonyPrizes } from './MyCeremonyPrizes';
import type { Tournament } from './model';

const event: Tournament = {
  id: 'event',
  name: '夜鴨爭鋒',
  players: [],
  matches: [],
  started: false,
  links: { member: 'player' },
  ceremony: {
    draws: [
      {
        id: 'mine',
        userId: 'member',
        name: '本人',
        prizeId: 'a',
        prize: '幸運禮',
        created: 1000,
        delivered: false,
      },
      {
        id: 'other',
        userId: 'other',
        name: '別人',
        prizeId: 'b',
        prize: '別人的抽獎',
        created: 2000,
        delivered: true,
      },
    ],
    awards: [
      {
        id: 'winner',
        playerId: 'player',
        title: '冠軍',
        prize: '冠軍紀念品',
        created: 3000,
        delivered: true,
      },
      {
        id: 'runner',
        playerId: 'another',
        title: '亞軍',
        prize: '別人的獎項',
        created: 4000,
        delivered: false,
      },
    ],
  },
};

it('會員僅看見自己的抽獎與對應選手獎項，區分待發與已發', () => {
  render(<MyCeremonyPrizes events={[event]} userId="member" />);
  expect(screen.getByRole('heading', { name: '抽獎得獎 · 幸運禮' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '冠軍 · 冠軍紀念品' })).toBeVisible();
  expect(screen.getByText('待現場頒發')).toBeVisible();
  expect(screen.getByText('已標記頒發')).toBeVisible();
  expect(screen.queryByText(/別人的/)).toBeNull();
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('冠軍');
});

it('未登入或沒有得獎時不製造空記錄，只有抽獎的觀眾也看得到', () => {
  const { rerender, container } = render(<MyCeremonyPrizes events={[event]} userId="" />);
  expect(container).toBeEmptyDOMElement();
  rerender(<MyCeremonyPrizes events={[event]} userId="nobody" />);
  expect(container).toBeEmptyDOMElement();
  rerender(<MyCeremonyPrizes events={[event]} userId="other" />);
  expect(screen.getByRole('heading', { name: '抽獎得獎 · 別人的抽獎' })).toBeVisible();
  expect(screen.queryByText(/冠軍紀念品/)).toBeNull();
});

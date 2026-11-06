import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BuildCard } from './BuildCard';
import builds from './buildCards.json';
import catalog from '../../../public/loadout/data/catalog.json';

it('keeps every identity card synchronized with the armory catalog', () => {
  expect(builds).toEqual(
    catalog.builds.map((build) => ({
      key: build.key,
      name: build.name,
      family: build.family,
      img: build.img,
      familyImg: build.familyImg,
      martials: build.martials.flatMap((key) =>
        catalog.martials
          .filter((m) => m.key === key)
          .map((m) => ({ key: m.key, name: m.name, img: m.img })),
      ),
    })),
  );
});
it('shows a named build and its martial pair while unknown builds never borrow another identity', () => {
  const { rerender } = render(<BuildCard name="裂石鈞" />);
  expect(screen.getByText('十方破陣')).toBeVisible();
  expect(screen.getByText('斬雪刀法')).toBeVisible();
  rerender(<BuildCard name="舊配置的流派" />);
  expect(screen.getByText('舊配置的流派')).toBeVisible();
  expect(screen.queryByText('十方破陣')).toBeNull();
  expect(screen.getByText('此流派尚無武學資料')).toBeVisible();
});

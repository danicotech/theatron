import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MemberShell } from './MemberShell';

it('個人入口使用同一活動並標示目前內容，手機切換後收合', () => {
  render(
    <MemberShell slug="活動" view="character">
      <p>已保存的配置</p>
    </MemberShell>,
  );
  expect(screen.getByRole('heading', { name: '會員專區' })).toBeVisible();
  const nav = screen.getByRole('navigation', { name: '個人資訊切換' });
  expect(within(nav).getByRole('link', { name: '報名武庫' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(within(nav).getByRole('link', { name: '我的報名' })).toHaveAttribute(
    'href',
    '/t/%E6%B4%BB%E5%8B%95/me?view=registration',
  );
  const toggle = screen.getByRole('button', { name: /切換頁面/ });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(within(nav).getByRole('link', { name: '我的報名' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

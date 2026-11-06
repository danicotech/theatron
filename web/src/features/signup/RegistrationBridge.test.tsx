import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RegistrationBridge } from './RegistrationBridge';
vi.mock('./SignupPage', () => ({
  SignupPage: ({ slug }: { slug: string }) => <input aria-label={slug} defaultValue="草稿" />,
}));
vi.mock('../sportsbook/SportsbookBridge', () => ({ SportsbookBridge: () => <p>預覽報名</p> }));
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
  vi.unstubAllEnvs();
});
it('進入報名章節載入正式表單，離開章節保留草稿', () => {
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', 'formal');
  document.body.innerHTML = '<div><div id="registration-inline"></div></div>';
  render(<RegistrationBridge />);
  expect(screen.queryByLabelText('formal')).not.toBeInTheDocument();
  act(() => {
    history.replaceState(null, '', '/#register');
    document.dispatchEvent(new Event('lunjian:chapter-change'));
  });
  expect(screen.getByLabelText('formal')).toHaveValue('草稿');
  expect(document.getElementById('registration-inline')?.parentElement).toHaveAttribute(
    'data-expanded',
    'true',
  );
  act(() => {
    history.replaceState(null, '', '/#rules');
    document.dispatchEvent(new Event('lunjian:chapter-change'));
  });
  expect(screen.getByLabelText('formal')).toHaveValue('草稿');
});
it('只有明確預覽參數才使用示範報名', () => {
  history.replaceState(null, '', '/?preview=1');
  render(<RegistrationBridge />);
  expect(screen.getByText('預覽報名')).toBeInTheDocument();
});
it('缺少活動設定時保留報名說明，不標記空表單已展開或改成示範報名', () => {
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', '');
  history.replaceState(null, '', '/?stage=2d#register');
  document.body.innerHTML =
    '<div class="registration-desk"><div id="registration-inline"></div><div class="registration-invitation">報名資訊尚未公布</div></div>';
  render(<RegistrationBridge />);
  expect(screen.getByText('報名資訊尚未公布')).toBeInTheDocument();
  expect(screen.queryByText('預覽報名')).not.toBeInTheDocument();
  expect(document.querySelector('.registration-desk')).toHaveAttribute('data-expanded', 'false');
});
it('由輕量場景網址直接進入報名，也會載入正式表單', () => {
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', 'formal');
  history.replaceState(null, '', '/?intro=0&stage=2d#register');
  document.body.innerHTML = '<div><div id="registration-inline"></div></div>';
  render(<RegistrationBridge />);
  expect(screen.getByLabelText('formal')).toHaveValue('草稿');
});

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HomeRuntime } from './HomeRuntime';
const router = vi.hoisted(() => ({ push: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.clearAllMocks();
});
it('保留活動參數，兩個首頁入口改用站內導覽並交接場景', () => {
  history.replaceState(null, '', '/home?sportsEvent=event-one');
  document.body.innerHTML =
    '<div class="baiye-home"><a href="/#prologue">了解賽制</a><a href="/#register">提筆報名</a></div>';
  const handoff = vi.fn();
  document.addEventListener('lunjian:home-handoff', handoff);
  render(<HomeRuntime revision="test" />);
  const links = document.querySelectorAll('a');
  act(() => {
    fireEvent.click(links[0]!);
  });
  expect(router.push).toHaveBeenLastCalledWith('/?sportsEvent=event-one#prologue', {
    scroll: false,
  });
  act(() => {
    fireEvent.click(links[1]!);
  });
  expect(router.push).toHaveBeenLastCalledWith('/?sportsEvent=event-one#register', {
    scroll: false,
  });
  expect(handoff).toHaveBeenCalledTimes(2);
  expect(router.prefetch).toHaveBeenCalledWith('/?sportsEvent=event-one');
  links[0]!.addEventListener('click', (event) => event.preventDefault(), { once: true });
  fireEvent.click(links[0]!, { ctrlKey: true });
  expect(handoff).toHaveBeenCalledTimes(2);
  document.removeEventListener('lunjian:home-handoff', handoff);
});

import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installObserver, type FakeObserver } from './testHarness';
import { useReveals } from './useReveals';

function Probe({ reduced = false }: { reduced?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useReveals(root, reduced);
  return (
    <div ref={root}>
      <section>
        <p data-rv="up">序</p>
        <p data-rv="up">讓武</p>
      </section>
      <section>
        <p data-rv="fade">賽程</p>
      </section>
    </div>
  );
}

function marked(root: HTMLElement) {
  return Array.from(root.querySelectorAll('[data-rv]'), (el) => el.hasAttribute('data-rv-in'));
}

/** 讓元素「量起來在視窗裡」。jsdom 沒有版面,矩形一律是 0。 */
function putInViewport(root: HTMLElement) {
  for (const el of root.querySelectorAll('[data-rv]')) {
    el.getBoundingClientRect = () =>
      ({ top: 10, bottom: 40, left: 0, right: 300, width: 300, height: 30 }) as DOMRect;
  }
}

describe('useReveals', () => {
  let made: FakeObserver[];

  beforeEach(() => {
    vi.useFakeTimers();
    made = installObserver();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const t = setTimeout(() => cb(0), 0);
      return t as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (h: number) => clearTimeout(h));
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('innerWidth', 1440);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('進入視窗才出場,同層的一個接一個', () => {
    const { container } = render(<Probe />);
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-rv]'));
    expect(marked(container)).toEqual([false, false, false]);

    act(() => {
      made[0]!.emit(items.map((target) => ({ target, ratio: 0.5 })));
    });
    // 第一個沒有延遲,後面的排隊。
    expect(marked(container)).toEqual([true, false, true]);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(marked(container)).toEqual([true, true, true]);
  });

  // 帶 hash 冷開,或捲到一半按 F5 讓瀏覽器還原位置:瀏覽器的定位跟觀察器的
  // 第一次派送會撞在一起,那一章可能一次回呼都收不到。內容不能因此消失。
  it('觀察器一次都不開口:已經在視窗裡的照樣出場', () => {
    const { container } = render(<Probe />);
    putInViewport(container);
    act(() => {
      vi.advanceTimersByTime(0); // 第一格的自我掃描
    });
    expect(marked(container)).toEqual([true, false, true]);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(marked(container)).toEqual([true, true, true]);
    // 自己掃出來的也要取消觀察,不然回捲時會再排一次。
    expect(made[0]!.targets.size).toBe(0);
  });

  it('觀察器壞了、又量不到版面:一秒二之後不等了,全部放出來', () => {
    const { container } = render(<Probe />);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(marked(container)).toEqual([true, true, true]);
  });

  it('已經有東西出場過,保險就不該多手', () => {
    const { container } = render(<Probe />);
    const first = container.querySelector<HTMLElement>('[data-rv]')!;
    act(() => {
      made[0]!.emit([{ target: first, ratio: 0.5 }]);
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    // 只有露出來的那一個,其餘仍然在等自己的時候。
    expect(marked(container)).toEqual([true, false, false]);
  });

  it('不想看到動的人:掛上就全部就位,不碰觀察器', () => {
    const { container } = render(<Probe reduced />);
    expect(marked(container)).toEqual([true, true, true]);
    expect(made.length).toBe(0);
  });

  it('卸載時把計時器收乾淨', () => {
    const { container, unmount } = render(<Probe />);
    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-rv]'));
    act(() => {
      made[0]!.emit(items.map((target) => ({ target, ratio: 0.5 })));
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

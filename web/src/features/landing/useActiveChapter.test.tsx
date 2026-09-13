import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChapterId } from './chapters';
import { installObserver, type FakeObserver } from './testHarness';
import { useActiveChapter } from './useActiveChapter';

function Probe() {
  const root = useRef<HTMLDivElement>(null);
  const active = useActiveChapter(root);
  return (
    <div ref={root}>
      <output>{active}</output>
      {(['01', '02', '03'] as ChapterId[]).map((id) => (
        <section key={id} data-chapter-section={id} />
      ))}
    </div>
  );
}

describe('useActiveChapter', () => {
  let made: FakeObserver[];

  beforeEach(() => {
    made = installObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sections(root: HTMLElement) {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-chapter-section]'));
  }

  it('露出比例最高的那一段是現在這一章', () => {
    const { container } = render(<Probe />);
    const [s0, s1, s2] = sections(container);
    const io = made[0]!;
    expect(io.targets.size).toBe(3);

    act(() => {
      io.emit([
        { target: s0!, ratio: 0.2 },
        { target: s1!, ratio: 0.7 },
        { target: s2!, ratio: 0 },
      ]);
    });
    expect(container.querySelector('output')?.textContent).toBe('02');

    act(() => {
      io.emit([
        { target: s1!, ratio: 0.1 },
        { target: s2!, ratio: 0.9 },
      ]);
    });
    expect(container.querySelector('output')?.textContent).toBe('03');
  });

  // 往下捲的時候,新的一章要真的站穩才接手 —— 打平時留在原地。
  it('比例相同時保留較早的一章', () => {
    const { container } = render(<Probe />);
    const [s0, s1] = sections(container);
    act(() => {
      made[0]!.emit([
        { target: s0!, ratio: 0.5 },
        { target: s1!, ratio: 0.5 },
      ]);
    });
    expect(container.querySelector('output')?.textContent).toBe('01');
  });

  it('兩側各縮一截,上一章的尾巴還掛在視窗底部時不會搶走', () => {
    render(<Probe />);
    expect(made[0]?.options?.rootMargin).toBe('-12% 0px -12% 0px');
  });

  // 固定導覽列那類不在這棵樹裡的東西,靠 <html> 上的屬性才讀得到。
  it('把現在這一章寫到 html 上,卸載時收乾淨', () => {
    const { container, unmount } = render(<Probe />);
    expect(document.documentElement.dataset.chapter).toBe('01');
    act(() => {
      made[0]!.emit([{ target: sections(container)[2]!, ratio: 0.8 }]);
    });
    expect(document.documentElement.dataset.chapter).toBe('03');
    unmount();
    expect(document.documentElement.dataset.chapter).toBeUndefined();
  });
});

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ForegroundStage } from './ForegroundStage';
import { installFrames } from './testHarness';

function pieces(host: HTMLElement, chapter: string): string[] {
  const set = host.querySelector(`[data-fg-set="${chapter}"]`);
  return set === null
    ? []
    : Array.from(set.querySelectorAll('img'), (img) => img.getAttribute('src') ?? '');
}

describe('ForegroundStage', () => {
  beforeEach(() => {
    // 順序有意義:vi.useFakeTimers 連 requestAnimationFrame 一起換掉,
    // 先裝替身會被它蓋過去,近景就永遠停在還沒站上來的那一格。
    vi.useFakeTimers();
    installFrames();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('一章只掛自己那一組近景', () => {
    const { container } = render(<ForegroundStage active="00" reduced={false} />);
    expect(pieces(container, '00')).toEqual([
      '/world/fg-lantern.webp',
      '/world/fg-snow-plum-branch.webp',
    ]);
  });

  it('每件都從自己貼著的那一邊進場,不是統一從下面浮起來', () => {
    const { container } = render(<ForegroundStage active="03" reduced={false} />);
    const set = container.querySelector('[data-fg-set="03"]')!;
    const sides = Array.from(set.querySelectorAll('[data-fg-in]'), (el) =>
      el.getAttribute('data-fg-in'),
    );
    expect(sides).toEqual(['left', 'right']);
  });

  it('切章:新的一組站上來,舊的一組留一下再走', () => {
    const { container, rerender } = render(<ForegroundStage active="00" reduced={false} />);
    rerender(<ForegroundStage active="02" reduced={false} />);

    expect(pieces(container, '02')).toEqual(['/world/fg-snow-bamboo.webp']);
    // 直接抽掉會看到東西憑空消失,所以舊的那組還在,只是被標成退場。
    const retiring = container.querySelector('[data-fg-set="00"]');
    expect(retiring?.className).toContain('retiring');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('[data-fg-set="00"]')).toBeNull();
  });

  // 不想看到動的人不該看到模糊的東西飄走;直接換掉就好。
  it('減少動態時不留退場的那一組', () => {
    const { container, rerender } = render(<ForegroundStage active="00" reduced />);
    rerender(<ForegroundStage active="01" reduced />);
    expect(container.querySelector('[data-fg-set="00"]')).toBeNull();
    expect(pieces(container, '01')).toEqual([
      '/world/fg-brazier.webp',
      '/world/fg-wood-railing.webp',
    ]);
  });

  it('整層對輔助科技隱藏,而且每張圖都帶著自己的尺寸', () => {
    const { container } = render(<ForegroundStage active="04" reduced />);
    const stage = container.querySelector('[data-testid="foreground-stage"]')!;
    expect(stage).toHaveAttribute('aria-hidden', 'true');
    const img = stage.querySelector('img')!;
    // 沒有尺寸的 lazy 圖片會在載入時把版面推一下。
    expect(img).toHaveAttribute('width', '1400');
    expect(img).toHaveAttribute('height', '933');
    expect(img).toHaveAttribute('alt', '');
  });
});

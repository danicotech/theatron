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
    const { container } = render(<ForegroundStage active="01" reduced={false} />);
    expect(pieces(container, '01')).toEqual([
      '/world/fg-snow-plum-branch.webp',
      '/world/fg-lantern.webp',
    ]);
  });

  it('每件都從自己貼著的那一邊進場,不是統一從下面浮起來', () => {
    const { container } = render(<ForegroundStage active="02" reduced={false} />);
    const set = container.querySelector('[data-fg-set="02"]')!;
    const sides = Array.from(set.querySelectorAll('[data-fg-in]'), (el) =>
      el.getAttribute('data-fg-in'),
    );
    expect(sides).toEqual(['left', 'right']);
  });

  // 帳冊是規格,不是庫存。`fg-war-table` 還沒有人交出來(素材缺口第三節),
  // 所以那一章就少一件近景 —— 不拿別的頂替,更不該整頁炸掉。
  it('帳冊列了但素材還沒有的那一件,就是不放', () => {
    const { container } = render(<ForegroundStage active="03" reduced={false} />);
    expect(container.querySelector('[data-fg-set="03"]')).not.toBeNull();
    expect(pieces(container, '03')).toEqual([]);
  });

  // 同一件素材在不同章節站不同邊,但大小不該跟著變 —— 所以邊與素材是兩個屬性。
  it('擺位由 side 決定,尺寸由 asset 決定', () => {
    const { container } = render(<ForegroundStage active="05" reduced />);
    const piece = container.querySelector('[data-fg-asset="fg-snow-plum-branch"]')!;
    expect(piece).toHaveAttribute('data-fg-side', 'centre');
    expect(piece).toHaveAttribute('data-fg-in', 'left');
    expect(piece).toHaveAttribute('data-fg-sways', '');
  });

  it('切章:新的一組站上來,舊的一組留一下再走', () => {
    const { container, rerender } = render(<ForegroundStage active="01" reduced={false} />);
    rerender(<ForegroundStage active="02" reduced={false} />);

    expect(pieces(container, '02')).toEqual([
      '/world/fg-snow-bamboo.webp',
      '/world/fg-wood-railing.webp',
    ]);
    // 直接抽掉會看到東西憑空消失,所以舊的那組還在,只是被標成退場。
    const retiring = container.querySelector('[data-fg-set="01"]');
    expect(retiring?.className).toContain('retiring');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('[data-fg-set="01"]')).toBeNull();
  });

  // 不想看到動的人不該看到模糊的東西飄走;直接換掉就好。
  it('減少動態時不留退場的那一組', () => {
    const { container, rerender } = render(<ForegroundStage active="01" reduced />);
    rerender(<ForegroundStage active="07" reduced />);
    expect(container.querySelector('[data-fg-set="01"]')).toBeNull();
    expect(pieces(container, '07')).toEqual([
      '/world/fg-snow-bamboo.webp',
      '/world/fg-black-banner.webp',
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

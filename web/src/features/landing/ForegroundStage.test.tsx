import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STAGES } from './foreground';
import { ForegroundStage } from './ForegroundStage';
import { installFrames } from './testHarness';
import { findWorldAsset } from './world';

function pieces(host: HTMLElement, stop: string): string[] {
  const set = host.querySelector(`[data-fg-set="${stop}"]`);
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

  it('一個定格點只掛自己那一組近景', () => {
    const { container } = render(<ForegroundStage held="format" reduced={false} />);
    expect(pieces(container, 'format')).toEqual([
      '/world/fg-snow-bamboo.webp',
      '/world/fg-wood-railing.webp',
    ]);
  });

  it('每件都從自己貼著的那一邊進場,不是統一從下面浮起來', () => {
    const { container } = render(<ForegroundStage held="format" reduced={false} />);
    const set = container.querySelector('[data-fg-set="format"]')!;
    const sides = Array.from(set.querySelectorAll('[data-fg-in]'), (el) =>
      el.getAttribute('data-fg-in'),
    );
    expect(sides).toEqual(['left', 'right']);
  });

  // 前兩幕整個畫面就是那塊布幕。布幕自己已經是最前面那一層,再加近景只會擋住剪影。
  it('布幕的那兩幕沒有近景,但仍然掛一個空的組', () => {
    const { container } = render(<ForegroundStage held="prologue" reduced={false} />);
    expect(container.querySelector('[data-fg-set="prologue"]')).not.toBeNull();
    expect(pieces(container, 'prologue')).toEqual([]);
  });

  // 帳冊是規格,不是庫存。清冊裡沒有的那一件就不放 —— 不拿別的頂替,
  // 更不該整頁炸掉。這一條驗的是那個保護,不是某一件素材現在在不在。
  it('帳冊列了但清冊裡沒有的素材會被跳過', () => {
    const listed = STAGES.flatMap((s) => s.pieces.map((p) => p.asset));
    const missing = listed.filter((a) => findWorldAsset(a) === undefined);
    const { container } = render(<ForegroundStage held="prize" reduced={false} />);
    const rendered = Array.from(
      container.querySelectorAll('[data-fg-asset]'),
      (el) => el.getAttribute('data-fg-asset') ?? '',
    );
    for (const a of missing) expect(rendered).not.toContain(a);
    // 沒有任何一張圖是壞的:掛出來的每一件都查得到。
    for (const a of rendered) expect(findWorldAsset(a)).toBeDefined();
  });

  // 同一件素材在不同場次站不同邊,但大小不該跟著變 —— 所以邊與素材是兩個屬性。
  it('擺位由 side 決定,尺寸由 asset 決定', () => {
    const { container } = render(<ForegroundStage held="schedule" reduced />);
    const piece = container.querySelector('[data-fg-asset="fg-snow-plum-branch"]')!;
    expect(piece).toHaveAttribute('data-fg-side', 'right');
    expect(piece).toHaveAttribute('data-fg-in', 'up');
    expect(piece).toHaveAttribute('data-fg-sways', '');
  });

  it('換場:新的一組站上來,舊的一組留一下再走', () => {
    const { container, rerender } = render(<ForegroundStage held="format" reduced={false} />);
    rerender(<ForegroundStage held="prize" reduced={false} />);

    expect(pieces(container, 'prize')).toEqual([
      '/world/fg-war-table.webp',
      '/world/fg-brazier.webp',
    ]);
    // 直接抽掉會看到東西憑空消失,所以舊的那組還在,只是被標成退場。
    const retiring = container.querySelector('[data-fg-set="format"]');
    expect(retiring?.className).toContain('retiring');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('[data-fg-set="format"]')).toBeNull();
  });

  // 不想看到動的人不該看到模糊的東西飄走;直接換掉就好。
  it('減少動態時不留退場的那一組', () => {
    const { container, rerender } = render(<ForegroundStage held="format" reduced />);
    rerender(<ForegroundStage held="signup" reduced />);
    expect(container.querySelector('[data-fg-set="format"]')).toBeNull();
    expect(pieces(container, 'signup')).toEqual([
      '/world/fg-lantern.webp',
      '/world/fg-snow-bamboo.webp',
    ]);
  });

  // 沒停在任何定格點時,近景整組退場 —— 幕與幕之間的過場不該掛著上一場的東西。
  it('沒有定格點時不掛任何一組', () => {
    const { container } = render(<ForegroundStage held={null} reduced />);
    expect(container.querySelectorAll('[data-fg-set]')).toHaveLength(0);
  });

  it('整層對輔助科技隱藏,而且每張圖都帶著自己的尺寸', () => {
    const { container } = render(<ForegroundStage held="prize" reduced />);
    const stage = container.querySelector('[data-testid="foreground-stage"]')!;
    expect(stage).toHaveAttribute('aria-hidden', 'true');
    const img = stage.querySelector('img')!;
    // 沒有尺寸的 lazy 圖片會在載入時把版面推一下。
    expect(img).toHaveAttribute('width');
    expect(img).toHaveAttribute('height');
    expect(img).toHaveAttribute('alt', '');
  });
});

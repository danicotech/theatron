import { expectNoAxeViolations } from '@theatron/ui/testing';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SealButton } from './SealButton';

function setup() {
  return render(
    <SealButton text="用印" label="用印 · 看報名方式">
      <p>報名截止 待公布</p>
    </SealButton>,
  );
}

function seal() {
  return screen.getByTestId('seal-button');
}

describe('印章按鈕的狀態機', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('一開始是 idle,面板沒展開,但按鈕不是禁用的', () => {
    setup();
    expect(seal()).toHaveAttribute('data-state', 'idle');
    expect(seal()).toHaveAttribute('aria-expanded', 'false');
    expect(seal()).not.toBeDisabled();
  });

  it('按下去先 activating,蓋完才 active、面板才展開', () => {
    setup();
    act(() => {
      seal().click();
    });
    expect(seal()).toHaveAttribute('data-state', 'activating');
    expect(seal()).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(seal()).toHaveAttribute('data-state', 'active');
    expect(seal()).toHaveAttribute('aria-expanded', 'true');
  });

  // 中途接手會看到印章跳回半空再蓋一次,那讀起來是壞掉,不是「反應快」。
  it('連按:activating 期間的點擊被忽略,不重啟也不排隊', () => {
    setup();
    act(() => {
      seal().click();
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    act(() => {
      seal().click();
      seal().click();
      seal().click();
    });
    // 還在同一次蓋印裡 —— 第一次按下之後 760ms 就該完成,不是被推遲。
    expect(seal()).toHaveAttribute('data-state', 'activating');
    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(seal()).toHaveAttribute('data-state', 'active');
    expect(seal()).toHaveAttribute('aria-expanded', 'true');
  });

  // 製作契約:Completed 可重播。重播的是動作,不是結果 —— 面板維持開著。
  it('蓋完之後再按可以重蓋,但面板不會關回去', () => {
    setup();
    act(() => {
      seal().click();
      vi.advanceTimersByTime(800);
    });
    act(() => {
      seal().click();
    });
    expect(seal()).toHaveAttribute('data-state', 'activating');
    expect(seal()).toHaveAttribute('aria-expanded', 'true');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(seal()).toHaveAttribute('data-state', 'active');
  });

  // 蓋印蓋到一半滑鼠移開,印章不該彈回去。
  it('hover 與 focus 只在 idle 那一側切,不會打斷蓋印', () => {
    setup();
    act(() => {
      seal().focus();
    });
    expect(seal()).toHaveAttribute('data-state', 'hover');
    act(() => {
      seal().click();
    });
    act(() => {
      seal().blur();
    });
    expect(seal()).toHaveAttribute('data-state', 'activating');
  });

  it('被展開的那一塊由 aria-controls 指名,鍵盤與螢幕閱讀器找得到', () => {
    const { container } = setup();
    const id = seal().getAttribute('aria-controls');
    expect(id).not.toBeNull();
    expect(container.querySelector(`#${CSS.escape(id!)}`)).not.toBeNull();
  });

  it('沒有無障礙違規', async () => {
    const { container } = setup();
    // axe 要跑真的 timer,而這一支測試檔全程用假的。
    vi.useRealTimers();
    await expectNoAxeViolations(container);
  });
});

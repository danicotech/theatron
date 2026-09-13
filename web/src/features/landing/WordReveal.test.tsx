import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { splitUnits } from './splitUnits';
import { WordReveal } from './WordReveal';

describe('splitUnits', () => {
  it('中文逐字,夾在中間的拉丁字串算一個單位', () => {
    expect(splitUnits('讓武 BP')).toEqual(['讓', '武', ' ', 'BP']);
  });

  it('標點黏在前一個字上 —— 一個逗號自己浮起來只會看到一粒東西在跳', () => {
    expect(splitUnits('段位定其差,BP 量其讓;')).toEqual([
      '段',
      '位',
      '定',
      '其',
      '差,',
      'BP',
      ' ',
      '量',
      '其',
      '讓;',
    ]);
  });

  it('開頭的引號跟著後面那個字一起出場', () => {
    expect(splitUnits('「讓武」')).toEqual(['「讓', '武」']);
  });
});

describe('WordReveal', () => {
  it('每個字各自關在一個遮罩裡,延遲一個接一個往上加', () => {
    const { container } = render(<WordReveal as="h1" text="百業試鋒" />);
    const units = container.querySelectorAll('[class*="unit"]');
    expect(Array.from(units, (u) => u.textContent)).toEqual(['百', '業', '試', '鋒']);
    expect(units[0]?.getAttribute('style')).toContain('--unit-delay: 0ms');
    expect(units[3]?.getAttribute('style')).toContain('--unit-delay: 210ms');
  });

  it('整串字仍然完整留在無障礙樹裡,拆開的部分藏起來', () => {
    render(<WordReveal as="h2" text="一屆是怎麼跑的" />);
    // 螢幕閱讀器唸一串被切碎的字是壞掉的,不是有質感。
    // aria-label 掛在 h2 上而不是光禿禿的 span —— 沒有角色的元素不准帶 aria-label。
    expect(screen.getByRole('heading', { name: '一屆是怎麼跑的' })).toBeInTheDocument();
    const parts = document.querySelectorAll('[class*="mask"]');
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) expect(p).toHaveAttribute('aria-hidden', 'true');
  });

  it('沒有人來揭開之前,字本身照樣在 DOM 裡 —— 出場動態只是動態', () => {
    const { container } = render(<WordReveal as="h2" text="赴約" />);
    const line = container.querySelector('[data-rv]');
    expect(line).toHaveAttribute('data-rv', 'fade');
    expect(line).not.toHaveAttribute('data-rv-in');
    expect(container.textContent).toBe('赴約');
  });
});

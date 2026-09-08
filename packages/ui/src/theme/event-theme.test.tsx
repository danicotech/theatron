import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NEUTRAL_VARS } from '../tokens/layer-one';

import summerCupJson from './__fixtures__/summer-cup.json';
import {
  DEFAULT_THEME_ID,
  parseEventTheme,
  themeAttributes,
  toCssVars,
  toThemeRule,
  type EventTheme,
} from './event-theme';
import { ThemeProvider, ThemeStyle } from './ThemeProvider';

// 色值刻意不寫死在測試裡:一寫死,check-tokens 就會判成一次性 hex,
// 而且 fixture 一改測試就跟著漂。主題本來就是資料,fixture 就放 JSON。
const summerCup = parseEventTheme(summerCupJson);

describe('toCssVars', () => {
  it('只寫得到第 1 層,六個中性階依序對應', () => {
    const css = toCssVars(summerCup);
    NEUTRAL_VARS.forEach((cssVar, i) => {
      expect(css).toContain(`${cssVar}:${summerCup.primitives.neutral[i]}`);
    });
  });

  it('三個語意色換的是色值,不是職責', () => {
    const css = toCssVars(summerCup);
    expect(css).toContain(`--amber-400:${summerCup.primitives.money}`);
    expect(css).toContain(`--mint-400:${summerCup.primitives.win}`);
    expect(css).toContain(`--rose-400:${summerCup.primitives.live}`);
  });

  it('不碰第 2 層的語意 slot —— 那是元件在讀的名字', () => {
    const css = toCssVars(summerCup);
    for (const slot of [
      '--surface-',
      '--text-',
      '--accent-',
      '--state-',
      '--space-',
      '--font-body',
      '--font-mono',
    ]) {
      expect(css).not.toContain(slot);
    }
  });

  it('radiusScale 0 = 全直角', () => {
    const css = toCssVars(summerCup);
    expect(css).toContain('--raw-radius-card:0px');
    expect(css).toContain('--raw-radius-control:0px');
    expect(css).toContain('--raw-radius-pill:0px');
  });

  it('沒給 radiusScale 就維持基準值', () => {
    const css = toCssVars({ ...summerCup, radiusScale: undefined });
    expect(css).toContain('--raw-radius-card:10px');
    expect(css).toContain('--raw-radius-control:6px');
  });

  it('只換得掉顯示字體,內文與等寬不出現', () => {
    const css = toCssVars(summerCup);
    expect(css).toContain('--raw-font-display:');
    expect(css).toContain('Bebas Neue');
  });

  it('中性階數量不對就丟錯,不要半套主題上線', () => {
    const broken: EventTheme = {
      ...summerCup,
      primitives: { ...summerCup.primitives, neutral: summerCup.primitives.neutral.slice(0, 2) },
    };
    expect(() => toCssVars(broken)).toThrow(/neutral/);
  });
});

describe('toCssVars 的注入防護', () => {
  // 主題是外部資料(DB → API → 瀏覽器)。一個 } 就能跳出宣告區塊。
  it.each([
    ['red;}body{display:none', 'primitives.money'],
    ['red}html{opacity:0', 'primitives.money'],
    ['', 'primitives.money'],
    ['   ', 'primitives.money'],
  ])('擋掉惡意色值 %s', (money) => {
    const theme = { ...summerCup, primitives: { ...summerCup.primitives, money } };
    expect(() => toCssVars(theme)).toThrow();
  });

  it('擋掉 displayFont 裡的 url()', () => {
    expect(() => toCssVars({ ...summerCup, displayFont: 'x), url(http://evil/a' })).toThrow();
  });

  it('擋掉惡意的主題 id', () => {
    expect(() => toThemeRule({ ...summerCup, id: 'a"]{}html{opacity:0' })).toThrow();
  });

  it('radiusScale 不接受負數或 NaN', () => {
    expect(() => toCssVars({ ...summerCup, radiusScale: -1 })).toThrow();
    expect(() => toCssVars({ ...summerCup, radiusScale: Number.NaN })).toThrow();
  });
});

describe('themeAttributes', () => {
  it('沒有活動主題就落在預設主題,紋理是 none', () => {
    expect(themeAttributes()).toEqual({ 'data-theme': DEFAULT_THEME_ID, 'data-texture': 'none' });
  });

  it('有主題就帶自己的 id 與紋理', () => {
    expect(themeAttributes(summerCup)).toEqual({
      'data-theme': 'summer-cup-2026',
      'data-texture': 'scanline',
    });
  });
});

describe('注入點', () => {
  it('ThemeStyle 對預設主題不注入任何東西 —— 那些值已經在 primitives.css 裡', () => {
    const { container } = render(<ThemeStyle />);
    expect(container.querySelector('style')).toBeNull();
  });

  it('ThemeStyle 注入一段選擇器綁在 data-theme 上的規則', () => {
    const { container } = render(<ThemeStyle theme={summerCup} />);
    const style = container.querySelector('style');
    expect(style?.textContent).toContain('[data-theme="summer-cup-2026"]{');
    expect(style?.textContent?.endsWith('}')).toBe(true);
  });

  it('ThemeProvider 把主題套在子樹上,不是套在 <html> 上', () => {
    const { container } = render(
      <ThemeProvider theme={summerCup}>
        <span>內容</span>
      </ThemeProvider>,
    );
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-theme', 'summer-cup-2026');
    expect(root).toHaveAttribute('data-texture', 'scanline');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});

describe('parseEventTheme', () => {
  it('原封不動收下合法的主題 JSON', () => {
    expect(parseEventTheme(summerCupJson)).toEqual(summerCup);
  });

  it('texture 與 heroScene 只認清單裡的值', () => {
    expect(() => parseEventTheme({ ...summerCupJson, texture: 'sparkles' })).toThrow(/texture/);
    expect(() => parseEventTheme({ ...summerCupJson, heroScene: 'space' })).toThrow(/heroScene/);
  });

  it('缺 primitives 或型別不對就丟錯,不要讓半套主題走到注入那一步', () => {
    expect(() => parseEventTheme(null)).toThrow();
    expect(() => parseEventTheme([summerCupJson])).toThrow();
    expect(() => parseEventTheme({ ...summerCupJson, primitives: undefined })).toThrow(
      /primitives/,
    );
    expect(() => parseEventTheme({ ...summerCupJson, id: 42 })).toThrow(/id/);
    expect(() => parseEventTheme({ ...summerCupJson, radiusScale: 'none' })).toThrow(/radiusScale/);
  });

  it('沒給的選填欄位就是 undefined,不會自己補預設值', () => {
    const minimal = parseEventTheme({
      id: 'bare',
      primitives: summerCupJson.primitives,
    });
    expect(minimal.displayFont).toBeUndefined();
    expect(minimal.radiusScale).toBeUndefined();
    expect(minimal.texture).toBeUndefined();
    expect(minimal.logoUrl).toBeUndefined();
  });
});

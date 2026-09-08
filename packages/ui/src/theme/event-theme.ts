// 活動主題:把平台回傳的 JSON 轉成覆寫第 1 層的 CSS 變數。
//
// 換一個活動的外觀不需要重新部署 —— 這是整個 token 分層的目的。
// 注入點只有一個地方(ThemeProvider / ThemeStyle),不要散出去。
//
// 這裡的 EventTheme 不是後端契約型別,是**元件的 props 契約**。
// 活動主題存在 themis 的 tournaments.theme (JSONB),不在 hestia 的 proto 裡;
// 等它進了契約,web 那一側負責把生成型別對映成這個 props 型別,ui 仍然只收 props。

import {
  DISPLAY_FONT_VAR,
  NEUTRAL_VARS,
  RADIUS_BASE_PX,
  RADIUS_VARS,
  SEMANTIC_COLOR_VARS,
  type NeutralRamp,
} from '../tokens/layer-one';

/** 背景紋理。只有三種,不開放任意值。 */
export type ThemeTexture = 'none' | 'grid' | 'scanline';

/** 首頁 3D 場景變體。M5 只做純 2D,這個欄位先帶著不消費。 */
export type ThemeHeroScene = 'bracket' | 'arena' | 'none';

export interface EventTheme {
  /** 主題識別子,會變成 data-theme 的值。 */
  id: string;
  name?: string | undefined;
  primitives: {
    /** 六個中性階,由深到淺。 */
    neutral: NeutralRamp;
    /** 錢。永遠代表錢,不能改成代表勝利。 */
    money: string;
    /** 贏。 */
    win: string;
    /** 正在發生 / 輸 / 危險操作。 */
    live: string;
  };
  /** 只有顯示字體可換。內文與等寬字體不開放。 */
  displayFont?: string | undefined;
  /** 圓角等比縮放,0 = 全直角。 */
  radiusScale?: number | undefined;
  texture?: ThemeTexture | undefined;
  heroScene?: ThemeHeroScene | undefined;
  /** 活動標誌圖檔 URL。由 web 傳給 <img>,不進 CSS。 */
  logoUrl?: string | undefined;
}

/** 預設主題。沒有活動主題時整個站長這樣。 */
export const DEFAULT_THEME_ID = 'arena-night';

/**
 * 主題是外部資料(DB → API → 瀏覽器),所以進 <style> 之前要擋 CSS 注入。
 * 一個 `}` 就能跳出宣告區塊,接著想加什麼規則都行。
 */
const SAFE_CSS_VALUE = /^[A-Za-z0-9\s#%(),.'"\-_]+$/;

function assertSafeCssValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || !SAFE_CSS_VALUE.test(trimmed) || trimmed.toLowerCase().includes('url(')) {
    throw new Error(`主題欄位 ${field} 含有不能注入 CSS 的值`);
  }
  return trimmed;
}

function radiusPx(base: number, scale: number | undefined): string {
  if (scale === undefined) return `${base}px`;
  if (!isFiniteNonNegative(scale)) {
    throw new Error('主題欄位 radiusScale 必須是 >= 0 的有限數字');
  }
  return `${Math.round(base * scale)}px`;
}

function isFiniteNonNegative(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value - value === 0;
}

/**
 * 把主題轉成一串 CSS 宣告(不含選擇器)。
 * 只寫得到第 1 層的變數名 —— 第 2 層的語意 slot 會自己跟著變。
 */
export function toCssVars(theme: EventTheme): string {
  const declarations: string[] = [];

  const ramp = theme.primitives.neutral;
  if (ramp.length !== NEUTRAL_VARS.length) {
    throw new Error(`主題欄位 primitives.neutral 必須是 ${NEUTRAL_VARS.length} 個由深到淺的色值`);
  }
  NEUTRAL_VARS.forEach((cssVar, i) => {
    declarations.push(`${cssVar}:${assertSafeCssValue(ramp[i] ?? '', `primitives.neutral[${i}]`)}`);
  });

  for (const [role, cssVar] of Object.entries(SEMANTIC_COLOR_VARS)) {
    const value = theme.primitives[role as keyof typeof SEMANTIC_COLOR_VARS];
    declarations.push(`${cssVar}:${assertSafeCssValue(value, `primitives.${role}`)}`);
  }

  if (theme.displayFont !== undefined) {
    const family = assertSafeCssValue(theme.displayFont, 'displayFont');
    declarations.push(
      `${DISPLAY_FONT_VAR}:'${family.replaceAll("'", '')}', 'Noto Sans TC', sans-serif`,
    );
  }

  for (const [role, cssVar] of Object.entries(RADIUS_VARS)) {
    const base = RADIUS_BASE_PX[role as keyof typeof RADIUS_BASE_PX];
    declarations.push(`${cssVar}:${radiusPx(base, theme.radiusScale)}`);
  }

  return declarations.join(';');
}

/** 完整的一段 CSS 規則。注入點用這個,不要自己拼選擇器。 */
export function toThemeRule(theme: EventTheme): string {
  const id = assertSafeCssValue(theme.id, 'id');
  return `[data-theme="${id}"]{${toCssVars(theme)}}`;
}

/** 掛在承載主題的元素上的屬性。<html> 或任何一棵子樹都可以。 */
export function themeAttributes(theme?: EventTheme): {
  'data-theme': string;
  'data-texture': ThemeTexture;
} {
  return {
    'data-theme': theme?.id ?? DEFAULT_THEME_ID,
    'data-texture': theme?.texture ?? 'none',
  };
}

const TEXTURES: readonly string[] = ['none', 'grid', 'scanline'];
const HERO_SCENES: readonly string[] = ['bracket', 'arena', 'none'];

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string') throw new Error(`主題欄位 ${key} 必須是字串`);
  return value;
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`主題欄位 ${key} 必須是字串`);
  return value;
}

function optionalEnum<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
): T | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`主題欄位 ${key} 只能是 ${allowed.join(' / ')}`);
  }
  return value as T;
}

/**
 * 把外部來的主題 JSON 收成 EventTheme。
 *
 * 這不是「為了型別好看」的轉換 —— 主題是 DB 裡的資料,會經過 API 到瀏覽器,
 * 而它最後會變成注入頁面的 CSS。形狀在進來的時候驗一次,比在注入的時候才炸好。
 * 色值本身的合法性由 toCssVars 把關(那裡是唯一會寫進 CSS 的地方)。
 */
export function parseEventTheme(input: unknown): EventTheme {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('主題必須是物件');
  }
  const raw = input as Record<string, unknown>;
  const primitives = raw.primitives;
  if (typeof primitives !== 'object' || primitives === null) {
    throw new Error('主題欄位 primitives 必須是物件');
  }
  const p = primitives as Record<string, unknown>;
  const neutral = p.neutral;
  if (!Array.isArray(neutral) || neutral.some((v) => typeof v !== 'string')) {
    throw new Error('主題欄位 primitives.neutral 必須是色值字串陣列');
  }

  const radiusScale = raw.radiusScale;
  if (radiusScale !== undefined && typeof radiusScale !== 'number') {
    throw new Error('主題欄位 radiusScale 必須是數字');
  }

  return {
    id: requireString(raw, 'id'),
    name: optionalString(raw, 'name'),
    primitives: {
      neutral: neutral as readonly string[],
      money: requireString(p, 'money'),
      win: requireString(p, 'win'),
      live: requireString(p, 'live'),
    },
    displayFont: optionalString(raw, 'displayFont'),
    radiusScale,
    texture: optionalEnum<ThemeTexture>(raw, 'texture', TEXTURES),
    heroScene: optionalEnum<ThemeHeroScene>(raw, 'heroScene', HERO_SCENES),
    logoUrl: optionalString(raw, 'logoUrl'),
  };
}

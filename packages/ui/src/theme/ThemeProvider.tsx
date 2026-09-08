import type { ReactNode } from 'react';

import { DEFAULT_THEME_ID, type EventTheme, themeAttributes, toThemeRule } from './event-theme';

export interface ThemeStyleProps {
  theme?: EventTheme | undefined;
}

/**
 * 唯一的主題注入點。
 * 預設主題(arena-night)的值已經在 primitives.css 裡,不需要注入。
 */
export function ThemeStyle({ theme }: ThemeStyleProps) {
  if (theme === undefined || theme.id === DEFAULT_THEME_ID) return null;
  return <style dangerouslySetInnerHTML={{ __html: toThemeRule(theme) }} />;
}

export interface ThemeProviderProps extends ThemeStyleProps {
  children: ReactNode;
  className?: string | undefined;
}

/**
 * 把一棵子樹套上主題。/kitchen-sink 要同頁並列兩個主題,所以主題不能只掛在 <html>。
 * 掛在 <html> 的情況用 themeAttributes() + <ThemeStyle>,不要多包一層 div。
 */
export function ThemeProvider({ theme, children, className }: ThemeProviderProps) {
  return (
    <div {...themeAttributes(theme)} className={className}>
      <ThemeStyle theme={theme} />
      {children}
    </div>
  );
}

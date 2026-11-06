import { describe, expect, it } from 'vitest';
import theme from './lunjian.json';
import { lunjianExtraCss } from './lunjian';

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  return channels
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i]!, 0);
}
function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function resolve(colors: Record<string, string>, slot: string, seen = new Set<string>()): string {
  if (seen.has(slot)) throw new Error(`Circular color alias: ${slot}`);
  seen.add(slot);
  const value = colors[slot];
  if (!value) throw new Error(`Missing color: ${slot}`);
  const alias = /^var\(--([a-z-]+)\)$/.exec(value);
  if (alias) return resolve(colors, alias[1]!, seen);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid color: ${slot}`);
  return value;
}

for (const mode of ['light', 'dark'] as const) {
  describe(`${mode} readable UI palette`, () => {
    const colors: Record<string, string> = {
      ...theme.extras,
      ...(mode === 'dark' ? theme.darkExtras : {}),
    };
    for (const surface of ['surface-auth-canvas', 'surface-auth-paper', 'surface-auth-field']) {
      for (const text of [
        'text-auth-ink',
        'text-auth-muted',
        'accent-auth-action',
        'accent-contrast',
        'accent-info',
        'accent-status-money',
        'state-status-win',
        'state-status-live',
      ]) {
        it(`${text} on ${surface} meets normal text contrast`, () => {
          expect(contrast(resolve(colors, text), resolve(colors, surface))).toBeGreaterThanOrEqual(
            4.5,
          );
        });
      }
    }
    for (const action of ['accent-action-primary', 'accent-action-hover']) {
      it(`${action} has readable on-action text`, () => {
        expect(
          contrast(resolve(colors, 'text-on-action'), resolve(colors, action)),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
    it('legacy actions resolve to the brand and status aliases retain their own roles', () => {
      expect(resolve(colors, 'accent-auth-action')).toBe(resolve(colors, 'accent-brand'));
      expect(resolve(colors, 'accent-status-money')).toBe(resolve(colors, 'accent-secondary'));
      expect(resolve(colors, 'state-auth-ready')).toBe(resolve(colors, 'state-status-win'));
      expect(resolve(colors, 'state-status-live')).not.toBe(resolve(colors, 'accent-brand'));
    });
    it('field outlines remain distinguishable', () => {
      expect(
        contrast(resolve(colors, 'border-auth'), resolve(colors, 'surface-auth-field')),
      ).toBeGreaterThanOrEqual(3);
    });
    it('fixed pale equipment cards keep the darker brand foreground in either mode', () => {
      // Oilpaper is a stricter contrast floor than the brighter fixed equipment sheet.
      expect(
        contrast(resolve(colors, 'accent-brand-on-paper'), theme.extras['surface-auth-canvas']),
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
}
it('ships the status colors through the validated theme serializer', () => {
  const css = lunjianExtraCss();
  for (const slot of ['accent-status-money', 'state-status-win', 'state-status-live']) {
    expect(css).toContain(`--${slot}:`);
  }
});

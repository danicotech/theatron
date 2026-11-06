import { describe, it, expect } from 'vitest';
import { safeReturnPath, discordLoginHref, memberLoginHref } from './returnPath';
describe('sign-in destination', () => {
  it.each(['/?panel=bets#duel', '/?match=m1&panel=markets#duel', '/#schedule'])(
    'preserves the in-place arena return %s for both sign-in methods',
    (path) => {
      expect(safeReturnPath(path)).toBe(path);
      expect(memberLoginHref('spring', path)).toContain(encodeURIComponent(path));
      expect(
        new URL(discordLoginHref(path), 'https://arena.test').searchParams.get('redirect'),
      ).toBe(path);
    },
  );
  it('preserves the selected match and section without enrolling a spectator', () => {
    const path = '/t/spring/m/match-one?player=one#markets';
    expect(safeReturnPath(path)).toBe(path);
    expect(memberLoginHref('spring', path)).toContain(encodeURIComponent(path));
    const start = new URL(discordLoginHref(path), 'https://arena.test');
    expect(start.searchParams.get('redirect')).toBe(path);
  });
  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%5cevil.test',
    '/api/auth/logout',
    '/auth/continue',
    '/t/a/login',
    '/judge/login',
    '/judge/../api',
    '/judge\n',
    '/judge%0a',
  ])('rejects unsafe or looping return %s', (path) => {
    expect(safeReturnPath(path, '/judge')).toBe('/judge');
  });
  it('retains both enrollment and administrative intent', () => {
    expect(safeReturnPath('/t/spring/enroll')).toBe('/t/spring/enroll');
    expect(safeReturnPath('/judge/spring/m/one')).toBe('/judge/spring/m/one');
  });
  it('returns Discord sign-in straight to enrollment and keeps role routing only without a destination', () => {
    const path = '/t/spring/enroll';
    const start = new URL(discordLoginHref(path), 'https://arena.test');
    expect(start.searchParams.get('redirect')).toBe(path);
    expect(discordLoginHref()).toBe('/api/auth/discord/start?redirect=%2Fauth%2Fcontinue');
    expect(discordLoginHref('//outside.test')).toBe(discordLoginHref());
  });
});

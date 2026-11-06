function hasUnsafeCharacters(value: string): boolean {
  return Array.from(value).some((character) => character === '\\' || character.charCodeAt(0) <= 32);
}

/** Only known, same-origin application destinations can survive sign-in. */
export function safeReturnPath(raw: unknown, fallback = ''): string {
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    hasUnsafeCharacters(raw)
  )
    return fallback;
  try {
    const decoded = decodeURIComponent(raw);
    if (hasUnsafeCharacters(decoded) || decoded.startsWith('//')) return fallback;
    const url = new URL(raw, 'https://arena.invalid');
    if (url.origin !== 'https://arena.invalid' || /^\/judge\/login\/?$/.test(url.pathname))
      return fallback;
    if (
      !(url.pathname === '/' && ['#duel', '#schedule', '#register'].includes(url.hash)) &&
      !/^\/t\/[^/]+\/(?:enroll|me|bets|m\/[^/]+)\/?$/.test(url.pathname) &&
      !/^\/judge(?:\/[^/]+(?:\/m\/[^/]+)?)?\/?$/.test(url.pathname)
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
export function memberLoginHref(slug: string, next: string): string {
  const path = safeReturnPath(next);
  return `/t/${encodeURIComponent(slug)}/login${path ? `?next=${encodeURIComponent(path)}` : ''}`;
}
export function discordLoginHref(next = ''): string {
  const path = safeReturnPath(next);
  const landing = path || '/auth/continue';
  return `/api/auth/discord/start?redirect=${encodeURIComponent(landing)}`;
}

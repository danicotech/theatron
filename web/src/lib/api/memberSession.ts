const base = process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? '/api';
let refresh: Promise<boolean> | null = null;

/** Retry only account-authenticated entry points after a rejected access token. */
export async function memberFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options = { ...init, credentials: 'include' as const };
  const response = await fetch(input, options);
  const url = input instanceof Request ? input.url : String(input);
  if (
    response.status !== 401 ||
    !/(?:AuthService\/GetMember|SignupService\/(?:Register|Login))$/.test(url)
  )
    return response;
  refresh ??= fetch(`${base}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((result) => result.ok)
    .catch(() => false)
    .finally(() => {
      refresh = null;
    });
  if (!(await refresh) || init?.signal?.aborted) return response;
  return fetch(input, options);
}

export async function memberLogout(): Promise<void> {
  const response = await fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error('登出失敗，請再試一次。');
}

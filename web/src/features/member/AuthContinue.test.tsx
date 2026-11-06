import { render, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthContinue } from './AuthContinue';

const api = vi.hoisted(() => ({ getMember: vi.fn(), replace: vi.fn() }));
vi.mock('../../lib/api/client', () => ({ platformApi: { auth: { getMember: api.getMember } } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: api.replace }) }));
beforeEach(() => {
  api.replace.mockReset();
});

it.each([
  [true, '', '/judge'],
  [false, '', '/t/spring/me'],
  [true, '/t/spring/enroll', '/t/spring/enroll'],
  [false, '/t/spring/m/one#markets', '/t/spring/m/one#markets'],
  [false, '//outside.test', '/t/spring/me'],
])('returns verified member: admin=%s, requested=%s', async (canManage, next, expected) => {
  api.getMember.mockResolvedValue({ member: { canManage } });
  render(<AuthContinue next={next} slug="spring" />);
  await waitFor(() => expect(api.replace).toHaveBeenCalledWith(expected));
});

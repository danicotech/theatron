import type { Metadata } from 'next';
import { MemberAccess } from '../../../../features/member/MemberAccess';
import { DiscordAccess } from '../../../../features/member/DiscordAccess';
import { safeReturnPath } from '../../../../features/member/returnPath';
import { MemberRegistration } from '../../../../features/signup/MemberRegistration';
export const metadata: Metadata = { title: '註冊' };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string; login_error?: string }>;
}) {
  const { slug } = await params,
    query = await searchParams;
  const next = safeReturnPath(query.next, `/t/${encodeURIComponent(slug)}/enroll`);
  return (
    <MemberAccess slug={slug} mode="signup" next={next}>
      <MemberRegistration slug={slug} next={next} />
      <DiscordAccess next={next} error={query.login_error ?? ''} />
    </MemberAccess>
  );
}

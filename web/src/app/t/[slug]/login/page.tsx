import type { Metadata } from 'next';
import { MemberAccess } from '../../../../features/member/MemberAccess';
import { DiscordAccess } from '../../../../features/member/DiscordAccess';
import { safeReturnPath } from '../../../../features/member/returnPath';
import { PlayerLogin } from '../../../../features/signup/PlayerLogin';
export const metadata: Metadata = { title: '會員登入' };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string; login_error?: string }>;
}) {
  const { slug } = await params,
    query = await searchParams;
  const next = safeReturnPath(query.next, '');
  return (
    <MemberAccess slug={slug} mode="login" next={next}>
      <PlayerLogin slug={slug} next={next} />
      <DiscordAccess next={next} error={query.login_error ?? ''} />
    </MemberAccess>
  );
}

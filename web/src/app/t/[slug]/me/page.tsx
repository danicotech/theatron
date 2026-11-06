import type { Metadata } from 'next';
import { MemberWorkspace } from '../../../../features/member/MemberWorkspace';
import { type MemberView } from '../../../../features/member/MemberShell';
export const metadata: Metadata = { title: '會員專區' };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const view: MemberView =
    query.view === 'registration' || query.view === 'character' || query.view === 'bets'
      ? query.view
      : 'overview';
  return <MemberWorkspace key={slug} slug={slug} view={view} />;
}

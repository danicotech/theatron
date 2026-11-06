import { redirect } from 'next/navigation';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; matchId: string }>;
  searchParams: Promise<{ player?: string | string[] }>;
}) {
  const [{ matchId }, query] = await Promise.all([params, searchParams]);
  const search = new URLSearchParams({ match: matchId, panel: 'markets' });
  if (typeof query.player === 'string') search.set('player', query.player);
  redirect('/?' + search.toString() + '#duel');
}

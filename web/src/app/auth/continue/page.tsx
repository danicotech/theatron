import { AuthContinue } from '../../../features/member/AuthContinue';
import { safeReturnPath } from '../../../features/member/returnPath';
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  return (
    <AuthContinue
      next={safeReturnPath(query.next)}
      slug={process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? ''}
    />
  );
}

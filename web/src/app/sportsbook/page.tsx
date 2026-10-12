import { Sportsbook } from '../../features/sportsbook/Sportsbook';
import { RegistrationEntry } from '../../features/sportsbook/RegistrationEntry';
export const metadata = { title: '觀局雅集｜本機試玩' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.entry === 'registration')
    return <RegistrationEntry eventId={typeof params.event === 'string' ? params.event : ''} />;
  return <Sportsbook />;
}

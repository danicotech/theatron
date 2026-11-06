import { redirect } from 'next/navigation';
/** Compatibility only: bets are now an in-place arena window. */
export default function Page() {
  redirect('/?panel=bets#duel');
}

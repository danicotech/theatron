import { redirect } from 'next/navigation';
/** The public schedule lives in the main site's schedule chapter. */
export default function Page() {
  redirect('/#schedule');
}

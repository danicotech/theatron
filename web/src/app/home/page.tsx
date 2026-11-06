import { HOME_MARKUP, HOME_REVISION } from './homeMarkup';
import { LUNJIAN_REVISION } from '../lunjianMarkup';
import { HomeRuntime } from './HomeRuntime';
import { RegistrationBridge } from '../../features/signup/RegistrationBridge';
export const metadata = {
  title: { absolute: '夜鴉閣 | 論劍試鋒' },
  description: '群俠赴約，以武會友。了解百業試鋒賽制、報名參賽、查看比武與賽程。',
};
export default function Page() {
  return (
    <>
      <link
        rel="stylesheet"
        precedence="default"
        href={`/lunjian/lunjian.css?v=${LUNJIAN_REVISION}`}
      />
      <link rel="stylesheet" precedence="default" href={`/lunjian/home.css?v=${HOME_REVISION}`} />
      <div data-home-entry-pending dangerouslySetInnerHTML={{ __html: HOME_MARKUP }} />
      <noscript>
        <style>
          {'[data-home-entry-pending] .baiye-home > :is(main,.site-header){visibility:visible}'}
        </style>
      </noscript>
      <RegistrationBridge />
      <HomeRuntime revision={HOME_REVISION} />
    </>
  );
}

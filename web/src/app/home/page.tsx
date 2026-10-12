import { HOME_MARKUP, HOME_REVISION } from './homeMarkup';
import { LUNJIAN_REVISION } from '../lunjianMarkup';
import { HomeRuntime } from './HomeRuntime';
import { SportsbookBridge } from '../../features/sportsbook/SportsbookBridge';
export const metadata = {
  title: '百業試鋒｜不同程度，同場試鋒',
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
      <div dangerouslySetInnerHTML={{ __html: HOME_MARKUP }} />
      <SportsbookBridge />
      <HomeRuntime revision={HOME_REVISION} />
    </>
  );
}

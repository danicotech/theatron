// Visual fixtures for the A–J battle layouts. Names are placeholders for local verification only;
// they are injected into the page under the slug "visual-test" and never reach the API.
const ranks = ['開山', '斷水', '飛花', '無我'];
const names = [
  '赤霄',
  '照雪',
  '長風',
  '聽雨',
  '墨川',
  '雲舟',
  '凌霜',
  '寒酥',
  '星河',
  '青崖',
  '晚晴',
  '逐月',
  '疏影',
  '孤鴻',
  '流螢',
  '白蘅',
];
function person(i) {
  return {
    id: 'p' + i,
    name: names[i % 16] + (i >= 16 ? i : ''),
    rank: (i % 4) + 1,
    rankName: ranks[i % 4],
    seed: i + 1,
  };
}
export function fixture(layout, options = {}) {
  const size = { C: 1, D: 2, E: 3, F: 4, G: 8, H: 16, J: 4 }[layout] || 1;
  const count = ['C', 'D', 'E', 'F', 'G', 'H'].includes(layout) ? 2 : 8;
  const players = Array.from({ length: count }, (_, i) => ({
    ...person(i),
    ...(size > 1
      ? {
          name: names[i] + '隊',
          members: Array.from({ length: size }, (_, j) => ({
            ...person(j + i * size),
            id: 'p' + i + '-m' + j,
          })),
        }
      : {}),
    ...(options.longName && i === 0
      ? { name: '東方不敗之劍客無名氏' + (size > 1 ? '隊' : '') }
      : {}),
  }));
  const rounds = [];
  let ids = players.map((p) => p.id),
    round = 1;
  while (ids.length > 1) {
    const next = [],
      matches = [];
    for (let i = 0; i < ids.length; i += 2) {
      const id = 'r' + round + 'm' + i / 2;
      const bye = layout === 'B' && round === 1 && i === 0;
      matches.push({
        id,
        round,
        slot: i / 2,
        p1: ids[i],
        p2: bye ? '' : ids[i + 1],
        winner: ids[i],
        status: 'done',
        bye,
        kind: 'bracket',
        s1: 2,
        s2: 1,
      });
      next.push(ids[i]);
    }
    rounds.push({
      round,
      label: ids.length === 2 ? '決賽' : ids.length === 4 ? '準決賽' : '八強',
      matches,
    });
    ids = next;
    round++;
  }
  if (!['I', 'J'].includes(layout)) {
    // Mixed states: one finished, one live, the rest upcoming.
    const first = rounds[0].matches;
    first.forEach((m, i) => {
      if (i === 1) {
        m.status = 'live';
        m.winner = '';
        m.s1 = 1;
        m.s2 = 0;
      } else if (i > 1) {
        m.status = 'upcoming';
        m.winner = '';
        m.s1 = 0;
        m.s2 = 0;
      }
    });
    rounds.slice(1).forEach((r) =>
      r.matches.forEach((m, i) => {
        m.status = 'upcoming';
        m.winner = '';
        m.s1 = 0;
        m.s2 = 0;
        if (i > 0 || r.round > 2) {
          m.p1 = '';
          m.p2 = '';
        } else {
          m.p2 = '';
        }
      }),
    );
  }
  if (layout === 'B') players.splice(1, 1);
  return { kind: 'ready', slug: 'visual-test', published: true, bestOf: 3, players, rounds };
}

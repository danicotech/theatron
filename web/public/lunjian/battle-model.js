/** Public presentation only. Never derive a result, a roster or a photo from a name. */
export const BATTLE_LAYOUTS = Object.freeze({1:'C',2:'D',3:'E',4:'F',8:'G',16:'H'});
export const rankNames = ['待評定','開山','斷水','飛花','無我'];
export const rankFrames = ['pending','kaishan','duanshui','feihua','wuwo'];
export function matchesOf(data) {
  return data?.published ? (data.rounds || []).flatMap(r => r.matches || []).filter(m => m.kind !== 'third') : [];
}
/** Bracket rounds in play order; third-place matches never enter the tree. */
export function bracketRounds(data) {
  if (!data?.published) return [];
  return (data.rounds || [])
    .map(r => ({...r, matches: (r.matches || []).filter(m => m.kind !== 'third').slice().sort((a, b) => a.slot - b.slot)}))
    .filter(r => r.matches.length)
    .sort((a, b) => a.round - b.round);
}
/** Red takes the first half of every round; the lone final sits in the centre. */
export function sideOf(round, match) {
  if (round.matches.length === 1) return 'center';
  return match.slot < round.matches.length / 2 ? 'red' : 'blue';
}
export function nextMatch(rounds, match) {
  const index = rounds.findIndex(r => r.round === match.round);
  const next = rounds[index + 1];
  return next ? next.matches.find(m => m.slot === Math.floor(match.slot / 2)) || null : null;
}
export function entrantsOf(player) {
  return Array.isArray(player?.members) && player.members.length ? player.members : player ? [player] : [];
}
export function teamSize(data) {
  return Math.max(1, ...(data?.players || []).map(p => entrantsOf(p).length));
}
export function imageOf(player) {
  // gameAvatarUrl is the administrator-collected game portrait from the bracket API (never a Discord avatar).
  const value = player?.gameAvatarUrl || player?.portraitUrl || '';
  // Only an explicitly supplied public image is shown; never substitute a demo person.
  return typeof value === 'string' && (/^https:\/\//i.test(value) || /^\/(?!\/)/.test(value)) ? value : '';
}
export function finalOf(data) {
  const matches = matchesOf(data);
  const last = Math.max(0,...matches.map(m=>m.round));
  const finals = matches.filter(m=>m.round===last);
  // An incomplete round with several matches is not a final.
  const requiredRounds = Math.ceil(Math.log2(data?.players?.length || 0));
  return finals.length === 1 && last >= requiredRounds && requiredRounds > 0 ? finals[0] : null;
}
export function championOf(data) {
  const final = finalOf(data);
  if (!final || final.status !== 'done' || !final.winner || ![final.p1,final.p2].includes(final.winner)) return null;
  return (data.players || []).find(p=>p.id===final.winner) || null;
}
export function scheduleLayout(data) {
  const winner=championOf(data);
  if (winner) return entrantsOf(winner).length > 1 ? 'J' : 'I';
  return matchesOf(data).some(m=>m.bye) || (data?.published && data.players?.length % 2 === 1) ? 'B' : 'A';
}
export function duelLayout(data, match) {
  if (!data?.published || !match) return 'C';
  const players=data.players || [];
  const count=Math.max(entrantsOf(players.find(p=>p.id===match.p1)).length,entrantsOf(players.find(p=>p.id===match.p2)).length,1);
  return BATTLE_LAYOUTS[count] || 'H';
}
/** Heading copy for the schedule and the duel; status comes from the data, never from a demo. */
export function scheduleHeading(data) {
  const layout = scheduleLayout(data), players = (data?.players || []).length, size = teamSize(data);
  if (!data?.published) return {layout, title: '比賽賽程', context: '', status: '賽程待公布'};
  const live = matchesOf(data).some(m => m.status === 'live');
  if (layout === 'I') return {layout, title: '比賽賽程', context: '個人賽 · 賽事已結束', status: ''};
  if (layout === 'J') return {layout, title: '比賽賽程', context: `團體賽 ${size}v${size} · 賽事已結束`, status: ''};
  const kind = size > 1 ? '團隊戰局' : '個人戰局';
  const name = layout === 'B' ? '奇數個人賽' : '偶數個人賽';
  const rounds = bracketRounds(data), first = rounds[0]?.label || '';
  return {layout, title: kind, context: `${layout} / ${size > 1 ? '團隊賽' : name} · ${players} ${size > 1 ? '隊' : '人'}${first ? ' · ' + first + '起' : ''}`, status: live ? '比賽進行中' : '待開賽'};
}
export function historyOf(data, id) {
  return matchesOf(data).filter(m=>m.p1===id || m.p2===id).sort((a,b)=>a.round-b.round || a.slot-b.slot).map(m=>({
    match:m,
    round:(data.rounds || []).find(r=>r.round===m.round)?.label || `第 ${m.round} 輪`,
    opponent:(data.players || []).find(p=>p.id===(m.p1===id?m.p2:m.p1)),
    score:m.bye?'輪空':m.status==='upcoming'?'待開賽':`${m.p1===id?m.s1:m.s2} : ${m.p1===id?m.s2:m.s1}`,
  }));
}
export function publicBattle(data) {
  // Drop all draft participants when publication is revoked.
  return data?.published ? data : {...data,players:[],rounds:[],published:false};
}

// Follow confirmed winners, not slot guesses. Incomplete records stop the branch.
export function teamRoute(data, entrantId, beforeRound = Infinity) {
  const prior = matchesOf(data).filter(m => m.round < beforeRound && m.status === 'done' && m.winner === entrantId && [m.p1,m.p2].includes(m.winner));
  const round = Math.max(0, ...prior.map(m => m.round));
  const candidates = prior.filter(m => m.round === round);
  const player = (data.players || []).find(p => p.id === entrantId);
  if (candidates.length !== 1) return {player};
  const match = candidates[0];
  return {player, match, children:[match.p1,match.p2].filter(Boolean).map(id => teamRoute(data,id,match.round))};
}

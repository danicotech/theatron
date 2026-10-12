'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LUNJIAN_REVISION } from '../../app/lunjianMarkup';
import type { TournamentDisplay } from '../landing/tournamentDisplay';
import { createBracketTree, type BracketController } from './bracketTreeRuntime';
import styles from './WuxiaBracket.module.css';

/** Public and judge views share the canonical seats, lines and winner states. */
export function WuxiaBracket({ data }: { data: TournamentDisplay }) {
  const host = useRef<HTMLDivElement>(null);
  const tree = useRef<BracketController | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!host.current) return;
    const openMatch = (matchId: string) => {
      router.push(`/judge/${encodeURIComponent(data.slug)}/m/${encodeURIComponent(matchId)}`);
    };
    const controller = createBracketTree({
      host: host.current,
      onSelect: openMatch,
      onPlayer: (_playerId, matchId) => openMatch(matchId),
      matchActionLabel: '開啟本場裁判台',
      playerActionLabel: '開啟本場裁判台',
      championArt: '/lunjian/art/manga-champion.webp',
    });
    tree.current = controller;
    return () => {
      controller.destroy();
      if (tree.current === controller) tree.current = null;
    };
  }, [router, data.slug]);
  useEffect(() => {
    tree.current?.render(data);
  }, [data]);
  return (
    <div className={styles.tree}>
      <link
        rel="stylesheet"
        href={`/lunjian/bracket-tree.css?v=${LUNJIAN_REVISION}`}
        precedence="bracket"
      />
      <div ref={host} />
    </div>
  );
}

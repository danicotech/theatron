'use client';
import { ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { useEffect, useState } from 'react';
import { activityApi } from '../../lib/api/activity';
import type { Player } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { useTournamentRealtime } from '../realtime/useTournamentRealtime';
import { tournamentRealtime } from '../realtime/tournamentRealtime';
import styles from './PlayerAvatarManager.module.css';

async function thumbnail(file: File): Promise<Blob> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('請選擇 8 MB 以內的 JPG 或 PNG。');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法處理圖片，請換個瀏覽器再試。');
    // Image encoding matte, not a themed interface surface; matches server normalization.
    context.fillStyle = 'white';
    context.fillRect(0, 0, 256, 256);
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('圖片處理失敗。'))),
        'image/jpeg',
        0.85,
      ),
    );
  } finally {
    bitmap.close();
  }
}

function AvatarEditor({ player, slug }: { player: Player; slug: string }) {
  const [draft, setDraft] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!draft) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(draft);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft]);
  async function select(file: File) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      setDraft(await thumbnail(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法讀取圖片。');
    } finally {
      setPending(false);
    }
  }
  async function save(remove = false) {
    if (pending || (!remove && !draft)) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await activityApi.judge.setPlayerAvatar({
        playerPublicId: player.publicId,
        image: remove ? new Uint8Array() : new Uint8Array(await draft!.arrayBuffer()),
      });
      setDraft(null);
      setMessage(remove ? '已移除頭像' : '已儲存頭像');
      tournamentRealtime(slug).reconnect();
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setPending(false);
    }
  }
  const source = preview || player.gameAvatarUrl;
  return (
    <li className={styles.row}>
      <div className={styles.identity}>
        <span className={styles.avatar}>
          {source ? (
            <img src={source} alt="" width={56} height={56} />
          ) : (
            <span aria-hidden="true">未提供</span>
          )}
        </span>
        <div>
          <h4>{player.displayName}</h4>
          <p>{player.gameId}</p>
        </div>
      </div>
      <div className={styles.controls}>
        <label className={styles.file}>
          選擇頭像
          <input
            type="file"
            accept="image/jpeg,image/png"
            aria-label={`選擇${player.displayName}的遊戲頭像`}
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void select(file);
            }}
          />
        </label>
        {draft && (
          <>
            <Button disabled={pending} variant="primary" onClick={() => void save()}>
              儲存頭像
            </Button>
            <Button disabled={pending} onClick={() => setDraft(null)}>
              取消
            </Button>
          </>
        )}
        {player.gameAvatarUrl && !draft && (
          <Button disabled={pending} onClick={() => void save(true)}>
            移除頭像
          </Button>
        )}
      </div>
      {draft && <p className={styles.feedback}>預覽：置中裁切成正方形，儲存後公開顯示。</p>}
      {message && (
        <p className={styles.feedback} role="status">
          {message}
        </p>
      )}
      {error && (
        <p className={styles.feedback} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function PlayerAvatarManager({ slug }: { slug: string }) {
  const sync = useTournamentRealtime(slug);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void activityApi.judge
      .listUnranked({ tournamentSlug: slug, includeRanked: true }, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setPlayers(response.players.flatMap((entry) => (entry.player ? [entry.player] : [])));
          setError('');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(ConnectError.from(err).message);
      });
    return () => controller.abort();
  }, [slug, sync.revision]);
  return (
    <section className={styles.section} aria-label="遊戲頭像管理">
      <h3>遊戲頭像</h3>
      <p>管理員收圖後設定。頭像與姓名將公開顯示於賽程；未提供時使用佔位。</p>
      <p className={styles.help}>JPG / PNG，最大 8 MB。上傳前可預覽裁切結果。</p>
      {error && <p role="alert">{error}</p>}
      {!players && !error && <p role="status">讀取選手…</p>}
      {players?.length === 0 && <p>尚無選手報名。</p>}
      <ul>
        {players?.map((player) => (
          <AvatarEditor key={player.publicId} player={player} slug={slug} />
        ))}
      </ul>
    </section>
  );
}

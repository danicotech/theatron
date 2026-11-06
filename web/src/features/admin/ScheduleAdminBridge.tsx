'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { platformApi } from '../../lib/api/client';
import styles from './ScheduleManagement.module.css';

const ScheduleManagement = dynamic(
  () => import('./ScheduleManagement').then((m) => m.ScheduleManagement),
  {
    loading: () => <p role="status">讀取賽程管理…</p>,
  },
);

/** The public schedule remains mounted; management is a separate, permission-gated view. */
export function ScheduleAdminBridge() {
  const slug = (process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '').trim();
  const [hosts, setHosts] = useState<{
    toolbar: HTMLElement;
    editor: HTMLElement;
    panel: HTMLElement;
  } | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const toolbar = document.querySelector<HTMLElement>('[data-schedule-mode]');
    const editor = document.querySelector<HTMLElement>('[data-schedule-editor]');
    const panel = document.getElementById('bracket-panel');
    // Local fixture management has its own permissions and must never target the formal event.
    if (
      !slug ||
      new URLSearchParams(location.search).get('preview') === '1' ||
      !toolbar ||
      !editor ||
      !panel
    )
      return;
    setHosts({ toolbar, editor, panel });
    let active = true;
    let request = 0;
    const check = async () => {
      const id = ++request;
      try {
        const { member } = await platformApi.auth.getMember({});
        if (!active || id !== request) return;
        setAllowed(member?.canManage === true);
        if (!member?.canManage) setEditing(false);
      } catch {
        if (!active || id !== request) return;
        setAllowed(false);
        setEditing(false);
      }
    };
    const foreground = () => {
      if (document.visibilityState === 'visible') void check();
    };
    void check();
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    return () => {
      active = false;
      window.removeEventListener('focus', foreground);
      document.removeEventListener('visibilitychange', foreground);
      panel.removeAttribute('data-schedule-editing');
    };
  }, [slug]);

  useEffect(() => {
    hosts?.panel.toggleAttribute('data-schedule-editing', allowed && editing);
    if (hosts) hosts.editor.hidden = !(allowed && editing);
    return () => {
      hosts?.panel.removeAttribute('data-schedule-editing');
    };
  }, [hosts, allowed, editing]);

  if (!hosts || !allowed) return null;
  return (
    <>
      {createPortal(
        <div className={styles.switcher} role="group" aria-label="賽程模式">
          <button type="button" aria-pressed={!editing} onClick={() => setEditing(false)}>
            檢視賽程
          </button>
          <button
            type="button"
            aria-pressed={editing}
            aria-controls="schedule-editor"
            onClick={() => setEditing(true)}
          >
            編輯賽程
          </button>
        </div>,
        hosts.toolbar,
      )}
      {editing && createPortal(<ScheduleManagement slug={slug} />, hosts.editor)}
    </>
  );
}

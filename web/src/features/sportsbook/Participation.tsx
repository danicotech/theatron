'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Character, Command, EnrollmentProfile, Member, Tournament } from './model';
import {
  blankCharacter,
  blankProfile,
  enrollmentErrors,
  selfRanks,
  type EnrollmentErrors,
} from './enrollment';
import styles from './Sportsbook.module.css';
import formStyles from './Participation.module.css';
import { SavedLoadoutRoles } from './SavedLoadoutRoles';
import type { SavedRole } from './registrationRolesRuntime.js';

type Actions = { busy: boolean; run: (command: Command) => Promise<boolean> };
const steps = ['了解說明', '填寫報名', '設定角色', '確認報名'];
export function Participation({
  event,
  member,
  busy,
  run,
  login,
  onMatch,
  submissionError = '',
  scrollForm = false,
  initialRulesAccepted = false,
}: Actions & {
  event: Tournament;
  member: Member | undefined;
  login: () => void;
  onMatch: (id: string) => void;
  submissionError?: string;
  scrollForm?: boolean;
  initialRulesAccepted?: boolean;
}) {
  const registration = event.registration;
  const saved = registration?.entries.find((x) => x.userId === member?.id);
  const [step, setStep] = useState(0),
    [editing, setEditing] = useState(false);
  const [gameId, setGameId] = useState(saved?.gameId || ''),
    [name, setName] = useState(saved?.name || member?.name || '');
  const [rulesAccepted, setRulesAccepted] = useState(saved?.rulesAccepted || initialRulesAccepted);
  const [furthestStep, setFurthestStep] = useState(0);
  useEffect(() => {
    setFurthestStep((old) => Math.max(old, step));
  }, [step]);
  const [character, setCharacter] = useState<Character>(saved?.character || blankCharacter);
  const [profile, setProfile] = useState<EnrollmentProfile>(saved?.profile || blankProfile);
  const [errors, setErrors] = useState<EnrollmentErrors>({}),
    [feedback, setFeedback] = useState(''),
    [failed, setFailed] = useState(false),
    [savingComplete, setSavingComplete] = useState<boolean | null>(null);
  const prefix = useId(),
    root = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    focusInvalid = useRef(false),
    saving = useRef(false);
  const [selectedRole, setSelectedRole] = useState<SavedRole | null>(null);
  const memberId = member?.id;
  const hasFocusedStep = useRef(false);
  const values = { gameId, name, character, profile, rulesAccepted };
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const arts = params.get('arts');
    if (
      (arts || params.has('loadoutRole')) &&
      memberId &&
      params.get('artsUser') === memberId &&
      (params.get('sportsEvent') || params.get('event')) === event.id
    ) {
      if (arts) setCharacter((old) => ({ ...old, arts }));
      setEditing(true);
      setStep(2);
    }
  }, [memberId, event.id]);
  useEffect(() => {
    // Each step has a different height. Keep the new heading in view after
    // advancing from the previous step's footer, including on narrow screens.
    // The scroll owns initial focus while unfolding. Later steps still scroll into view.
    if (!scrollForm || hasFocusedStep.current) heading.current?.focus();
    hasFocusedStep.current = true;
  }, [step, editing, saved?.status, scrollForm]);
  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    const key = Object.keys(errors).find((k) => errors[k as keyof EnrollmentErrors]);
    if (key) root.current?.querySelector<HTMLElement>(`[data-field="${key}"]`)?.focus();
  }, [errors, step]);
  const rulesHref = scrollForm
    ? '#rules'
    : `/?preview=1&stage=3d&sportsEvent=${encodeURIComponent(event.id)}#rules`;
  const handicapHref = scrollForm ? '#invitation' : rulesHref.replace('#rules', '#invitation');
  const myPlayer = member && event.links[member.id];
  const myMatches = event.matches.filter((m) => myPlayer && [m.p1, m.p2].includes(myPlayer));
  function jump(next: number) {
    setErrors({});
    setFeedback('');
    setFailed(false);
    setStep(next);
  }
  function focusErrors(found: EnrollmentErrors) {
    focusInvalid.current = true;
    setErrors(found);
  }
  function change(key: keyof EnrollmentErrors) {
    setErrors((old) => ({ ...old, [key]: undefined }));
    setFeedback('');
    setFailed(false);
  }
  async function save(complete: boolean) {
    if (busy || saving.current) return false;
    if (!member) {
      login();
      return false;
    }
    const completing = complete || saved?.status === 'confirmed';
    if (completing) {
      for (let n = 0; n < 3; n++) {
        const found = enrollmentErrors(values, n);
        if (Object.keys(found).length) {
          setStep(n);
          focusErrors(found);
          return false;
        }
      }
    }
    if (!gameId.trim() || !name.trim()) {
      setStep(1);
      focusErrors({
        ...(gameId.trim() ? {} : { gameId: '儲存前請填寫遊戲 ID。' }),
        ...(name.trim() ? {} : { name: '儲存前請填寫角色姓名。' }),
      });
      return false;
    }
    setFailed(false);
    setFeedback('');
    saving.current = true;
    setSavingComplete(complete);
    let ok: boolean;
    try {
      ok = await run({
        type: 'enroll',
        eventId: event.id,
        userId: member.id,
        gameId,
        name,
        character,
        profile,
        rulesAccepted,
        complete,
      });
    } catch {
      ok = false;
    } finally {
      saving.current = false;
      setSavingComplete(null);
    }
    setFailed(!ok);
    if (ok) {
      setFeedback(completing ? '報名資料已儲存。' : '草稿已儲存，尚未完成報名。');
      if (completing) {
        setEditing(false);
        const url = new URL(location.href);
        url.searchParams.delete('arts');
        url.searchParams.delete('artsUser');
        history.replaceState(null, '', url);
      }
    }
    return ok;
  }
  function loadoutHref(role: SavedRole | null = selectedRole) {
    return `/loadout?sportsEvent=${encodeURIComponent(event.id)}&returnTo=${scrollForm ? 'register' : 'participation'}${role ? `&loadoutRole=${role.id}&roleSource=${role.source}` : ''}`;
  }
  function openLoadout(role: SavedRole | null = selectedRole) {
    const url = new URL(loadoutHref(role), location.origin);
    const current = new URLSearchParams(location.search);
    for (const key of ['preview', 'stage']) {
      const value = current.get(key);
      if (value) url.searchParams.set(key, value);
    }
    void save(false).then((ok) => {
      if (ok) location.assign(url.href);
    });
  }
  function field(
    key: keyof EnrollmentErrors,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: {
      required?: boolean;
      multiline?: boolean;
      limit?: number;
      help?: string | undefined;
    } = {},
  ) {
    const id = prefix + '-' + key,
      error = errors[key];
    const attrs = {
      id,
      'data-field': key,
      value,
      required: options.required,
      maxLength: options.limit || 80,
      'aria-invalid': !!error,
      'aria-describedby': id + '-help' + (error ? ' ' + id + '-error' : ''),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(e.target.value);
        change(key);
      },
    };
    return (
      <div className={formStyles.field}>
        <div className={formStyles.fieldLabel}>
          <label htmlFor={id}>{label}</label>
          <span aria-hidden="true">{options.required ? '必填' : '選填'}</span>
        </div>
        {options.multiline ? (
          <textarea {...attrs} rows={4} />
        ) : (
          <input {...attrs} autoComplete="off" />
        )}
        <small id={id + '-help'}>{options.help || ''}</small>
        {error && (
          <p id={id + '-error'} className={formStyles.fieldError}>
            {error}
          </p>
        )}
      </div>
    );
  }
  function profileReview(p: EnrollmentProfile | undefined) {
    return (
      <dl className={formStyles.review}>
        <dt>伺服器／Discord</dt>
        <dd>
          {p?.server || '未填寫'} ／ {p?.discord || '未填寫'}
        </dd>
        <dt>自評段位</dt>
        <dd>{p?.selfRank || '待評估'}（以大會評定為準）</dd>
        <dt>對戰經驗</dt>
        <dd>{p?.experience || '未補填'}</dd>
        <dt>可參賽時段</dt>
        <dd>{p?.availability || '未補填'}</dd>
        <dt>給大會的備註</dt>
        <dd>{p?.notes || '無'}</dd>
      </dl>
    );
  }
  function characterReview(c: Character) {
    return (
      <dl className={formStyles.review}>
        <dt>流派／武器</dt>
        <dd>
          {c.style} ／ {c.weapon}
        </dd>
        <dt>裝備</dt>
        <dd>{c.equipment}</dd>
        <dt>武學</dt>
        <dd>{c.arts}</dd>
      </dl>
    );
  }
  const configurationLink = scrollForm && (
    <a
      className={formStyles.configurationLink}
      data-my-loadout
      href={loadoutHref()}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const url = new URL(e.currentTarget.href);
        const current = new URLSearchParams(location.search);
        for (const key of ['preview', 'stage']) {
          const value = current.get(key);
          if (value) url.searchParams.set(key, value);
        }
        e.currentTarget.href = url.href;
        if (
          member &&
          gameId.trim() &&
          name.trim() &&
          registration?.open &&
          !registration.published &&
          (saved?.status !== 'confirmed' || editing)
        ) {
          e.preventDefault();
          openLoadout();
        }
      }}
    >
      我的武學配置 <span aria-hidden="true">→</span>
    </a>
  );
  const readingConsent = (
    <>
      <div className={formStyles.readingScene} aria-hidden="true">
        <img src="/lunjian/art/manga-breakout.webp" alt="" width={1024} height={1536} />
        <img src="/lunjian/art/manga-veteran-layer.webp" alt="" width={1024} height={1536} />
      </div>
      <label className={formStyles.consent} htmlFor={prefix + '-rules-accepted'}>
        <input
          id={prefix + '-rules-accepted'}
          aria-label="我已閱讀並了解賽制與讓武原則"
          data-field="rulesAccepted"
          type="checkbox"
          checked={rulesAccepted}
          aria-invalid={!!errors.rulesAccepted}
          aria-describedby={errors.rulesAccepted ? prefix + '-rules-error' : undefined}
          onChange={(e) => {
            setRulesAccepted(e.target.checked);
            change('rulesAccepted');
          }}
        />
        <span className={formStyles.consentText}>
          <span>我已閱讀並了解</span>
          <a href={rulesHref}>賽制</a>
          <span>與</span>
          <a href={handicapHref}>讓武原則</a>
        </span>
      </label>
      {errors.rulesAccepted && (
        <p id={prefix + '-rules-error'} className={formStyles.fieldError}>
          {errors.rulesAccepted}
        </p>
      )}
    </>
  );
  if (!registration)
    return (
      <section className={formStyles.enrollment} data-scroll-form={scrollForm}>
        <ol className={formStyles.steps} aria-label="報名進度">
          {steps.map((label, i) => (
            <li key={label} aria-current={i === 0 ? 'step' : undefined}>
              <button type="button" disabled={i > 0}>
                <span>{i + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        {readingConsent}
        <p role="status" className={formStyles.closedNotice}>
          本場參賽名單已排定，目前不開放新增報名。仍可閱讀賽事與讓武說明。
        </p>
        {configurationLink}
        {myMatches.map((m) => (
          <button key={m.id} onClick={() => onMatch(m.id)}>
            查看我的對局 · 第 {m.round} 輪
          </button>
        ))}
      </section>
    );
  if (saved?.status === 'confirmed' && !editing)
    return (
      <section ref={root} className={formStyles.enrollment} data-scroll-form={scrollForm}>
        <header className={formStyles.receipt}>
          <span className={formStyles.seal} aria-hidden="true">
            已入冊
          </span>
          <p>本機報名已完成</p>
          <h2 ref={heading} tabIndex={-1}>
            {saved.name}
          </h2>
          <p>
            {event.name} · 遊戲 ID：{saved.gameId}
          </p>
          <small>報名編號 {saved.playerId.slice(0, 8).toUpperCase()}</small>
        </header>
        <div className={formStyles.receiptColumns}>
          <section>
            <h3>我的武學配置</h3>
            {characterReview(saved.character)}
          </section>
          <section>
            <h3>出席與聯絡資料</h3>
            {profileReview(saved.profile)}
          </section>
        </div>
        <p>
          {registration.published
            ? myPlayer
              ? '對局已發布，請查看你的賽程。'
              : '本次未排入對局，請聯絡管理者。'
            : '已進入報名名單，等待管理者安排對局。'}
        </p>
        <div className={styles.actions}>
          {configurationLink}
          {registration.open && !registration.published && (
            <button
              onClick={() => {
                setEditing(true);
                jump(1);
              }}
            >
              修改報名資料與角色
            </button>
          )}
          {myMatches.map((m) => (
            <button key={m.id} onClick={() => onMatch(m.id)}>
              查看我的對局 · {m.kind === 'third' ? '季軍戰' : `第 ${m.round} 輪`}
            </button>
          ))}
        </div>
        <p className={formStyles.help}>參賽會員可投注其他場次，不能投注自己的對局或本屆名次盤。</p>
      </section>
    );
  if (!registration.open || registration.published)
    return (
      <section className={styles.participation}>
        <h2>報名已截止</h2>
        <p>{saved ? '資料仍是草稿，尚未完成報名。' : '本屆不再接受新的報名。'}</p>
        <a href={rulesHref}>查看規則 ↗</a>
        {configurationLink}
      </section>
    );
  if (
    saved?.status !== 'confirmed' &&
    registration.entries.filter((e) => e.status === 'confirmed').length >= registration.capacity
  )
    return (
      <section className={styles.participation}>
        <h2>報名名額已滿</h2>
        <p>
          本屆 {registration.capacity} 位名額已完成報名。
          {saved
            ? '你的草稿仍保留，可在大會增加名額後繼續。'
            : '已完成報名的會員仍可登入查看資料。'}
        </p>
        <div className={styles.actions}>
          {configurationLink}
          {!member && <button onClick={login}>登入查看我的報名</button>}
          <a href={rulesHref}>查看規則與讓武說明 ↗</a>
        </div>
      </section>
    );
  return (
    <section
      ref={root}
      className={formStyles.enrollment}
      data-scroll-form={scrollForm}
      aria-label="百業試鋒報名表"
    >
      <header className={formStyles.formHead}>
        <div>
          {!scrollForm && <h2>赴約參賽</h2>}
          <p>不因段位拒絕任何人，帶著你的本事來。</p>
        </div>
        <p className={formStyles.capacity}>
          <strong>{registration.entries.filter((x) => x.status === 'confirmed').length}</strong> /{' '}
          {registration.capacity}
          <span>已完成報名</span>
        </p>
      </header>
      <ol className={formStyles.steps} aria-label="報名進度">
        {steps.map((label, i) => (
          <li key={label} aria-current={step === i ? 'step' : undefined}>
            <button type="button" disabled={busy || i > furthestStep} onClick={() => jump(i)}>
              <span aria-hidden="true">{i < step ? '✓' : i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div className={formStyles.layout}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setFailed(false);
            const found = enrollmentErrors(values, step);
            if (Object.keys(found).length) {
              focusErrors(found);
              return;
            }
            if (!member) {
              login();
              return;
            }
            if (step < 3) jump(step + 1);
            else void save(true);
          }}
        >
          <h3 ref={heading} tabIndex={-1} className={formStyles.stepHeading}>
            {steps[step]}
          </h3>
          <fieldset disabled={busy} className={formStyles.fields} key={step}>
            {step === 0 && (
              <>
                {readingConsent}
                {!member && !scrollForm && <p>請登入或註冊會員，以便保留你的報名與角色資料。</p>}
              </>
            )}
            {step === 1 && (
              <>
                <div className={formStyles.fieldPair}>
                  {field('gameId', '遊戲 ID', gameId, setGameId, {
                    required: true,
                    limit: 64,
                    help: '填遊戲內可查找到你的唯一 ID。',
                  })}
                  {field('name', '角色姓名', name, setName, {
                    required: true,
                    limit: 40,
                    help: '將公開顯示在賽程與比武名帖上。',
                  })}
                  {field(
                    'server',
                    '所在伺服器',
                    profile.server,
                    (v) => setProfile({ ...profile, server: v }),
                    { help: '若所有人同服，可留空。' },
                  )}
                  {field(
                    'discord',
                    'Discord 名稱',
                    profile.discord,
                    (v) => setProfile({ ...profile, discord: v }),
                    { help: '選填；未填時以遊戲 ID 聯繫。' },
                  )}
                </div>
                <div className={formStyles.field}>
                  <div className={formStyles.fieldLabel}>
                    <label htmlFor={prefix + '-rank'}>自評段位</label>
                    <span>供裁判參考</span>
                  </div>
                  <select
                    id={prefix + '-rank'}
                    value={profile.selfRank}
                    onChange={(e) => setProfile({ ...profile, selfRank: e.target.value })}
                  >
                    {selfRanks.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <small>不確定就選待評估。自評不影響報名資格。</small>
                </div>
                {field(
                  'experience',
                  '對戰經驗',
                  profile.experience,
                  (v) => setProfile({ ...profile, experience: v }),
                  {
                    required: true,
                    multiline: true,
                    limit: 2000,
                    help: '例如：幾乎沒碰過論劍／經常切磋／目前遊戲段位。不必填得漂亮。',
                  },
                )}
                {field(
                  'availability',
                  '可參賽時段',
                  profile.availability,
                  (v) => setProfile({ ...profile, availability: v }),
                  {
                    required: true,
                    multiline: true,
                    limit: 1000,
                    help: '填可出席時段與限制；日期未公布可填「待公告後確認」。',
                  },
                )}
              </>
            )}
            {step === 2 && (
              <>
                <p className={formStyles.help}>選擇備戰角色，一次套入配置。</p>
                {member && (
                  <SavedLoadoutRoles
                    eventId={event.id}
                    userId={member.id}
                    selectedKey={selectedRole ? selectedRole.source + ':' + selectedRole.id : ''}
                    onEdit={openLoadout}
                    onApply={(role) => {
                      setSelectedRole(role);
                      setCharacter({ ...role.character });
                      setName(role.name);
                      setErrors({});
                      setFeedback(`已套用「${role.name}」，確認後再完成報名。`);
                    }}
                  />
                )}
                <a
                  data-field="style"
                  href={loadoutHref()}
                  onClick={(e) => {
                    e.preventDefault();
                    openLoadout();
                  }}
                >
                  {selectedRole ? '編輯這個備戰角色 ↗' : '前往我的武學配置 ↗'}
                </a>
                {Object.values(errors).some(Boolean) && (
                  <p role="alert" className={formStyles.fieldError}>
                    請先選擇完整的備戰角色，或前往我的武學配置完成配置。
                  </p>
                )}
                {character.style && (
                  <section className={formStyles.reviewSection} aria-label="已套用的角色配置">
                    <h4>{name} · 目前配置</h4>
                    <dl className={`${formStyles.review} ${formStyles.roleReview}`}>
                      <dt>流派</dt>
                      <dd>{character.style}</dd>
                      <dt>武器</dt>
                      <dd>{character.weapon || '待設定'}</dd>
                      <dt>裝備</dt>
                      <dd>{character.equipment || '待設定'}</dd>
                    </dl>
                    <details>
                      <summary>查看完整配置</summary>
                      <p className={formStyles.loadoutNote}>{character.arts}</p>
                    </details>
                  </section>
                )}
                <details>
                  <summary>給大會的備註（選填）</summary>
                  {field(
                    'notes',
                    '給大會的備註',
                    profile.notes,
                    (v) => setProfile({ ...profile, notes: v }),
                    {
                      multiline: true,
                      limit: 2000,
                      help: '選填，例如操作設備、需提前通知的事項。',
                    },
                  )}
                </details>
              </>
            )}
            {step === 3 && (
              <>
                <section className={formStyles.reviewSection}>
                  <div className={formStyles.reviewTitle}>
                    <h4>參賽身分與出席</h4>
                    <button type="button" onClick={() => jump(1)}>
                      修改報名資料
                    </button>
                  </div>
                  <p>
                    {name} · {gameId}
                  </p>
                  {profileReview(profile)}
                </section>
                <section className={formStyles.reviewSection}>
                  <div className={formStyles.reviewTitle}>
                    <h4>角色配置</h4>
                    <button type="button" onClick={() => jump(2)}>
                      修改角色設定
                    </button>
                  </div>
                  {characterReview(character)}
                </section>
                <p>已確認賽制與讓武原則。送出後加入本機報名名單；正式伺服器尚未串接。</p>
              </>
            )}
          </fieldset>
          {Object.values(errors).some(Boolean) && (
            <p role="alert" className={formStyles.fieldError}>
              還有欄位需要確認，請依欄位下方說明修正。
            </p>
          )}
          {failed && (
            <p role="alert" className={styles.error}>
              {submissionError || '尚未儲存成功，請稍後重試。原本填寫的資料仍在表單中。'}
            </p>
          )}
          <p role="status" className={formStyles.feedback}>
            {feedback ||
              (saved?.status === 'draft' ? '已保留本機草稿，完成最後確認才算報名。' : '')}
          </p>
          <footer className={formStyles.formActions} data-intro-actions={step === 0 || undefined}>
            {step === 0 && configurationLink}
            {step > 0 && (
              <button disabled={busy} type="button" onClick={() => jump(step - 1)}>
                上一步
              </button>
            )}
            {step >= 1 && (
              <button
                type="button"
                disabled={busy}
                aria-busy={(busy && savingComplete === false) || undefined}
                onClick={() => void save(false)}
              >
                {busy && savingComplete === false
                  ? '正在儲存…'
                  : saved?.status === 'confirmed'
                    ? '儲存修改'
                    : '儲存草稿'}
              </button>
            )}
            <button
              className={formStyles.submit}
              disabled={busy}
              aria-busy={(busy && savingComplete === true) || undefined}
            >
              {busy && savingComplete === true
                ? '正在儲存…'
                : step === 3
                  ? '確認完成報名'
                  : step === 0 && !member
                    ? '登入／註冊後繼續'
                    : '下一步'}
            </button>
          </footer>
        </form>
        <aside className={formStyles.summary} aria-label="參賽摘要">
          <p className={formStyles.kicker}>這次上場的你</p>
          <h3>{name.trim() || '名帖待書'}</h3>
          <dl>
            <dt>遊戲 ID</dt>
            <dd>{gameId.trim() || '尚未填寫'}</dd>
            <dt>流派／武器</dt>
            <dd>
              {character.style || '待設定'} ／ {character.weapon || '待設定'}
            </dd>
            <dt>報名狀態</dt>
            <dd>
              {saved?.status === 'confirmed'
                ? '已報名 · 修改中'
                : saved
                  ? '草稿，尚未送出'
                  : '尚未送出'}
            </dd>
          </dl>
          <p>最後確認才完成報名。儲存草稿後，可登入同一會員繼續填寫。</p>
        </aside>
      </div>
    </section>
  );
}

export function EnrollmentAdmin({
  event,
  busy,
  run,
  ask,
  feedback = '',
  failed = false,
}: Actions & {
  event: Tournament;
  ask: (command: Command, title: string, description: string) => void;
  feedback?: string;
  failed?: boolean;
}) {
  const r = event.registration;
  const confirmed = r?.entries.filter((e) => e.status === 'confirmed') || [];
  const [chosen, setChosen] = useState<string[] | null>(null);
  const ids = (chosen || confirmed.map((e) => e.playerId)).filter((id) =>
    confirmed.some((e) => e.playerId === id),
  );
  if (!r) return <p>此屆為既有賽程快照，可直接管理對局；收取新報名請另建活動。</p>;
  return (
    <section className={styles.participation}>
      <h3>活動與報名名單</h3>
      <p>
        {r.published ? '已發布對局' : r.open ? '開放報名' : '報名已關閉'} · 完成 {confirmed.length}{' '}
        / {r.capacity} 人 · 草稿 {r.entries.length - confirmed.length} 人
      </p>
      <form
        key={`${event.name}:${r.capacity}:${r.open}`}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run({
            type: 'activity-update',
            eventId: event.id,
            name: typeof f.get('name') === 'string' ? (f.get('name') as string) : '',
            capacity: Number(f.get('capacity')),
            open: f.get('open') === 'yes',
          });
        }}
      >
        <fieldset disabled={busy || r.published}>
          <label>
            活動名稱
            <input name="name" defaultValue={event.name} maxLength={80} required />
          </label>
          <label>
            報名人數上限
            <input
              name="capacity"
              type="number"
              min={Math.max(2, confirmed.length)}
              max="64"
              defaultValue={r.capacity}
              required
            />
          </label>
          <label>
            報名狀態
            <select name="open" defaultValue={r.open ? 'yes' : 'no'}>
              <option value="yes">開放報名</option>
              <option value="no">關閉報名</option>
            </select>
          </label>
          <button aria-busy={busy || undefined}>{busy ? '正在儲存…' : '儲存活動設定'}</button>
        </fieldset>
      </form>
      {feedback && (
        <p role={failed ? 'alert' : 'status'} className={failed ? styles.error : undefined}>
          {feedback}
        </p>
      )}
      <div className={styles.actions}>
        <a href={`/sportsbook?event=${encodeURIComponent(event.id)}&tab=participation`}>
          參賽者報名入口 ↗
        </a>
        <a href={`/?preview=1&stage=3d&sportsEvent=${encodeURIComponent(event.id)}#schedule`}>
          查看完整賽程 ↗
        </a>
      </div>
      {r.entries.map((e) => (
        <details key={e.playerId}>
          <summary>
            {e.name} · {e.status === 'confirmed' ? '已完成報名' : '草稿'}
          </summary>
          <p>
            {e.gameId} · {e.character.style} · {e.character.weapon}
          </p>
          <p>{e.character.equipment}</p>
          <p>{e.character.arts}</p>
          {e.profile && (
            <dl>
              <dt>伺服器／聯絡 Discord</dt>
              <dd>
                {e.profile.server || '未填寫'} ／ {e.profile.discord || '未填寫'}
              </dd>
              <dt>自評與對戰經驗</dt>
              <dd>
                {e.profile.selfRank} · {e.profile.experience}
              </dd>
              <dt>可參賽時段</dt>
              <dd>{e.profile.availability}</dd>
              <dt>備註</dt>
              <dd>{e.profile.notes || '無'}</dd>
            </dl>
          )}
        </details>
      ))}
      {!r.published && (
        <>
          <h3>安排參賽者與籤位</h3>
          <p>
            勾選已完成報名者，再依序調整首輪籤位。關閉報名後才能發布；發布後鎖定名單並開放投注。
          </p>
          {confirmed.map((e) => (
            <label className={styles.checkRow} key={e.playerId}>
              <input
                type="checkbox"
                disabled={busy}
                checked={ids.includes(e.playerId)}
                onChange={() =>
                  setChosen(
                    ids.includes(e.playerId)
                      ? ids.filter((id) => id !== e.playerId)
                      : [...ids, e.playerId],
                  )
                }
              />
              {e.name}
            </label>
          ))}
          <ol>
            {ids.map((id, i) => (
              <li key={id}>
                {confirmed.find((e) => e.playerId === id)!.name}{' '}
                <button
                  disabled={busy || i === 0}
                  aria-label={`將 ${confirmed.find((e) => e.playerId === id)!.name} 籤位前移`}
                  onClick={() => {
                    const moved = [...ids];
                    [moved[i - 1], moved[i]] = [moved[i]!, moved[i - 1]!];
                    setChosen(moved);
                  }}
                >
                  ↑
                </button>
              </li>
            ))}
          </ol>
          <button
            className={styles.primary}
            disabled={busy || r.open || ids.length < 2}
            onClick={() =>
              ask(
                { type: 'publish-roster', eventId: event.id, playerIds: ids },
                '確認發布對局',
                `依目前籤位安排 ${ids.length} 人：${ids.map((id) => confirmed.find((e) => e.playerId === id)!.name).join('、')}。發布後不能更換名單，並開放本機投注。`,
              )
            }
          >
            發布對局（{ids.length} 人）
          </button>
        </>
      )}
    </section>
  );
}

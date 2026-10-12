import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LUNJIAN_MARKUP } from './lunjianMarkup';
import { LOADOUT_MARKUP } from './loadout/loadoutMarkup';
import { activityDisplay } from '../features/landing/activityDisplay';
import { TournamentPhase } from '../lib/api/gen/hestia/activity/v1/common_pb';

const homeSource = readFileSync('web/public/lunjian/lunjian.js', 'utf8');
const stageSource = readFileSync('web/public/lunjian/stage3d.js', 'utf8');
const loadoutSource = readFileSync('web/public/loadout/loadout.js', 'utf8');
const noteSource = readFileSync('web/public/loadout/build-note.js', 'utf8');
const noteExports = [...noteSource.matchAll(/export (?:const|function) (\w+)/g)].map((m) => m[1]);
const getNote = runInThisContext(
  '(function(){' + noteSource.replace(/export /g, '') + `;return {${noteExports.join(',')}};})`,
) as () => Record<string, unknown>;
const catalog: unknown = JSON.parse(readFileSync('web/public/loadout/data/catalog.json', 'utf8'));
const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
  localStorage.clear();
  history.replaceState(null, '', '/?stage=2d&intro=0#rules');
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('900'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('innerWidth', 960);
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('anime', Object.assign(vi.fn(), { remove: vi.fn(), stagger: vi.fn() }));
  vi.stubGlobal('mountInk', vi.fn());
  vi.stubGlobal('playInk', vi.fn());
  vi.stubGlobal('inkVS', () => document.createElement('span'));
  vi.stubGlobal('INK', { load: () => Promise.resolve() });
});
afterEach(() => {
  window.__LUNJIAN?.destroy();
  window.__LOADOUT?.destroy();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lab 首頁執行期回歸', () => {
  function mount() {
    document.body.innerHTML = LUNJIAN_MARKUP;
    runInThisContext(homeSource);
  }
  it('React 已移除內頁 DOM 後仍能清理 runtime，不阻斷返回首頁', () => {
    mount();
    document.body.replaceChildren();
    expect(() => vi.advanceTimersByTime(34)).not.toThrow();
    expect(() => window.__LUNJIAN?.destroy()).not.toThrow();
    expect(window.__LUNJIAN).toBeUndefined();
  });
  it('稀疏影格依實際时间推進墨幕，換頁當幀必須完整覆蓋', async () => {
    let callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const frame = (time: number) => {
      const pending = callbacks;
      callbacks = [];
      pending.forEach((callback) => callback(time));
    };
    mount();
    click('.site-nav a[href="#duel"]');
    await Promise.resolve();
    await Promise.resolve();
    frame(1600);
    expect(document.querySelector('#duel')).toHaveAttribute('data-on');
    expect(document.querySelector('#ink-wipe')).toHaveAttribute('data-progress', '0.4600');
    expect(document.body).toHaveAttribute('data-cut');
    frame(3500);
    expect(document.body).not.toHaveAttribute('data-cut');
    expect(document.querySelector('#duel')).toHaveAttribute('data-on');
    expect(document.querySelector('#ink-wipe')).toHaveAttribute('data-progress', '1.0000');
  });
  it('跳到內容進入目前章節正文，不把定格頁跳回隱藏的第一章', () => {
    mount();
    const skip = document.querySelector<HTMLAnchorElement>('.skip-link')!;
    skip.focus();
    skip.click();
    expect(document.activeElement).toBe(document.querySelector('#rules .chapter-sticky'));
    expect(location.hash).toBe('#rules');
  });
  it('漫畫按 DOM 閱讀順序揭露，閱讀模式與卸載取消動畫並還原可見內容', async () => {
    const pause = vi.fn();
    const play = vi.fn();
    const add = vi.fn(({ targets }: { targets: HTMLElement | HTMLElement[] }) => {
      (Array.isArray(targets) ? targets : [targets]).forEach((target) => {
        target.style.opacity = '0.5';
      });
    });
    const remove = vi.fn();
    const timeline = vi.fn(() => ({ pause, play, add }));
    vi.stubGlobal('anime', Object.assign(vi.fn(), { remove, stagger: vi.fn(), timeline }));
    mount();
    const frames = [...document.querySelectorAll<HTMLElement>('#rules [data-comic-frame]')];
    expect(
      add.mock.calls
        .map(([options]) => options.targets)
        .filter((target) => !Array.isArray(target) && target.closest('#rules')),
    ).toEqual([frames[0]]);
    expect(frames.slice(1).every((frame) => frame.style.opacity === '0')).toBe(true);
    expect(play).toHaveBeenCalled();
    const initialCount = timeline.mock.calls.length;
    await Promise.resolve();
    await Promise.resolve();
    expect(timeline.mock.calls.length).toBe(initialCount);
    runInThisContext('window.__LUNJIAN.applyGrid(1, {animate:false})');
    expect(timeline.mock.calls.length).toBe(initialCount);
    click('.site-header [data-reading-toggle]');
    expect(pause).toHaveBeenCalled();
    expect(frames.every((frame) => frame.style.opacity === '')).toBe(true);
    const count = timeline.mock.calls.length;
    click('.site-header [data-reading-toggle]');
    expect(timeline.mock.calls.length).toBeGreaterThan(count);
    window.__LUNJIAN?.destroy();
    expect(frames.every((frame) => frame.style.opacity === '')).toBe(true);
    expect(remove).toHaveBeenCalledWith(expect.arrayContaining(frames));
  });
  it('實際 Anime.js 完成上一格後才開始下一格，不靠固定延遲猜測', () => {
    type MotionTimeline = { duration: number; seek: (time: number) => void };
    const vendorSource = readFileSync('web/public/lunjian/vendor/anime.min.js', 'utf8');
    const vendor = runInThisContext(
      '(function(){const module={exports:{}};const exports=module.exports;' +
        vendorSource +
        ';return module.exports;})()',
    ) as { timeline: (options: Record<string, unknown>) => MotionTimeline };
    const timelines: MotionTimeline[] = [];
    const makeTimeline = vendor.timeline;
    vendor.timeline = (options) => {
      const timeline = makeTimeline(options);
      timelines.push(timeline);
      return timeline;
    };
    vi.stubGlobal('anime', vendor);
    mount();
    const frames = [...document.querySelectorAll<HTMLElement>('#rules [data-comic-frame]')];
    const states = () => frames.map((frame) => frame.dataset.comicState);
    expect(states()).toEqual(['entering', 'waiting', 'waiting']);
    const first = timelines.at(-1)!;
    first.seek(first.duration - 1);
    expect(states()).toEqual(['entering', 'waiting', 'waiting']);
    first.seek(first.duration);
    expect(states()).toEqual(['shown', 'entering', 'waiting']);
    const second = timelines.at(-1)!;
    second.seek(second.duration);
    expect(states()).toEqual(['shown', 'shown', 'entering']);
    const third = timelines.at(-1)!;
    third.seek(third.duration);
    expect(states()).toEqual(['shown', 'shown', 'shown']);
    expect(frames.every((frame) => frame.style.opacity === '')).toBe(true);
  });
  it('下一章在墨幕完整覆蓋時準備分層，揭幕後不再次隱藏重播', async () => {
    const timeline = vi.fn(() => ({ pause: vi.fn(), play: vi.fn(), add: vi.fn() }));
    vi.stubGlobal('anime', Object.assign(vi.fn(), { remove: vi.fn(), stagger: vi.fn(), timeline }));
    mount();
    timeline.mockClear();
    click('.site-nav a[href="#invitation"]');
    await vi.advanceTimersByTimeAsync(600);
    expect(timeline).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('invitation');
    const prepared = timeline.mock.calls.length;
    expect(prepared).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.body.hasAttribute('data-cut')).toBe(false);
    expect(timeline.mock.calls.length).toBe(prepared);
  });
  it('慢速素圖在墨幕下等待解碼，準備好後才揭露下一章', async () => {
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const previous = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode');
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => pending,
    });
    try {
      mount();
      click('.site-nav a[href="#invitation"]');
      expect(
        [
          ...document.querySelectorAll<HTMLImageElement>('#invitation [data-comic-frame] img'),
        ].every((image) => image.loading === 'eager'),
      ).toBe(true);
      await vi.advanceTimersByTimeAsync(1700);
      expect(document.querySelector('.chapter[data-on]')?.id).toBe('rules');
      expect(Number(document.querySelector<HTMLElement>('#ink-wipe')?.dataset.progress)).toBe(0.46);
      finish();
      await vi.advanceTimersByTimeAsync(40);
      expect(document.querySelector('.chapter[data-on]')?.id).toBe('invitation');
      await vi.advanceTimersByTimeAsync(2000);
      expect(document.body.hasAttribute('data-cut')).toBe(false);
    } finally {
      if (previous) Object.defineProperty(HTMLImageElement.prototype, 'decode', previous);
      else Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
    }
  });
  it('七章保留正文操作區，對決還原全舞台雙俠，其餘資訊章清除前景；試映入口可達', async () => {
    mount();
    expect(document.querySelector('.motion-study-link')?.getAttribute('href')).toBe(
      '/lunjian/motion-study.html',
    );
    expect(document.querySelectorAll('#rules .sword-layer,#invitation .sword-layer')).toHaveLength(
      0,
    );
    for (const id of ['register', 'duel', 'schedule', 'rewards']) {
      click(`.site-nav a[href="#${id}"]`);
      await vi.advanceTimersByTimeAsync(3600);
      const section = document.querySelector(`#${id}`)!;
      if (id === 'duel') {
        expect(section.querySelectorAll('.arena-fighter.duelist')).toHaveLength(2);
        expect(section.querySelectorAll('#duel-vs-slot')).toHaveLength(1);
        expect(section.querySelector('.folio')).toBeNull();
      } else if (id === 'schedule') {
        expect(section.querySelector('#bracket-host')).not.toBeNull();
        expect(section.querySelector('.schedule-heading')).not.toBeNull();
        expect(section.querySelector('.folio')).toBeNull();
      } else if (id === 'rewards') {
        expect(section.querySelectorAll('.podium-frame')).toHaveLength(3);
        expect(
          [...section.querySelectorAll('.podium-frame h3')].map((el) => el.textContent),
        ).toEqual(['冠軍', '亞軍', '季軍']);
        expect(section.textContent).toContain('殿軍');
      } else {
        expect(section.querySelector('#registration-inline')).not.toBeNull();
        expect(section.querySelector('.registration-invitation #register-cta')).not.toBeNull();
        expect(section.querySelector('.folio-scene')).toBeNull();
      }
      expect(document.querySelector('#foreground')?.children).toHaveLength(0);
      const reader = section.querySelector<HTMLElement>('.chapter-sticky')!;
      const scrollBy = vi.fn();
      reader.scrollBy = scrollBy;
      reader.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
      expect(scrollBy).toHaveBeenCalledOnce();
      expect(location.hash).toBe('#' + id);
    }
  });
  it('落墨先覆蓋舊章再揭露新章，連續點選仍到達最後目標', async () => {
    mount();
    click('.site-nav a[href="#invitation"]');
    await vi.advanceTimersByTimeAsync(600);
    expect(document.body.hasAttribute('data-cut')).toBe(true);
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('rules');
    expect(
      Number(document.querySelector<HTMLElement>('#ink-wipe')?.dataset.progress),
    ).toBeGreaterThan(0);
    expect(Number(document.querySelector<HTMLElement>('#ink-wipe')?.dataset.progress)).toBeLessThan(
      0.46,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('invitation');
    click('.site-nav a[href="#register"]');
    await vi.advanceTimersByTimeAsync(5500);
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('register');
    expect(document.body.hasAttribute('data-cut')).toBe(false);
    expect(location.hash).toBe('#register');
  });
  it('鍵盤依閱讀順序切章，保留各章原有場景並能從條件前往報名', async () => {
    history.replaceState(null, '', '/?stage=2d&intro=0');
    mount();
    const stops = [
      ['prologue', '0'],
      ['rules', '2'],
      ['invitation', '1'],
      ['register', '3'],
      ['duel', '3'],
      ['schedule', '5'],
      ['rewards', '4'],
    ];
    for (const [index, [id, shot]] of stops.entries()) {
      if (index) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        await vi.advanceTimersByTimeAsync(3600);
      }
      expect(document.querySelector('.chapter[data-on]')?.id).toBe(id);
      expect(document.querySelector('#stage .shot[data-on]')?.getAttribute('data-shot')).toBe(shot);
      expect(document.querySelector('.site-nav [aria-current]')?.getAttribute('href')).toBe(
        '#' + id,
      );
    }
    history.replaceState(null, '', '#invitation');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.querySelector('#invitation')?.textContent).toContain('六類限制');
    click('#invitation [data-chapter-pagination] a[href="#register"]');
    await vi.advanceTimersByTimeAsync(3600);
    expect(location.hash).toBe('#register');
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('register');
  });
  it('規則停留 30 秒、返回及閱讀模式切換後仍完整可讀', async () => {
    mount();
    const fullRules = document.querySelector<HTMLDialogElement>('#rules-dialog')!;
    fullRules.showModal = () => {
      fullRules.open = true;
    };
    fullRules.close = () => {
      fullRules.open = false;
    };
    expect(fullRules.open).toBe(false);
    click('.rules-open');
    expect(fullRules.open).toBe(true);
    await vi.advanceTimersByTimeAsync(31000);
    const assertRules = () => {
      expect(document.querySelector<HTMLElement>('.rule-table')!.style.opacity).not.toBe('0');
      expect(fullRules.open).toBe(true);
      expect(document.querySelectorAll('#rules .rule-section')).toHaveLength(5);
      expect(document.querySelector('#rule-part-5')?.textContent).toContain('裁判與爭議');
    };
    assertRules();
    click('.site-nav a[href="#register"]');
    await vi.advanceTimersByTimeAsync(3600);
    click('.site-nav a[href="#rules"]');
    await vi.advanceTimersByTimeAsync(3600);
    assertRules();
    click('.site-header [data-reading-toggle]');
    expect(document.querySelector<HTMLElement>('#rules .chapter-sticky')!.inert).toBe(false);
    assertRules();
    click('.site-header [data-reading-toggle]');
    assertRules();
  });
  it('長文以垂直按鍵捲動，水平按鍵才換章；規則與分類保留使用者資料', async () => {
    mount();
    const reader = document.querySelector<HTMLElement>('#rules .chapter-sticky')!;
    const scrollBy = vi.fn();
    reader.scrollBy = scrollBy;
    reader.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
    expect(scrollBy).toHaveBeenCalledOnce();
    expect(location.hash).toBe('#rules');
    expect(reader.textContent).toContain('三局全程固定，不得於局間重新配置');
    expect(reader.textContent).toContain('裁判不得僅因限制組合過於強勢');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await vi.advanceTimersByTimeAsync(3600);
    expect(location.hash).toBe('#invitation');
    expect(
      [...document.querySelectorAll('.handicap-categories b')].map((el) => el.textContent?.trim()),
    ).toEqual(['5 項', '8 項', '6 項', '4 項', '6 項', '7 項']);
  });
  it('讓武分類連結展開條文、移動焦點，返回與前進仍同步讓武章', () => {
    history.replaceState(null, '', '/?stage=2d&intro=0#invitation');
    mount();
    click('.handicap-categories a[href="#handicap-group-skill"]');
    const group = document.querySelector<HTMLDetailsElement>('#handicap-group-skill')!;
    expect(location.hash).toBe('#handicap-group-skill');
    expect(group.open).toBe(true);
    expect(document.activeElement).toBe(group.querySelector('summary'));
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('invitation');
    expect(document.querySelector('.site-nav [aria-current]')?.getAttribute('href')).toBe(
      '#invitation',
    );
    history.replaceState(null, '', '#rules');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('rules');
    history.replaceState(null, '', '#handicap-group-skill');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('invitation');
    expect(document.activeElement).toBe(group.querySelector('summary'));
  });
  it('讓武分類可直接進入且不播序幕；切到靜態閱讀完整展開六類', () => {
    history.replaceState(null, '', '/?stage=2d#handicap-group-victory');
    mount();
    const groups = [...document.querySelectorAll<HTMLDetailsElement>('.handicap-group')];
    expect(groups).toHaveLength(6);
    expect(groups.filter((group) => group.open).map((group) => group.id)).toEqual([
      'handicap-group-victory',
    ]);
    expect(document.body.hasAttribute('data-intro')).toBe(false);
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('invitation');
    expect(document.activeElement).toBe(document.querySelector('#handicap-group-victory summary'));
    click('.site-header [data-reading-toggle]');
    expect(groups.every((group) => group.open)).toBe(true);
    expect(document.querySelectorAll('.handicap-item')).toHaveLength(36);
  });
  it('漫畫 BP 示意可切換四種段位差，重新掛載與清理不殘留互動', () => {
    mount();
    for (const gap of [0, 1, 2, 3]) {
      click(`[data-bp-gap="${gap}"]`);
      expect(document.querySelector('#comic-bp-output')?.textContent).toBe(String(gap * 8));
      expect(document.querySelectorAll('[data-bp-gap][aria-pressed="true"]')).toHaveLength(1);
    }
    runInThisContext(homeSource);
    click('[data-bp-gap="0"]');
    expect(document.querySelector('#comic-bp-note')?.textContent).toContain('不進行讓武');
    window.__LUNJIAN!.destroy();
    click('[data-bp-gap="3"]');
    expect(document.querySelector('#comic-bp-output')?.textContent).toBe('0');
  });
  it('底部狀態列與比武摘要完整移除，閱讀和示範階段操作留在頁首更多選單', () => {
    mount();
    expect(
      document.querySelectorAll('.status-bar,#scene-note,#chapter-label,#duel-summary'),
    ).toHaveLength(0);
    const menu = document.querySelector<HTMLDetailsElement>('.site-header .nav-more')!;
    const reading = menu.querySelector<HTMLElement>('[data-reading-toggle]')!;
    expect(document.querySelectorAll('[data-reading-toggle]')).toHaveLength(1);
    expect(document.querySelector('.phase-pick')?.closest('.nav-more')).toBe(menu);
    menu.open = true;
    reading.focus();
    reading.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector('summary'));
    menu.open = true;
    reading.click();
    expect(document.body.classList.contains('reading')).toBe(true);
    expect(reading.getAttribute('aria-pressed')).toBe('true');
    reading.click();
    expect(document.body.classList.contains('reading')).toBe(false);
    expect(
      document.querySelectorAll('.status-bar,#scene-note,#chapter-label,#duel-summary'),
    ).toHaveLength(0);
  });
  it('960px 使用手機導覽並同步目前章節及網址', async () => {
    mount();
    expect(document.body.dataset.device).toBe('mobile');
    click('.site-nav a[href="#register"]');
    await vi.advanceTimersByTimeAsync(3600);
    expect(document.querySelector('.site-nav [aria-current]')?.getAttribute('href')).toBe(
      '#register',
    );
    expect(location.hash).toBe('#register');
    history.replaceState(null, '', '#rules');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.querySelector('.site-nav [aria-current]')?.getAttribute('href')).toBe('#rules');
  });
  it('所有 CTA 同源更新，失敗可重試，非 preview 不展示假選手', () => {
    mount();
    window.__LUNJIAN!.updateActivity(activityDisplay('test-event', TournamentPhase.SIGNUP));
    for (const a of document.querySelectorAll('[data-activity-cta]')) {
      expect(a.textContent).toBe('報名參賽');
      expect(a.getAttribute('href')).toBe('/t/test-event/signup');
    }
    window.__LUNJIAN!.updateActivity(activityDisplay('test-event', 'error'));
    expect(document.querySelector<HTMLElement>('.activity-retry')!.hidden).toBe(false);
    const retry = vi.fn();
    document.addEventListener('lunjian:retry', retry, { once: true });
    click('.activity-retry');
    expect(retry).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('聞人夜');
    expect(document.querySelector<HTMLElement>('.phase-pick')!.hidden).toBe(true);
  });
  it('preview 可切換階段且不顯示固定示範標籤', () => {
    history.replaceState(null, '', '/?preview=1&phase=live&intro=0');
    mount();
    expect(document.querySelector('.preview-badge')).toBeNull();
    const menu = document.querySelector<HTMLDetailsElement>('.site-header .nav-more')!;
    menu.open = true;
    for (const phase of ['signup', 'finished', 'live']) {
      click(`.phase-pick [data-phase="${phase}"]`);
      expect(document.body.dataset.phase).toBe(phase);
      expect(
        document.querySelector(`.phase-pick [data-phase="${phase}"]`)?.getAttribute('aria-pressed'),
      ).toBe('true');
      expect(document.querySelector('.preview-badge')).toBeNull();
    }
  });
  it('reduced-motion 直接完整靜態閱讀', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduced-motion'),
      addEventListener: vi.fn(),
    }));
    mount();
    expect(document.body.classList.contains('reading')).toBe(true);
    expect(
      [...document.querySelectorAll<HTMLDetailsElement>('.manga-fulltext,.handicap-group')].every(
        (d) => d.open,
      ),
    ).toBe(true);
    expect(document.body.hasAttribute('data-intro')).toBe(false);
  });
  it('3D 載入失敗仍等待點擊開場，燃燒完成才釋放焦點', async () => {
    history.replaceState(null, '', '/?stage=3d');
    mount();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // VM has no dynamic import loader: this exercises the real failure branch.
    const mountStage = runInThisContext(
      '(function(){' +
        stageSource.replace('export async function', 'async function') +
        ';return mountStage3D;})()',
    ) as () => Promise<unknown>;
    await mountStage();
    expect(document.body.dataset.stage).toBe('2d');
    expect(document.querySelector('#skip-intro')).toBeNull();
    expect(document.querySelector('#boot')?.getAttribute('data-state')).toBe('ready');
    expect(document.activeElement?.id).toBe('ignite');
    expect(document.querySelector<HTMLElement>('.site-header')!.inert).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.body.hasAttribute('data-intro')).toBe(true);
    click('#ignite');
    expect(document.querySelector('#boot')?.getAttribute('data-state')).toBe('burning');
    expect(document.querySelector<HTMLButtonElement>('#ignite')!.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(5300);
    expect(document.body.hasAttribute('data-intro')).toBe(false);
    expect(document.querySelector<HTMLElement>('.site-header')!.inert).toBe(false);
    expect(document.activeElement?.getAttribute('href')).toBe('#prologue');
    warning.mockRestore();
  });
  it('載入期間不能誤觸；整支舞台腳本缺失仍提供點燃入口', async () => {
    history.replaceState(null, '', '/');
    mount();
    expect(document.querySelector('#boot')?.getAttribute('data-state')).toBe('loading');
    expect(document.querySelector<HTMLButtonElement>('#ignite')!.disabled).toBe(true);
    click('#ignite');
    expect(document.querySelector('#boot')?.getAttribute('data-state')).toBe('loading');
    await vi.advanceTimersByTimeAsync(2600);
    expect(document.querySelector('#boot')?.getAttribute('data-state')).toBe('ready');
    expect(document.querySelector<HTMLProgressElement>('#load-progress')!.value).toBe(100);
    runInThisContext(homeSource);
    expect(document.querySelector('#boot')?.getAttribute('data-state')).toBe('loading');
    expect(document.querySelector<HTMLButtonElement>('#ignite')!.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(2600);
    click('#ignite');
    window.__LUNJIAN!.destroy();
    await vi.advanceTimersByTimeAsync(6000);
    expect(window.__LUNJIAN).toBeUndefined();
  });
  it('重複初始化不重複綁定閱讀切換，離開後計時與事件停止', async () => {
    mount();
    runInThisContext(homeSource);
    expect(document.querySelectorAll('.rail-seg')).toHaveLength(7);
    click('.site-header [data-reading-toggle]');
    expect(document.body.classList.contains('reading')).toBe(true);
    window.__LUNJIAN!.destroy();
    click('.site-header [data-reading-toggle]');
    expect(document.body.classList.contains('reading')).toBe(false);
    await vi.advanceTimersByTimeAsync(31000);
    expect(window.__LUNJIAN).toBeUndefined();
  });
});

describe('lab 配裝執行期回歸', () => {
  beforeEach(() => {
    // jsdom does not implement the browser's native modal top layer.
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
  });
  const importLine = /import \{([\s\S]*?)\} from '[^']+';/;
  const imports = importLine.exec(loadoutSource)![1]!.replace(/(\w+) as (\w+)/g, '$1: $2');
  const makeMount = runInThisContext(
    '(function(deps){' +
      loadoutSource
        .replace(importLine, `const {${imports}} = deps;`)
        .replace('export function', 'function') +
      ';return mountLoadout;})',
  ) as (deps: Record<string, unknown>) => (options: { slug?: string }) => void;
  async function mount(slug = '') {
    document.body.innerHTML = LOADOUT_MARKUP;
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(catalog) }),
    );
    makeMount(getNote())({ slug });
    await vi.advanceTimersByTimeAsync(1);
  }
  it('備戰返回比武保留賽事與預覽環境，且頁首不顯示資料版本', async () => {
    history.replaceState(null, '', '/loadout?sportsEvent=event-a&preview=1&stage=2d');
    await mount();
    const link = document.querySelector<HTMLAnchorElement>('#return-duel')!;
    const target = new URL(link.href);
    expect(target.pathname).toBe('/');
    expect(target.hash).toBe('#duel');
    expect(target.searchParams.get('sportsEvent')).toBe('event-a');
    expect(target.searchParams.get('preview')).toBe('1');
    expect(target.searchParams.get('stage')).toBe('2d');
    expect(target.searchParams.get('intro')).toBe('0');
    expect(document.querySelector('#ver')).toBeNull();
  });
  it('原生角色視窗取消後回到管理鈕，卸載清除 modal 狀態', async () => {
    await mount();
    const trigger = document.querySelector<HTMLButtonElement>('button.manage')!;
    trigger.focus();
    trigger.click();
    const dialog = document.querySelector<HTMLDialogElement>('#roles-modal')!;
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await Promise.resolve();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    window.__LOADOUT?.destroy();
    expect(document.querySelectorAll('dialog[open]')).toHaveLength(0);
  });
  it('套裝選項可開啟及切換，重畫後仍保留鍵盤焦點', async () => {
    await mount();
    click('#bhead');
    click('#pick-grid button');
    click('.pickcell');
    expect(document.querySelector<HTMLDialogElement>('#eqsel')!.open).toBe(true);
    const option = document.querySelector<HTMLButtonElement>('#eqsel .eqopt')!;
    option.click();
    expect(document.activeElement?.getAttribute('data-focus-key')).toBe(option.dataset.focusKey);
    expect(document.activeElement?.getAttribute('aria-pressed')).toBe('true');
  });
  it('裝備位置、類別及清空均為草稿，取消不寫入，儲存才更新', async () => {
    const note = getNote();
    const state = (note.emptyState as () => { vault: unknown[] })();
    const weapon = (catalog as { weapons: { key: string }[] }).weapons[0]!;
    state.vault.push(
      (note.newItem as (slot: string, key: string) => unknown)('weapon', weapon.key),
    );
    const index = (note.indexOf as (catalog: unknown) => unknown)(catalog);
    const data = (note.toJSON as (state: unknown, catalog: unknown, index: unknown) => unknown)(
      state,
      catalog,
      index,
    );
    localStorage.setItem(
      'lunjian.loadout.v3',
      JSON.stringify({ v: 3, active: 0, roles: [{ id: 1, name: '測試角色', data }] }),
    );
    await mount();
    await vi.advanceTimersByTimeAsync(450);
    const before = localStorage.getItem('lunjian.loadout.v3');
    const openWeapon = () =>
      [...document.querySelectorAll('#vault .ecard')]
        .find((card) => card.querySelectorAll('.act-gold').length === 2)!
        .querySelector<HTMLButtonElement>('.act-ghost')!
        .click();
    openWeapon();
    const placement = document.querySelector<HTMLSelectElement>(
      '#edit select[data-focus-key="掛在哪一格"]',
    )!;
    placement.value = 'w_main';
    placement.dispatchEvent(new Event('change'));
    click('#edit [data-focus-key="裝備類別"]');
    [...document.querySelectorAll<HTMLButtonElement>('#pop-box button')].at(-1)!.click();
    click('#edit-clear');
    expect(document.querySelector<HTMLDialogElement>('#edit')!.open).toBe(true);
    click('#edit-cancel');
    await vi.advanceTimersByTimeAsync(450);
    expect(localStorage.getItem('lunjian.loadout.v3')).toBe(before);
    openWeapon();
    const next = document.querySelector<HTMLSelectElement>(
      '#edit select[data-focus-key="掛在哪一格"]',
    )!;
    next.value = 'w_main';
    next.dispatchEvent(new Event('change'));
    click('#edit-save');
    await vi.advanceTimersByTimeAsync(450);
    expect(localStorage.getItem('lunjian.loadout.v3')).not.toBe(before);
  });
  it('本機備戰不需正式活動代號，按會員與活動隔離配置', async () => {
    history.replaceState(null, '', '/loadout?sportsEvent=local-event');
    sessionStorage.setItem('lunjian-sportsbook-user', 'user-a');
    await mount();
    click('#bhead');
    click('#pick-grid button');
    expect(document.querySelector<HTMLButtonElement>('#btn-go')!.disabled).toBe(false);
    expect(document.querySelector('#btn-go')!.textContent).toBe('帶回角色設定');
    window.__LOADOUT!.destroy();
    sessionStorage.setItem('lunjian-sportsbook-user', 'user-b');
    await mount();
    expect(document.querySelector<HTMLButtonElement>('#btn-go')!.disabled).toBe(true);
    sessionStorage.removeItem('lunjian-sportsbook-user');
  });
  it('本機保存失敗持續顯示重試，重試成功與離頁前都保存最新配置', async () => {
    await mount();
    click('#bhead');
    click('#pick-grid button');
    const before = document.querySelector('#sheet')!.textContent;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    try {
      await vi.advanceTimersByTimeAsync(400);
      expect(document.querySelector('#storage-status')!.getAttribute('data-state')).toBe('error');
      expect(document.querySelector('#storage-message')!.textContent).toContain('尚未儲存');
      expect(document.querySelector<HTMLButtonElement>('#storage-retry')!.hidden).toBe(false);
      expect(document.querySelector<HTMLButtonElement>('#btn-export')!.disabled).toBe(false);
      expect(document.querySelector('#sheet')!.textContent).toBe(before);
    } finally {
      write.mockRestore();
    }
    click('#storage-retry');
    expect(document.querySelector('#storage-status')!.getAttribute('data-state')).toBe('saved');
    expect(document.querySelector<HTMLButtonElement>('#storage-retry')!.hidden).toBe(true);
    window.__LOADOUT!.destroy();
    await mount();
    expect(document.querySelector('#sheet')!.textContent).toBe(before);
    window.dispatchEvent(new Event('pagehide'));
    expect(document.querySelector('#storage-status')!.getAttribute('data-state')).toBe('saved');
  });
  it('空倉庫與匯出狀態；原生流派按鈕可開啟、Escape 關閉並還原焦點', async () => {
    await mount();
    const button = document.querySelector<HTMLButtonElement>('#bhead')!;
    expect(button.tagName).toBe('BUTTON');
    expect(document.querySelector<HTMLElement>('#vbar')!.hidden).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('#btn-export')!.disabled).toBe(true);
    button.focus();
    button.click();
    expect(document.activeElement?.id).toBe('pick-q');
    document.querySelector('#pick')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await Promise.resolve();
    expect(document.activeElement).toBe(button);
    expect(document.querySelector('#pick')!.hasAttribute('data-on')).toBe(false);
  });
  it('活動代號優先，選流派後可備份，刷新與重新掛載保留配置', async () => {
    localStorage.setItem('lunjian.loadout.slug', 'old-event');
    await mount('current-event');
    expect(document.querySelector<HTMLInputElement>('#slug')!.value).toBe('current-event');
    click('#bhead');
    click('#pick-grid button');
    expect(document.querySelector<HTMLButtonElement>('#btn-export')!.disabled).toBe(false);
    expect(document.querySelector('#bhead button')).toBeNull();
    expect(document.querySelectorAll('#build-card .chip')).toHaveLength(2);
    click('#build-card .chip');
    expect(document.querySelector('#pop')!.hasAttribute('data-on')).toBe(true);
    const maximum = [...document.querySelectorAll<HTMLButtonElement>('#pop-box button')].find(
      (control) => control.textContent === '20',
    )!;
    maximum.click();
    expect(document.querySelector('#pop')!.hasAttribute('data-on')).toBe(false);
    expect(document.querySelector('#build-card .chip')!.getAttribute('aria-label')).toContain(
      '目前 20',
    );
    const before = document.querySelector('#sheet')!.textContent;
    window.__LOADOUT!.destroy();
    await mount('current-event');
    expect(document.querySelector('#sheet')!.textContent).toBe(before);
    expect(document.querySelectorAll('#secbar button')).toHaveLength(3);
    click('#step-check');
    expect(document.querySelector('#main')!.getAttribute('data-sec')).toBe('power');
    expect(document.querySelector('[data-pane="sheet"]')!.hasAttribute('data-on')).toBe(true);
  });
  it('JSON 匯出後匯入保持相同文字；無活動代號不產生預設報名連結', async () => {
    await mount();
    click('#bhead');
    click('#pick-grid button');
    const before = document.querySelector('#sheet')!.textContent;
    click('#btn-export');
    const json = document.querySelector('.io-adv pre')!.textContent;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const link = [...document.querySelectorAll<HTMLButtonElement>('#io-foot button')].find(
      (b) => b.textContent === '複製報名連結',
    )!;
    link.click();
    expect(writeText).not.toHaveBeenCalled();
    click('#io-close');
    click('#btn-import');
    const input = document.querySelector<HTMLTextAreaElement>('.io-paste')!;
    input.value = json;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('.io-paste')).toBe(input);
    const apply = [...document.querySelectorAll<HTMLButtonElement>('#io-foot button')].find(
      (b) => b.textContent === '套用',
    )!;
    apply.click();
    expect(document.querySelector<HTMLDialogElement>('#ask')!.open).toBe(true);
    click('#ask-yes');
    await Promise.resolve();
    expect(document.querySelector<HTMLDialogElement>('#io-modal')!.open).toBe(false);
    expect(document.querySelector('#sheet')!.textContent).toBe(before);
    click('#step-check');
    const slug = document.querySelector<HTMLInputElement>('#slug')!;
    slug.value = 'test-event';
    slug.dispatchEvent(new Event('input', { bubbles: true }));
    click('#btn-export');
    [...document.querySelectorAll<HTMLButtonElement>('#io-foot button')]
      .find((b) => b.textContent === '複製報名連結')!
      .click();
    expect(writeText).toHaveBeenCalledWith(
      location.origin + '/t/test-event/signup?arts=' + encodeURIComponent(before),
    );
  });
  it('剪貼簿失敗在匯出視窗內保留可聚焦提示，晚到回覆不污染新視窗', async () => {
    await mount();
    click('#bhead');
    click('#pick-grid button');
    click('#btn-export');
    let fail!: (reason: Error) => void;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(
          () =>
            new Promise((_resolve, reject) => {
              fail = reject;
            }),
        ),
      },
    });
    const copy = () =>
      [...document.querySelectorAll<HTMLButtonElement>('#io-foot button')]
        .find((b) => b.textContent === '複製到剪貼簿')!
        .click();
    copy();
    fail(new Error('denied'));
    await Promise.resolve();
    const feedback = document.querySelector('#io-modal [role="alert"]')!;
    expect(feedback.textContent).toContain('請改用下載檔案');
    expect(document.activeElement).toBe(feedback);
    copy();
    click('#io-close');
    click('#btn-import');
    fail(new Error('late'));
    await Promise.resolve();
    expect(document.querySelector('#io-title')!.textContent).toBe('匯入配置');
    expect(document.querySelector('#io-feedback')).toBeNull();
  });
  it('讀檔失敗可重試，舊檔案不能蓋掉新輸入或新開的匯出視窗', async () => {
    await mount();
    click('#bhead');
    click('#pick-grid button');
    click('#btn-import');
    const file = document.querySelector<HTMLInputElement>('#io-modal input[type=file]')!;
    function choose(text: () => Promise<string>) {
      Object.defineProperty(file, 'files', { configurable: true, value: [{ text }] });
      file.dispatchEvent(new Event('change'));
    }
    choose(() => Promise.reject(new Error('read failed')));
    await Promise.resolve();
    expect(document.activeElement).toBe(document.querySelector('#io-import-error'));
    let finish!: (text: string) => void;
    choose(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const input = document.querySelector<HTMLTextAreaElement>('.io-paste')!;
    input.value = '流派　鳴金虹';
    input.dispatchEvent(new Event('input'));
    finish('stale');
    await Promise.resolve();
    expect(input.value).toBe('流派　鳴金虹');
    choose(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    click('#io-close');
    click('#btn-export');
    finish('{}');
    await Promise.resolve();
    expect(document.querySelector('#io-title')!.textContent).toBe('匯出配置');
    expect(document.querySelector('.io-paste')).toBeNull();
  });
});

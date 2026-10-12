import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { LUNJIAN_MARKUP } from './lunjianMarkup';

const source = readFileSync('web/public/lunjian/lunjian.js', 'utf8');
type Step = {
  targets: HTMLElement | HTMLElement[];
  opacity?: number[];
  translateX?: number[];
  scale?: number[];
  rotate?: number[];
  duration?: number;
  easing?: string;
};
type Timeline = {
  frame: HTMLElement | null;
  running: boolean;
  easing: string | undefined;
  finish: () => void;
  pause: Mock<() => void>;
  play: Mock<() => void>;
  add: Mock<(options: Step, offset?: number) => void>;
};
let timelines: Timeline[];
let observers: Observer[];
let motion: { matches: boolean; listeners: Set<() => void> };

// Browser callback ordering is deliberately controlled, including callbacks already
// queued before disconnect. Anime completes only when a test explicitly finishes it.
class Observer {
  connected = true;
  observed = new Set<Element>();
  constructor(
    private callback: IntersectionObserverCallback,
    readonly options: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
  observe = (target: Element) => this.observed.add(target);
  unobserve = (target: Element) => this.observed.delete(target);
  disconnect = () => {
    this.connected = false;
  };
  emit(targets: Element[], isIntersecting = true) {
    this.callback(
      targets.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

const frames = (chapter = 'rules') => [
  ...document.querySelectorAll<HTMLElement>(`#${chapter} [data-comic-frame]`),
];
const reader = (chapter = 'rules') =>
  document.querySelector<HTMLElement>(`#${chapter} .chapter-sticky`)!;
const observer = (chapter = 'rules') =>
  observers.findLast((item) => item.connected && item.options.root === reader(chapter))!;
const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();
const running = () => timelines.filter((item) => item.running);
const states = (chapter = 'rules') => frames(chapter).map((frame) => frame.dataset.comicState);
function mount(chapter = 'rules') {
  history.replaceState(null, '', `/?stage=2d&intro=0#${chapter}`);
  document.body.innerHTML = LUNJIAN_MARKUP;
  runInThisContext(source);
}
function rect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 600,
    width: 600,
    height,
    toJSON: () => ({}),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  timelines = [];
  observers = [];
  motion = { matches: false, listeners: new Set() };
  localStorage.clear();
  vi.stubGlobal('IntersectionObserver', Observer);
  vi.stubGlobal('matchMedia', (query: string) =>
    query.includes('reduced-motion')
      ? {
          get matches() {
            return motion.matches;
          },
          addEventListener: (_type: string, listener: () => void) => motion.listeners.add(listener),
          removeEventListener: (_type: string, listener: () => void) =>
            motion.listeners.delete(listener),
        }
      : { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  );
  vi.stubGlobal('innerWidth', 960);
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'anime',
    Object.assign(vi.fn(), {
      remove: vi.fn(),
      stagger: vi.fn(),
      timeline: vi.fn((options: { complete?: () => void; easing?: string }) => {
        const item: Timeline = {
          frame: null,
          running: false,
          easing: options.easing,
          finish: () => {
            item.running = false;
            options.complete?.();
          },
          pause: vi.fn(() => {
            item.running = false;
          }),
          play: vi.fn(() => {
            item.running = true;
          }),
          add: vi.fn<(options: Step, offset?: number) => void>(({ targets }) => {
            if (!Array.isArray(targets)) item.frame = targets;
          }),
        };
        timelines.push(item);
        return item;
      }),
    }),
  );
  vi.stubGlobal('mountInk', vi.fn());
  vi.stubGlobal('playInk', vi.fn());
  vi.stubGlobal('inkVS', () => document.createElement('span'));
  vi.stubGlobal('INK', { load: () => Promise.resolve() });
});

afterEach(() => {
  window.__LUNJIAN?.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('漫畫逐格入場佇列', () => {
  it('同批逆序可見通知仍依敘事順序，每格完整完成才開始下一格', () => {
    mount();
    const panels = frames();
    observer().emit([...panels].reverse());
    expect(running().map((item) => item.frame)).toEqual([panels[0]]);
    expect(states()).toEqual(['entering', 'waiting', 'waiting']);
    expect(panels[1]!.style.opacity).toBe('0');
    running()[0]!.finish();
    expect(running().map((item) => item.frame)).toEqual([panels[1]]);
    expect(states()).toEqual(['shown', 'entering', 'waiting']);
    running()[0]!.finish();
    expect(running().map((item) => item.frame)).toEqual([panels[2]]);
    running()[0]!.finish();
    expect(running()).toHaveLength(0);
    expect(states()).toEqual(['shown', 'shown', 'shown']);
  });

  it.each([
    [1440, 44],
    [768, 44],
    [375, 24],
  ])('%ipx 每格由左右交替淡入，前格完成後才開始下一格', (width, distance) => {
    vi.stubGlobal('innerWidth', width);
    mount();
    const panels = frames();
    observer().emit([...panels].reverse());
    for (const [index, panel] of panels.entries()) {
      expect(running().map((item) => item.frame)).toEqual([panel]);
      const timeline = running()[0]!;
      const step = timeline.add.mock.calls.find(([options]) => options.targets === panel)?.[0];
      if (!step) throw new Error('缺少畫格入場動畫');
      const start = index % 2 === 0 ? -distance : distance;
      expect(step).toEqual(
        expect.objectContaining({
          opacity: [0, 1],
          translateX: [start, 0],
          duration: 900,
        }),
      );
      expect(step.easing ?? timeline.easing).toBe('easeOutCubic');
      expect(panels.slice(index + 1).every((frame) => frame.dataset.comicState === 'waiting')).toBe(
        true,
      );
      // Simulate the inline transform left by an in-flight tween. Completion must
      // remove it so that subsequent layout and reduced motion use the final pose.
      panel.style.transform = `translateX(${start}px)`;
      panel.style.opacity = '0.5';
      timeline.finish();
      expect(panel.dataset.comicState).toBe('shown');
      expect(panel.style.transform).toBe('');
      expect(panel.style.opacity).toBe('');
    }
    expect(running()).toHaveLength(0);
    expect(states()).toEqual(['shown', 'shown', 'shown']);
  });

  it('背景、人物、前景與文字依序完成，不讓對白搶先出現', () => {
    mount('prologue');
    observer('prologue').emit(frames('prologue'));
    const calls = running()[0]!.add.mock.calls.filter(([options]) =>
      Array.isArray(options.targets),
    );
    const kinds = calls.map(([options, offset]) => ({
      kind: (options.targets as HTMLElement[])[0]?.dataset.comicLayer,
      offset,
    }));
    expect(kinds).toEqual([
      { kind: 'scene', offset: 0 },
      { kind: 'character', offset: 240 },
      { kind: 'foreground', offset: 600 },
      { kind: 'caption', offset: 820 },
    ]);
  });

  it('快速捲過播放中的格會完成該格並立即釋放佇列', () => {
    mount();
    const panels = frames();
    observer().emit(panels);
    const first = running()[0]!;
    vi.spyOn(reader(), 'getBoundingClientRect').mockReturnValue(rect(0, 600));
    vi.spyOn(panels[0]!, 'getBoundingClientRect').mockReturnValue(rect(-400, 300));
    vi.spyOn(panels[1]!, 'getBoundingClientRect').mockReturnValue(rect(40, 300));
    reader().dispatchEvent(new Event('scroll'));
    expect(first.pause).toHaveBeenCalled();
    expect(panels[0]!.dataset.comicState).toBe('shown');
    expect(running().map((item) => item.frame)).toEqual([panels[1]]);
    first.finish();
    expect(panels[1]!.dataset.comicState).toBe('entering');
  });

  it('跨批、重複通知與離開 viewport 不造成平行播放或離屏偷播', () => {
    mount();
    const panels = frames();
    const io = observer();
    io.emit([panels[0]!]);
    io.emit([panels[2]!, panels[1]!]);
    io.emit(panels);
    expect(timelines).toHaveLength(1);
    io.emit([panels[1]!], false);
    running()[0]!.finish();
    expect(running()).toHaveLength(0);
    expect(states()).toEqual(['shown', 'waiting', 'waiting']);
    io.emit([panels[1]!]);
    expect(running().map((item) => item.frame)).toEqual([panels[1]]);
    io.emit([panels[0]!, panels[2]!]);
    expect(timelines).toHaveLength(2);
    running()[0]!.finish();
    expect(running().map((item) => item.frame)).toEqual([panels[2]]);
  });

  it('尚未收到離開通知但已移到 viewport 下方的格不開始', () => {
    mount();
    const panels = frames();
    vi.spyOn(reader(), 'getBoundingClientRect').mockReturnValue(rect(0, 600));
    vi.spyOn(panels[1]!, 'getBoundingClientRect').mockReturnValue(rect(650, 200));
    observer().emit(panels);
    running()[0]!.finish();
    expect(running()).toHaveLength(0);
    expect(panels[1]!.dataset.comicState).toBe('waiting');
  });

  it('快速滑過導覽列上方的未播放格會定格，當前可見格仍能開始', () => {
    mount();
    const panels = frames();
    vi.spyOn(document.querySelector('.site-header')!, 'getBoundingClientRect').mockReturnValue(
      rect(0, 120),
    );
    vi.spyOn(reader(), 'getBoundingClientRect').mockReturnValue(rect(0, 600));
    vi.spyOn(panels[0]!, 'getBoundingClientRect').mockReturnValue(rect(10, 100));
    vi.spyOn(panels[1]!, 'getBoundingClientRect').mockReturnValue(rect(150, 200));
    observer().emit([panels[2]!, panels[1]!]);
    expect(states()).toEqual(['shown', 'entering', 'waiting']);
    expect(panels[0]!.style.opacity).toBe('');
    expect(running().map((item) => item.frame)).toEqual([panels[1]]);
  });

  it.each(['reading', 'destroy', 'chapter'] as const)(
    '%s 清理後舊 IO 與 complete 回呼不會重啟播放',
    (action) => {
      mount();
      const panels = frames();
      const oldObserver = observer();
      const oldReader = reader();
      oldObserver.emit(panels);
      const oldTimeline = running()[0]!;
      const moving = [
        panels[0]!,
        ...panels[0]!.querySelectorAll<HTMLElement>('[data-comic-layer]'),
      ];
      moving.forEach((element) => {
        element.style.transform = 'translateX(-20px)';
        element.style.opacity = '0.5';
      });
      if (action === 'reading') click('.site-header [data-reading-toggle]');
      else if (action === 'destroy') window.__LUNJIAN!.destroy();
      else {
        history.replaceState(null, '', '#invitation');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      const count = timelines.length;
      oldObserver.emit([...panels].reverse());
      oldTimeline.finish();
      oldReader.dispatchEvent(new Event('scroll'));
      expect(timelines).toHaveLength(count);
      expect(oldObserver.connected).toBe(false);
      expect(oldTimeline.pause).toHaveBeenCalled();
      expect(
        moving.every((element) => element.style.opacity === '' && element.style.transform === ''),
      ).toBe(true);
      expect(
        panels.every(
          (panel) => panel.style.opacity === '' && !panel.hasAttribute('data-comic-state'),
        ),
      ).toBe(true);
    },
  );

  it('Tab 焦點進入等待格時立即顯示內容，取消仍在播放的裝飾動畫', () => {
    mount();
    const panels = frames();
    observer().emit([panels[0]!, panels[1]!]);
    const oldTimeline = running()[0]!;
    // A native control fixture verifies the generic focus guard without changing
    // product markup; current folio controls intentionally remain visible.
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = '查看規則';
    panels[1]!.append(control);
    expect(panels[1]!.dataset.comicState).toBe('waiting');
    control.focus();
    expect(document.activeElement).toBe(control);
    expect(states()).toEqual(['shown', 'shown', 'waiting']);
    expect(panels.slice(0, 2).every((panel) => panel.style.opacity === '')).toBe(true);
    expect(oldTimeline.pause).toHaveBeenCalled();
    oldTimeline.finish();
    expect(running()).toHaveLength(0);
    expect(timelines).toHaveLength(1);
  });

  it('沒有 IntersectionObserver 時仍由前格完成來推進下一格', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    mount();
    const panels = frames();
    expect(running().map((item) => item.frame)).toEqual([panels[0]]);
    expect(states()).toEqual(['entering', 'waiting', 'waiting']);
    running()[0]!.finish();
    expect(running().map((item) => item.frame)).toEqual([panels[1]]);
    expect(states()).toEqual(['shown', 'entering', 'waiting']);
  });

  it('墨幕揭露期間只播放第一格，第一格完成後仍等揭幕結束才開始第二格', async () => {
    mount();
    click('.site-nav a[href="#invitation"]');
    await vi.advanceTimersByTimeAsync(1600);
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('invitation');
    const panels = frames('invitation');
    observer('invitation').emit(panels);
    expect(running().map((item) => item.frame)).toEqual([panels[0]]);
    running()[0]!.finish();
    expect(document.body.hasAttribute('data-cut')).toBe(true);
    expect(states('invitation')).toEqual(['shown', 'waiting', 'waiting']);
    expect(running()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.body.hasAttribute('data-cut')).toBe(false);
    expect(running().map((item) => item.frame)).toEqual([panels[1]]);
  });

  it('獎賞三格依序完成入場，各自才建立該格的蓋印動畫', () => {
    mount('rewards');
    const panels = frames('rewards');
    const stamps = panels.map((panel) =>
      panel.querySelector<HTMLElement>('[data-comic-layer="stamp"]')!,
    );
    expect(panels).toHaveLength(3);
    expect(stamps.map((stamp) => stamp.textContent)).toEqual(['冠軍', '亞軍', '季軍']);
    observer('rewards').emit([...panels].reverse());
    for (const [index, panel] of panels.entries()) {
      expect(running().map((item) => item.frame)).toEqual([panel]);
      const timeline = running()[0]!;
      const calls = timeline.add.mock.calls.filter(
        ([options]) => Array.isArray(options.targets) && options.targets.includes(stamps[index]!),
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]![0]).toEqual(
        expect.objectContaining({
          targets: [stamps[index]],
          opacity: [0, 1],
          scale: [1.55, 1],
          rotate: [-7, -5],
          duration: 420,
        }),
      );
      expect(calls[0]![1]).toBe(880);
      const allTargets = timelines.flatMap((item) =>
        item.add.mock.calls.flatMap(([options]) =>
          Array.isArray(options.targets) ? options.targets : [options.targets],
        ),
      );
      expect(stamps.slice(index + 1).every((stamp) => !allTargets.includes(stamp))).toBe(true);
      expect(panels.slice(index + 1).every((frame) => frame.dataset.comicState === 'waiting')).toBe(
        true,
      );
      timeline.finish();
    }
    expect(states('rewards')).toEqual(['shown', 'shown', 'shown']);
    expect(running()).toHaveLength(0);
  });

  it('reduced-motion 保留三席與印章完整可見，不預先藏印或排入動畫', () => {
    motion.matches = true;
    mount('rewards');
    const panels = frames('rewards');
    const stamps = [
      ...document.querySelectorAll<HTMLElement>('#rewards [data-comic-layer="stamp"]'),
    ];
    expect(panels).toHaveLength(3);
    expect(stamps.map((stamp) => stamp.textContent)).toEqual(['冠軍', '亞軍', '季軍']);
    expect(
      [...panels, ...stamps].every((element) => !element.hidden && element.style.opacity !== '0'),
    ).toBe(true);
    expect(timelines).toHaveLength(0);
    expect(observers).toHaveLength(0);
  });

  it('初始 reduced-motion 直接完整顯示，不建立動畫或 IO', () => {
    motion.matches = true;
    mount();
    expect(document.body.classList.contains('reading')).toBe(true);
    expect(timelines).toHaveLength(0);
    expect(observers).toHaveLength(0);
    expect(frames().every((panel) => panel.style.opacity === '')).toBe(true);
  });

  it('播放中啟用 reduced-motion 取消隊列，後續回呼不再隱藏或播放', () => {
    mount();
    const panels = frames();
    const io = observer();
    io.emit(panels);
    const timeline = running()[0]!;
    motion.matches = true;
    motion.listeners.forEach((listener) => listener());
    timeline.finish();
    io.emit(panels);
    expect(document.body.classList.contains('reading')).toBe(true);
    expect(running()).toHaveLength(0);
    expect(timelines).toHaveLength(1);
    expect(panels.every((panel) => panel.style.opacity === '')).toBe(true);
  });
});

import { vi } from 'vitest';

/**
 * 首頁測試共用的環境替身。
 *
 * jsdom 沒有 IntersectionObserver,而首頁的每一個狀態(現在是哪一章、哪些
 * 東西出場了)都是從它來的。所以測試要能自己餵進 entry,而不是等一個永遠
 * 不會來的回呼。這一份放在一個地方,四支測試才不會各自長出一個略有出入的
 * 假觀察器 —— 那種不一致只在其中一支開始說謊時才會被發現。
 *
 * 檔名不是 *.test.ts,所以 vitest 不會把它當成一支測試。
 */

export interface FakeObserver {
  options: IntersectionObserverInit | undefined;
  targets: Set<Element>;
  /** 餵一批 entry 進去。只給需要的欄位,其餘補成 axe 不會看的預設值。 */
  emit(entries: ReadonlyArray<{ target: Element; ratio: number }>): void;
}

/** 換掉 IntersectionObserver,回傳一個會累積所有被建立的觀察器的陣列。 */
export function installObserver(): FakeObserver[] {
  const made: FakeObserver[] = [];

  class Fake {
    private readonly cb: IntersectionObserverCallback;
    readonly targets = new Set<Element>();
    readonly options: IntersectionObserverInit | undefined;

    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.cb = cb;
      this.options = options;
      made.push(this);
    }

    observe(el: Element) {
      this.targets.add(el);
    }

    unobserve(el: Element) {
      this.targets.delete(el);
    }

    disconnect() {
      this.targets.clear();
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }

    emit(entries: ReadonlyArray<{ target: Element; ratio: number }>) {
      const full = entries.map(({ target, ratio }) => ({
        target,
        intersectionRatio: ratio,
        isIntersecting: ratio > 0,
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRect: target.getBoundingClientRect(),
        rootBounds: null,
        time: 0,
      })) as unknown as IntersectionObserverEntry[];
      this.cb(full, this as unknown as IntersectionObserver);
    }
  }

  vi.stubGlobal('IntersectionObserver', Fake);
  return made;
}

/** 換掉 matchMedia。只認 prefers-reduced-motion,其餘一律不成立。 */
export function installMatchMedia(reduced: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

/**
 * rAF 在測試裡直接跑完,不等下一格。
 *
 * 但**巢狀的不跑**:首頁上有好幾個自我排程的迴圈(序幕每格寫 CSS 變數、
 * 墨暈轉場每格算遮罩),它們在回呼裡再排一次下一格。同步執行加上自我排程
 * 等於無限遞迴,測試會以「呼叫堆疊爆掉」收場 —— 而那跟程式對不對無關。
 * 所以第一層照跑(一次就夠,那是「這一格」),巢狀的只收下不執行。
 */
export function installFrames(): void {
  let depth = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    if (depth > 0) return 1;
    depth += 1;
    try {
      cb(0);
    } finally {
      depth -= 1;
    }
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
}

import { gsap } from 'gsap';
import { addPortal } from './portal';

export const OPENINGS = [
  {
    id: 'I',
    name: '赤影縱刊',
    mood: '黑白雙框 · 人物出框',
    duration: 1.5,
    summary: '框在後、人在前，底線收住畫面。',
    color:
      '背景、主人物、黑衣特寫、白衣對手與前景分開生成。黑衣看右、白衣看左；柔和筆觸搭配霧中遠景，黑白雙框保留前後遮擋。',
    eye: '桌機採 16:9 橫向配置：主角偏左、特寫移至右側，背景留出景深空間。手機保留 185:231 直式；人物不拉寬，兩種版面都維持雙框、出框與共同底線。',
    intent:
      '點封面：特寫人物先回落，黑白框隨後收束；主窗接成同一片山景，原有雙線沿窗口展開到畫面邊緣再退去。可用慢放及進度檢查對視、出框與景深。',
  },
  {
    id: 'J',
    name: '局部成像',
    mood: '多框特寫 · 人物拼貼',
    duration: 1.5,
    summary: '從一個眼神，走進完整江湖。',
    color: '淡灰人物作底，暖紅細框與暖色局部形成清晰焦點。',
    eye: '頭像、眼神、全身與劍的不同尺度，沿不對稱版面形成視線路徑。',
    intent: '對應第二張參考。周圍特寫向主頭像靠攏，主框變景並展開，接回同一座山門。',
  },
  {
    id: 'F',
    name: '人物刊首',
    mood: '大字 · 特寫編排',
    duration: 1.5,
    summary: '人立於字前，故事藏在細節裡。',
    color: '紙白與墨黑打底，大面積硃砂標題成為唯一強色。',
    eye: '巨字在後、人物在前；旁欄的臉與劍，把全身主圖拆成閱讀節奏。',
    intent: '對應你貼的紅字人物封面：右側特寫先變成山門，從原框擴展；人物與大字維持前後距離。',
  },
  {
    id: 'G',
    name: '異色切片',
    mood: '負片 · 色塊拼貼',
    duration: 1.5,
    summary: '同一個人，在另一種明暗裡相遇。',
    color: '灰階人物搭配硃砂與夜藍；局部負片保留輪廓，改變圖底關係。',
    eye: '一塊偏心矩形截取臉與衣褶，直排字和細線建立編輯感。',
    intent: '對應你貼的彩色遮片封面：負片切片原地變景，傾斜畫框轉正並連續展開成山門。',
  },
  {
    id: 'H',
    name: '凝視成刊',
    mood: '菱形 · 焦點留白',
    duration: 1.5,
    summary: '把整個江湖，收進一次凝視。',
    color: '大面積紙白、淡灰主圖與清晰黑白特寫，硃砂只作小標記。',
    eye: '低對比人物作底，菱形窗內的眼神成為清晰焦點；細框沿四角延伸。',
    intent: '對應你貼的 FOCUS 封面：菱形內先出現夜景，畫框轉正並擴展，景物維持直立且不拉伸。',
  },
  {
    id: 'A',
    name: '月霧散幕',
    mood: '安靜 · 空氣感',
    duration: 1.5,
    summary: '霧先退，山門再浮現。',
    color: '霜白、墨藍、低彩度；讓月色與雪景保持連續。',
    eye: '兩層霧向相反方向退去，中間的空處逐漸成為主角。',
    intent: '想要自然、安靜地進入場景，先試這款。',
  },
  {
    id: 'B',
    name: '留白開境',
    mood: '極簡 · 書卷感',
    duration: 1.4,
    summary: '從一線空白，望見整座山門。',
    color: '暖紙白對冷夜藍，硃砂只留一小枚印。',
    eye: '開口偏離正中；留白先收住視線，再向兩側釋放。',
    intent: '視覺最克制，適合想要更乾淨、更有版面感的開場。',
  },
  {
    id: 'C',
    name: '墨相反轉',
    mood: '負片 · 虛實互換',
    duration: 1.5,
    summary: '紙上山門，轉入真實夜色。',
    color: '柔和灰白負片轉為原有墨藍；明暗交接，不做白閃。',
    eye: '構圖保持一致，只有圖與底的明暗關係互換。',
    intent: '保留一個意外的瞬間，整體仍然平靜。',
  },
  {
    id: 'D',
    name: '折景歸一',
    mood: '錯視 · 空間感',
    duration: 1.4,
    summary: '分離的景片，合成同一個江湖。',
    color: '沿用夜景原色，以明暗窄縫區分三片空間。',
    eye: '三片山門以不同距離滑回原位；平面產生短暫景深錯覺。',
    intent: '想要些許立體感，但不想載入 3D，可以選這款。',
  },
  {
    id: 'E',
    name: '朱印啟幕',
    mood: '硃砂 · 儀式感',
    duration: 1.2,
    summary: '一枚朱印，一次俐落的開場。',
    color: '大面積深墨，只用少量硃砂建立唯一焦點。',
    eye: '朱印先收，細線掠過，墨幕隨即向上退場。',
    intent: '更明快、有出場儀式，也最接近網站既有品牌語言。',
  },
] as const;
export type OpeningId = (typeof OPENINGS)[number]['id'];

export function openingTimeline(
  root: HTMLElement,
  id: OpeningId,
  reduced: boolean,
  update: () => void,
  complete: () => void,
) {
  const q = (selector: string) => root.querySelectorAll<HTMLElement>(selector);
  const tl = gsap.timeline({ paused: true, onUpdate: update, onComplete: complete });
  const duration = OPENINGS.find((item) => item.id === id)!.duration;
  gsap.set(q('[data-home-copy]'), { opacity: 0, y: 16 });
  gsap.set(q('[data-portal-outline]'), { opacity: 0 });
  if (reduced) {
    tl.to(q('[data-cover], [data-intro-copy], [data-enter-prompt]'), {
      opacity: 0,
      duration: 0.15,
    }).to(q('[data-home-copy]'), { opacity: 1, y: 0, duration: 0.15 }, 0);
    return tl;
  }
  tl.to(
    q('[data-intro-copy], [data-enter-prompt]'),
    { opacity: 0, y: -8, duration: 0.28, ease: 'power2.in' },
    0,
  );
  if (id === 'A') {
    tl.to(
      q('[data-mist-top]'),
      { yPercent: -55, opacity: 0, duration: 1.1, ease: 'power2.inOut' },
      0.1,
    )
      .to(
        q('[data-mist-bottom]'),
        { yPercent: 45, opacity: 0, duration: 1.15, ease: 'power2.inOut' },
        0.2,
      )
      .to(q('[data-mist-base]'), { opacity: 0, duration: 1.2 }, 0.15);
  } else if (id === 'B') {
    tl.to(q('[data-paper-left]'), { xPercent: -100, duration: 1.1, ease: 'power3.inOut' }, 0.12).to(
      q('[data-paper-right]'),
      { xPercent: 100, duration: 1.1, ease: 'power3.inOut' },
      0.2,
    );
  } else if (id === 'C') {
    tl.to(
      q('[data-negative]'),
      { opacity: 0, scale: 1.025, duration: 1.35, ease: 'power2.inOut' },
      0.05,
    );
  } else if (id === 'D') {
    const panes = q('[data-refraction]');
    gsap.set(panes[0]!, { yPercent: -6 });
    gsap.set(panes[1]!, { yPercent: 5 });
    gsap.set(panes[2]!, { yPercent: -3 });
    tl.to(panes, { yPercent: 0, duration: 1, stagger: 0.06, ease: 'power3.inOut' }, 0.1)
      .to(q('[data-refraction-veil]'), { opacity: 0, duration: 0.85 }, 0.35)
      .to(q('[data-refraction-seam]'), { opacity: 0, scaleX: 0.15, duration: 0.7 }, 0.5)
      .to(q('[data-refracted-scene]'), { opacity: 0, duration: 0.25 }, 1.15);
  } else if (id === 'E') {
    tl.to(
      q('[data-seal]'),
      { scale: 0.8, rotation: 0, opacity: 0, duration: 0.35, ease: 'power2.in' },
      0,
    )
      .fromTo(
        q('[data-red-line]'),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.45, ease: 'power2.inOut' },
        0.05,
      )
      .to(q('[data-ink-sheet]'), { yPercent: -100, duration: 0.85, ease: 'power3.inOut' }, 0.25);
  }
  if (['F', 'G', 'H', 'I', 'J'].includes(id)) {
    addPortal(tl, root, id === 'H' ? 45 : id === 'G' ? -4 : 0, id === 'J' ? 0.42 : 0.3);
    if (id === 'F') {
      tl.to(
        q('[data-ed-person]'),
        { x: -18, scale: 1.035, duration: 1.1, ease: 'power2.inOut' },
        0.1,
      ).to(q('[data-ed-type]'), { x: -10, duration: 1.1, ease: 'power2.inOut' }, 0.1);
    } else if (id === 'G') {
      tl.to(q('[data-ed-person]'), { scale: 1.025, duration: 1.15, ease: 'power2.inOut' }, 0.1);
    } else if (id === 'I') {
      tl.to(q('[data-wire-background]'), { xPercent: -1, duration: 1, ease: 'power2.inOut' }, 0.1)
        .to(
          q('[data-layer="36"] [data-foreground-art]'),
          { xPercent: -2, yPercent: 1, duration: 1, ease: 'power2.inOut' },
          0.1,
        )
        .to(q('[data-wire-person]'), { xPercent: 4, duration: 1, ease: 'power2.inOut' }, 0.1)
        .to(
          q('[data-portrait-person]'),
          { yPercent: 22, opacity: 0, duration: 0.28, stagger: 0.04, ease: 'power2.in' },
          0.04,
        )
        .to(
          q('[data-portrait-frame], [data-portrait-lip]'),
          {
            scaleX: 0,
            transformOrigin: 'left bottom',
            opacity: 0,
            duration: 0.24,
            ease: 'power2.inOut',
          },
          0.19,
        )
        .to(
          q('[data-wire-detail] figcaption, [data-wire-detail] a'),
          { opacity: 0, duration: 0.12 },
          0.08,
        )
        .to(q('[data-wire-breakout]'), { opacity: 0, duration: 0.15 }, 0.16)
        .to(q('[data-ed-type]'), { opacity: 0, duration: 0.26 }, 0.22);
    } else if (id === 'J') {
      const anchor = root.querySelector<HTMLElement>('[data-portal-anchor]')!;
      const target = anchor.getBoundingClientRect();
      q('[data-montage-detail]').forEach((detail, index) => {
        const rect = detail.getBoundingClientRect();
        tl.to(
          detail,
          {
            x: (target.left + target.width / 2 - rect.left - rect.width / 2) * 0.45,
            y: (target.top + target.height / 2 - rect.top - rect.height / 2) * 0.45,
            scale: 0.72,
            opacity: 0,
            duration: 0.5,
            ease: 'power2.inOut',
          },
          index * 0.045,
        );
      });
    }
  }
  tl.to(
    q('[data-home-copy]'),
    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
    duration - 0.5,
  );
  return tl;
}

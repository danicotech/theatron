'use client';

import {
  Amount,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  DEFAULT_THEME_ID,
  ThemeProvider,
  type EventTheme,
} from '@theatron/ui';
import { useState, type ReactNode } from 'react';

import styles from './KitchenSink.module.css';

/** 寬度切換器。責任在驗收,不是在做響應式版面,所以就是這四個關鍵尺寸。 */
const WIDTHS = [
  { id: 'phone', label: '375', value: 375 },
  { id: 'tablet', label: '768', value: 768 },
  { id: 'desktop', label: '1024', value: 1024 },
  { id: 'full', label: '滿版', value: 0 },
] as const;

type WidthId = (typeof WIDTHS)[number]['id'];

function Section({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionName}>{name}</h2>
        <span className={styles.sectionNote}>{note}</span>
      </div>
      <div className={styles.specimens}>{children}</div>
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.specimen}>
      <span className={styles.specimenLabel}>{label}</span>
      {children}
    </div>
  );
}

export interface KitchenSinkProps {
  themes: readonly EventTheme[];
}

export function KitchenSink({ themes }: KitchenSinkProps) {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);
  const [widthId, setWidthId] = useState<WidthId>('full');

  const theme = themes.find((t) => t.id === themeId);
  const width = WIDTHS.find((w) => w.id === widthId)?.value ?? 0;

  return (
    <ThemeProvider theme={theme} className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>主題</span>
          <Button
            size="sm"
            aria-pressed={themeId === DEFAULT_THEME_ID}
            onClick={() => {
              setThemeId(DEFAULT_THEME_ID);
            }}
          >
            arena-night
          </Button>
          {themes.map((t) => (
            <Button
              key={t.id}
              size="sm"
              aria-pressed={themeId === t.id}
              onClick={() => {
                setThemeId(t.id);
              }}
            >
              {t.name ?? t.id}
            </Button>
          ))}
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>寬度</span>
          {WIDTHS.map((w) => (
            <Button
              key={w.id}
              size="sm"
              aria-pressed={widthId === w.id}
              onClick={() => {
                setWidthId(w.id);
              }}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      <div
        className={styles.stage}
        style={width === 0 ? undefined : { maxInlineSize: `${width}px` }}
      >
        <Section name="Button" note="三個 variant 對應三種語意,不是三種重要程度">
          <Specimen label="variant">
            <div className={styles.column}>
              <Button>加入注單</Button>
              <Button variant="money">送出注單</Button>
              <Button variant="danger">判定勝者</Button>
            </div>
          </Specimen>

          <Specimen label="size(觸控裝置上一律吃到 44px)">
            <div className={styles.row}>
              <Button size="sm">小</Button>
              <Button size="md">中</Button>
              <Button size="lg">大</Button>
            </div>
          </Specimen>

          <Specimen label="state">
            <div className={styles.column}>
              <Button loading>送出注單</Button>
              <Button disabled>商店已關閉</Button>
              <Button variant="money" loading>
                購買
              </Button>
            </div>
          </Specimen>

          <Specimen label="fullWidth(手機版的關鍵操作)">
            <Button variant="danger" size="lg" fullWidth>
              判定勝者
            </Button>
          </Specimen>
        </Section>

        <Section name="Card" note="票根的結構:全大寫小字標頭、齒孔虛線的動作區">
          <Specimen label="raised">
            <Card aria-label="第 3 場">
              <CardHeader label="準決賽 · 第 3 場" title="Nova vs Vex" />
              <CardBody>兩位選手上下排列,右側是賠率。</CardBody>
            </Card>
          </Specimen>

          <Specimen label="live">
            <Card live aria-label="進行中的比賽">
              <CardHeader
                live
                label="進行中"
                title="Kite vs Orra"
                aside={<Amount value="182" currency="PT" size="sm" />}
              />
              <CardBody>紅點在脈動,邊框是玫瑰色。沒有光暈,沒有陰影。</CardBody>
              <CardFooter>
                <Button size="sm">加入注單</Button>
                <Button size="sm" variant="money">
                  送出注單
                </Button>
              </CardFooter>
            </Card>
          </Specimen>

          <Specimen label="overlay(彈層、hover)">
            <Card tone="overlay" aria-label="商品">
              <CardHeader label="商店 · 自動履約" title="顏色變更卡" />
              <CardBody>
                <Amount value="480" currency="PT" />
              </CardBody>
              <CardFooter>
                <Button size="sm" variant="money">
                  購買
                </Button>
              </CardFooter>
            </Card>
          </Specimen>
        </Section>

        <Section name="Amount" note="int64 全程走 bigint / 字串,不進 Number">
          <Specimen label="tone(職責唯一,不可挪用)">
            <div className={styles.column}>
              <Amount value="1234567" currency="PT" />
              <Amount value="1234567" currency="PT" tone="win" />
              <Amount value="1234567" currency="PT" tone="live" />
              <Amount value="1234567" currency="PT" tone="neutral" />
              <Amount value="1234567" currency="PT" tone="muted" />
            </div>
          </Specimen>

          <Specimen label="size">
            <div className={styles.column}>
              <Amount value="482" currency="PT" size="sm" />
              <Amount value="482" currency="PT" size="md" />
              <Amount value="482" currency="PT" size="lg" />
            </div>
          </Specimen>

          <Specimen label="超過 2^53 的金額(Number 會在這裡少錢)">
            <div className={styles.column}>
              <Amount value="9007199254740993" currency="PT" size="sm" />
              <Amount value="9223372036854775807" currency="PT" size="sm" />
              <Amount value="1234567" scale={2} currency="PT" size="sm" />
            </div>
          </Specimen>

          <Specimen label="帳本欄位:等寬、右對齊、直角、細線分隔">
            <table className={styles.ledger}>
              <thead>
                <tr>
                  <th>事由</th>
                  <th className={styles.numeric}>金額</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>每日簽到</td>
                  <td className={styles.numeric}>
                    <Amount value="50" signDisplay="always" tone="win" size="sm" />
                  </td>
                </tr>
                <tr>
                  <td>商店購買</td>
                  <td className={styles.numeric}>
                    <Amount value="-480" size="sm" />
                  </td>
                </tr>
                <tr>
                  <td>退款</td>
                  <td className={styles.numeric}>
                    <Amount value="480" signDisplay="always" tone="win" size="sm" />
                  </td>
                </tr>
              </tbody>
            </table>
          </Specimen>
        </Section>
      </div>
    </ThemeProvider>
  );
}

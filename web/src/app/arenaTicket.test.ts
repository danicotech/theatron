import { labSource } from '../../../scripts/lab-source';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Options = {
  players: { id: string; name: string }[];
  side: 'left' | 'right';
  matchLabel: string;
  trigger?: HTMLElement;
};
type Ticket = {
  open: (options: Options) => void;
  close: () => void;
  isOpen: () => boolean;
  destroy: () => void;
};
const source = readFileSync(labSource('arena-ticket.js'), 'utf8');
const createTicket = runInThisContext(
  '(function(){' + source.replace(/export /g, '') + ';return createArenaTicket;})()',
) as (options?: { signal?: AbortSignal }) => Ticket;
const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const players = [
  { id: 'a', name: '青山' },
  { id: 'b', name: '夜雨' },
];
const tickets: Ticket[] = [];
function mount(signal?: AbortSignal) {
  const ticket = createTicket(signal ? { signal } : {});
  tickets.push(ticket);
  return ticket;
}
function submit() {
  element('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
function stake(value: string) {
  element<HTMLInputElement>('#arena-stake').value = value;
  element('#arena-stake').dispatchEvent(new Event('input', { bubbles: true }));
}
function key(value: string, shiftKey = false) {
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }),
  );
}
beforeEach(() => {
  document.body.innerHTML = '<button id="trigger">選右方</button>';
});
afterEach(() => {
  tickets.splice(0).forEach((ticket) => ticket.destroy());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('擂台示範投注單', () => {
  it('帶入指定選手，經檢查才產生本機示範收據，完全不送出或寫入儲存', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const store = vi.spyOn(Storage.prototype, 'setItem');
    const ticket = mount();
    ticket.open({ players, side: 'right', matchLabel: '準決賽 · 第 2 場' });
    expect(ticket.isOpen()).toBe(true);
    expect(element<HTMLInputElement>('input[name="winner"]:checked').value).toBe('1');
    expect(element('.at-match').textContent).toBe('準決賽 · 第 2 場');
    expect(document.activeElement).toBe(element('#arena-stake'));
    stake('123');
    submit();
    expect(element('.at-review').hidden).toBe(false);
    expect(element('.at-review').textContent).toContain('夜雨 · 123 枚');
    expect(element('.at-review').textContent).toContain('227 枚');
    expect(element('.at-receipt').hidden).toBe(true);
    expect(element<HTMLFieldSetElement>('fieldset').disabled).toBe(true);
    element('[data-ticket-edit]').click();
    expect(element<HTMLFieldSetElement>('fieldset').disabled).toBe(false);
    stake('200');
    submit();
    submit();
    expect(element('.at-receipt').hidden).toBe(false);
    expect(element('.at-receipt-detail').textContent).toContain('夜雨 · 200 枚');
    expect(element('.at-receipt-detail').textContent).toContain('370 枚');
    expect(element('.at-receipt').textContent).toContain('未提交正式注單');
    expect(fetch).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '1.5', '1e3', '10001', ''])(
    '拒絕無效本金 %j，保持可更正的輸入階段',
    (amount) => {
      const ticket = mount();
      ticket.open({ players, side: 'left', matchLabel: '八強' });
      stake(amount);
      submit();
      expect(element('#arena-stake').getAttribute('aria-invalid')).toBe('true');
      expect(element('#arena-stake-error').textContent).toContain('整數本金');
      expect(element('.at-review').hidden).toBe(true);
      expect(document.activeElement).toBe(element('#arena-stake'));
      stake('10000');
      submit();
      expect(element('#arena-stake').hasAttribute('aria-invalid')).toBe(false);
      expect(element('.at-review').textContent).toContain('18,500 枚');
    },
  );

  it('安全顯示選手名稱，重新開啟不保留上場注單', () => {
    const ticket = mount();
    ticket.open({
      players: [{ id: 'x', name: '<img src=x onerror=alert(1)>' }, players[1]!],
      side: 'left',
      matchLabel: '<b>決賽</b>',
    });
    expect(element('.at-players').textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element('.at-players').querySelector('img')).toBeNull();
    expect(element('.at-match').querySelector('b')).toBeNull();
    stake('999');
    submit();
    submit();
    ticket.close();
    ticket.open({ players, side: 'right', matchLabel: '新場次' });
    expect(element('.at-receipt').hidden).toBe(true);
    expect(element<HTMLInputElement>('#arena-stake').value).toBe('100');
    expect(element<HTMLInputElement>('input[name="winner"]:checked').value).toBe('1');
  });

  it('圈限鍵盤焦點、Escape 回到原入口，取消生命週期移除面板與事件', () => {
    const controller = new AbortController(),
      trigger = element('#trigger');
    const ticket = mount(controller.signal);
    trigger.focus();
    ticket.open({ players, side: 'right', matchLabel: '決賽', trigger });
    element('button[type="submit"]').focus();
    key('Tab');
    expect(document.activeElement).toBe(element('[data-ticket-close]'));
    key('Tab', true);
    expect(document.activeElement).toBe(element('button[type="submit"]'));
    key('Escape');
    expect(ticket.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    ticket.open({ players, side: 'left', matchLabel: '決賽', trigger });
    controller.abort();
    expect(document.querySelector('#arena-ticket')).toBeNull();
    ticket.open({ players, side: 'right', matchLabel: '決賽', trigger });
    expect(document.querySelector('#arena-ticket')).toBeNull();
    expect(ticket.isOpen()).toBe(false);
  });
});

import { afterEach, expect, it } from 'vitest';
import { mountColorMode } from './colorMode';

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  delete document.documentElement.dataset.colorMode;
});

it('switches and saves the palette without navigation, and synchronizes another tab', () => {
  document.body.innerHTML = '<header><div class="lj-nav__actions"></div></header>';
  const cleanup = mountColorMode(document.querySelector('header')!);
  const button = document.querySelector('button')!;
  expect(button.getAttribute('aria-label')).toBe('切換深色模式');
  button.click();
  expect(document.documentElement.dataset.colorMode).toBe('dark');
  expect(localStorage.getItem('lunjian-color-mode')).toBe('dark');
  expect(button.getAttribute('aria-pressed')).toBe('true');
  window.dispatchEvent(
    new StorageEvent('storage', { key: 'lunjian-color-mode', newValue: 'light' }),
  );
  expect(button.getAttribute('aria-label')).toBe('切換深色模式');
  cleanup();
  expect(document.querySelector('button')).toBeNull();
  window.dispatchEvent(
    new StorageEvent('storage', { key: 'lunjian-color-mode', newValue: 'dark' }),
  );
  expect(document.documentElement.dataset.colorMode).toBe('light');
});

it('reflects saved dark mode and supports a clean remount', () => {
  document.documentElement.dataset.colorMode = 'dark';
  document.body.innerHTML = '<header><div class="lj-nav__actions"></div></header>';
  const root = document.querySelector('header')!;
  mountColorMode(root)();
  const cleanup = mountColorMode(root);
  expect(document.querySelectorAll('button')).toHaveLength(1);
  expect(document.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  document.querySelector('button')!.click();
  expect(localStorage.getItem('lunjian-color-mode')).toBe('light');
  cleanup();
});

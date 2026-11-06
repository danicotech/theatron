import { afterEach, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { mountHelpHints } from './helpHints';
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
});
function setup() {
  document.body.innerHTML =
    '<button data-help="補充說明" aria-label="武庫說明"><span>!</span></button><button>別處</button>';
  dispose = mountHelpHints();
  return screen.getByRole('button', { name: '武庫說明' });
}
it('supports keyboard focus, accessible description and Escape without closing the parent dialog', () => {
  const button = setup();
  button.focus();
  const tip = screen.getByRole('tooltip');
  expect(tip.textContent).toBe('補充說明');
  expect(button.getAttribute('aria-describedby')).toBe(tip.id);
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(document.activeElement).toBe(button);
});
it('opens from a touch/click and dismisses outside; content is text, not markup', () => {
  const button = setup();
  button.dataset.help = '<img src=x onerror=alert(1)>';
  fireEvent.click(button);
  expect(screen.getByRole('tooltip').querySelector('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '別處' }));
  expect(screen.queryByRole('tooltip')).toBeNull();
});
it('supports dynamically inserted triggers and cleans up on navigation', () => {
  setup();
  const button = document.createElement('button');
  button.dataset.help = '動態武庫';
  document.body.append(button);
  fireEvent.click(button);
  expect(screen.getByRole('tooltip').textContent).toBe('動態武庫');
  dispose!();
  expect(document.querySelector('[role=tooltip]')).toBeNull();
  fireEvent.click(button);
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('dismisses help when the chapter changes, without keeping a detached description', () => {
  const button = setup();
  button.focus();
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(button).not.toHaveAttribute('aria-describedby');
});

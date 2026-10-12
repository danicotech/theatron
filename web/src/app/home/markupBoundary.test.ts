import { expect, it } from 'vitest';
import { LUNJIAN_MARKUP } from '../lunjianMarkup';
import { HOME_MARKUP } from './homeMarkup';

it.each([
  ['內頁', LUNJIAN_MARKUP],
  ['首頁', HOME_MARKUP],
])('%s SSR 標記必須完整留在 React 容器，切頁才能移除', (_, markup) => {
  const doc = new DOMParser().parseFromString(
    `<body><div id="react-mount">${markup}</div></body>`,
    'text/html',
  );
  const mount = doc.getElementById('react-mount')!;
  expect(mount.contains(doc.querySelector('.site-header'))).toBe(true);
  expect(mount.contains(doc.querySelector('main'))).toBe(true);
  expect(doc.body.children).toHaveLength(1);
});

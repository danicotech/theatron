import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorldBackdrop } from './WorldBackdrop';

describe('WorldBackdrop', () => {
  // 它是裝飾。讀螢幕的人不該聽到「圖片」,鍵盤也不該停在上面。
  it('整層對輔助科技隱藏,圖沒有替代文字', () => {
    render(<WorldBackdrop />);
    const layer = screen.getByTestId('world-backdrop');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    const img = layer.querySelector('img')!;
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('src', '/world/bg-night-crow-courtyard.webp');
  });

  it('可以換板子', () => {
    render(<WorldBackdrop plate="/world/bg-snow-arena.webp" />);
    expect(screen.getByTestId('world-backdrop').querySelector('img')).toHaveAttribute(
      'src',
      '/world/bg-snow-arena.webp',
    );
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<WorldBackdrop />);
    await expectNoAxeViolations(container);
  });
});

import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { DiceFace } from './ToolsRoom';

it.each([1, 2, 3, 4, 5, 6])('%i 點的骰面與實際圓點數一致', (value) => {
  render(<DiceFace value={value} />);
  const image = screen.getByRole('img', { name: `${value} 點` });
  expect(image.querySelectorAll('circle')).toHaveLength(value);
});

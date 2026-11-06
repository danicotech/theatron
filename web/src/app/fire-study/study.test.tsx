import { fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FireStudy from './study';

const mock = vi.hoisted(() => ({
  create: vi.fn(),
  engines: [] as Array<Record<string, ReturnType<typeof vi.fn>>>,
}));
vi.mock('../../features/chrome/fireStudyRenderer', async (original) => {
  const actual = await original<typeof import('../../features/chrome/fireStudyRenderer')>();
  return { ...actual, createFireStudy: mock.create };
});
beforeEach(() => {
  mock.engines = [];
  mock.create.mockImplementation(() => {
    const engine = Object.fromEntries(
      ['play', 'pause', 'resume', 'seek', 'speed', 'hold', 'reset', 'dispose'].map((key) => [
        key,
        vi.fn(),
      ]),
    );
    mock.engines.push(engine);
    return Promise.resolve(engine);
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('independent fire comparison', () => {
  it('waits for explicit playback, controls all variants, and records preference without navigation', async () => {
    render(<FireStudy />);
    await waitFor(() => expect(screen.getByRole('button', { name: '重播 D' })).toBeEnabled());
    mock.engines.forEach((engine) => expect(engine.play).not.toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '一起點燃 ↗' }));
    mock.engines.forEach((engine) => expect(engine.play).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByRole('combobox', { name: '速度' }), { target: { value: '.5' } });
    mock.engines.forEach((engine) => expect(engine.speed).toHaveBeenCalledWith(0.5));
    fireEvent.click(screen.getByRole('checkbox', { name: '停在半燃，觀察火舌' }));
    mock.engines.forEach((engine) => expect(engine.hold).toHaveBeenCalledWith(true));
    fireEvent.click(
      within(document.getElementById('variant-C')!).getByRole('button', { name: '選這款' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('目前偏好 C');
  });
  it('seeks and pauses only the chosen sample', async () => {
    render(<FireStudy />);
    await waitFor(() => expect(screen.getByRole('button', { name: '重播 A' })).toBeEnabled());
    fireEvent.input(screen.getByRole('slider', { name: 'A 燃燒進度' }), {
      target: { value: '.4' },
    });
    expect(mock.engines[0]!.seek).toHaveBeenCalledWith(0.4);
    expect(mock.engines[1]!.seek).not.toHaveBeenCalled();
    fireEvent.click(
      within(document.getElementById('variant-A')!).getByRole('button', { name: '暫停' }),
    );
    expect(mock.engines[0]!.pause).toHaveBeenCalledOnce();
  });
  it('aborts pending texture setup and disposes late arrivals after unmount', async () => {
    let finish: ((engine: Record<string, ReturnType<typeof vi.fn>>) => void) | undefined;
    mock.create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<FireStudy />);
    const signal = mock.create.mock.calls[0]![3] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    const engine = { dispose: vi.fn() };
    finish!(engine);
    await waitFor(() => expect(engine.dispose).toHaveBeenCalledOnce());
  });
});

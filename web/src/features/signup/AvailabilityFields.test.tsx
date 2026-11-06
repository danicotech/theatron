import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AvailabilityFields, readAvailability } from './AvailabilityFields';

function formData(container: HTMLElement) {
  return new FormData(container.querySelector('form')!);
}
describe('calendar availability', () => {
  it('retains native picker input when another row is added before change commits', async () => {
    const { container } = render(
      <form>
        <AvailabilityFields />
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: '＋ 新增時段' }));
    fireEvent.input(screen.getByLabelText('日期 1'), { target: { value: '2026-11-01' } });
    fireEvent.input(screen.getByLabelText('開始時間 1'), { target: { value: '18:00' } });
    fireEvent.input(screen.getByLabelText('結束時間 1'), { target: { value: '20:00' } });
    await userEvent.click(screen.getByRole('button', { name: '＋ 新增時段' }));
    await userEvent.click(screen.getByRole('button', { name: '移除時段 2' }));
    expect(readAvailability(formData(container))).toBe('2026-11-01 18:00–20:00');
  });
  it('adds and removes independent date/time ranges and preserves the other row', async () => {
    const { container } = render(
      <form>
        <AvailabilityFields />
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: '＋ 新增時段' }));
    fireEvent.change(screen.getByLabelText('日期 1'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('開始時間 1'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('結束時間 1'), { target: { value: '20:00' } });
    await userEvent.click(screen.getByRole('button', { name: '＋ 新增時段' }));
    fireEvent.change(screen.getByLabelText('日期 2'), { target: { value: '2026-11-02' } });
    fireEvent.change(screen.getByLabelText('開始時間 2'), { target: { value: '19:00' } });
    fireEvent.change(screen.getByLabelText('結束時間 2'), { target: { value: '21:30' } });
    expect(readAvailability(formData(container))).toBe(
      '2026-11-01 18:00–20:00\n2026-11-02 19:00–21:30',
    );
    await userEvent.click(screen.getByRole('button', { name: '移除時段 1' }));
    expect(screen.getByLabelText('日期 1')).toHaveValue('2026-11-02');
    expect(readAvailability(formData(container))).toBe('2026-11-02 19:00–21:30');
  });
  it('reopens stored slots as editable calendar controls', () => {
    const { container } = render(
      <form>
        <AvailabilityFields defaultValue={'2026-11-03 14:30–17:00\n2026-11-04 18:00–19:00'} />
      </form>,
    );
    expect(screen.getByLabelText('日期 1')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('開始時間 2')).toHaveAttribute('type', 'time');
    expect(readAvailability(formData(container))).toContain('2026-11-04 18:00–19:00');
  });
  it.each([
    ['2026-11-01 20:00–18:00', '結束時間'],
    ['2026-11-01 18:00–20:00\n2026-11-01 19:00–21:00', '重疊'],
  ])('rejects invalid ranges %s', (value, reason) => {
    const { container } = render(
      <form>
        <AvailabilityFields defaultValue={value} />
      </form>,
    );
    expect(() => readAvailability(formData(container))).toThrow(reason);
  });
  it('keeps legacy availability visible until explicitly removed', async () => {
    const { container } = render(
      <form>
        <AvailabilityFields defaultValue="週五晚上" />
      </form>,
    );
    expect(readAvailability(formData(container))).toBe('週五晚上');
    await userEvent.click(screen.getByRole('button', { name: '移除原時段' }));
    expect(readAvailability(formData(container))).toBe('');
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ParticipantBp } from './ParticipantBp';
import { buildEvent, defaultSnapshot, initialState } from './engine';
import type { Member } from './model';
const member: Member = {
  id: 'low',
  name: '低段方',
  login: 'low',
  salt: '',
  hash: '',
  discord: '',
  balance: '1000',
};
function fixture() {
  const event = buildEvent(initialState(), defaultSnapshot(4), '讓武測試');
  const match = event.matches[0]!;
  event.links = { low: match.p1, high: match.p2 };
  event.bpRanks = { [match.p1]: 0, [match.p2]: 3 };
  return { event, match, member, busy: false, run: vi.fn().mockResolvedValue(true) };
}
describe('本場讓武面板', () => {
  it('低段方必須逐項填指定內容才能送出，不改比賽先後手', async () => {
    const props = fixture();
    render(<ParticipantBp {...props} />);
    const article = screen.getByRole('heading', { name: /禁用任意奇術/ }).closest('article')!;
    const input = article.querySelector('input')!;
    const add = article.querySelector('button')!;
    expect(add).toBeDisabled();
    fireEvent.change(input, { target: { value: '太白醉月' } });
    fireEvent.click(add);
    await waitFor(() =>
      expect(props.run).toHaveBeenCalledWith({
        type: 'bp-select',
        eventId: props.event.id,
        matchId: props.match.id,
        userId: 'low',
        itemId: 'skill-8',
        targetNote: '太白醉月',
      }),
    );
    expect(props.match.status).toBe('upcoming');
  });
  it('高段方開賽前只看到等待，鎖定後公布選項', () => {
    const props = fixture();
    props.event.bpSelections = [
      {
        id: 'selection',
        userId: 'low',
        playerId: props.match.p1,
        opponentId: props.match.p2,
        matchId: props.match.id,
        itemId: 'skill-8',
        targetNote: '太白醉月',
      },
    ];
    const view = render(<ParticipantBp {...props} member={{ ...member, id: 'high' }} />);
    expect(screen.getByText('對手正在選擇讓武，開賽鎖定後公布配置。')).toBeVisible();
    expect(screen.queryByText('太白醉月')).toBeNull();
    props.match.status = 'live';
    view.rerender(<ParticipantBp {...props} member={{ ...member, id: 'high' }} />);
    expect(screen.getByText('太白醉月')).toBeVisible();
    expect(screen.queryByRole('button', { name: '移除' })).toBeNull();
  });
  it('觀眾無本場BP面板', () => {
    const props = fixture();
    const { container } = render(
      <ParticipantBp {...props} member={{ ...member, id: 'spectator' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

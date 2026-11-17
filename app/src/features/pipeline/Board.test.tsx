import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import type { Application, Stage } from '../../domain/types';
import { useStore } from '../../store/store';
import { Board } from './Board';
import { commitMove, handleDrop } from './moves';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY - 60_000).toISOString();

function app(id: string, candidateId: string, stage: Stage, enteredDaysAgo: number, extra: Partial<Application> = {}): Application {
  const at = ago(enteredDaysAgo);
  return {
    id, candidateId, jobId: 'job-1', stage, source: 'Referral', via: 'manual', addedBy: 'u-thu',
    addedAt: at, stageEnteredAt: at, history: [{ stage, at, by: 'u-thu' }], comments: [], ...extra,
  };
}

let names: string[];

beforeEach(() => {
  const seed = buildSeed();
  names = seed.candidates.slice(0, 3).map((c) => c.name);
  const jobs = seed.jobs.map((j) => (j.id === 'job-1' ? { ...j, stageSla: { new: 2, screening: 3 } } : j));
  useStore.setState({
    ...seed,
    jobs,
    activities: [],
    applications: [
      app('a1', seed.candidates[0].id, 'screening', 4),
      app('a2', seed.candidates[1].id, 'screening', 1, { via: 'talent_pool', source: 'Talent Pool' }),
      app('a3', seed.candidates[2].id, 'new', 0),
    ],
  });
});

const job = (id = 'job-1') => useStore.getState().jobs.find((j) => j.id === id)!;
const renderBoard = (id = 'job-1') =>
  render(<MemoryRouter><Board job={job(id)} /></MemoryRouter>);
const card = (name: string) => screen.getByTestId(`card-${useStore.getState().applications.find((a) => useStore.getState().candidates.find((c) => c.id === a.candidateId)?.name === name)!.id}`);
const stageOf = (id: string) => useStore.getState().applications.find((a) => a.id === id)!.stage;

describe('Board', () => {
  it('drop on same column is a no-op', () => {
    const before = useStore.getState();
    expect(handleDrop('a1', 'screening')).toBe('none');
    expect(handleDrop('a1', null)).toBe('none');
    const after = useStore.getState();
    expect(after.applications).toBe(before.applications);
    expect(after.activities).toBe(before.activities);
  });

  it('drop on another column asks for a note, then commits and records it', () => {
    expect(handleDrop('a1', 'interview')).toBe('needs_note');
    expect(stageOf('a1')).toBe('screening');
    expect(commitMove('a1', 'interview', '')).toBe(true);
    const moved = useStore.getState().applications.find((a) => a.id === 'a1')!;
    expect(moved.stage).toBe('interview');
    expect(moved.history).toHaveLength(2);
    expect(useStore.getState().activities).toHaveLength(1);
  });

  it('drop on rejected asks reason and cancel keeps stage', () => {
    expect(handleDrop('a1', 'rejected')).toBe('needs_note');
    expect(stageOf('a1')).toBe('screening');

    renderBoard();
    fireEvent.click(within(card(names[0])).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rejected' }));
    const dialog = screen.getByRole('dialog', { name: 'Reject candidate' });
    expect(within(dialog).getByRole('button', { name: 'Reject' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stageOf('a1')).toBe('screening');
    expect(useStore.getState().activities).toHaveLength(0);
  });

  it('rejecting with a reason moves the card to Rejected', () => {
    renderBoard();
    fireEvent.click(within(card(names[0])).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rejected' }));
    const dialog = screen.getByRole('dialog', { name: 'Reject candidate' });
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Salary mismatch' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(useStore.getState().applications.find((a) => a.id === 'a1')).toMatchObject({ stage: 'rejected', rejectedReason: 'Salary mismatch' });
    expect(within(screen.getByTestId('column-rejected')).getByText(names[0])).toBeInTheDocument();
  });

  it('every move opens note dialog and cancel keeps stage', () => {
    renderBoard();
    fireEvent.click(within(card(names[2])).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Screening' }));
    const dialog = screen.getByRole('dialog', { name: 'Move to Screening' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stageOf('a3')).toBe('new');
    expect(useStore.getState().applications.find((a) => a.id === 'a3')!.history).toHaveLength(1);
  });

  it('move with empty note allowed except rejected', () => {
    renderBoard();
    fireEvent.click(within(card(names[2])).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Screening' }));
    const dialog = screen.getByRole('dialog', { name: 'Move to Screening' });
    const ok = within(dialog).getByRole('button', { name: 'Move' });
    expect(ok).toBeEnabled();
    fireEvent.click(ok);
    const a = useStore.getState().applications.find((x) => x.id === 'a3')!;
    expect(a.stage).toBe('screening');
    expect(a.history[a.history.length - 1].note).toBeUndefined();
  });

  it('optional note saved on history entry and shown in the drawer', () => {
    renderBoard();
    fireEvent.click(within(card(names[2])).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Screening' }));
    const dialog = screen.getByRole('dialog', { name: 'Move to Screening' });
    fireEvent.change(within(dialog).getByLabelText('Note'), { target: { value: 'Hẹn PV thứ 5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    const a = useStore.getState().applications.find((x) => x.id === 'a3')!;
    expect(a.history[a.history.length - 1]).toMatchObject({ stage: 'screening', note: 'Hẹn PV thứ 5' });
    fireEvent.click(card(names[2]));
    expect(within(screen.getByRole('dialog')).getByText('Hẹn PV thứ 5')).toBeInTheDocument();
  });

  it('drawer Move to… also asks for a note', () => {
    renderBoard();
    fireEvent.click(card(names[2]));
    const drawer = screen.getByRole('dialog');
    fireEvent.click(within(drawer).getByRole('button', { name: /^Move to…/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Offer' }));
    expect(screen.getByRole('dialog', { name: 'Move to Offer' })).toBeInTheDocument();
  });

  describe('collapsible end columns', () => {
    const busy = () => {
      const cs = buildSeed().candidates;
      useStore.setState({
        applications: [...useStore.getState().applications, app('a4', cs[3].id, 'interview', 1), app('a5', cs[4].id, 'offer', 1)],
      });
    };

    it('end columns collapsed by default when busy', () => {
      busy();
      renderBoard();
      expect(screen.getByTestId('column-rejected')).toHaveClass('w-12');
      expect(screen.getByTestId('column-hired')).toHaveClass('w-12');
      expect(screen.getByTestId('column-new')).not.toHaveClass('w-12');
      fireEvent.click(within(screen.getByTestId('column-rejected')).getByRole('button', { name: 'Expand Rejected' }));
      expect(screen.getByTestId('column-rejected')).not.toHaveClass('w-12');
    });

    it('end columns stay open when the pipeline is quiet', () => {
      renderBoard();
      expect(screen.getByTestId('column-rejected')).not.toHaveClass('w-12');
    });

    it('collapsed rejected strip still requires reason', () => {
      busy();
      renderBoard();
      expect(handleDrop('a1', 'rejected')).toBe('needs_note');
      fireEvent.click(within(card(names[0])).getByRole('button', { name: 'Move to…' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rejected' }));
      const dialog = screen.getByRole('dialog', { name: 'Reject candidate' });
      expect(within(dialog).getByRole('button', { name: 'Reject' })).toBeDisabled();
      expect(screen.getByTestId('column-rejected')).toHaveClass('w-12');
    });

    it('collapse default is frozen at mount: moving a card does not flip the strips', () => {
      busy();
      renderBoard();
      expect(screen.getByTestId('column-hired')).toHaveClass('w-12');
      // 5 active -> 3 active: a per-render default would now flip the strips open
      act(() => { commitMove('a1', 'hired', ''); commitMove('a2', 'hired', ''); });
      expect(screen.getByTestId('column-hired')).toHaveClass('w-12');
      expect(screen.getByTestId('column-rejected')).toHaveClass('w-12');
    });

    it('a text filter auto-expands a collapsed strip that holds matches, with the filtered count', () => {
      busy();
      const cs = buildSeed().candidates;
      useStore.setState({ applications: [...useStore.getState().applications, app('h1', cs[5].id, 'hired', 1)] });
      const hiredName = cs[5].name;
      const { rerender } = render(<MemoryRouter><Board job={job()} filter={{ text: '' }} /></MemoryRouter>);
      expect(screen.getByTestId('column-hired')).toHaveClass('w-12');
      rerender(<MemoryRouter><Board job={job()} filter={{ text: hiredName }} /></MemoryRouter>);
      const hired = screen.getByTestId('column-hired');
      expect(hired).not.toHaveClass('w-12');
      expect(within(hired).getByTestId('column-count')).toHaveTextContent('1');
      expect(screen.getAllByText(hiredName).length).toBeGreaterThan(0);
      rerender(<MemoryRouter><Board job={job()} filter={{ text: '' }} /></MemoryRouter>);
      expect(screen.getByTestId('column-hired')).toHaveClass('w-12');
    });

    it('collapsed hired strip accepts move', () => {
      busy();
      renderBoard();
      fireEvent.click(within(card(names[0])).getByRole('button', { name: 'Move to…' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Hired' }));
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Move to Hired' })).getByRole('button', { name: 'Move' }));
      expect(stageOf('a1')).toBe('hired');
      expect(within(screen.getByTestId('column-hired')).getByTestId('column-count')).toHaveTextContent('1');
    });
  });

  it('card shows one source label and no duplicate talent pool chip', () => {
    renderBoard();
    const c = within(card(names[1]));
    expect(c.getAllByText('Talent Pool')).toHaveLength(1);
    expect(c.queryByText('From Talent Pool')).not.toBeInTheDocument();
    expect(c.getByText('1d')).toBeInTheDocument();
    expect(within(screen.getByTestId('column-screening')).getByTestId('column-count')).toHaveTextContent('2');
    expect(within(screen.getByTestId('column-new')).getByTestId('column-count')).toHaveTextContent('1');
  });

  it('overdue card has red left border and warning', () => {
    renderBoard();
    const late = card(names[0]);
    expect(late).toHaveClass('border-l-4', 'border-l-red-500');
    expect(within(late).getByText(/4d/)).toHaveTextContent('⚠');
    expect(within(late).getByText(/4d/)).not.toHaveClass('text-red-500');
    const fresh = card(names[1]);
    expect(fresh).not.toHaveClass('border-l-red-500');
    expect(within(fresh).queryByText(/⚠/)).not.toBeInTheDocument();
  });

  it('renders empty state for a job with no applications', () => {
    renderBoard('job-2');
    expect(screen.getByText('No candidates in this pipeline yet')).toBeInTheDocument();
    expect(screen.queryByTestId('column-new')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add from Talent Pool/ })).not.toBeInTheDocument();
  });

  it('Escape closes the move dialog and leaves the stage unchanged', () => {
    renderBoard();
    fireEvent.click(within(card(names[0])).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Interview' }));
    expect(screen.getByRole('dialog', { name: 'Move to Interview' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stageOf('a1')).toBe('screening');
  });

  it('card days are localized', () => {
    useStore.setState((s) => ({ ui: { ...s.ui, lang: 'vi' } }));
    renderBoard();
    expect(within(card(names[1])).getByText('1n')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import type { Application, Stage } from '../../domain/types';
import { useStore } from '../../store/store';
import { Board } from './Board';
import { handleDrop } from './moves';

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

  it('drop on another column moves the card and records it', () => {
    expect(handleDrop('a1', 'interview')).toBe('moved');
    const moved = useStore.getState().applications.find((a) => a.id === 'a1')!;
    expect(moved.stage).toBe('interview');
    expect(moved.history).toHaveLength(2);
    expect(useStore.getState().activities).toHaveLength(1);
  });

  it('drop on rejected asks reason and cancel keeps stage', () => {
    expect(handleDrop('a1', 'rejected')).toBe('needs_reason');
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
  });
});

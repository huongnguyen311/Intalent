import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import type { Application, Stage } from '../../domain/types';
import { JobDetailPage } from '../jobs/JobDetailPage';
import { useStore } from '../../store/store';
import { PipelinePage } from './PipelinePage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY - 60_000).toISOString();
function app(id: string, candidateId: string, stage: Stage, enteredDaysAgo: number): Application {
  const at = ago(enteredDaysAgo);
  return { id, candidateId, jobId: 'job-1', stage, source: 'Referral', via: 'manual', addedBy: 'u-thu', addedAt: at, stageEnteredAt: at, history: [{ stage, at, by: 'u-thu' }], comments: [] };
}

let names: string[];
beforeEach(() => {
  const seed = buildSeed();
  names = seed.candidates.slice(0, 3).map((c) => c.name);
  useStore.setState({
    ...seed,
    activities: [],
    applications: [
      app('a1', seed.candidates[0].id, 'screening', 4),
      app('a2', seed.candidates[1].id, 'screening', 9),
      app('a3', seed.candidates[2].id, 'new', 1),
    ],
  });
});

const renderList = () => {
  render(
    <MemoryRouter initialEntries={['/pipeline/job-1']}>
      <Routes><Route path="/pipeline/:jobId" element={<PipelinePage />} /></Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'List view' }));
};
const rowIds = () => screen.getAllByTestId(/^row-/).map((r) => r.getAttribute('data-testid'));

describe('PipelineList', () => {
  it('list view sorts by days in stage', () => {
    renderList();
    expect(rowIds()).toEqual(['row-a3', 'row-a2', 'row-a1']); // default: stage order, longest wait first
    fireEvent.click(screen.getByRole('button', { name: 'Days in stage' }));
    expect(rowIds()).toEqual(['row-a3', 'row-a1', 'row-a2']); // asc: 1, 4, 9
    fireEvent.click(screen.getByRole('button', { name: 'Days in stage' }));
    expect(rowIds()).toEqual(['row-a2', 'row-a1', 'row-a3']);
  });

  it('list row move to rejected asks reason', () => {
    renderList();
    fireEvent.click(within(screen.getByTestId('row-a1')).getByRole('button', { name: 'Move to…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rejected' }));
    const dialog = screen.getByRole('dialog', { name: 'Reject candidate' });
    expect(within(dialog).getByRole('button', { name: 'Reject' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(useStore.getState().applications.find((a) => a.id === 'a1')!.stage).toBe('screening');
  });

  it('row click opens the drawer', () => {
    renderList();
    fireEvent.click(within(screen.getByTestId('row-a1')).getByText(names[0]));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pages at 20 rows', () => {
    const cs = buildSeed().candidates;
    useStore.setState({ applications: cs.slice(0, 25).map((c, i) => app(`p${i}`, c.id, 'new', i)) });
    renderList();
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(5);
  });

  it('filters with no match show empty message', () => {
    renderList();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzzzz' } });
    expect(screen.getByText('No candidates match')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^row-/)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Kanban view' }));
    expect(screen.getByText('No candidates match')).toBeInTheDocument();
    expect(screen.queryByTestId('column-new')).not.toBeInTheDocument();
  });

  it('job detail pipeline tab offers list view', () => {
    render(
      <MemoryRouter initialEntries={['/jobs/job-1']}>
        <Routes><Route path="/jobs/:id" element={<JobDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(3);
  });
});

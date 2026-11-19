import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import type { Application } from '../../domain/types';
import { AppRoutes } from '../../routes';
import { useStore } from '../../store/store';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const now = new Date().toISOString();
const fresh = (id: string, candidateId: string): Application => ({
  id, candidateId, jobId: 'job-1', stage: 'new', source: 'Careers page', via: 'careers', addedBy: 'Careers site',
  addedAt: now, stageEnteredAt: now, history: [{ stage: 'new', at: now, by: 'Careers site' }], comments: [],
});

beforeEach(() => {
  const seed = buildSeed(undefined, Date.now());
  // No job waits for approval unless a test adds one (approvals are a to-do of their own).
  const jobs = seed.jobs.map((j) => (j.status === 'pending_approval' ? { ...j, status: 'draft' as const } : j));
  useStore.setState({ ...seed, jobs, applications: [fresh('a-fresh', seed.candidates[0].id)], ui: { ...seed.ui, actingAs: undefined } });
});

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

describe('To do', () => {
  it('the header bell counts what is waiting and opens the application', () => {
    at('/jobs');
    const bell = screen.getByRole('button', { name: 'To do (1)' });
    fireEvent.click(bell);
    const item = screen.getByRole('menuitem', { name: /New application/ });
    fireEvent.click(item);
    expect(screen.getByRole('dialog', { name: useStore.getState().candidates[0].name })).toBeInTheDocument();
  });

  it('the dashboard lists the to-do items', () => {
    at('/');
    const card = screen.getByRole('region', { name: 'To do' });
    expect(within(card).getByText(useStore.getState().candidates[0].name)).toBeInTheDocument();
    expect(within(card).getByText('New application')).toBeInTheDocument();
  });

  it('shows an empty state when nothing waits', () => {
    useStore.setState({ applications: [] });
    at('/');
    expect(within(screen.getByRole('region', { name: 'To do' })).getByText('Nothing is waiting on you.')).toBeInTheDocument();
  });

  it('tells an approver that jobs wait for approval and links to them', () => {
    useStore.setState((st) => ({ jobs: st.jobs.map((j, i) => (i === 0 ? { ...j, status: 'pending_approval' as const } : j)) }));
    at('/');
    const row = within(screen.getByRole('region', { name: 'To do' })).getByRole('link', { name: /1 job\(s\) waiting for your approval/ });
    expect(row).toHaveAttribute('href', '/jobs?status=pending_approval');
    expect(screen.getByRole('button', { name: 'To do (2)' })).toBeInTheDocument();
  });
});

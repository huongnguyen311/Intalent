import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { PipelinePage } from './PipelinePage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/pipeline/:jobId" element={<PipelinePage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed(), activities: [] });
});

const firstOpen = () => useStore.getState().jobs.find((j) => j.status === 'open')!;

describe('PipelinePage', () => {
  it('bare /pipeline opens the first open job', () => {
    renderAt('/pipeline');
    expect(screen.getByRole('button', { name: `Job: ${firstOpen().title}` })).toBeInTheDocument();
  });

  it('the job switcher lists open jobs and switches the board', () => {
    renderAt('/pipeline/job-1');
    fireEvent.click(screen.getByRole('button', { name: /^Job: / }));
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(items).toEqual(useStore.getState().jobs.filter((j) => j.status === 'open').map((j) => j.title));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tech Lead / Senior Engineer' }));
    expect(screen.getByRole('button', { name: 'Job: Tech Lead / Senior Engineer' })).toBeInTheDocument();
  });

  it('clicking a card opens the drawer; comments and ratings are saved by the current user', () => {
    renderAt('/pipeline/job-1');
    const app = useStore.getState().applications.find((a) => a.jobId === 'job-1')!;
    fireEvent.click(screen.getByTestId(`card-${app.id}`));
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByRole('link', { name: /View full profile/ })).toHaveAttribute('href', `/candidates/${app.candidateId}`);
    expect(within(drawer).getByText('Stage history')).toBeInTheDocument();

    fireEvent.change(within(drawer).getByLabelText('Add a comment'), { target: { value: 'Great culture fit' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Post comment' }));
    expect(within(drawer).getByText('Great culture fit')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Rate 4 of 5' }));
    const saved = useStore.getState().applications.find((a) => a.id === app.id)!;
    expect(saved.comments[saved.comments.length - 1]).toMatchObject({ by: 'u-admin', text: 'Great culture fit' });
    expect(saved.ratings?.find((r) => r.by === 'u-admin')?.stars).toBe(4);
  });

  it('unknown job shows not found', () => {
    renderAt('/pipeline/nope');
    expect(screen.getByText('Job not found')).toBeInTheDocument();
  });
});

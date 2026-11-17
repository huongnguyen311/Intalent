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

  it('header shows summary and search narrows board', () => {
    renderAt('/pipeline/job-1');
    const total = useStore.getState().applications.filter((a) => a.jobId === 'job-1').length;
    expect(screen.getByText(new RegExp(`^${total} candidates · [0-9]+ overdue · Open [0-9]+ days$`))).toBeInTheDocument();
    const cards = () => screen.getAllByTestId(/^card-/);
    expect(cards()).toHaveLength(total);
    const { candidates, applications } = useStore.getState();
    const first = candidates.find((c) => c.id === applications.find((a) => a.jobId === 'job-1')!.candidateId)!;
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: first.name } });
    expect(cards().length).toBeLessThan(total);
    expect(within(cards()[0]).getByText(first.name)).toBeInTheDocument();
  });

  it('source select narrows the board', () => {
    renderAt('/pipeline/job-1');
    const apps = useStore.getState().applications.filter((a) => a.jobId === 'job-1');
    const src = apps[0].source;
    fireEvent.change(screen.getByLabelText('All sources'), { target: { value: src } });
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(apps.filter((a) => a.source === src).length);
  });

  it('filters reset when switching job', () => {
    const st = useStore.getState();
    const other = st.jobs.find((j) => j.status === 'open' && j.id !== 'job-1' && st.applications.some((a) => a.jobId === j.id))!;
    const src = st.applications.find((a) => a.jobId === 'job-1')!.source;
    renderAt('/pipeline/job-1');
    fireEvent.change(screen.getByLabelText('All sources'), { target: { value: src } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: /^Job: / }));
    fireEvent.click(screen.getByRole('menuitem', { name: other.title }));
    expect(screen.getByLabelText('All sources')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(st.applications.filter((a) => a.jobId === other.id).length);
  });

  it('ignores a source the current job does not have', () => {
    renderAt('/pipeline/job-1');
    const total = useStore.getState().applications.filter((a) => a.jobId === 'job-1').length;
    // Stored filter for a source absent from the job: simulate via a select option that exists only elsewhere.
    const select = screen.getByLabelText('All sources') as HTMLSelectElement;
    const opt = document.createElement('option');
    opt.value = 'Nowhere';
    select.appendChild(opt);
    fireEvent.change(select, { target: { value: 'Nowhere' } });
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(total);
    expect(screen.getByLabelText('All sources')).toHaveValue('');
  });

  it('view toggle switches state', () => {
    renderAt('/pipeline/job-1');
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('unknown job shows not found', () => {
    renderAt('/pipeline/nope');
    expect(screen.getByText('Job not found')).toBeInTheDocument();
  });
});

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

/** Hired/Rejected are collapsed on a busy board, so their cards are not rendered. */
// The default board fits on screen, so every column is open and every card renders.
const visibleApps = (jobId: string) => useStore.getState().applications.filter((a) => a.jobId === jobId);

describe('PipelinePage', () => {
  it('bare /pipeline shows All jobs: every open job on one board, each card naming its job', () => {
    renderAt('/pipeline');
    expect(screen.getByRole('combobox', { name: 'Job' })).toHaveValue('');
    const st = useStore.getState();
    const open = new Set(st.jobs.filter((j) => j.status === 'open' || j.status === 'on_hold').map((j) => j.id));
    const ids = screen.getAllByTestId(/^card-/).map((el) => el.dataset.testid!.slice(5));
    const jobIds = new Set(ids.map((id) => st.applications.find((a) => a.id === id)!.jobId));
    expect(jobIds.size).toBeGreaterThan(1);
    for (const j of jobIds) expect(open.has(j)).toBe(true);
    const a = st.applications.find((x) => x.id === ids[0])!;
    expect(within(screen.getByTestId(`card-${a.id}`)).getByText(st.jobs.find((j) => j.id === a.jobId)!.title)).toBeInTheDocument();
    // Settings are per job: nothing to configure on All jobs.
    expect(screen.queryByRole('button', { name: /Pipeline settings/ })).not.toBeInTheDocument();
  });

  it('the Job filter lists All jobs + open jobs and switches the board', () => {
    renderAt('/pipeline/job-1');
    const select = screen.getByRole('combobox', { name: 'Job' });
    expect(select).toHaveValue('job-1');
    const items = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(items).toEqual(['All jobs', ...useStore.getState().jobs.filter((j) => j.status === 'open' || j.status === 'on_hold').map((j) => j.title)]);
    const tech = useStore.getState().jobs.find((j) => j.title === 'Tech Lead / Senior Engineer')!;
    fireEvent.change(select, { target: { value: tech.id } });
    expect(screen.getByRole('combobox', { name: 'Job' })).toHaveValue(tech.id);
    fireEvent.change(screen.getByRole('combobox', { name: 'Job' }), { target: { value: '' } });
    expect(screen.getByRole('combobox', { name: 'Job' })).toHaveValue('');
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

  it('search narrows board', () => {
    renderAt('/pipeline/job-1');
    const cards = () => screen.getAllByTestId(/^card-/);
    expect(cards()).toHaveLength(visibleApps('job-1').length);
    const { candidates, applications } = useStore.getState();
    const first = candidates.find((c) => c.id === applications.find((a) => a.jobId === 'job-1')!.candidateId)!;
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: first.name } });
    expect(cards().length).toBeLessThan(visibleApps('job-1').length);
    expect(within(cards()[0]).getByText(first.name)).toBeInTheDocument();
  });

  it('search resets when switching job', () => {
    const st = useStore.getState();
    const other = st.jobs.find((j) => j.status === 'open' && j.id !== 'job-1' && st.applications.some((a) => a.jobId === j.id))!;
    renderAt('/pipeline/job-1');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Job' }), { target: { value: other.id } });
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(visibleApps(other.id).length);
  });

  it('view toggle switches state', () => {
    renderAt('/pipeline/job-1');
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Add from Candidate Pool opens the pool picker for this job (no job choice needed)', () => {
    renderAt('/pipeline/job-1');
    fireEvent.click(screen.getByRole('button', { name: /Add from Candidate Pool/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add from Candidate Pool' });
    expect(within(dialog).queryByLabelText('Job')).not.toBeInTheDocument();
  });

  it('on All jobs, Add from Candidate Pool asks which job', () => {
    renderAt('/pipeline');
    fireEvent.click(screen.getByRole('button', { name: /Add from Candidate Pool/ }));
    expect(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Job' })).toBeInTheDocument();
  });

  it('unknown job shows not found', () => {
    renderAt('/pipeline/nope');
    expect(screen.getByText('Job not found')).toBeInTheDocument();
  });
  it('an empty job shows one Add button and no search or view toggle', () => {
    useStore.setState((s) => ({ applications: s.applications.filter((a) => a.jobId !== 'job-2') }));
    renderAt('/pipeline/job-2');
    expect(screen.getAllByRole('button', { name: /Add from Candidate Pool/ })).toHaveLength(1);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'All sources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kanban view' })).not.toBeInTheDocument();
    expect(screen.getByText('No candidates in this pipeline yet')).toBeInTheDocument();
  });

  it('view toggle is icon-only (names in aria-label / tooltip); search comes before the Job filter', () => {
    renderAt('/pipeline/job-1');
    const kanban = screen.getByRole('button', { name: 'Kanban view' });
    expect(kanban).toHaveTextContent(/^view_kanban$/);
    expect(kanban).toHaveAttribute('title', 'Kanban view');
    expect(screen.getByRole('button', { name: 'List view' })).toHaveTextContent(/^view_list$/);
    const search = screen.getByRole('searchbox');
    const job = screen.getByRole('combobox', { name: 'Job' });
    expect(search.compareDocumentPosition(job) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a rejection reason appears once in the drawer', () => {
    const st = useStore.getState();
    const a = st.applications.find((x) => x.jobId === 'job-1' && x.stage !== 'rejected')!;
    st.moveStage(a.id, 'rejected', 'u-admin', 'Salary mismatch', 'Salary mismatch');
    renderAt('/pipeline/job-1');
    fireEvent.click(screen.getByTestId(`card-${a.id}`));
    expect(within(screen.getByRole('dialog')).getAllByText(/Salary mismatch/)).toHaveLength(1);
  });
});

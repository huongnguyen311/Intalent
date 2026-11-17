import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { publicJobs } from '../../store/selectors';
import { useStore } from '../../store/store';
import { JobDetailPage } from './JobDetailPage';
import { JobsPage } from './JobsPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('JobDrawer validation', () => {
  it('blocks save for empty, fractional or sub-1 SLA values with a per-field error', () => {
    renderAt('/jobs?fromJd=jd-2026-002');
    const drawer = screen.getByRole('dialog');
    const before = useStore.getState().jobs.length;
    fireEvent.change(within(drawer).getByLabelText('Screening'), { target: { value: '' } });
    fireEvent.change(within(drawer).getByLabelText('Interview'), { target: { value: '2.5' } });
    fireEvent.change(within(drawer).getByLabelText('Offer'), { target: { value: '-1' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(within(drawer).getAllByText('Enter a whole number of days (1 or more)')).toHaveLength(3);
    expect(useStore.getState().jobs).toHaveLength(before);
    fireEvent.change(within(drawer).getByLabelText('Screening'), { target: { value: '4' } });
    fireEvent.change(within(drawer).getByLabelText('Interview'), { target: { value: '6' } });
    fireEvent.change(within(drawer).getByLabelText('Offer'), { target: { value: '3' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(useStore.getState().jobs[0].stageSla).toEqual({ new: 2, screening: 4, interview: 6, offer: 3 });
  });

  it('shows the missing-JD error under the JD select', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /Create Job/ }));
    const drawer = screen.getByRole('dialog');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const err = within(drawer).getByText('Select a JD');
    expect(err.previousElementSibling).toBe(within(drawer).getByLabelText('Job description'));
  });
});

describe('JobDrawer', () => {
  it('creating from JD prefills title and stack', () => {
    const jd = useStore.getState().jds.find((j) => j.id === 'jd-2026-002')!;
    renderAt('/jobs?fromJd=jd-2026-002');
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByLabelText('Title')).toHaveValue(jd.title);
    for (const skill of jd.skills.slice(0, 3)) expect(within(drawer).getByText(skill)).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Level')).toHaveValue('Senior');
    expect(within(drawer).getByLabelText('Screening')).toHaveValue(5);
  });

  it('saves a new job as a draft unless publish is ticked', () => {
    renderAt('/jobs?fromJd=jd-2026-002');
    const drawer = screen.getByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Department'), { target: { value: 'Engineering' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const created = useStore.getState().jobs[0];
    expect(created).toMatchObject({ jdId: 'jd-2026-002', department: 'Engineering', status: 'draft' });
    expect(created.stageSla).toEqual({ new: 2, screening: 5, interview: 7, offer: 5 });
  });

  it('publishing makes the job public', () => {
    renderAt('/jobs?fromJd=jd-2026-002');
    const drawer = screen.getByRole('dialog');
    fireEvent.click(within(drawer).getByLabelText(/Publish to careers site/));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(useStore.getState().jobs[0].status).toBe('open');
  });
});

describe('publicJobs', () => {
  it('draft job not listed on careers', () => {
    const state = useStore.getState();
    const draft = state.jobs.find((j) => j.status === 'draft')!;
    const closed = state.jobs.find((j) => j.status === 'closed')!;
    const ids = publicJobs(state).map((j) => j.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(closed.id);
    expect(ids).toHaveLength(4);
    state.setJobStatus(draft.id, 'open');
    expect(publicJobs(useStore.getState()).map((j) => j.id)).toContain(draft.id);
  });
});

describe('JobsPage', () => {
  it('lists jobs and filters by status', () => {
    renderAt('/jobs');
    expect(screen.getByText('Senior Frontend Developer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Draft' }));
    expect(screen.getByText('Mobile Engineer (Flutter)')).toBeInTheDocument();
    expect(screen.queryByText('Senior Frontend Developer')).toBeNull();
  });

  it('job title is a link to the detail page', () => {
    renderAt('/jobs');
    expect(screen.getByRole('link', { name: 'Senior Frontend Developer' })).toHaveAttribute('href', '/jobs/job-1');
  });
});

describe('JobDetailPage', () => {
  it('shows candidates and campaigns of the job and a careers preview', () => {
    const s = useStore.getState();
    const first = s.applications.find((a) => a.jobId === 'job-1')!;
    const name = s.candidates.find((c) => c.id === first.candidateId)!.name;
    renderAt('/jobs/job-1');
    fireEvent.click(screen.getByRole('tab', { name: 'Candidates' }));
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', `/candidates/${first.candidateId}`);
    fireEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(screen.getByRole('link', { name: 'Frontend Summer Push' })).toHaveAttribute('href', '/campaigns/camp-1');
    fireEvent.click(screen.getByRole('tab', { name: 'Careers page preview' }));
    expect(screen.getByTestId('careers-preview')).toHaveTextContent('Senior Frontend Developer');
  });

  it('pipeline tab embeds the Kanban board', () => {
    renderAt('/jobs/job-1');
    const inJob = useStore.getState().applications.filter((a) => a.jobId === 'job-1');
    const column = screen.getByTestId('column-new');
    expect(within(column).getByTestId('column-count')).toHaveTextContent(String(inJob.filter((a) => a.stage === 'new').length));
    // Hired/Rejected start collapsed on a busy board, so their cards are not rendered.
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(inJob.filter((a) => a.stage !== 'hired' && a.stage !== 'rejected').length);
  });

  it('closing a job from the header updates its status', () => {
    renderAt('/jobs/job-1');
    fireEvent.click(screen.getByRole('button', { name: /Close job/ }));
    expect(useStore.getState().jobs.find((j) => j.id === 'job-1')!.status).toBe('closed');
  });
});

describe('Jobs pagination language', () => {
  it('shows Vietnamese pagination wording in vi', () => {
    useStore.setState({ ui: { ...useStore.getState().ui, lang: 'vi' } });
    renderAt('/jobs');
    expect(screen.getByText(/Hiển thị/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });
});

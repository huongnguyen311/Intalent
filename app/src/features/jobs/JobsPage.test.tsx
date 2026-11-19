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
    fireEvent.change(within(drawer).getByLabelText('HR Screening'), { target: { value: '' } });
    fireEvent.change(within(drawer).getByLabelText('1st Interview'), { target: { value: '2.5' } });
    fireEvent.change(within(drawer).getByLabelText('Offer'), { target: { value: '-1' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(within(drawer).getAllByText('Enter a whole number of days (1 or more)')).toHaveLength(3);
    expect(useStore.getState().jobs).toHaveLength(before);
    fireEvent.change(within(drawer).getByLabelText('HR Screening'), { target: { value: '4' } });
    fireEvent.change(within(drawer).getByLabelText('1st Interview'), { target: { value: '6' } });
    fireEvent.change(within(drawer).getByLabelText('Offer'), { target: { value: '3' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(useStore.getState().jobs[0].stageSla).toEqual({ new: 2, ai_screening: 1, screening: 4, interview: 6, assessment: 5, final_interview: 5, offer: 3 });
  });

  it('shows the missing-JD error under the JD select', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = screen.getByRole('dialog');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const err = within(drawer).getByText('Select a JD');
    expect(err.previousElementSibling).toBe(within(drawer).getByLabelText('Job description'));
  });
});

describe('JobDrawer', () => {
  it('prefills the company perks, drafts additional info and can rewrite then undo', () => {
    renderAt('/jobs?fromJd=jd-2026-002');
    const drawer = screen.getByRole('dialog');
    const why = within(drawer).getByLabelText("Why you'll love working here");
    expect((why as HTMLTextAreaElement).value).toContain('Hybrid working and flexible hours');
    fireEvent.change(within(drawer).getByLabelText('Location'), { target: { value: 'Da Nang' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Draft: Additional information' }));
    const info = within(drawer).getByLabelText('Additional information') as HTMLTextAreaElement;
    expect(info.value.split('\n')[0]).toBe('- Working location: Da Nang');
    fireEvent.change(why, { target: { value: 'Great team. Great team; free lunch' } });
    fireEvent.click(within(drawer).getByRole('button', { name: "Rewrite: Why you'll love working here" }));
    expect(why).toHaveValue(['- Great team', '- Free lunch'].join('\n'));
    fireEvent.click(within(drawer).getAllByRole('button', { name: /Undo/ })[0]);
    expect(why).toHaveValue('Great team. Great team; free lunch');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const saved = useStore.getState().jobs[0];
    expect(saved.whyLove).toBe('Great team. Great team; free lunch');
    expect(saved.additionalInfo).toContain('Working location: Da Nang');
  });

  it('creates a new JD inline and selects it', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: '__new__' } });
    const dialogs = screen.getAllByRole('dialog');
    const editor = dialogs[dialogs.length - 1];
    fireEvent.change(within(editor).getByLabelText(/^Title/), { target: { value: 'Data Engineer' } });
    fireEvent.click(within(editor).getByRole('button', { name: /Save/ }));
    const created = useStore.getState().jds.find((j) => j.title === 'Data Engineer')!;
    expect(created).toBeDefined();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByLabelText('Job description')).toHaveValue(created.id);
    expect(screen.getByLabelText('Title')).toHaveValue('Data Engineer');
  });

  it('creating from JD prefills title and stack', () => {
    const jd = useStore.getState().jds.find((j) => j.id === 'jd-2026-002')!;
    renderAt('/jobs?fromJd=jd-2026-002');
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByLabelText('Title')).toHaveValue(jd.title);
    for (const skill of jd.skills.slice(0, 3)) expect(within(drawer).getByText(skill)).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Level')).toHaveValue('Senior');
    expect(within(drawer).getByLabelText('HR Screening')).toHaveValue(5);
  });

  it('saves a new job as a draft unless publish is ticked', () => {
    renderAt('/jobs?fromJd=jd-2026-002');
    const drawer = screen.getByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Department'), { target: { value: 'Engineering' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const created = useStore.getState().jobs[0];
    expect(created).toMatchObject({ jdId: 'jd-2026-002', department: 'Engineering', status: 'draft' });
    expect(created.stageSla).toEqual({ new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 5 });
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
  it('unpublished (pending approval) job not listed on careers', () => {
    const state = useStore.getState();
    const draft = state.jobs.find((j) => j.status === 'pending_approval')!;
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
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pending approval' }));
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
    // The default 7-column board fits on screen, so every column (Hired/Rejected included) is open.
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(inJob.length);
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

describe('Jobs list: PRD P1 additions', () => {
  const asUser = (id: string) => useStore.setState({ ui: { ...useStore.getState().ui, actingAs: id } });

  it('shows the AI match average and a last-updated time per job', () => {
    renderAt('/jobs');
    expect(screen.getByRole('columnheader', { name: 'AI Match Avg' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last Updated' })).toBeInTheDocument();
    const row = screen.getByRole('link', { name: 'Senior Frontend Developer' }).closest('tr')!;
    expect(within(row).getByText(/^\d+%$/)).toBeInTheDocument();
    expect(within(row).getByText(/ago$|just now/)).toBeInTheDocument();
  });

  it('duplicates a job into a new draft titled "(Copy)"', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Senior Frontend Developer' }));
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByLabelText('Title')).toHaveValue('Senior Frontend Developer (Copy)');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const [copy] = useStore.getState().jobs;
    const source = useStore.getState().jobs.find((j) => j.id === 'job-1')!;
    expect(copy).toMatchObject({ title: 'Senior Frontend Developer (Copy)', status: 'draft', salaryMin: source.salaryMin, headcount: source.headcount });
    expect(copy.id).not.toBe('job-1');
  });

  it('a recruiter submits for approval instead of publishing', () => {
    asUser('u-huy');
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = screen.getByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Job description'), { target: { value: 'jd-2026-002' } });
    fireEvent.click(within(drawer).getByLabelText(/Submit for approval/));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const created = useStore.getState().jobs[0];
    expect(created.status).toBe('pending_approval');
    expect(publicJobs(useStore.getState()).map((j) => j.id)).not.toContain(created.id);
  });

  it('the approver sends a pending job back with a reason', () => {
    renderAt('/jobs/job-5');
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for approval');
    fireEvent.click(screen.getByRole('button', { name: /Send back/ }));
    const dialog = screen.getAllByRole("dialog").slice(-1)[0];
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send back' }));
    expect(within(dialog).getByText('Enter a reason')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Add salary range' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send back' }));
    expect(useStore.getState().jobs.find((j) => j.id === 'job-5')).toMatchObject({ status: 'draft', approval: { rejectedReason: 'Add salary range' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Add salary range');
  });

  it('starts a job from a template and saves the form as a new template', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = screen.getByRole('dialog');
    fireEvent.change(within(drawer).getByLabelText('Start from template'), { target: { value: 'jtpl-eng-senior' } });
    expect(within(drawer).getByLabelText('Minimum years of experience')).toHaveValue(5);
    expect(within(drawer).getByLabelText('Education')).toHaveValue('bachelor');
    expect(within(drawer).getByLabelText('Department')).toHaveValue('Engineering');
    fireEvent.click(within(drawer).getByRole('button', { name: /Save as template/ }));
    fireEvent.change(within(drawer).getByLabelText('Template name'), { target: { value: 'My template' } });
    fireEvent.click(within(drawer).getAllByRole('button', { name: 'Save' })[0]);
    expect(useStore.getState().jobTemplates![0]).toMatchObject({ name: 'My template', fields: { minYears: 5, education: 'bachelor' } });
  });
});

describe('Applicants stage legend', () => {
  it('lists only the job\'s own columns, never unused custom slots', () => {
    renderAt('/jobs');
    const row = screen.getByRole('link', { name: 'Growth Marketing Manager' }).closest('tr')!;
    const legend = within(row).getByRole('tooltip', { hidden: true });
    expect(legend).not.toHaveTextContent(/Custom column/);
    expect(legend).toHaveTextContent('Hired');
    expect(legend).toHaveTextContent('Rejected');
  });
});

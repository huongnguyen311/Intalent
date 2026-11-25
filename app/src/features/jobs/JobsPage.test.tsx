import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import type { Job } from '../../domain/types';
import { publicJobs } from '../../store/selectors';
import { useStore } from '../../store/store';
import { JobDetailPage } from './JobDetailPage';
import { JobEditorPage } from './JobEditorPage';
import { JobsPage } from './JobsPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/new" element={<JobEditorPage mode="create" />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/jobs/:id/edit" element={<JobEditorPage mode="edit" />} />
        <Route path="/jobs/:id/duplicate" element={<JobEditorPage mode="duplicate" />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('Job editor validation', () => {
  it('has no Stage SLA inputs and a new job gets the default SLA', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    expect(within(drawer).queryByLabelText('HR Screening')).toBeNull();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    expect(useStore.getState().jobs[0].stageSla).toEqual({ new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 5 });
  });

  it('shows the missing-JD error under the JD select', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = document.body;
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    const err = within(drawer).getByText('Select a JD');
    expect(err.previousElementSibling).toBe(within(drawer).getByLabelText('Job description'));
  });

  it('Save draft shows the error in its section and saves nothing', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    const before = useStore.getState().jobs.length;
    fireEvent.change(within(drawer).getByLabelText('From'), { target: { value: '50' } });
    fireEvent.change(within(drawer).getByLabelText('To'), { target: { value: '40' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    expect(within(drawer).getByText('"From" must not be higher than "To"')).toBeInTheDocument();
    expect(useStore.getState().jobs).toHaveLength(before);
  });

  it('Save draft with a blank title shows the error', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    const before = useStore.getState().jobs.length;
    fireEvent.change(within(drawer).getByLabelText('Title'), { target: { value: ' ' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    expect(within(drawer).getByText('Title is required')).toBeInTheDocument();
    expect(useStore.getState().jobs).toHaveLength(before);
  });
});

describe('Job editor sections', () => {
  it('shows the five sections in order, candidate-facing first, with no steps', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const names = ['Job details', 'Requirements', 'Compensation', 'Job post & application', 'Hiring team'];
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby')).filter((id) => id?.startsWith('job-section-'))).toEqual(
      ['details', 'requirements', 'compensation', 'careers', 'team'].map((k) => `job-section-${k}`),
    );
    for (const name of names) expect(screen.getByRole('region', { name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Compensation' })).getByLabelText('From')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Hiring team' })).getByLabelText('Hiring manager')).toBeInTheDocument();
    // The publish choice sits with the Save buttons, not inside a section.
    expect(within(screen.getByRole('region', { name: 'Job post & application' })).queryByLabelText('Publish to careers site')).toBeNull();
    expect(screen.getByLabelText('Publish to careers site')).toBeInTheDocument();
  });

  it('picking a JD keeps a typed title', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = document.body;
    fireEvent.change(within(drawer).getByLabelText('Title'), { target: { value: 'My role' } });
    fireEvent.change(within(drawer).getByLabelText('Job description'), { target: { value: 'jd-2026-002' } });
    expect(within(drawer).getByLabelText('Title')).toHaveValue('My role');
    expect(within(drawer).getByLabelText('Level')).toHaveValue('Senior');
  });

  it('edit saves without changing status', () => {
    useStore.setState({ jobs: useStore.getState().jobs.map((j) => (j.id === 'job-1' ? { ...j, status: 'open' as const } : j)) });
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Senior Frontend Developer' }));
    const drawer = document.body;
    expect(within(drawer).queryByRole('button', { name: 'Save draft' })).toBeNull();
    fireEvent.change(within(drawer).getByLabelText('Department'), { target: { value: 'Platform' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(useStore.getState().jobs.find((j) => j.id === 'job-1')).toMatchObject({ department: 'Platform', status: 'open' });
  });
});

describe('Job editor', () => {
  it('prefills the company perks, drafts additional info and can rewrite then undo', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    fireEvent.change(within(drawer).getByLabelText('Location'), { target: { value: 'Da Nang' } });
    const why = within(drawer).getByLabelText("Why you'll love working here");
    expect((why as HTMLTextAreaElement).value).toContain('Hybrid working and flexible hours');
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

  it('creating from JD prefills title and stack', () => {
    const jd = useStore.getState().jds.find((j) => j.id === 'jd-2026-002')!;
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    expect(within(drawer).getByLabelText('Title')).toHaveValue(jd.title);
    // Each skill shows on the JD summary and again in the job's own Skills field.
    for (const skill of jd.skills.slice(0, 3)) expect(within(drawer).getAllByText(skill).length).toBeGreaterThanOrEqual(2);
    expect(within(drawer).getByLabelText('Level')).toHaveValue('Senior');
  });

  it('saves a new job as a draft unless publish is ticked', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    fireEvent.change(within(drawer).getByLabelText('Department'), { target: { value: 'Engineering' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    const created = useStore.getState().jobs[0];
    expect(created).toMatchObject({ jdId: 'jd-2026-002', department: 'Engineering', status: 'draft' });
    expect(created.stageSla).toEqual({ new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 5 });
  });

  it('publishing makes the job public', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
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
    expect(ids).toHaveLength(5);
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
    const drawer = document.body;
    expect(within(drawer).getByLabelText('Title')).toHaveValue('Senior Frontend Developer (Copy)');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    const [copy] = useStore.getState().jobs;
    const source = useStore.getState().jobs.find((j) => j.id === 'job-1')!;
    expect(copy).toMatchObject({ title: 'Senior Frontend Developer (Copy)', status: 'draft', salaryMin: source.salaryMin, headcount: source.headcount });
    expect(copy.id).not.toBe('job-1');
  });

  it('a recruiter submits for approval instead of publishing', () => {
    asUser('u-huy');
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = document.body;
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

  it('a new job has no template picker: the title is typed freely', () => {
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = document.body;
    expect(within(drawer).queryByLabelText('Start from template')).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: /Save as template/ })).not.toBeInTheDocument();
    fireEvent.change(within(drawer).getByLabelText('Title'), { target: { value: 'Anything I want' } });
    expect(within(drawer).getByLabelText('Title')).toHaveValue('Anything I want');
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

describe('Job editor hiring team', () => {
  const asUser = (id: string) => useStore.setState({ ui: { ...useStore.getState().ui, actingAs: id } });
  const group = (d: HTMLElement, name: string) => within(d).getByRole('group', { name });
  const patchJob1 = (patch: Partial<Job>) =>
    useStore.setState({ jobs: useStore.getState().jobs.map((j) => (j.id === 'job-1' ? { ...j, ...patch } : j)) });

  it('recruiter list holds only recruiter roles and defaults to the creator', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    const recruiters = group(drawer, 'Recruiter(s)');
    expect(within(recruiters).getByLabelText('Super Admin')).toBeChecked();
    expect(within(recruiters).getByLabelText('Pham Gia Huy')).not.toBeChecked();
    expect(within(recruiters).queryByLabelText('Vu Hoang Nam')).toBeNull();
    expect(within(recruiters).queryByLabelText('Ly Quoc Quang')).toBeNull();
  });

  it('create is blocked without a recruiter', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    const before = useStore.getState().jobs.length;
    fireEvent.click(within(group(drawer, 'Recruiter(s)')).getByLabelText('Super Admin'));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    expect(within(drawer).getByText('Pick at least one recruiter')).toBeInTheDocument();
    expect(useStore.getState().jobs).toHaveLength(before);
  });

  it('a recruiter creating a job is the recruiter by default and can save', () => {
    asUser('u-huy');
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: /New job/ }));
    const drawer = document.body;
    fireEvent.change(within(drawer).getByLabelText('Job description'), { target: { value: 'jd-2026-002' } });
    const before = useStore.getState().jobs.length;
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    expect(useStore.getState().jobs).toHaveLength(before + 1);
    expect(useStore.getState().jobs[0].collaborators).toContain('u-huy');
  });

  it('editing a job without recruiters warns but saves', () => {
    patchJob1({ collaborators: [], hiringManager: 'u-nam' });
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Senior Frontend Developer' }));
    const drawer = document.body;
    expect(within(drawer).getByText('No recruiter on this job yet.')).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(screen.queryByLabelText('Title')).toBeNull();
  });

  it('duplicate keeps stage SLA, recruiters and interviewers', () => {
    const job1 = useStore.getState().jobs.find((j) => j.id === 'job-1')!;
    patchJob1({ stageSla: { ...job1.stageSla, screening: 9 }, collaborators: ['u-huy'], interviewers: ['u-chau'] });
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Senior Frontend Developer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    const [copy] = useStore.getState().jobs;
    expect(copy.id).not.toBe('job-1');
    expect(copy.stageSla.screening).toBe(9);
    expect(copy.collaborators).toContain('u-huy');
    expect(copy.interviewers).toEqual(['u-chau']);
  });

  it('saves interviewers', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    fireEvent.click(within(group(drawer, 'Interviewers')).getByLabelText('Ly Quoc Quang'));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
    expect(useStore.getState().jobs[0].interviewers).toEqual(['u-quang']);
  });

  it('cancel after ticking an interviewer asks to discard', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    fireEvent.click(within(group(drawer, 'Interviewers')).getByLabelText('Ly Quoc Quang'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
  });
});

describe('Job editor polish', () => {
  it('adding a question counts as an unsaved change', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    fireEvent.click(screen.getByRole('button', { name: /Add question/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
  });

  it('an AI draft counts as an unsaved change', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    fireEvent.click(screen.getByRole('button', { name: 'Draft: Additional information' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
  });

  it('keeps the AI undo after a rewrite', () => {
    renderAt('/jobs/new?fromJd=jd-2026-002');
    const drawer = document.body;
    const why = within(drawer).getByLabelText("Why you'll love working here");
    fireEvent.change(why, { target: { value: 'Great team. Free lunch' } });
    fireEvent.click(within(drawer).getByRole('button', { name: "Rewrite: Why you'll love working here" }));
    fireEvent.click(within(drawer).getAllByRole('button', { name: /Undo/ })[0]);
    expect(within(drawer).getByLabelText("Why you'll love working here")).toHaveValue('Great team. Free lunch');
  });

});

describe('Jobs list hiring urgency', () => {
  const titlesShown = () => screen.getAllByRole('link').map((a) => a.textContent).filter((x): x is string => !!x);

  it('?priority=urgent,critical lists exactly the urgent jobs', async () => {
    const { isUrgent } = await import('../../domain/jobUrgency');
    renderAt('/jobs?priority=urgent,critical');
    const urgent = useStore.getState().jobs.filter(isUrgent).map((j) => j.title);
    expect(urgent.length).toBeGreaterThan(0);
    const shown = titlesShown().filter((x) => useStore.getState().jobs.some((j) => j.title === x));
    expect(shown.sort()).toEqual([...urgent].sort());
  });

  it('?overdue=1 lists exactly the overdue jobs', async () => {
    const { isOverdue, todayIso } = await import('../../domain/jobUrgency');
    const st = useStore.getState();
    renderAt('/jobs?overdue=1');
    const overdue = st.jobs.filter((j) => isOverdue(j, st.applications, todayIso())).map((j) => j.title);
    expect(overdue.length).toBeGreaterThan(0);
    const shown = titlesShown().filter((x) => st.jobs.some((j) => j.title === x));
    expect(shown.sort()).toEqual([...overdue].sort());
    expect(screen.getByRole('button', { name: /Overdue/, pressed: true })).toBeInTheDocument();
  });

  it('shows the priority badge on a critical job row', () => {
    renderAt('/jobs');
    const row = screen.getByRole('link', { name: 'Senior Frontend Developer' }).closest('tr')!;
    expect(within(row).getByText('Critical')).toBeInTheDocument();
  });
});


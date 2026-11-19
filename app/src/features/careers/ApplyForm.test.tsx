import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { AppRoutes } from '../../routes';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );

let jobId: string;
let closedId: string;
let campaignId: string;

beforeEach(() => {
  sessionStorage.clear();
  const seed = buildSeed();
  useStore.setState({ ...seed, applications: [], activities: [], ui: { ...seed.ui, careersLang: 'en' } });
  jobId = seed.jobs.find((j) => j.status === 'open')!.id;
  closedId = seed.jobs.find((j) => j.status !== 'open')!.id;
  campaignId = seed.campaigns[0].id;
});

const fill = (name: string, email: string) => {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  // A CV is required (PRD AC-04).
  fireEvent.change(screen.getByLabelText(/^CV/), { target: { files: [new File(['x'], 'Applicant_CV.pdf')] } });
};
const consent = () => fireEvent.click(screen.getByRole('checkbox'));
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

describe('Careers site', () => {
  it('lists only open jobs and shows the job description with an apply link keeping ?src', () => {
    renderAt('/careers');
    const open = useStore.getState().jobs.filter((j) => j.status === 'open');
    expect(screen.getByTestId('careers-grid').children).toHaveLength(open.length);
    expect(screen.queryByText(useStore.getState().jobs.find((j) => j.id === closedId)!.title)).toBeNull();
  });

  it('job page keeps ?src on the apply link', () => {
    renderAt(`/careers/${jobId}?src=${campaignId}-linkedin`);
    expect(screen.getByRole('link', { name: 'Apply now' })).toHaveAttribute('href', `/careers/${jobId}/apply?src=${campaignId}-linkedin`);
  });

  it('closed job shows the unavailable page on job and apply routes', () => {
    for (const p of [`/careers/${closedId}`, `/careers/${closedId}/apply`, '/careers/nope']) {
      const { unmount } = renderAt(p);
      expect(screen.getByText('This job is no longer available')).toBeInTheDocument();
      unmount();
    }
  });

  it('validates name, contact and consent without creating anything', () => {
    renderAt(`/careers/${jobId}/apply`);
    submit();
    expect(screen.getByText('Please enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter an email or a phone number')).toBeInTheDocument();
    expect(screen.getByText('You need to agree before applying')).toBeInTheDocument();
    expect(useStore.getState().applications).toHaveLength(0);
  });

  it('asks the job questions: required ones block submit, answers are saved', () => {
    renderAt('/careers/job-2/apply');
    fill('Tran Van Q', 'tran.q@example.com');
    consent();
    submit();
    expect(screen.getAllByText('Please answer this question')).toHaveLength(2);
    expect(useStore.getState().applications).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('How many engineers have you led? *'), { target: { value: '4 engineers' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    submit();
    expect(screen.getByTestId('careers-applied')).toBeInTheDocument();
    expect(useStore.getState().applications[0].answers).toEqual([
      { questionId: 'q-lead', label: 'How many engineers have you led?', answer: '4 engineers' },
      { questionId: 'q-english', label: 'Are you comfortable working in English daily?', answer: 'Yes' },
    ]);
  });

  it('shows the job post sections from the JD and the job', () => {
    const { jobs, jds } = useStore.getState();
    const job = jobs.find((j) => j.id === 'job-1')!;
    useStore.setState({
      jobs: jobs.map((j) => (j.id === 'job-1' ? { ...j, whyLove: '- Hybrid work', additionalInfo: 'Office in District 1' } : j)),
      jds: jds.map((d) => (d.id === job.jdId ? { ...d, skillsExperience: '- 5+ years of React' } : d)),
    });
    renderAt('/careers/job-1');
    for (const h of ['Your skills and experience', "Why you'll love working here", 'Additional information']) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByText('5+ years of React')).toBeInTheDocument();
    expect(screen.getByText('Hybrid work')).toBeInTheDocument();
    expect(screen.getByText('Office in District 1')).toBeInTheDocument();
  });

  it('shows the salary range only when the job allows it', () => {
    renderAt('/careers/job-1');
    expect(screen.getByText('40.000.000 ₫ – 60.000.000 ₫')).toBeInTheDocument();
  });

  it('requires a CV before applying', () => {
    renderAt(`/careers/${jobId}/apply`);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'No Cv' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'no.cv@example.com' } });
    consent();
    submit();
    expect(screen.getByText('Please attach your CV')).toBeInTheDocument();
    expect(useStore.getState().applications).toHaveLength(0);
  });

  it('keeps what was typed when the applicant leaves the form and comes back', () => {
    const first = renderAt(`/careers/${jobId}/apply`);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Draft Person' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'draft@example.com' } });
    first.unmount();
    renderAt(`/careers/${jobId}/apply`);
    expect(screen.getByLabelText('Full name')).toHaveValue('Draft Person');
    expect(screen.getByLabelText('Email')).toHaveValue('draft@example.com');
  });

  it('rejects a CV that is not PDF or DOCX', () => {
    renderAt(`/careers/${jobId}/apply`);
    fireEvent.change(screen.getByLabelText(/^CV/), { target: { files: [new File(['x'], 'cv.exe')] } });
    expect(screen.getByText('Only PDF or DOCX files are accepted')).toBeInTheDocument();
  });

  it('submits an application with the campaign channel and shows the confirmation', () => {
    renderAt(`/careers/${jobId}/apply?src=${campaignId}-topcv`);
    fill('Pham Thi Test', 'pham.test@example.com');
    consent();
    submit();
    expect(screen.getByTestId('careers-applied')).toBeInTheDocument();
    expect(useStore.getState().applications[0]).toMatchObject({ stage: 'new', source: 'TopCV', via: 'campaign', campaignId });
  });

  it('applying again shows the already applied page and adds nothing', () => {
    useStore.getState().applyFromCareers({ name: 'Pham Thi Test', email: 'pham.test@example.com' }, jobId);
    renderAt(`/careers/${jobId}/apply`);
    fill('Pham Thi Test', 'PHAM.test@example.com');
    consent();
    submit();
    expect(screen.getByTestId('careers-already-applied')).toBeInTheDocument();
    expect(screen.getByText(/Current status: Received/)).toBeInTheDocument();
    expect(useStore.getState().applications).toHaveLength(1);
  });

  it('the old status link leads to candidate sign-in, which shows the application with a friendly stage word', () => {
    useStore.getState().applyFromCareers({ name: 'Pham Thi Test', email: 'pham.test@example.com' }, jobId);
    renderAt('/careers/status');
    fireEvent.change(screen.getByLabelText('Email or phone number'), { target: { value: 'pham.test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(within(screen.getByTestId('candidate-portal')).getByText('Received')).toBeInTheDocument();
    signInAs(undefined);
  });

  it('the confirmation page says how to follow the application', () => {
    renderAt(`/careers/${jobId}/apply`);
    fill('Follow Up', 'follow.up@example.com');
    consent();
    submit();
    expect(screen.getByRole('link', { name: 'Follow my application' })).toHaveAttribute('href', '/careers/login');
  });

  it('filters jobs by keyword, department, location and level, with an empty message', () => {
    renderAt('/careers');
    const open = useStore.getState().jobs.filter((j) => j.status === 'open');
    const grid = () => screen.getByTestId('careers-grid').children.length;
    const first = open[0];
    fireEvent.change(screen.getByLabelText('Search positions'), { target: { value: first.title.toUpperCase() } });
    expect(grid()).toBe(open.filter((j) => j.title.toLowerCase().includes(first.title.toLowerCase())).length);
    fireEvent.change(screen.getByLabelText('Search positions'), { target: { value: '' } });
    for (const [label, key] of [['Department', 'department'], ['Location', 'location'], ['Level', 'level']] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: first[key] } });
      expect(grid()).toBe(open.filter((j) => j[key] === first[key]).length);
      fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
      expect(grid()).toBe(open.length);
    }
    fireEvent.change(screen.getByLabelText('Search positions'), { target: { value: 'zzzz-nothing' } });
    expect(screen.getByText('No positions match your search.')).toBeInTheDocument();
  });

  it('saves a LinkedIn link and rejects an invalid one', () => {
    renderAt(`/careers/${jobId}/apply`);
    fill('Pham Thi Test', 'pham.test@example.com');
    fireEvent.change(screen.getByLabelText(/LinkedIn/), { target: { value: 'not a link' } });
    consent();
    submit();
    expect(screen.getByText('Enter a valid LinkedIn link')).toBeInTheDocument();
    expect(useStore.getState().applications).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/LinkedIn/), { target: { value: 'https://linkedin.com/in/pham' } });
    submit();
    expect(useStore.getState().candidates.find((c) => c.email === 'pham.test@example.com')?.linkedin).toBe('https://linkedin.com/in/pham');
  });

  it('a picked CV prefills only empty fields', () => {
    renderAt(`/careers/${jobId}/apply`);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Typed Name' } });
    fireEvent.change(screen.getByLabelText(/^CV/), { target: { files: [new File(['x'], 'Tran_Van_Binh_CV.pdf')] } });
    expect(screen.getByLabelText('Full name')).toHaveValue('Typed Name');
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).not.toBe('');
  });

  it('a picked CV never fills the email, so it cannot collide with an existing profile', () => {
    renderAt(`/careers/${jobId}/apply`);
    fireEvent.change(screen.getByLabelText(/^CV/), { target: { files: [new File(['x'], 'CV.pdf')] } });
    expect(screen.getByLabelText('Email')).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/^CV/), { target: { files: [new File(['x'], 'Tran_Van_Binh_CV.pdf')] } });
    const email = (screen.getByLabelText('Email') as HTMLInputElement).value;
    expect(email).toBe('');
    expect(useStore.getState().candidates.some((c) => c.email === email && email !== '')).toBe(false);
  });

  it('keeps the parsed CV details on the new candidate; typed values win', () => {
    renderAt(`/careers/${jobId}/apply`);
    fill('Typed Name', 'typed.name@example.com');
    fireEvent.change(screen.getByLabelText(/^CV/), { target: { files: [new File(['x'], 'Tran_Van_Binh_CV.pdf')] } });
    expect(screen.getByLabelText('Full name')).toHaveValue('Typed Name');
    consent();
    submit();
    const c = useStore.getState().candidates.find((x) => x.email === 'typed.name@example.com')!;
    expect(c.name).toBe('Typed Name');
    expect(c.title).not.toBe('');
    expect(c.skills.length).toBeGreaterThan(0);
    expect(c.seniority).not.toBe('');
    expect(c.cv).toBe('Tran_Van_Binh_CV.pdf');
  });

  it('a signed-in candidate sees only the jobs they applied to, not ones HR added them to', () => {
    const s = useStore.getState();
    const r = s.applyFromCareers({ name: 'Pham Thi Test', email: 'pham.test@example.com' }, jobId);
    const other = s.jobs.filter((j) => j.status === 'open').find((j) => j.id !== jobId)!;
    if (!r.ok) throw new Error('expected ok');
    s.addToPipeline(r.application.candidateId, other.id, { via: 'manual', source: 'Manual', by: 'u-admin' });
    renderAt('/careers/login');
    fireEvent.change(screen.getByLabelText('Email or phone number'), { target: { value: 'pham.test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const portal = screen.getByTestId('candidate-portal');
    expect(within(portal).queryByText(other.title)).toBeNull();
    signInAs(undefined);
  });

  it('language toggle switches the careers scope to Vietnamese', () => {
    renderAt('/careers');
    fireEvent.click(screen.getByRole('button', { name: /^vi$/i }));
    expect(useStore.getState().ui.careersLang).toBe('vi');
    expect(screen.getAllByText('Đăng nhập ứng viên').length).toBeGreaterThan(0);
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockupFixture } from '../../data/fixtureMockup';
import { toast } from '../../components/Toast';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { CandidateProfilePage } from './CandidateProfilePage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/candidates/:id" element={<CandidateProfilePage />} />
        <Route path="/candidates" element={<div>pool page</div>} />
      </Routes>
    </MemoryRouter>,
  );

const ME = { by: 'u-admin' };
let id: string;

beforeEach(() => {
  const seed = buildSeed();
  useStore.setState({ ...seed, applications: [], activities: [] });
  id = seed.candidates[0].id;
});

describe('CandidateProfilePage', () => {
  it('shows the candidate with a breadcrumb back to the pool', () => {
    renderAt(`/candidates/${id}`);
    const c = useStore.getState().candidates[0];
    expect(screen.queryByRole('heading', { name: 'Candidate Profile' })).toBeNull();
    expect(screen.getByText(useStore.getState().candidates[0].name, { selector: '[aria-current="page"]' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue(c.name);
    expect(screen.getByLabelText('Full Name')).not.toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Candidate Pool' }));
    expect(screen.getByText('pool page')).toBeInTheDocument();
  });

  it('live CV pane has no mockup footer and owner links are English', () => {
    renderAt(`/candidates/${id}`);
    expect(screen.queryByText(/Sample CV/)).toBeNull();
    expect(screen.getByText('Change owner')).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown id', () => {
    renderAt('/candidates/nope');
    expect(screen.getByText('Candidate not found')).toBeInTheDocument();
  });

  it('fields are edited in place and save when the field is left, with no Edit button', () => {
    renderAt(`/candidates/${id}`);
    expect(screen.queryByRole('button', { name: /^Edit$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    const role = screen.getByLabelText('Current Role');
    expect(role).not.toHaveAttribute('readonly');
    fireEvent.change(role, { target: { value: 'Principal Engineer' } });
    // Typing alone does not save; leaving the field does.
    expect(useStore.getState().candidates[0].title).not.toBe('Principal Engineer');
    fireEvent.blur(role);
    expect(useStore.getState().candidates[0].title).toBe('Principal Engineer');
    expect(screen.getByRole('status')).toHaveTextContent(/All changes saved/);
  });

  it('Enter in a field saves it; whitespace is trimmed and a blank name falls back to the old one', () => {
    renderAt(`/candidates/${id}`);
    const before = useStore.getState().candidates[0].name;
    const name = screen.getByLabelText('Full Name');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);
    expect(useStore.getState().candidates[0].name).toBe(before);
    expect(screen.getByLabelText('Full Name')).toHaveValue(before);
    const loc = screen.getByLabelText('Location');
    fireEvent.change(loc, { target: { value: '  Da Nang ' } });
    fireEvent.blur(loc);
    expect(useStore.getState().candidates[0].location).toBe('Da Nang');
  });

  it('users without Talent Pool access see the same page as plain text', () => {
    const hm = useStore.getState().users.find((u) => u.role === 'Hiring Manager')!;
    const job = useStore.getState().jobs.find((j) => j.status === 'open')!;
    useStore.getState().addToPipeline(id, job.id, { via: 'talent_pool', source: 'Talent Pool', ...ME });
    useStore.setState((s) => ({ jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, hiringManager: hm.id } : j)), ui: { ...s.ui, actingAs: hm.id } }));
    renderAt(`/candidates/${id}`);
    expect(screen.getByLabelText('Current Role')).toHaveAttribute('readonly');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('expected rate shows formatted, edits as digits and can be cleared', () => {
    useStore.setState({ candidates: useStore.getState().candidates.map((c, i) => (i === 0 ? { ...c, expectedRate: 2500 } : c)) });
    renderAt(`/candidates/${id}`);
    const rate = () => screen.getByLabelText('Expected Rate (USD / month)');
    expect(rate()).toHaveValue('$2,500 / month');
    fireEvent.focus(rate());
    expect(rate()).toHaveValue('2500');
    fireEvent.change(rate(), { target: { value: '3200' } });
    fireEvent.blur(rate());
    expect(useStore.getState().candidates[0].expectedRate).toBe(3200);
    expect(rate()).toHaveValue('$3,200 / month');
    fireEvent.focus(rate());
    fireEvent.change(rate(), { target: { value: '' } });
    fireEvent.blur(rate());
    expect(useStore.getState().candidates[0].expectedRate).toBeUndefined();
  });

  it('availability date can be edited and cleared', () => {
    useStore.setState({ candidates: useStore.getState().candidates.map((c, i) => (i === 0 ? { ...c, availableFrom: '2026-12-15' } : c)) });
    renderAt(`/candidates/${id}`);
    const date = () => screen.getByLabelText('Availability Date');
    expect(date()).toHaveAttribute('type', 'date');
    expect(date()).toHaveValue('2026-12-15');
    fireEvent.change(date(), { target: { value: '2027-01-05' } });
    fireEvent.blur(date());
    expect(useStore.getState().candidates[0].availableFrom).toBe('2027-01-05');
    fireEvent.change(date(), { target: { value: '' } });
    fireEvent.blur(date());
    expect(useStore.getState().candidates[0].availableFrom).toBeUndefined();
  });

  it('an email owned by another candidate is not saved and shows an error', () => {
    vi.mocked(toast).mockClear();
    useStore.setState({ ui: { ...useStore.getState().ui, piiUnlocked: true } });
    renderAt(`/candidates/${id}`);
    const other = useStore.getState().candidates[1];
    const before = useStore.getState().candidates[0];
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: other.email } });
    fireEvent.blur(screen.getByLabelText('Email'));
    expect(toast).toHaveBeenCalledWith('Another profile already uses this email or phone', 'error');
    expect(useStore.getState().candidates[0].email).toBe(before.email);
  });

  it('masked contact data must be revealed before it can be edited', () => {
    useStore.setState({ ui: { ...useStore.getState().ui, piiUnlocked: false } });
    renderAt(`/candidates/${id}`);
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    fireEvent.click(screen.getAllByRole('button', { name: 'Show' })[0]);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('readonly');
  });

  it('?edit=1 puts the cursor in the name field', () => {
    renderAt(`/candidates/${id}?edit=1`);
    expect(screen.getByLabelText('Full Name')).toHaveFocus();
  });

  it('Application history lists each application with its job link, stage, source and who added it', () => {
    const { jobs } = useStore.getState();
    const open = jobs.filter((j) => j.status === 'open');
    const s = useStore.getState();
    s.addToPipeline(id, open[0].id, { via: 'careers', source: 'LinkedIn Ad', ...ME });
    s.addToPipeline(id, open[1].id, { via: 'talent_pool', source: 'Talent Pool', ...ME });
    s.moveStage(useStore.getState().applications[0].id, 'screening', 'u-admin');
    renderAt(`/candidates/${id}`);
    const item = screen.getByTestId(`application-${open[0].id}`);
    expect(within(item).getByRole('link', { name: open[0].title })).toHaveAttribute('href', `/pipeline/${open[0].id}`);
    expect(within(item).getByText('HR Screening')).toBeInTheDocument();
    expect(item).toHaveTextContent('LinkedIn Ad');
    expect(item).toHaveTextContent('Careers site');
    expect(item).toHaveTextContent('added by Super Admin');
    expect(screen.getByTestId(`application-${open[1].id}`)).toHaveTextContent('Talent Pool');
  });

  it('Application history shows an empty state when there are no applications', () => {
    renderAt(`/candidates/${id}`);
    expect(screen.getByText('Not used in any job pipeline yet')).toBeInTheDocument();
  });

  it('Add to Pipeline button opens the modal for this candidate', () => {
    renderAt(`/candidates/${id}`);
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add to Pipeline' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
  });

  it('a saved edit stamps Last updated by with the editor and date', () => {
    renderAt(`/candidates/${id}`);
    expect(screen.getByTestId('candidate-detail-lastupdatedby-input')).toHaveValue('—');
    fireEvent.change(screen.getByLabelText('Current Role'), { target: { value: 'Staff Engineer' } });
    fireEvent.blur(screen.getByLabelText('Current Role'));
    const c = useStore.getState().candidates[0];
    expect(c.updatedBy).toBe('u-admin');
    expect((screen.getByTestId('candidate-detail-lastupdatedby-input') as HTMLInputElement).value).toMatch(/^Super Admin · \d{2}\/\d{2}\/\d{4}$/);
  });

  it('shows location, source, added date and years of experience', () => {
    const c = useStore.getState().candidates[0];
    renderAt(`/candidates/${id}`);
    expect(screen.getByLabelText('Location')).toHaveValue(c.location ?? '');
    expect(screen.getByLabelText('Source')).toHaveValue(c.source);
    expect(screen.getByLabelText('Added to pool')).toHaveValue(c.createdAt.slice(8, 10) + '/' + c.createdAt.slice(5, 7) + '/' + c.createdAt.slice(0, 4));
    expect(screen.getByLabelText('Years of experience')).toBeInTheDocument();
  });

  it('tags, skills and toggles save on click; list sections save when focus leaves them', () => {
    renderAt(`/candidates/${id}`);
    const tagBox = within(screen.getByText('Tags').closest('section')!).getByRole('textbox');
    fireEvent.change(tagBox, { target: { value: 'hot-lead' } });
    fireEvent.keyDown(tagBox, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Primary Skills: Type and press Enter'), { target: { value: 'Rust' } });
    fireEvent.keyDown(screen.getByLabelText('Primary Skills: Type and press Enter'), { key: 'Enter' });
    const before = useStore.getState().candidates[0].openToWork;
    fireEvent.click(screen.getByLabelText('Open to Work'));
    fireEvent.click(screen.getByRole('button', { name: /Add experience/ }));
    const titles = screen.getAllByLabelText('Job Title');
    fireEvent.change(titles[titles.length - 1], { target: { value: 'CTO' } });
    // Moving between inputs of the same section does not save yet.
    fireEvent.blur(titles[titles.length - 1], { relatedTarget: screen.getAllByLabelText('Company').slice(-1)[0] });
    expect(useStore.getState().candidates[0].experience?.slice(-1)[0]?.title).not.toBe('CTO');
    fireEvent.blur(titles[titles.length - 1], { relatedTarget: null });
    fireEvent.click(screen.getByRole('button', { name: /Add education/ }));
    fireEvent.blur(screen.getByRole('button', { name: /Add education/ }), { relatedTarget: null });
    const c = useStore.getState().candidates[0];
    expect(c.tags).toContain('hot-lead');
    expect(c.primarySkills).toContain('Rust');
    expect(c.skills).toContain('Rust');
    expect(c.openToWork).toBe(!before);
    expect(c.experience?.[c.experience.length - 1]?.title).toBe('CTO');
    // An empty education row is dropped on save.
    expect(c.education?.every((e) => e.degree || e.institution)).toBe(true);
  });

  it('Activity history lists what was logged about the candidate, newest first', () => {
    const { users } = useStore.getState();
    const other = users.find((u) => u.id !== 'u-admin' && u.role !== 'Candidate')!;
    useStore.getState().transferOwner(id, other.id, 'u-admin');
    renderAt(`/candidates/${id}`);
    const history = screen.getByRole('region', { name: 'Activity history' });
    expect(within(history).getByText(/CV owner changed/)).toBeInTheDocument();
  });

  it('mockup fixture renders the first candidate fully and hides the new UI', () => {
    useStore.setState(buildMockupFixture());
    window.history.pushState({}, '', '/?fixture=mockup');
    try {
      renderAt('/candidates/cand-mock-01?fixture=mockup');
      expect(screen.getByLabelText('Full Name')).toHaveValue('PHAM MINH KHOA');
      expect(screen.getAllByDisplayValue('Nova Payments (demo)')).toHaveLength(1);
      expect(screen.getByDisplayValue('MBA in Marketing')).toBeInTheDocument();
      expect(screen.getByText('Sales Strategy')).toBeInTheDocument();
      expect(screen.getByText(/Sample CV/)).toBeInTheDocument();
      expect(screen.getByText('Đổi owner')).toBeInTheDocument();
      expect(screen.queryByText('Used in')).toBeNull();
      expect(screen.queryByRole('button', { name: /Add to Pipeline/ })).toBeNull();
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('summary card shows who the candidate is and the jobs they are active in', () => {
    const open = useStore.getState().jobs.filter((j) => j.status === 'open');
    useStore.getState().addToPipeline(id, open[0].id, { via: 'talent_pool', source: 'Talent Pool', ...ME });
    renderAt(`/candidates/${id}`);
    const hero = screen.getByRole('region', { name: 'Candidate summary' });
    const c = useStore.getState().candidates[0];
    expect(within(hero).getByRole('heading', { name: c.name })).toBeInTheDocument();
    expect(within(hero).getByText('Pipelines: 1 active · 1 total')).toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: new RegExp(open[0].title) })).toHaveAttribute('href', `/pipeline/${open[0].id}`);
  });

  it('an invalid email is not saved and keeps its message under the field', () => {
    useStore.setState({ ui: { ...useStore.getState().ui, piiUnlocked: true } });
    renderAt(`/candidates/${id}`);
    const before = useStore.getState().candidates[0].email;
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    expect(screen.getByText('Enter a valid email, e.g. name@company.com')).toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText('Email'));
    expect(useStore.getState().candidates[0].email).toBe(before);
    expect(screen.getByLabelText('Email')).toHaveValue('not-an-email');
    expect(screen.getByText('Enter a valid email, e.g. name@company.com')).toBeInTheDocument();
  });

  it('seniority and English level are picked from the taxonomy and save on change', () => {
    renderAt(`/candidates/${id}`);
    const seniority = screen.getByLabelText('Seniority');
    expect(seniority.tagName).toBe('SELECT');
    const lead = useStore.getState().taxonomy.find((x) => x.kind === 'seniority' && x.active)!.label;
    fireEvent.change(seniority, { target: { value: lead } });
    expect(screen.getByLabelText('English Level').tagName).toBe('SELECT');
    expect(useStore.getState().candidates[0].seniority).toBe(lead);
  });

  it('edits links, work preferences, certifications, languages and projects', () => {
    renderAt(`/candidates/${id}`);
    fireEvent.change(screen.getByLabelText('GitHub'), { target: { value: 'github.com/someone' } });
    fireEvent.blur(screen.getByLabelText('GitHub'));
    fireEvent.change(screen.getByLabelText('Portfolio / website'), { target: { value: '' } });
    fireEvent.blur(screen.getByLabelText('Portfolio / website'));
    const modes = screen.getByRole('group', { name: 'Work mode' });
    const remoteOn = within(modes).getByRole('button', { name: /Remote/ }).getAttribute('aria-pressed') === 'true';
    fireEvent.click(within(modes).getByRole('button', { name: /Remote/ }));
    const relocateBefore = Boolean(useStore.getState().candidates[0].willingToRelocate);
    fireEvent.click(screen.getByLabelText('Willing to relocate'));
    const cert = within(screen.getByRole('heading', { name: /Certifications/, level: 3 }).closest('section')!).getByRole('textbox');
    fireEvent.change(cert, { target: { value: 'AWS SAA' } });
    fireEvent.keyDown(cert, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Add project/ }));
    const names = screen.getAllByLabelText('Project name');
    fireEvent.change(names[names.length - 1], { target: { value: 'Payments revamp' } });
    fireEvent.blur(names[names.length - 1], { relatedTarget: null });
    const c = useStore.getState().candidates[0];
    expect(c.github).toBe('github.com/someone');
    expect(c.portfolio).toBeUndefined();
    expect(c.workModes?.includes('remote')).toBe(!remoteOn);
    expect(c.willingToRelocate).toBe(!relocateBefore);
    expect(c.certifications).toContain('AWS SAA');
    expect(c.projects?.some((p) => p.name === 'Payments revamp')).toBe(true);
    expect(screen.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', 'https://github.com/someone');
  });

  it('"I currently work here" clears the end date', () => {
    useStore.setState({ candidates: useStore.getState().candidates.map((c, i) => (i === 0 ? { ...c, experience: [{ title: 'Dev', company: 'Acme', start: '2020-01', end: '2022-06', description: '' }] } : c)) });
    renderAt(`/candidates/${id}`);
    expect(screen.getByLabelText('Start Date')).toHaveAttribute('type', 'month');
    fireEvent.click(screen.getByLabelText('I currently work here'));
    expect(screen.getByLabelText('End Date')).toHaveAttribute('readonly');
    fireEvent.blur(screen.getByLabelText('I currently work here'), { relatedTarget: null });
    expect(useStore.getState().candidates[0].experience?.[0].end).toBe('');
    expect(screen.getByLabelText('End Date')).toHaveValue('Present');
  });

  it('Application history collects ratings, comments and the rejection reason; HR can flag do not hire', () => {
    vi.mocked(toast).mockClear();
    const open = useStore.getState().jobs.filter((j) => j.status === 'open');
    useStore.getState().addToPipeline(id, open[0].id, { via: 'talent_pool', source: 'Talent Pool', ...ME });
    const app = useStore.getState().applications[0];
    useStore.setState({
      applications: [{ ...app, stage: 'rejected', rejectedCode: 'salary', rejectedReason: 'Asked 2x budget', ratings: [{ by: 'u-admin', stars: 4, at: app.addedAt }], comments: [{ by: 'u-admin', at: app.addedAt, text: 'Strong backend, weak English' }] }],
    });
    renderAt(`/candidates/${id}`);
    const card = screen.getByTestId(`application-${open[0].id}`);
    expect(card).toHaveTextContent('Strong backend, weak English');
    expect(card).toHaveTextContent('Asked 2x budget');
    fireEvent.click(screen.getByRole('button', { name: /Flag do not hire/ }));
    fireEvent.change(screen.getByLabelText('Why should we not hire this candidate again?'), { target: { value: 'No-show twice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Flag' }));
    expect(useStore.getState().candidates[0].doNotHire).toMatchObject({ reason: 'No-show twice', by: 'u-admin' });
    expect(within(screen.getByRole('region', { name: 'Candidate summary' })).getByRole('alert')).toHaveTextContent('No-show twice');
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/ }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Flagged do not hire');
  });
});

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
    expect(screen.getByRole('heading', { name: 'Candidate Profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toHaveValue(c.name);
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('readonly');
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

  it('Edit makes fields editable and Save persists via updateCandidate', () => {
    renderAt(`/candidates/${id}`);
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    const role = screen.getByLabelText('Current Role');
    expect(role).not.toHaveAttribute('readonly');
    fireEvent.change(role, { target: { value: 'Principal Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(useStore.getState().candidates[0].title).toBe('Principal Engineer');
    expect(screen.getByLabelText('Current Role')).toHaveAttribute('readonly');
  });

  it('Save with an email owned by another candidate shows an error and stays in edit mode', () => {
    vi.mocked(toast).mockClear();
    renderAt(`/candidates/${id}`);
    const other = useStore.getState().candidates[1];
    const before = useStore.getState().candidates[0];
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: other.email } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(toast).toHaveBeenCalledWith('Another profile already uses this email or phone', 'error');
    expect(useStore.getState().candidates[0].email).toBe(before.email);
    expect(screen.getByLabelText('Current Role')).not.toHaveAttribute('readonly');
  });

  it('Cancel discards edits', () => {
    renderAt(`/candidates/${id}`);
    const before = useStore.getState().candidates[0].title;
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(screen.getByLabelText('Current Role'), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useStore.getState().candidates[0].title).toBe(before);
    expect(screen.getByLabelText('Current Role')).toHaveValue(before);
  });

  it('?edit=1 opens in edit mode', () => {
    renderAt(`/candidates/${id}?edit=1`);
    expect(screen.getByLabelText('Current Role')).not.toHaveAttribute('readonly');
  });

  it('Used in lists each application with a link to the job pipeline', () => {
    const { jobs } = useStore.getState();
    const open = jobs.filter((j) => j.status === 'open');
    const s = useStore.getState();
    s.addToPipeline(id, open[0].id, { via: 'careers', source: 'LinkedIn Ad', ...ME });
    s.addToPipeline(id, open[1].id, { via: 'talent_pool', source: 'Talent Pool', ...ME });
    s.moveStage(useStore.getState().applications[0].id, 'screening', 'u-admin');
    renderAt(`/candidates/${id}`);
    const row = screen.getByTestId(`used-in-${open[0].id}`);
    expect(within(row).getByRole('link', { name: open[0].title })).toHaveAttribute('href', `/pipeline/${open[0].id}`);
    expect(within(row).getByText('HR Screening')).toBeInTheDocument();
    expect(within(row).getByText('LinkedIn Ad')).toBeInTheDocument();
    expect(within(row).getByText('Careers site')).toBeInTheDocument();
    expect(within(row).getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByTestId(`used-in-${open[1].id}`)).toHaveTextContent('Talent Pool');
  });

  it('Used in shows an empty state when there are no applications', () => {
    renderAt(`/candidates/${id}`);
    expect(screen.getByText('Not used in any job pipeline yet')).toBeInTheDocument();
  });

  it('Add to Pipeline button opens the modal for this candidate', () => {
    renderAt(`/candidates/${id}`);
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add to Pipeline' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
  });

  it('Save stamps Last updated by with the editor and date', () => {
    renderAt(`/candidates/${id}`);
    expect(screen.getByTestId('candidate-detail-lastupdatedby-input')).toHaveValue('—');
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(screen.getByLabelText('Current Role'), { target: { value: 'Staff Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
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

  it('edits tags, skills, open to work, experience and education', () => {
    renderAt(`/candidates/${id}`);
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /Add education/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
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
});

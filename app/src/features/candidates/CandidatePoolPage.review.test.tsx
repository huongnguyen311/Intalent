import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import type { Application, Candidate } from '../../domain/types';
import { useStore } from '../../store/store';
import { CandidatePoolPage } from './CandidatePoolPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

const renderAt = (url = '/candidates') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/candidates" element={<CandidatePoolPage />} />
        <Route path="/candidates/:id" element={<div>profile</div>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const recent = new Date(Date.now() - 86_400_000).toISOString();
const base = (o: Partial<Candidate> & { id: string; name: string }): Candidate => ({
  title: 'Engineer', email: `${o.id}@x.demo`, phone: '0900000000', seniority: 'Senior', english: 'Advanced', skills: ['React'],
  domains: [], tags: [], groups: [], cvOwner: 'u-thu', source: 'Manual', inTalentPool: true, createdAt: recent, cv: '',
  consents: [{ purpose: 'recruitment', policyVersion: '1', at: recent }], ...o,
});

beforeEach(() => {
  const seed = buildSeed();
  const job = seed.jobs[0];
  useStore.setState({
    ...seed,
    candidates: [
      base({ id: 'c-open', name: 'Open Person', openToWork: true, location: 'Ha Noi', tags: ['vip', 'remote', 'java'] }),
      base({ id: 'c-closed', name: 'Closed Person', openToWork: false, location: 'Da Nang' }),
      base({ id: 'c-anon', name: 'Anonymized #anon', email: '', phone: '', anonymizedAt: recent }),
      base({ id: 'c-gap', name: 'Gap Person', email: '' }),
    ],
    applications: [
      { ...(seed.applications[0] as Application), id: 'a1', candidateId: 'c-open', jobId: job.id, stage: 'interview' },
      { ...(seed.applications[0] as Application), id: 'a2', candidateId: 'c-closed', jobId: job.id, stage: 'rejected' },
    ],
  });
});

describe('Candidate pool review fixes', () => {
  it('shows the real open-to-work status', () => {
    renderAt();
    expect(screen.getByTestId('pool-open-c-open')).toHaveTextContent('Open to work');
    expect(screen.getByTestId('pool-open-c-closed')).toHaveTextContent('Not looking');
  });

  it('keeps filters in the URL and restores them on load', () => {
    const { unmount } = renderAt();
    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: 'open' } });
    expect(screen.getByTestId('where')).toHaveTextContent('/candidates?q=open');
    unmount();
    renderAt('/candidates?q=open');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('opening a profile carries the pool URL for the breadcrumb', () => {
    renderAt('/candidates?open=1');
    fireEvent.click(screen.getByText('Open Person'));
    expect(screen.getByText('profile')).toBeInTheDocument();
  });

  it('anonymized rows are marked and cannot be selected or added to a pipeline', () => {
    renderAt();
    const row = screen.getByTestId('pool-row-c-anon');
    expect(within(row).getByText('Anonymized')).toBeInTheDocument();
    expect(within(row).getByRole('checkbox')).toBeDisabled();
    fireEvent.click(within(row).getByRole('button', { name: /Actions for/ }));
    expect(screen.queryByRole('menuitem', { name: 'Add to Pipeline' })).toBeNull();
  });

  it('one PII toggle in the header unlocks contacts', () => {
    renderAt();
    expect(screen.getAllByRole('button', { name: 'Show or hide contact details' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show or hide contact details' }));
    expect(screen.getByText('c-open@x.demo')).toBeInTheDocument();
  });

  it('shows the active pipeline and ignores ended applications', () => {
    renderAt();
    const job = useStore.getState().jobs[0];
    expect(screen.getByTestId('pool-pipeline-c-open')).toHaveTextContent(job.title);
    expect(screen.getByTestId('pool-pipeline-c-closed')).toHaveTextContent('—');
  });

  it('flags profiles with quality gaps and shows tags, location', () => {
    renderAt();
    expect(screen.getByTestId('pool-quality-c-gap').getAttribute('title')).toContain('Missing email');
    expect(screen.queryByTestId('pool-quality-c-open')).toBeNull();
    const row = screen.getByTestId('pool-row-c-open');
    expect(row).toHaveTextContent('vip');
    expect(row).toHaveTextContent('+1');
    expect(row).toHaveTextContent('Ha Noi');
  });

  it('filters by open to work and pipeline status', () => {
    const { unmount } = renderAt('/candidates?open=1');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    unmount();
    renderAt('/candidates?pipeline=1');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Open Person')).toBeInTheDocument();
  });

  it('empty state offers to clear filters', () => {
    renderAt('/candidates?q=zzzz');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2);
  });

  it('bulk adds a tag to the selected candidates', () => {
    renderAt();
    fireEvent.click(within(screen.getByTestId('pool-row-c-closed')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    fireEvent.change(screen.getByLabelText('New or existing tag'), { target: { value: 'shortlist' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(useStore.getState().candidates.find((c) => c.id === 'c-closed')!.tags).toEqual(['shortlist']);
  });

  it('bulk changes the CV owner (with reports permission)', () => {
    const { users } = useStore.getState();
    const lead = users.find((u) => u.role === 'Recruitment Lead' && u.status !== 'Inactive')!;
    const target = users.find((u) => u.role === 'Recruiter' && u.status !== 'Inactive' && u.id !== 'u-thu')!;
    useStore.setState((s) => ({ ui: { ...s.ui, actingAs: lead.id } }));
    renderAt();
    fireEvent.click(within(screen.getByTestId('pool-row-c-closed')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Change CV owner' }));
    fireEvent.click(screen.getByRole('menuitem', { name: target.name }));
    expect(useStore.getState().candidates.find((c) => c.id === 'c-closed')!.cvOwner).toBe(target.id);
  });

  it('hides bulk owner change without the reports permission', () => {
    const recruiter = useStore.getState().users.find((u) => u.role === 'Recruiter' && u.status !== 'Inactive')!;
    useStore.setState((s) => ({ ui: { ...s.ui, actingAs: recruiter.id } }));
    renderAt();
    fireEvent.click(within(screen.getByTestId('pool-row-c-closed')).getByRole('checkbox'));
    expect(screen.queryByRole('button', { name: 'Change CV owner' })).toBeNull();
  });
});

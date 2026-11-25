import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { InterviewDialog } from './InterviewDialog';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('InterviewDialog panel', () => {
  it('prefills the panel with the hiring manager and the job interviewers', () => {
    const s = useStore.getState();
    const job = s.jobs.find((j) => j.id === 'job-1')!;
    const extra = s.users.find((u) => u.id !== job.hiringManager && u.status === 'Active' && u.role !== 'Candidate')!;
    useStore.setState({ jobs: s.jobs.map((j) => (j.id === 'job-1' ? { ...j, interviewers: [extra.id, job.hiringManager] } : j)) });
    const app = s.applications.find((a) => a.jobId === 'job-1')!;
    render(<InterviewDialog open app={app} candidateName="A" hasEmail={false} onClose={() => {}} />);
    const hm = s.users.find((u) => u.id === job.hiringManager)!;
    const checked = screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked && c.closest('fieldset'));
    expect(checked.map((c) => c.closest('label')!.textContent)).toEqual(
      s.users.filter((u) => u.id === hm.id || u.id === extra.id).filter((u) => u.status === 'Active' && u.role !== 'Candidate').map((u) => u.name),
    );
    expect(checked).toHaveLength(2);
  });
});

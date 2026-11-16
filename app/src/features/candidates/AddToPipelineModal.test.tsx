import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { AddToPipelineModal } from './AddToPipelineModal';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const open = (id: string) => useStore.getState().jobs.find((j) => j.status === 'open' && j.id === id)!;

let ids: string[];
let jobId: string;

beforeEach(() => {
  const seed = buildSeed();
  useStore.setState({ ...seed, applications: [], activities: [] });
  ids = seed.candidates.slice(0, 2).map((c) => c.id);
  jobId = seed.jobs.find((j) => j.status === 'open')!.id;
});

const pickJob = (id: string) => fireEvent.change(screen.getByLabelText('Job'), { target: { value: id } });
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Add to pipeline' }));

describe('AddToPipelineModal', () => {
  it('adds selected candidates with via talent_pool', () => {
    render(<AddToPipelineModal open onClose={() => {}} candidateIds={ids} />);
    expect(screen.getByLabelText('Source')).toHaveValue('Talent Pool');
    pickJob(jobId);
    confirm();
    const apps = useStore.getState().applications;
    expect(apps).toHaveLength(2);
    for (const a of apps) {
      expect(a).toMatchObject({ jobId, via: 'talent_pool', source: 'Talent Pool', stage: 'new', addedBy: 'u-admin' });
    }
    expect(apps.map((a) => a.candidateId).sort()).toEqual([...ids].sort());
    expect(screen.getAllByText('Added')).toHaveLength(2);
  });

  it('reports already-in-pipeline per candidate', () => {
    useStore.getState().addToPipeline(ids[0], jobId, { via: 'manual', source: 'Manual', by: 'u-admin' });
    useStore.getState().moveStage(useStore.getState().applications[0].id, 'interview', 'u-admin');
    render(<AddToPipelineModal open onClose={() => {}} candidateIds={ids} />);
    pickJob(jobId);
    confirm();
    expect(useStore.getState().applications).toHaveLength(2);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Already in this job's pipeline (stage Interview)")).toBeInTheDocument();
    expect(within(rows[1]).getByText('Added')).toBeInTheDocument();
  });

  it('only open jobs are selectable', () => {
    render(<AddToPipelineModal open onClose={() => {}} candidateIds={ids} />);
    const offered = within(screen.getByLabelText('Job')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value).filter(Boolean);
    const { jobs } = useStore.getState();
    expect(jobs.some((j) => j.status !== 'open')).toBe(true);
    expect(offered.sort()).toEqual(jobs.filter((j) => j.status === 'open').map((j) => j.id).sort());
    expect(open(offered[0])).toBeTruthy();
  });

  it('confirm is disabled until a job is chosen', () => {
    render(<AddToPipelineModal open onClose={() => {}} candidateIds={ids} />);
    expect(screen.getByRole('button', { name: 'Add to pipeline' })).toBeDisabled();
  });
});

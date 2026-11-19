import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { evaluateApplication } from '../../domain/aiEvaluation';
import type { AiEvaluation, Application, Candidate, Stage } from '../../domain/types';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';
import { ApplicationDrawer } from './ApplicationDrawer';
import { Board } from './Board';
import { useAiQueue } from './useAiQueue';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const at = new Date(Date.now() - 86_400_000).toISOString();
const evalWith = (score: number, c: Candidate): AiEvaluation => ({
  ...evaluateApplication(c, { stack: ['React'] }, at, `ai-${score}`),
  score,
});

function app(id: string, candidateId: string, stage: Stage, extra: Partial<Application> = {}): Application {
  return {
    id, candidateId, jobId: 'job-1', stage, source: 'Referral', via: 'manual', addedBy: 'u-thu',
    addedAt: at, stageEnteredAt: at, history: [{ stage, at, by: 'u-thu' }], comments: [], ...extra,
  };
}

let cands: Candidate[];

beforeEach(() => {
  const seed = buildSeed();
  cands = seed.candidates.slice(0, 3);
  useStore.setState({
    ...seed,
    activities: [],
    ui: { ...seed.ui, lang: 'en', actingAs: undefined },
    applications: [
      app('a1', cands[0].id, 'new', { aiEvaluations: [evalWith(55, cands[0])] }),
      app('a2', cands[1].id, 'new', { aiPending: true }),
      app('a3', cands[2].id, 'new', { aiEvaluations: [evalWith(91, cands[2])] }),
    ],
  });
});

afterEach(() => vi.useRealTimers());

const job = () => useStore.getState().jobs.find((j) => j.id === 'job-1')!;
const find = (id: string) => useStore.getState().applications.find((a) => a.id === id)!;
const renderDrawer = (id: string) =>
  render(<MemoryRouter><ApplicationDrawer appId={id} job={job()} onClose={() => {}} onMove={() => {}} /></MemoryRouter>);

describe('AI evaluation UI', () => {
  it('kanban card does not show the AI score badge', () => {
    render(<MemoryRouter><Board job={job()} /></MemoryRouter>);
    expect(within(screen.getByTestId('card-a1')).queryByText(/✦/)).toBeNull();
    expect(within(screen.getByTestId('card-a2')).queryByText('AI scoring…')).toBeNull();
  });

  it('sort by AI score puts the highest first and unevaluated last', () => {
    render(<MemoryRouter><Board job={job()} sort="ai" /></MemoryRouter>);
    const ids = screen.getAllByTestId(/^card-a/).map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual(['card-a3', 'card-a1', 'card-a2']);
  });

  it('list view keeps the AI order within a stage', () => {
    // Default list order is longest-waiting first (a2, a1, a3); AI order must win instead (a3, a1, a2).
    const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
    const entered: Record<string, string> = { a2: daysAgo(3), a1: daysAgo(2), a3: daysAgo(0) };
    useStore.setState({ applications: useStore.getState().applications.map((a) => ({ ...a, stageEnteredAt: entered[a.id] })) });
    render(<MemoryRouter><Board job={job()} view="list" sort="ai" /></MemoryRouter>);
    const rows = screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
    const order = [cands[2].name, cands[0].name, cands[1].name].map((n) => rows.findIndex((r) => r.includes(n)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it('findings are translated in Vietnamese', () => {
    const c = { ...cands[0], skills: ['React'], primarySkills: undefined, secondarySkills: undefined, experience: undefined, cv: '' };
    const e = evaluateApplication(c, { stack: ['React', 'Vue'] }, at, 'ai-vi');
    useStore.setState({ applications: useStore.getState().applications.map((a) => (a.id === 'a1' ? { ...a, aiEvaluations: [e] } : a)), ui: { ...useStore.getState().ui, lang: 'vi' } });
    renderDrawer('a1');
    expect(screen.getByText('Có React')).toBeInTheDocument();
    expect(screen.getByText('Không thấy Vue')).toBeInTheDocument();
    expect(screen.getByText('Xác minh kinh nghiệm thực tế với Vue.')).toBeInTheDocument();
  });

  it('queue drains a pending application once', () => {
    vi.useFakeTimers();
    function Q() { useAiQueue(2000); return null; }
    render(<Q />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(find('a2').aiPending).toBeFalsy();
    expect(find('a2').aiEvaluations).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(find('a2').aiEvaluations).toHaveLength(1);
  });

  it('drawer shows breakdown, findings, disclaimer and a link to the CV', () => {
    renderDrawer('a1');
    const section = screen.getByRole('region', { name: 'AI evaluation' });
    expect(within(section).getByText('55')).toBeInTheDocument();
    for (const label of ['Stack', 'Experience', 'Domain', 'English']) expect(within(section).getByText(label)).toBeInTheDocument();
    expect(within(section).getByText('AI suggests only. HR makes the decision.')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /Open original CV/ })).toHaveAttribute('href', `/candidates/${cands[0].id}`);
  });

  it('the skills-only note appears only under stack strengths', () => {
    const c = { ...cands[0], cv: '', experience: [], skills: ['React'], seniority: 'Senior', english: 'Fluent' };
    useStore.setState({ ui: { ...useStore.getState().ui, lang: 'en' } });
    const e = evaluateApplication(c, { stack: ['React'], seniority: 'Junior', english: 'Basic' }, at, 'ai-x');
    useStore.setState({ applications: useStore.getState().applications.map((a) => (a.id === 'a1' ? { ...a, aiEvaluations: [e] } : a)) });
    renderDrawer('a1');
    expect(e.strengths).toHaveLength(3);
    expect(screen.getAllByText('Listed in profile skills')).toHaveLength(1);
  });

  it('re-run adds a version', () => {
    renderDrawer('a1');
    fireEvent.click(screen.getByRole('button', { name: 'Re-run' }));
    expect(find('a1').aiEvaluations).toHaveLength(2);
    expect(screen.getByText(/version 2/)).toBeInTheDocument();
  });

  it('re-run is hidden once handed off', () => {
    useStore.setState({ applications: useStore.getState().applications.map((a) => (a.id === 'a1' ? { ...a, stage: 'hired', handoff: { at, by: 'u-thu', target: 'x' } } : a)) });
    renderDrawer('a1');
    expect(screen.queryByRole('button', { name: 'Re-run' })).toBeNull();
  });

  it('an interviewer awaiting their scorecard does not see the AI section', () => {
    useStore.setState({
      applications: useStore.getState().applications.map((a) => (a.id === 'a1'
        ? { ...a, stage: 'interview', interviews: [{ id: 'iv', round: 'Tech', at: '2026-11-20T10:00', durationMin: 60, mode: 'online', place: 'x', interviewers: ['u-quang'], status: 'scheduled', scorecards: [], createdBy: 'u-thu' }] }
        : a)),
    });
    signInAs('u-quang');
    renderDrawer('a1');
    expect(screen.queryByRole('region', { name: 'AI evaluation' })).toBeNull();
  });
});

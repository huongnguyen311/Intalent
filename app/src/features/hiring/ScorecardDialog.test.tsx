import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Interview } from '../../domain/types';
import { useStore } from '../../store/store';
import { signInAs } from '../../store/session';
import { ScorecardDialog } from './ScorecardDialog';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

/** A scheduled round on an application for the Senior Frontend Developer job (JD skills: React, TypeScript, Vue). */
function setup(round: string) {
  signInAs('u-admin');
  const s = useStore.getState();
  const app = s.applications.find((a) => a.jobId === 'job-1' && !a.handoff && a.stage !== 'hired' && a.stage !== 'rejected')!;
  const iv = s.scheduleInterview(app.id, { round, at: '2026-12-01T10:00', durationMin: 60, mode: 'online', place: '', interviewers: ['u-admin'] }, 'u-admin') as Interview;
  render(<ScorecardDialog open appId={app.id} interview={iv} onClose={() => {}} />);
  return { appId: app.id, ivId: iv.id };
}

const rate = (name: string, n: number) => fireEvent.click(within(screen.getByRole('group', { name })).getAllByRole('button')[n - 1]);

describe('ScorecardDialog', () => {
  it('scores a technical round on the JD skills and the engineering competencies', () => {
    setup('Technical interview');
    expect(screen.getByText('Technical round: go deep on the skills this job needs.')).toBeInTheDocument();
    for (const s of ['React', 'TypeScript', 'Vue']) expect(screen.getByRole('group', { name: s })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Code quality & system design' })).toBeInTheDocument();
    // Skills are optional: only the competencies and the recommendation are asked for.
    expect(screen.getByText('Still needed: Problem solving, Code quality & system design, Communication, Culture & team fit, Recommendation')).toBeInTheDocument();
  });

  it('a final round asks about motivation too, and saves the criteria with the scores', () => {
    const { appId, ivId } = setup('Final interview');
    rate('React', 4);
    for (const c of ['Problem solving', 'Code quality & system design', 'Communication', 'Culture & team fit', 'Motivation & expectations']) rate(c, 3);
    fireEvent.click(screen.getByLabelText('Yes'));
    expect(screen.queryByText(/Still needed/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    const card = useStore.getState().applications.find((a) => a.id === appId)!.interviews!.find((i) => i.id === ivId)!.scorecards[0];
    expect(card.scores).toEqual({ 'skill:React': 4, problem: 3, design: 3, communication: 3, culture: 3, motivation: 3 });
    expect(card.criteria?.map((c) => c.key)).toContain('skill:Vue');
    signInAs(undefined);
  });
});

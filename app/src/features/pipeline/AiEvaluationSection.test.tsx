import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { evaluateApplication } from '../../domain/aiEvaluation';
import type { Application } from '../../domain/types';
import { useStore } from '../../store/store';
import { AiEvaluationSection } from './AiEvaluationSection';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const at = '2026-11-18T08:00:00.000Z';
let app: Application;

beforeEach(() => {
  const seed = buildSeed();
  useStore.setState({ ...seed, ui: { ...seed.ui, lang: 'en', actingAs: undefined } });
  const c = { ...seed.candidates[0], skills: [], seniority: '', cv: '', experience: [] };
  const e = evaluateApplication(c, { stack: ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'], seniority: 'Senior', years: 5 }, at, 'ai-long');
  app = {
    id: 'a', candidateId: c.id, jobId: 'job-1', stage: 'new', source: 'x', via: 'careers', addedBy: 'x', addedAt: at,
    stageEnteredAt: at, history: [], comments: [], aiEvaluations: [e],
  };
});

const section = () => render(<MemoryRouter><AiEvaluationSection app={app} /></MemoryRouter>);

describe('AiEvaluationSection', () => {
  it('shows three gaps and folds the rest behind "+N more"', () => {
    section();
    const gaps = screen.getByText('Gaps').parentElement!;
    expect(within(gaps).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(within(gaps).getByRole('button', { name: '+4 more' }));
    expect(within(gaps).getAllByRole('listitem')).toHaveLength(7);
    expect(within(gaps).getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('leaves out an unknown level instead of printing a dash', () => {
    section();
    fireEvent.click(within(screen.getByText('Gaps').parentElement!).getByRole('button', { name: /more/ }));
    expect(screen.getByText('~0 yrs vs required Senior, 5+ yrs')).toBeInTheDocument();
  });
});

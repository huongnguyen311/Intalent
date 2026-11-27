import { render, screen } from '@testing-library/react';
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
  it('reads as a score with a word, a table per requirement and the missing skills', () => {
    section();
    expect(screen.getByText('Weak match')).toBeInTheDocument();
    const skills = screen.getByRole('rowheader', { name: 'Skills' }).closest('tr')!;
    expect(skills).toHaveTextContent('6 skills');
    expect(skills).toHaveTextContent('None');
    expect(screen.getByText('A1, B2, C3, D4, E5, F6')).toBeInTheDocument();
  });

  it('puts the JD requirement next to what the CV shows, leaving out an unknown level', () => {
    section();
    const exp = screen.getByRole('rowheader', { name: 'Experience' }).closest('tr')!;
    expect(exp).toHaveTextContent('Senior, 5+ yrs');
    expect(exp).toHaveTextContent('~0 yrs');
    expect(exp).not.toHaveTextContent('-,');
    // Domain and English were not asked for: said in words, full points.
    expect(screen.getAllByText('Not required')).toHaveLength(2);
  });
});

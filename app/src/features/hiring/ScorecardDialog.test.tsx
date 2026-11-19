import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Interview } from '../../domain/types';
import { ScorecardDialog } from './ScorecardDialog';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const iv = { id: 'iv', round: 'Tech', at: '2026-11-20T10:00', durationMin: 60, mode: 'online', place: '', interviewers: [], status: 'scheduled', scorecards: [], createdBy: 'x' } as Interview;

describe('ScorecardDialog', () => {
  it('says what is still missing while Submit is disabled', () => {
    render(<ScorecardDialog open appId="a" interview={iv} onClose={() => {}} />);
    expect(screen.getByText('Still needed: Technical skills, Communication, Problem solving, Culture fit, Recommendation')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Technical skills' })).getAllByRole('button')[3]);
    fireEvent.click(screen.getByLabelText('Yes'));
    expect(screen.getByText('Still needed: Communication, Problem solving, Culture fit')).toBeInTheDocument();
    for (const c of ['Communication', 'Problem solving', 'Culture fit']) fireEvent.click(within(screen.getByRole('group', { name: c })).getAllByRole('button')[2]);
    expect(screen.queryByText(/Still needed/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { PipelineConfigDrawer } from './PipelineConfigDrawer';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

const job = () => useStore.getState().jobs.find((j) => j.id === 'job-1')!;
const open = () => render(<PipelineConfigDrawer job={job()} open onClose={() => {}} />);
const rows = () => screen.getAllByTestId(/^col-/).map((el) => el.dataset.testid);

describe('PipelineConfigDrawer columns', () => {
  it('starts with the 7 basic columns', () => {
    open();
    expect(rows()).toEqual(['col-new', 'col-screening', 'col-interview', 'col-final_interview', 'col-offer', 'col-hired', 'col-rejected']);
  });

  it('Add column offers no Assessment, Withdrawn or custom column', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items).toEqual(['AI Screening']);
  });

  it('adds a column before Offer, renames, reorders and removes columns, then saves', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'AI Screening' }));
    expect(rows()).toEqual(['col-new', 'col-screening', 'col-interview', 'col-final_interview', 'col-ai_screening', 'col-offer', 'col-hired', 'col-rejected']);
    fireEvent.change(within(screen.getByTestId('col-screening')).getByRole('textbox'), { target: { value: 'CV review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move AI Screening left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove 2nd Interview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(job().pipeline).toEqual(['screening', 'interview', 'ai_screening', 'offer']);
    expect(job().stageNames).toEqual({ screening: 'CV review' });
  });

  it('New, Hired and Rejected cannot be removed', () => {
    open();
    for (const s of ['New', 'Hired', 'Rejected']) expect(screen.queryByRole('button', { name: `Remove ${s}` })).not.toBeInTheDocument();
  });
});

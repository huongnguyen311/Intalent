import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '../../components/Toast';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { IntakeModal } from './IntakeModal';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.mocked(toast).mockClear();
  useStore.setState({ ...buildSeed(), candidates: [], notes: [], applications: [], activities: [] });
});

describe('IntakeModal', () => {
  it('step 1 offers Talent Pool and Note with explanations', () => {
    render(<IntakeModal open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Add to Talent Pool/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to Note/ })).toBeInTheDocument();
    expect(screen.getByText(/The person is not added to the Talent Pool/)).toBeInTheDocument();
  });

  it('Add to Note does not create a candidate', () => {
    const onClose = vi.fn();
    render(<IntakeModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to Note/ }));
    type(/^Name/, 'Lan Pham');
    type(/Contact/, 'lan@example.com');
    type(/^Note/, 'Met at a meetup');
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    const s = useStore.getState();
    expect(s.candidates).toHaveLength(0);
    expect(s.notes).toHaveLength(1);
    expect(s.notes[0]).toMatchObject({ name: 'Lan Pham', contact: 'lan@example.com', text: 'Met at a meetup' });
    expect(toast).toHaveBeenCalledWith('Not added to Talent Pool', 'info');
    expect(onClose).toHaveBeenCalled();
  });

  it('Add to Talent Pool creates a profile, then a duplicate email updates the existing one', () => {
    render(<IntakeModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to Talent Pool/ }));
    type(/Full name/, 'Mai Le');
    type(/^Email/, 'mai@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    expect(useStore.getState().candidates).toHaveLength(1);
    expect(toast).toHaveBeenLastCalledWith('Added to Talent Pool', 'success');

    fireEvent.click(screen.getByRole('button', { name: /Add to Talent Pool/ }));
    type(/Full name/, 'Mai Le');
    type(/^Email/, 'MAI@example.com');
    type(/^Title/, 'Designer');
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    // Nothing is merged until HR confirms (PRD AC-11).
    expect(screen.getByText(/already belongs to Mai Le/)).toBeInTheDocument();
    expect(useStore.getState().candidates[0].title).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Merge into this profile' }));
    expect(useStore.getState().candidates).toHaveLength(1);
    expect(useStore.getState().candidates[0].title).toBe('Designer');
    expect(toast).toHaveBeenLastCalledWith('Existing profile updated', 'info');
  });

  it('requires a name and an email or phone', () => {
    render(<IntakeModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to Talent Pool/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(useStore.getState().candidates).toHaveLength(0);
    type(/Full name/, 'Mai Le');
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    expect(screen.getByText('Add an email or a phone number')).toBeInTheDocument();
  });

  it('saves the chosen source and tags on the profile and the application', () => {
    const job = useStore.getState().jobs.find((j) => j.status === 'open')!;
    render(<IntakeModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to Talent Pool/ }));
    expect(screen.getByLabelText('Source')).toHaveValue('Manual');
    type(/Full name/, 'Mai Le');
    type(/^Email/, 'mai@example.com');
    type(/^Source/, 'Meetup');
    type(/^Tags/, 'referral, vip');
    type(/Also add to job/, job.id);
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    const s = useStore.getState();
    expect(s.candidates[0]).toMatchObject({ source: 'Meetup', tags: ['referral', 'vip'] });
    expect(s.applications[0]).toMatchObject({ source: 'Meetup', via: 'manual' });
  });

  it('a picked CV prefills empty fields only and never the email', () => {
    render(<IntakeModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to Talent Pool/ }));
    type(/Full name/, 'Typed Name');
    fireEvent.change(screen.getByLabelText(/^CV file/), { target: { files: [new File(['x'], 'Tran_Van_Binh_CV.pdf')] } });
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Typed Name');
    expect(screen.getByLabelText(/^Email/)).toHaveValue('');
    expect((screen.getByLabelText(/^Phone/) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).not.toBe('');
    expect((screen.getByLabelText(/^Skills/) as HTMLInputElement).value).not.toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    expect(useStore.getState().candidates[0].cv).toBe('Tran_Van_Binh_CV.pdf');
  });

  it('rejects a CV of the wrong type', () => {
    render(<IntakeModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to Talent Pool/ }));
    fireEvent.change(screen.getByLabelText(/^CV file/), { target: { files: [new File(['x'], 'cv.exe')] } });
    expect(screen.getByText('Only PDF, DOCX or TXT files are accepted')).toBeInTheDocument();
  });

  it('optionally adds the new candidate to a job', () => {
    const job = useStore.getState().jobs.find((j) => j.status === 'open')!;
    render(<IntakeModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add to Talent Pool/ }));
    type(/Full name/, 'Mai Le');
    type(/^Email/, 'mai@example.com');
    type(/Also add to job/, job.id);
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    const s = useStore.getState();
    expect(s.applications).toHaveLength(1);
    expect(s.applications[0]).toMatchObject({ jobId: job.id, candidateId: s.candidates[0].id });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { NotesPage } from './NotesPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <NotesPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed(), candidates: [], notes: [], applications: [], activities: [] });
});

describe('NotesPage', () => {
  it('renders empty state', () => {
    renderPage();
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('convert to Talent Pool links the note', () => {
    useStore.getState().addNote({ name: 'Lan Pham', contact: 'lan@example.com', text: 'Met at a meetup' }, 'u-admin');
    renderPage();
    expect(screen.getByText('Lan Pham')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Convert to Talent Pool' }));
    const s = useStore.getState();
    expect(s.candidates).toHaveLength(1);
    expect(s.notes[0].convertedToCandidateId).toBe(s.candidates[0].id);
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', `/candidates/${s.candidates[0].id}`);
    expect(screen.queryByRole('button', { name: 'Convert to Talent Pool' })).toBeNull();
  });
});

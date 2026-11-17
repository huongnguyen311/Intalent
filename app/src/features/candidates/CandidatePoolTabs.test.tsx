import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { AppRoutes } from '../../routes';
import { useStore } from '../../store/store';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
      <Loc />
    </MemoryRouter>,
  );

beforeEach(() => {
  window.history.pushState({}, '', '/');
  useStore.setState({ ...buildSeed(), notes: [] });
  useStore.getState().addNote({ name: 'Lan Pham', contact: 'lan@example.com', text: 'Met at a meetup' }, 'u-admin');
});

describe('Candidate pool tabs', () => {
  it('notes route redirects to candidates notes tab', () => {
    renderAt('/notes');
    expect(screen.getByTestId('loc')).toHaveTextContent('/candidates?tab=notes');
    expect(screen.getByText('Lan Pham')).toBeInTheDocument();
  });

  it('notes tab lists notes and convert still works', () => {
    renderAt('/candidates?tab=notes');
    const before = useStore.getState().candidates.length;
    fireEvent.click(screen.getByRole('button', { name: 'Convert to Talent Pool' }));
    const s = useStore.getState();
    expect(s.candidates).toHaveLength(before + 1);
    expect(s.notes[0].convertedToCandidateId).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View profile' })).toBeInTheDocument();
  });

  it('profiles tab is default', () => {
    renderAt('/candidates');
    expect(screen.getByRole('button', { name: 'Profiles' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Lan Pham')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByText('Lan Pham')).toBeInTheDocument();
  });

  it('fixture mode shows no tabs or switch', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    renderAt('/candidates');
    expect(screen.queryByRole('button', { name: 'Profiles' })).toBeNull();
  });

  it('fixture mode keeps the notes page at /notes', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    renderAt('/notes');
    expect(screen.getByTestId('loc')).toHaveTextContent('/notes');
    expect(screen.getByText('Lan Pham')).toBeInTheDocument();
  });
});

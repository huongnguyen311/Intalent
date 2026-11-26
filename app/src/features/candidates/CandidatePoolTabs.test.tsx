import { render, screen } from '@testing-library/react';
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

describe('Candidate pool without a Notes tab', () => {
  it('old notes links land on the pool', () => {
    renderAt('/notes');
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/candidates$/);
    expect(screen.queryByText('Lan Pham')).toBeNull();
  });

  it('the pool shows no Profiles / Notes switch', () => {
    renderAt('/candidates');
    expect(screen.queryByRole('button', { name: 'Profiles' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull();
  });

  it('fixture mode keeps the notes page at /notes', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    renderAt('/notes');
    expect(screen.getByTestId('loc')).toHaveTextContent('/notes');
    expect(screen.getByText('Lan Pham')).toBeInTheDocument();
  });
});

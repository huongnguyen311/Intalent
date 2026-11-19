import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { JdMatchingPage } from './JdMatchingPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

function Profile() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>back</button>;
}

const wrap = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/jd-matching" element={<JdMatchingPage />} />
        <Route path="/candidates/:id" element={<Profile />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('JD Matching flow', () => {
  it('keeps the score filter after opening a candidate and coming back', () => {
    wrap('/jd-matching?jd=jd-2026-004');
    fireEvent.click(screen.getByRole('button', { name: /Score: ≥ 60/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Score: All' }));
    const first = document.querySelector('.jm-row') as HTMLElement;
    fireEvent.click(first);
    fireEvent.click(screen.getByText('back'));
    expect(screen.getByRole('button', { name: /Score: All/ })).toBeInTheDocument();
    expect(document.querySelectorAll('.jm-row').length).toBeGreaterThan(0);
  });

  it('offers a lower threshold when nobody reaches the score', () => {
    wrap('/jd-matching?jd=jd-2026-004&min=80');
    const lower = screen.getByRole('button', { name: /Show candidates scoring ≥ \d+/ });
    fireEvent.click(lower);
    expect(document.querySelectorAll('.jm-row').length).toBeGreaterThan(0);
  });

  it('adds a ranked candidate to a job without leaving the list', () => {
    wrap('/jd-matching?jd=jd-2026-002');
    const row = document.querySelector('.jm-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Add to job' }));
    expect(screen.getByRole('dialog', { name: 'Add to Pipeline' })).toBeInTheDocument();
    expect(screen.queryByText('back')).toBeNull();
  });
});

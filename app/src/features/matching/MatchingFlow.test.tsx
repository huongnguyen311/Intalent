import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { ANALYZE_MS, JdMatchingPage } from './JdMatchingPage';

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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const done = () => act(() => { vi.advanceTimersByTime(ANALYZE_MS); });

  it('keeps the applied score filter after opening a candidate and coming back', () => {
    wrap('/jd-matching?jd=jd-2026-004');
    done();
    fireEvent.change(screen.getByRole('slider', { name: 'Min match score' }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    done();
    fireEvent.click(within(screen.getAllByTestId('match-card')[0]).getByRole('button', { name: 'View profile' }));
    fireEvent.click(screen.getByText('back'));
    done();
    expect(screen.getByRole('slider', { name: 'Min match score' })).toHaveValue('0');
    expect(screen.getAllByTestId('match-card').length).toBeGreaterThan(0);
  });

  it('offers a lower threshold when nobody reaches the score', () => {
    wrap('/jd-matching?jd=jd-2026-004&min=100');
    done();
    fireEvent.click(screen.getByRole('button', { name: /Show (candidates scoring ≥ \d+|all candidates)/ }));
    done();
    expect(screen.getAllByTestId('match-card').length).toBeGreaterThan(0);
  });

  it('adds a ranked candidate to a job without leaving the list', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    fireEvent.click(within(screen.getAllByTestId('match-card')[0]).getByRole('button', { name: /Add to job/ }));
    expect(screen.getByRole('dialog', { name: 'Add to Pipeline' })).toBeInTheDocument();
    expect(screen.queryByText('back')).toBeNull();
  });
});

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
    fireEvent.change(screen.getByRole('combobox', { name: 'Min match score' }), { target: { value: '0' } });
    done();
    fireEvent.click(within(screen.getAllByTestId('match-card')[0]).getByRole('button', { name: 'View profile' }));
    fireEvent.click(screen.getByText('back'));
    done();
    expect(screen.getByRole('combobox', { name: 'Min match score' })).toHaveValue('0');
    expect(screen.getAllByTestId('match-card').length).toBeGreaterThan(0);
  });

  it('offers a lower threshold when nobody reaches the score', () => {
    wrap('/jd-matching?jd=jd-2026-004&min=100');
    done();
    fireEvent.click(screen.getByRole('button', { name: /Show (candidates scoring ≥ \d+|all candidates)/ }));
    done();
    expect(screen.getAllByTestId('match-card').length).toBeGreaterThan(0);
  });

  const top = () => useStore.getState().candidates.find((c) => c.name === 'Lam Bao Ngoc')!;
  const cardOf = (name: string) => screen.getAllByTestId('match-card').find((c) => c.getAttribute('aria-label') === name);

  it('never ranks anonymized profiles', () => {
    const id = top().id;
    useStore.setState({ candidates: useStore.getState().candidates.map((c) => (c.id === id ? { ...c, anonymizedAt: '2026-11-01' } : c)) });
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    expect(cardOf('Lam Bao Ngoc')).toBeUndefined();
    expect(screen.getByText(/anonymized profiles are not ranked/)).toBeInTheDocument();
  });

  it('flags do-not-hire candidates and offers no way to add them', () => {
    const id = top().id;
    useStore.setState({ candidates: useStore.getState().candidates.map((c) => (c.id === id ? { ...c, doNotHire: { reason: 'No-show', by: 'u', at: '2026-10-01' } } : c)) });
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    const card = cardOf('Lam Bao Ngoc')!;
    expect(within(card).getByText('Do not hire')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Add to job/ })).toBeNull();
    expect(within(card).getByRole('checkbox', { name: 'Select Lam Bao Ngoc' })).toBeDisabled();
  });

  it('marks candidates already in a pipeline for this JD', () => {
    const s = useStore.getState();
    const job = s.jobs.find((j) => j.jdId === 'jd-2026-002')!;
    s.addToPipeline(top().id, job.id, { by: 'u-admin', source: 'Talent pool' } as never);
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    const card = cardOf('Lam Bao Ngoc')!;
    expect(within(card).getByText(/In pipeline ·/)).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Add to job/ })).toBeNull();
  });

  it('header names the JD as plain text (no switcher), and English shows on the card', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    expect(screen.getByText('Senior Frontend Developer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change job description' })).toBeNull();
    expect(screen.queryByText(/Matching against/)).toBeNull();
    expect(within(cardOf('Lam Bao Ngoc')!).getByText('Advanced')).toBeInTheDocument();
  });

  it('flags values below the JD in amber, leaving the rest plain', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    // JD asks for Intermediate English; Kieu Anh Duy has Basic, Lam Bao Ngoc has Advanced.
    expect(within(cardOf('Kieu Anh Duy')!).getByText(/Below the JD \(Intermediate\)/)).toBeInTheDocument();
    expect(within(cardOf('Lam Bao Ngoc')!).queryByText(/Below the JD/)).toBeNull();
  });

  it('skills and domains sit in separate sections; every skill shows, gaps first', () => {
    wrap('/jd-matching?jd=jd-2026-005&min=0');
    done();
    const card = screen.getAllByTestId('match-card')[0];
    const skills = within(card).getByRole('region', { name: 'Skills' });
    const domains = within(card).getByRole('region', { name: 'Domain' });
    expect(within(skills).getAllByText(/^(Has|missing)/)).toHaveLength(12);
    expect(within(skills).queryByText('Fintech')).toBeNull();
    expect(within(domains).getByText('Fintech')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /more$/ })).toBeNull();
    // A gap comes before any skill the candidate has.
    const status = within(skills).getAllByText(/^(Has|missing)/).map((e) => e.textContent!.startsWith('missing'));
    expect(status.indexOf(false)).toBeGreaterThan(status.lastIndexOf(true));
  });

  it('has no avatar initials on the cards', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    expect(within(cardOf('Lam Bao Ngoc')!).queryByText('LN')).toBeNull();
  });

  it('table layout: one row per candidate, header click sorts, choice kept in the URL', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    fireEvent.click(screen.getByRole('button', { name: /Table/ }));
    const table = screen.getByTestId('match-table');
    expect(within(table).getAllByTestId('match-row').length).toBe(screen.getAllByTestId('match-card').length);
    fireEvent.click(within(table).getByRole('button', { name: /Rate/ }));
    const rates = within(screen.getByTestId('match-table')).getAllByTestId('match-row')
      .map((r) => /\$(\d{1,3}(?:,\d{3})*)/.exec(r.textContent ?? '')?.[1]).filter(Boolean).map((n) => Number(n!.replace(/,/g, '')));
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(within(screen.getByTestId('match-table')).getByRole('columnheader', { name: /Rate/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('selects several candidates and adds them together', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    const bar = screen.getByRole('region', { name: 'Selection' });
    // Nothing picked: the toolbar shows the count, no add button.
    expect(within(bar).getByText(/candidates scoring/)).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: /to job/ })).toBeNull();
    const boxes = screen.getAllByRole('checkbox', { name: /^Select (?!all)/ }).filter((b) => !(b as HTMLInputElement).disabled);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole('button', { name: /Add 2 to job/ }));
    expect(screen.getByRole('dialog', { name: 'Add to Pipeline' })).toBeInTheDocument();
  });

  it('select all on this page picks only candidates that can be added', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    const enabled = screen.getAllByRole('checkbox', { name: /^Select (?!all)/ }).filter((b) => !(b as HTMLInputElement).disabled);
    expect(enabled.every((b) => (b as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(`${enabled.length} selected`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText(/candidates scoring/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select all on this page' })).not.toBeChecked();
  });

  it('filters show their value in place; Clear all appears only when something differs from the default', () => {
    wrap('/jd-matching?jd=jd-2026-002&loc=Hanoi');
    done();
    expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('Hanoi');
    for (const card of screen.queryAllByTestId('match-card')) expect(card.textContent).not.toMatch(/Ho Chi Minh City/);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    done();
    expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Apply filters/ })).toBeNull();
  });

  it('filters are one compact row that applies on change; no "More filters"', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    expect(screen.queryByRole('button', { name: /More filters/ })).toBeNull();
    expect(screen.queryByLabelText('Min English')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Location' }), { target: { value: 'Hanoi' } });
    done();
    const pool = useStore.getState().candidates;
    for (const card of screen.getAllByTestId('match-card')) {
      const c = pool.find((x) => x.name === card.getAttribute('aria-label'))!;
      expect([undefined, 'Hanoi']).toContain(c.location);
    }
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
  });

  it('has no Sort by box; a sort set from the table header still applies to cards', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0&sort=rate');
    done();
    expect(screen.queryByRole('combobox', { name: 'Sort by' })).toBeNull();
    const rates = screen.getAllByTestId('match-card')
      .map((c) => /\$([\d,]+)\/mo/.exec(c.textContent ?? '')?.[1])
      .filter(Boolean)
      .map((n) => Number(n!.replace(/,/g, '')));
    expect(rates.length).toBeGreaterThan(1);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
  });

  it('adds a ranked candidate to a job without leaving the list', () => {
    wrap('/jd-matching?jd=jd-2026-002&min=0');
    done();
    fireEvent.click(within(screen.getAllByTestId('match-card')[0]).getByRole('button', { name: /Add to job/ }));
    expect(screen.getByRole('dialog', { name: 'Add to Pipeline' })).toBeInTheDocument();
    expect(screen.queryByText('back')).toBeNull();
  });
});

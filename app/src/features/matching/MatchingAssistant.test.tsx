import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockupFixture } from '../../data/fixtureMockup';
import { buildSeed } from '../../data/seed';
import { parseQuery, searchCandidates } from '../../domain/scoring';
import { useStore } from '../../store/store';
import { AssistantPage } from '../assistant/AssistantPage';
import { ANALYZE_MS, JdMatchingPage } from './JdMatchingPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const wrap = (ui: React.ReactNode, url = '/') => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('JdMatchingPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const done = () => act(() => { vi.advanceTimersByTime(ANALYZE_MS); });
  const scores = () => [...document.querySelectorAll('[data-testid="match-score"]')].map((e) => Number(e.textContent));

  it('shows the AI analyzing state first, then ranked cards at or above the 70% default', () => {
    wrap(<JdMatchingPage />, '/jd-matching?jd=jd-2026-002');
    expect(screen.getByRole('status')).toHaveTextContent('AI is analyzing candidates…');
    done();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Matching Results' })).toBeInTheDocument();
    const s = scores();
    expect(s.length).toBeGreaterThan(0);
    expect(s).toEqual([...s].sort((a, b) => b - a));
    expect(Math.min(...s)).toBeGreaterThanOrEqual(70);
  });

  it('cards show experience, location and rate, and the info button explains the score', () => {
    wrap(<JdMatchingPage />, '/jd-matching?jd=jd-2026-002&min=0');
    done();
    const card = screen.getAllByTestId('match-card')[0];
    expect(within(card).getByText('Experience')).toBeInTheDocument();
    expect(within(card).getByText(/\/mo$|Contact for rate/)).toBeInTheDocument();
    expect(screen.getAllByText(/^(\d{2}\/\d{2}\/\d{4}|Now)$/).length).toBeGreaterThan(0);
    expect(within(card).getByRole('button', { name: 'View profile' })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Why this score' }));
    expect(screen.getByText('Tech stack')).toBeInTheDocument();
  });

  it('min score applies at once (re-running the match) and widens the list', () => {
    wrap(<JdMatchingPage />, '/jd-matching?jd=jd-2026-002');
    done();
    const count = () => Number(/^(\d+)/.exec(screen.getByText(/candidates scoring/).textContent!)![1]);
    const before = count();
    fireEvent.change(screen.getByRole('combobox', { name: 'Min match score' }), { target: { value: '0' } });
    expect(screen.getByRole('status')).toBeInTheDocument();
    done();
    expect(screen.getByText(/candidates scoring ≥ 0%/)).toBeInTheDocument();
    expect(count()).toBeGreaterThan(before);
  });

  it('max rate keeps candidates under the rate and those who did not state one', () => {
    wrap(<JdMatchingPage />, '/jd-matching?jd=jd-2026-002&min=0');
    done();
    const rate = screen.getByLabelText('Max rate (USD per month)');
    fireEvent.change(rate, { target: { value: '1000' } });
    fireEvent.keyDown(rate, { key: 'Enter' });
    done();
    const rates = [...document.querySelectorAll('[data-testid="match-card"]')].map((c) => /\$([\d,]+)\/mo/.exec(c.textContent!)?.[1]);
    expect(rates.length).toBeGreaterThan(0);
    for (const r of rates) if (r) expect(Number(r.replace(/,/g, ''))).toBeLessThanOrEqual(1000);
    expect(rates.some((r) => r === undefined)).toBe(true);
  });

  it('required skills default to the JD stack and drive the skill chips', () => {
    const jd = useStore.getState().jds.find((j) => j.id === 'jd-2026-002')!;
    wrap(<JdMatchingPage />, '/jd-matching?jd=jd-2026-002&min=0');
    done();
    const picker = screen.getByRole('button', { name: 'Required skills' });
    expect(picker).toHaveTextContent(jd.skills[0]);
    fireEvent.click(picker);
    fireEvent.click(screen.getByRole('checkbox', { name: jd.skills[0] }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    done();
    const text = screen.getAllByTestId('match-card')[0].textContent!;
    expect(text).not.toContain(`✓ ${jd.skills[0]}`);
    expect(text).not.toContain(`✕ ${jd.skills[0]}`);
  });

  it('shows an empty state instead of scoring everyone when there is no JD', () => {
    useStore.setState({ jds: [] });
    wrap(<JdMatchingPage />, '/jd-matching');
    done();
    expect(scores()).toHaveLength(0);
    expect(screen.getAllByText('Create a job description to run a match').length).toBeGreaterThan(0);
  });

  it('reproduces the mockup rows in fixture mode', () => {
    useStore.setState({ ...buildMockupFixture() });
    wrap(<JdMatchingPage />, '/jd-matching?min=0');
    done();
    expect(screen.getByText('Nguyen Hoang Long')).toBeInTheDocument();
    expect(scores()).toHaveLength(8);
  });
});

describe('AssistantPage', () => {
  const EXAMPLES_EN = ['Senior React, good English', 'Senior Java, Fintech', 'Python, 3 years experience'];
  const EXAMPLES_VI = ['Senior React, tiếng Anh tốt', 'Senior Java, mảng Fintech', 'Python, 3 năm kinh nghiệm'];
  const openHistory = () => fireEvent.click(screen.getByRole('button', { name: 'History' }));

  it('shows the welcome state with example chips, no disclaimer and no active chat', () => {
    useStore.setState({ chats: [] });
    wrap(<AssistantPage />);
    expect(screen.getByText('AI-Powered Candidate Search')).toBeInTheDocument();
    for (const e of EXAMPLES_EN) expect(screen.getByRole('button', { name: e })).toBeInTheDocument();
    expect(screen.queryByText(/AI generated responses/)).toBeNull();
  });

  it('every example query (en + vi) finds a top candidate with all requested skills', () => {
    const { candidates, taxonomy } = useStore.getState();
    for (const q of [...EXAMPLES_EN, ...EXAMPLES_VI]) {
      const req = parseQuery(q, taxonomy);
      const [top] = searchCandidates(candidates, req);
      expect(top, q).toBeDefined();
      expect(top.reason, q).not.toMatch(/missing/);
      expect(Object.keys(req).length, `${q} should use 2+ criteria`).toBeGreaterThanOrEqual(2);
    }
  });

  it('clicking an example fills the input without sending', () => {
    useStore.setState({ chats: [] });
    wrap(<AssistantPage />);
    fireEvent.click(screen.getByRole('button', { name: EXAMPLES_EN[0] }));
    expect(screen.getByPlaceholderText(/Ask follow-up/)).toHaveValue(EXAMPLES_EN[0]);
    expect(useStore.getState().chats).toHaveLength(0);
  });

  it('shows Vietnamese examples when the UI is in Vietnamese', () => {
    useStore.setState((s) => ({ chats: [], ui: { ...s.ui, lang: 'vi' } }));
    wrap(<AssistantPage />);
    expect(screen.getByRole('button', { name: 'Senior React, tiếng Anh tốt' })).toBeInTheDocument();
  });

  it('an unclear question gets a text reply asking for criteria, with no cards', () => {
    useStore.setState({ chats: [] });
    useStore.getState().sendChat(null, 'can you help me hire someone?');
    wrap(<AssistantPage />);
    openHistory();
    fireEvent.click(screen.getByRole('button', { name: 'can you help me hire someone?' }));
    expect(screen.getByText(/not quite sure what kind of candidate/)).toBeInTheDocument();
    expect(screen.getByText(/The main skill or tech stack/)).toBeInTheDocument();
    expect(screen.queryAllByTestId('assistant-score')).toHaveLength(0);
  });

  it('answers a query in prose with the top 3 candidate cards (up to 5), and keeps history', () => {
    vi.useFakeTimers();
    useStore.setState({ chats: [] });
    wrap(<AssistantPage />);
    fireEvent.change(screen.getByPlaceholderText(/Ask follow-up/), { target: { value: 'senior React' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    act(() => { vi.advanceTimersByTime(1000); });
    vi.useRealTimers();
    const cards = () => screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/candidates/'));
    expect(cards()).toHaveLength(3);
    expect(screen.getAllByText(/% match/).length).toBe(3);
    // the reply explains itself: what it understood, how many fit, who leads
    expect(screen.getByText("Here's what I understood you need:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/profiles in the talent pool fit/)).toBeInTheDocument();
    expect(screen.getByText(/leads at \d+%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show \d more/ }));
    expect(cards().length).toBeGreaterThan(3);
    expect(cards().length).toBeLessThanOrEqual(5);
    expect(screen.getByText('Best fit')).toBeInTheDocument();
    expect(screen.queryByText('You could ask next')).toBeNull();
    expect(useStore.getState().chats).toHaveLength(2);
    // history is closed until opened
    expect(screen.queryByText('Today')).toBeNull();
    openHistory();
    expect(screen.getByRole('dialog', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    // New chat lives in the header and returns to the welcome state
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'History' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /New chat/ }));
    expect(cards()).toHaveLength(0);
  });

  it('selecting a chat in the history panel opens it and closes the panel', () => {
    useStore.setState({ chats: [] });
    useStore.getState().sendChat(null, 'senior React');
    wrap(<AssistantPage />);
    openHistory();
    fireEvent.click(screen.getByText('senior React'));
    expect(screen.queryByRole('dialog', { name: 'History' })).toBeNull();
    expect(screen.getAllByText(/% match/).length).toBeGreaterThan(0);
  });

  it('history panel works from the keyboard: focus moves in, chats are buttons, focus returns on close', () => {
    useStore.setState({ chats: [] });
    useStore.getState().sendChat(null, 'senior React');
    wrap(<AssistantPage />);
    const trigger = screen.getByRole('button', { name: 'History' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'History' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'senior React' }));
    expect(screen.queryByRole('dialog', { name: 'History' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('history opens as a narrow right-hand drawer; backdrop and Close both close it', () => {
    wrap(<AssistantPage />);
    openHistory();
    const dialog = screen.getByRole('dialog', { name: 'History' });
    expect(dialog.className).toContain('max-w-sm');
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole('dialog', { name: 'History' })).toBeNull();
    openHistory();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'History' })).toBeNull();
  });

  it('empty history says so instead of showing a blank drawer', () => {
    useStore.setState({ chats: [] });
    wrap(<AssistantPage />);
    openHistory();
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });

  it('fixture mode shows the mockup history under Older with the welcome state', () => {
    useStore.setState({ ...buildMockupFixture() });
    wrap(<AssistantPage />);
    expect(screen.getByText('AI-Powered Candidate Search')).toBeInTheDocument();
    openHistory();
    expect(screen.getByText('Older')).toBeInTheDocument();
    expect(screen.getAllByText('Frontend Developer').length).toBeGreaterThanOrEqual(1);
  });

  it('deleting a conversation removes it from history', () => {
    useStore.setState({ chats: [] });
    useStore.getState().sendChat(null, 'senior React');
    wrap(<AssistantPage />);
    openHistory();
    fireEvent.click(screen.getByTitle('Delete'));
    expect(useStore.getState().chats).toHaveLength(0);
  });
});

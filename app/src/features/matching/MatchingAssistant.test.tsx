import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockupFixture } from '../../data/fixtureMockup';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { AssistantPage } from '../assistant/AssistantPage';
import { JdMatchingPage } from './JdMatchingPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const wrap = (ui: React.ReactNode, url = '/') => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('JdMatchingPage', () => {
  it('ranks store candidates with scoreCandidate and shows the weights', () => {
    wrap(<JdMatchingPage />, '/jd-matching?jd=jd-2026-002');
    expect(screen.getByText('Candidates scanned').nextSibling).toHaveTextContent(String(useStore.getState().candidates.length));
    for (const w of ['40%', '30%', '20%', '10%']) expect(screen.getByText(w)).toBeInTheDocument();
    const scores = [...document.querySelectorAll('.jm-score')].map((e) => Number(e.textContent));
    expect(scores.length).toBeGreaterThan(0);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(60);
  });

  it('score filter widens the list', () => {
    wrap(<JdMatchingPage />, '/jd-matching?jd=jd-2026-002');
    const topN = () => Number(/Top (\d+) of/.exec(screen.getByText(/Top \d+ of/).textContent!)![1]);
    const before = topN();
    fireEvent.click(screen.getByRole('button', { name: /Score: ≥ 60/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Score: All' }));
    expect(topN()).toBeGreaterThan(before);
  });

  it('reproduces the mockup run in fixture mode', () => {
    useStore.setState({ ...buildMockupFixture() });
    wrap(<JdMatchingPage />);
    expect(screen.getByText('781')).toBeInTheDocument();
    expect(screen.getByText('Nguyen Hoang Long')).toBeInTheDocument();
    expect(screen.getByText('Top 49 of 781 · sorted by match score')).toBeInTheDocument();
    expect(screen.getByText('20:41')).toBeInTheDocument();
    expect(document.querySelectorAll('.jm-score')).toHaveLength(8);
  });
});

describe('AssistantPage', () => {
  it('shows the welcome state with chips and no active chat', () => {
    useStore.setState({ chats: [] });
    wrap(<AssistantPage />);
    expect(screen.getByText('AI-Powered Candidate Search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Frontend Developer' })).toBeInTheDocument();
  });

  it('answers a query with ranked candidate cards linking to profiles, and keeps history', () => {
    useStore.setState({ chats: [] });
    wrap(<AssistantPage />);
    fireEvent.change(screen.getByPlaceholderText(/Ask follow-up/), { target: { value: 'senior React, good English' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/candidates/'));
    expect(links.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/% match/).length).toBe(links.length);
    expect(useStore.getState().chats).toHaveLength(2);
    // history lists the conversation under Today; New chat returns to the welcome state
    expect(screen.getByText('Today')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New chat/ }));
    expect(screen.getByText('AI-Powered Candidate Search')).toBeInTheDocument();
  });

  it('fixture mode shows the mockup history under Older with the welcome state', () => {
    useStore.setState({ ...buildMockupFixture() });
    wrap(<AssistantPage />);
    expect(screen.getByText('Older')).toBeInTheDocument();
    expect(screen.getAllByText('Frontend Developer').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('AI-Powered Candidate Search')).toBeInTheDocument();
  });

  it('deleting a conversation removes it from history', () => {
    useStore.setState({ chats: [] });
    useStore.getState().sendChat(null, 'senior React');
    wrap(<AssistantPage />);
    fireEvent.click(screen.getByTitle('Delete'));
    expect(useStore.getState().chats).toHaveLength(0);
  });
});

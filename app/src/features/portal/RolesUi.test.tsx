import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { AppRoutes } from '../../routes';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );

beforeEach(() => {
  window.localStorage.clear();
  const seed = buildSeed(undefined, Date.parse('2026-11-16T10:00:00Z'));
  useStore.setState({ ...seed, ui: { ...seed.ui, careersLang: 'en' } });
});

describe('roles in the internal app', () => {
  it('Hiring Manager sees only own jobs, no config or Talent Pool in the menu', () => {
    signInAs('u-nam');
    renderAt('/jobs');
    const own = useStore.getState().jobs.filter((j) => j.hiringManager === 'u-nam');
    const other = useStore.getState().jobs.find((j) => j.hiringManager !== 'u-nam')!;
    for (const j of own) expect(screen.getByText(j.title)).toBeInTheDocument();
    expect(screen.queryByText(other.title)).toBeNull();
    expect(screen.queryByRole('button', { name: /New job/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Candidate Pool/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Configuration/ })).toBeNull();
  });

  it('blocks a page the role cannot open', () => {
    signInAs('u-huy');
    renderAt('/users');
    expect(screen.getAllByText('No access').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Go to my start page' })).toHaveAttribute('href', '/');
  });

  it('Interviewer lands on My interviews and can only score', () => {
    signInAs('u-quang');
    renderAt('/');
    expect(screen.getAllByText('My interviews').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Pipeline/ })).toBeNull();
  });

  it('Recruiters see a pending-review count and can approve a proposal', () => {
    signInAs('u-huy');
    const c = useStore.getState().candidates.find((x) => x.suggestions?.length)!;
    renderAt(`/candidates/${c.id}`);
    const panel = screen.getByTestId('suggestions-review');
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Approve' })[0]);
    expect(useStore.getState().candidates.find((x) => x.id === c.id)!.suggestions).toHaveLength(1);
    expect(screen.getByTestId('cv-versions')).toBeInTheDocument();
  });
});

describe('candidate portal', () => {
  it('signs in by email, updates contact at once and sends standardised fields for review', () => {
    const acct = useStore.getState().users.find((u) => u.candidateId)!;
    renderAt('/careers/login');
    fireEvent.change(screen.getByLabelText('Email or phone number'), { target: { value: acct.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByTestId('candidate-portal')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Hue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useStore.getState().candidates.find((c) => c.id === acct.candidateId)!.location).toBe('Hue');

    const before = useStore.getState().candidates.find((c) => c.id === acct.candidateId)!;
    fireEvent.change(screen.getByLabelText('Skills (comma separated)'), { target: { value: 'Kotlin, Swift' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to HR for review' }));
    const after = useStore.getState().candidates.find((c) => c.id === acct.candidateId)!;
    expect(after.skills).toEqual(before.skills);
    expect(after.suggestions?.find((s) => s.field === 'skills')?.value).toEqual(['Kotlin', 'Swift']);
  });

  it('rejects an unknown email and keeps candidates out of internal pages', () => {
    renderAt('/careers/login');
    fireEvent.change(screen.getByLabelText('Email or phone number'), { target: { value: 'ghost@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no profile');
  });

  it('a signed-in candidate opening an internal page lands on their profile', () => {
    signInAs(useStore.getState().users.find((u) => u.candidateId)!.id);
    renderAt('/candidates');
    expect(screen.getByTestId('candidate-portal')).toBeInTheDocument();
  });
});

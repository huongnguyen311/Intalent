import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../routes';
import { jobsInScope } from '../../domain/permissions';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('Login and Dashboard screens', () => {
  it('login submit navigates to the dashboard', () => {
    at('/login');
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: 'admin@company.demo' } });
    fireEvent.click(screen.getByRole('button', { name: /Log In/ }));
    expect(screen.getByTestId('dashboard-recruitment')).toBeInTheDocument();
  });

  it('google sign-in navigates to the dashboard', () => {
    at('/login');
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/ }));
    expect(screen.getByTestId('dashboard-recruitment')).toBeInTheDocument();
  });

  it('dashboard defaults to All and shows the recruitment row outside fixture mode', () => {
    at('/');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('dashboard-recruitment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Recruiter' })).toBeInTheDocument();
  });

  it('a recruiter sees open jobs for their own jobs only, and the card opens the job list', () => {
    const { jobs } = useStore.getState();
    signInAs('u-huy');
    const mine = jobsInScope(useStore.getState().users.find((u) => u.id === 'u-huy'), jobs).filter((j) => j.status === 'open').length;
    expect(mine).toBeLessThan(jobs.filter((j) => j.status === 'open').length);
    at('/');
    const card = screen.getByRole('link', { name: /Open Jobs/i });
    expect(card).toHaveTextContent(String(mine));
    expect(card).toHaveAttribute('href', '/jobs?status=open');
    // Their dashboard is already their own jobs: no recruiter filter, only the job filter.
    expect(screen.queryByRole('combobox', { name: 'Recruiter' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Job' })).toBeInTheDocument();
    signInAs(undefined);
  });
});

describe('Dashboard hiring urgency tiles', () => {
  it('counts open urgent and overdue jobs in scope and links to the filtered Jobs list', async () => {
    const { isOverdue, isUrgent, todayIso } = await import('../../domain/jobUrgency');
    const { buildSeed } = await import('../../data/seed');
    useStore.setState({ ...buildSeed() });
    const st = useStore.getState();
    const open = st.jobs.filter((j) => j.status === 'open');
    at('/dashboard');
    const urgent = screen.getByTestId('tile-urgent-jobs');
    const overdue = screen.getByTestId('tile-overdue-jobs');
    expect(urgent).toHaveTextContent(String(open.filter(isUrgent).length));
    expect(overdue).toHaveTextContent(String(open.filter((j) => isOverdue(j, st.applications, todayIso())).length));
    expect(urgent.closest('a') ?? urgent.querySelector('a')).toHaveAttribute('href', '/jobs?priority=urgent,critical&status=open');
    expect(overdue.closest('a') ?? overdue.querySelector('a')).toHaveAttribute('href', '/jobs?overdue=1');
  });

  it('a recruiter only counts jobs in their scope', async () => {
    const { isUrgent } = await import('../../domain/jobUrgency');
    const { buildSeed } = await import('../../data/seed');
    useStore.setState({ ...buildSeed() });
    signInAs('u-chau');
    const st = useStore.getState();
    const mine = jobsInScope(st.users.find((u) => u.id === 'u-chau'), st.jobs).filter((j) => j.status === 'open');
    at('/dashboard');
    expect(screen.getByTestId('tile-urgent-jobs')).toHaveTextContent(String(mine.filter(isUrgent).length));
    signInAs(undefined);
  });
});


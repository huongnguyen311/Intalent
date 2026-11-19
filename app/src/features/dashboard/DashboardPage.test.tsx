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


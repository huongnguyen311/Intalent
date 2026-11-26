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

  it('dashboard defaults to All time and filters by a date-range dropdown with a custom range', () => {
    at('/');
    const range = screen.getByRole('combobox', { name: 'Date range' });
    expect(range).toHaveValue('all');
    expect(screen.getByTestId('dashboard-recruitment')).toBeInTheDocument();
    expect([...range.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['All time', 'Today', 'This week', 'This month', 'Custom…']);
    expect(screen.queryByLabelText('From')).toBeNull();
    fireEvent.change(range, { target: { value: 'custom' } });
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    // Only the two dashboard recruiters are offered, and there is no Create job button.
    const recruiter = screen.getByRole('combobox', { name: 'Recruiter' });
    expect([...recruiter.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['All recruiters', 'Hòa Đặng', 'Tiên Nguyễn']);
    expect(screen.queryByRole('link', { name: /Create job/i })).toBeNull();
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
    // Their dashboard is already their own jobs: no recruiter filter, and no job filter either.
    expect(screen.queryByRole('combobox', { name: 'Recruiter' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Job' })).toBeNull();
    signInAs(undefined);
  });
});

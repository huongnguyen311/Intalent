import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../routes';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('Login and Dashboard screens', () => {
  it('login submit navigates to the dashboard', () => {
    at('/login');
    fireEvent.click(screen.getByRole('button', { name: /Log In/ }));
    expect(screen.getAllByText('Total Candidates').length).toBeGreaterThan(0);
  });

  it('google sign-in navigates to the dashboard', () => {
    at('/login');
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/ }));
    expect(screen.getAllByText('Total Candidates').length).toBeGreaterThan(0);
  });

  it('dashboard defaults to All and shows the recruitment row outside fixture mode', () => {
    at('/');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('dashboard-recruitment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tuần' }));
    expect(screen.getByRole('button', { name: 'Tuần' })).toHaveAttribute('aria-pressed', 'true');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { AppRoutes } from '../../routes';
import { useStore } from '../../store/store';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);

beforeEach(() => {
  const seed = buildSeed();
  useStore.setState({ ...seed, ui: { ...seed.ui, actingAs: undefined } });
});

describe('LoginPage (app)', () => {
  it('asks for an email instead of signing in silently as Super Admin', () => {
    at('/login');
    // The demo Super Admin is pre-filled; clearing it must not sign in silently.
    expect(screen.getByLabelText(/Email Address/)).toHaveValue('admin@company.demo');
    expect(screen.getByLabelText(/^Password/)).toHaveValue('demo1234');
    fireEvent.change(screen.getByLabelText(/Email Address/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Log In/ }));
    expect(screen.getByText('Enter your work email')).toBeInTheDocument();
    expect(screen.queryByText('Total Candidates')).toBeNull();
  });

  it('does not list demo accounts on the sign-in page', () => {
    at('/login');
    expect(screen.queryByText(/Demo accounts/)).not.toBeInTheDocument();
  });

  it('Forgot Password and Sign Up open their own flows', () => {
    at('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Forgot Password?' }));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'someone@company.demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByRole('status')).toHaveTextContent('someone@company.demo');
    fireEvent.click(screen.getByRole('link', { name: 'Back to sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(screen.getByRole('heading', { name: 'Create your workspace' })).toBeInTheDocument();
  });

  it('an invited user is activated by their first sign in', () => {
    const r = useStore.getState().addUser({ name: 'New Rec', email: 'newrec@company.demo', role: 'Recruiter' });
    if (!r.ok) throw new Error('setup');
    at('/login');
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'newrec@company.demo' } });
    fireEvent.submit(screen.getByLabelText(/email/i).closest('form')!);
    expect(useStore.getState().users.find((u) => u.id === r.user.id)?.status).toBe('Active');
    expect(useStore.getState().ui.actingAs).toBe(r.user.id);
  });
});

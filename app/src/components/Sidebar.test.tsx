import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';
import { useStore } from '../store/store';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

afterEach(() => window.history.pushState({}, '', '/'));

describe('Sidebar', () => {
  it('marks current route active', () => {
    renderAt('/candidates');
    const active = screen.getByRole('link', { name: /Candidate Pool/ });
    expect(active).toHaveClass('bg-primary', 'text-white');
    expect(active.querySelector('.icon-filled')).not.toBeNull();
    const idle = screen.getByRole('link', { name: /Taxonomy/ });
    expect(idle).not.toHaveClass('bg-primary');
    expect(idle.querySelector('.icon-filled')).toBeNull();
  });

  it('marks nested routes active', () => {
    renderAt('/jds/abc');
    expect(screen.getByRole('link', { name: /JD Management/ })).toHaveClass('bg-primary');
  });

  it('hides new nav items in fixture mode', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    renderAt('/');
    for (const name of [/Jobs/, /Pipeline/, /Campaigns/, /Notes/]) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
    expect(screen.getByRole('link', { name: /JD Matching/ })).toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.queryByText('Recruitment')).toBeNull();
    expect(screen.queryByText('Talent Pool')).toBeNull();
  });

  it('shows Jobs, Pipeline, Campaigns, Notes in normal mode', () => {
    renderAt('/');
    for (const name of [/Jobs/, /Pipeline/, /Campaigns/, /Notes/]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Recruitment')).toBeInTheDocument();
    expect(screen.getByText('Talent Pool')).toBeInTheDocument();
  });

  it('user menu offers language toggle, reset and log out', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /Super Admin/ }));
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset demo data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('reset demo data asks for confirmation, then resets the store', () => {
    renderAt('/');
    useStore.setState({ candidates: [] });
    fireEvent.click(screen.getByRole('button', { name: /Super Admin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo data' }));
    expect(useStore.getState().candidates).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(useStore.getState().candidates.length).toBeGreaterThan(0);
  });
});

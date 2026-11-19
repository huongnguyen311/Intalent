import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';
import { useStore } from '../store/store';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.history.pushState({}, '', '/'));

describe('Sidebar', () => {
  it('marks current route active', () => {
    renderAt('/candidates');
    const active = screen.getByRole('link', { name: /Candidate Pool/ });
    expect(active).toHaveClass('bg-primary', 'text-white');
    expect(active.querySelector('.icon-filled')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Configuration/ }));
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

  it('shows the grouped menu in normal mode', () => {
    renderAt('/');
    for (const name of [/Jobs/, /Pipeline/, /Campaigns/, /Careers page/, /Upload CV/]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: /Notes/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Ultra/ })).toBeNull();
    const careers = screen.getByRole('link', { name: /Careers page/ });
    expect(careers).toHaveAttribute('href', '/careers');
    expect(careers).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Recruitment')).toBeInTheDocument();
    expect(screen.getByText('Talent Pool')).toBeInTheDocument();
  });

  it('puts JD Management under Recruitment and JD Matching under Talent Pool', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: /Recruitment/ }));
    expect(screen.queryByRole('link', { name: /JD Management/ })).toBeNull();
    expect(screen.getByRole('link', { name: /JD Matching/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Talent Pool/ }));
    expect(screen.queryByRole('link', { name: /JD Matching/ })).toBeNull();
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

  it('section header toggles its items', () => {
    renderAt('/');
    const header = screen.getByRole('button', { name: /Talent Pool/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header);
    expect(screen.queryByRole('link', { name: /AI Search/ })).toBeNull();
    expect(header).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(header);
    expect(screen.getByRole('link', { name: /AI Search/ })).toBeInTheDocument();
  });

  it('folded group shows item count and is persisted', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: /Configuration/ })).toHaveTextContent('(6)');
    expect(screen.queryByRole('link', { name: /Taxonomy/ })).toBeNull();
    expect(window.localStorage.getItem('intalent-ui-nav')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Talent Pool/ }));
    expect(JSON.parse(window.localStorage.getItem('intalent-ui-nav')!).folded['nav.group.talentPool']).toBe(true);
  });

  it('a folded group holding the current route stays open', () => {
    renderAt('/taxonomy');
    expect(screen.getByRole('link', { name: /Taxonomy/ })).toBeInTheDocument();
  });

  it('treats Ultra and Notes routes as active for their parent items', () => {
    renderAt('/upload-ultra');
    expect(screen.getByRole('link', { name: /Upload CV/ })).toHaveClass('bg-primary');
  });

  it('rail mode shows icons with tooltips only', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.queryByText('Jobs')).toBeNull();
    expect(screen.getByRole('link', { name: 'Jobs' })).toHaveAttribute('title', 'Jobs');
    for (const l of screen.getAllByRole('link')) expect(l).toHaveAttribute('title');
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByText('Jobs')).toBeInTheDocument();
  });

  it('fixture mode renders old flat menu', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    renderAt('/');
    expect(screen.getByRole('link', { name: /Ultra Upload/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Taxonomy/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Configuration|Collapse sidebar/ })).toBeNull();
  });
});

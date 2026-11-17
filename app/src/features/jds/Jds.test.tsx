import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockupFixture } from '../../data/fixtureMockup';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { JdDetailPage } from './JdDetailPage';
import { JdListPage } from './JdListPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/jds" element={<JdListPage />} />
        <Route path="/jds/:id" element={<JdDetailPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

describe('JdListPage', () => {
  it('lists the JDs with "+N" overflow chips and filters by search text', () => {
    renderAt('/jds');
    expect(screen.getByText('ID: JD-2026-004')).toBeInTheDocument();
    expect(screen.getAllByText('+10')).toHaveLength(2);
    fireEvent.change(screen.getByPlaceholderText('Search by title, domain, or skill...'), { target: { value: 'flutter' } });
    expect(screen.getByText('Senior Flutter & Java Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Senior Growth Marketing Lead')).toBeNull();
  });

  it('creates a JD from pasted text using the keyword extractor', () => {
    renderAt('/jds');
    fireEvent.click(screen.getByRole('button', { name: /Create New JD/ }));
    fireEvent.change(screen.getByLabelText('Paste job description text'), {
      target: { value: 'DATA ENGINEER\nWe need a senior engineer with Python, PostgreSQL and Docker for a fintech product.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Fill fields from text/ }));
    expect(screen.getByLabelText('Title')).toHaveValue('Data Engineer');
    expect(screen.getByLabelText(/Tech stack/)).toHaveValue('Python, PostgreSQL, Docker');
    expect(screen.getByLabelText(/Domains/)).toHaveValue('Fintech');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const created = useStore.getState().jds[0];
    expect(created).toMatchObject({ title: 'Data Engineer', status: 'Draft', skills: ['Python', 'PostgreSQL', 'Docker'] });
    expect(screen.getByText('ID: JD-2026-005')).toBeInTheDocument();
  });

  it('requires a title', () => {
    renderAt('/jds');
    fireEvent.click(screen.getByRole('button', { name: /Create New JD/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(useStore.getState().jds).toHaveLength(4);
  });

  it('unpublishes from the row menu and deletes only after confirming', () => {
    const jd = useStore.getState().createJd({ title: 'Temp role', domains: [], skills: [], body: '', status: 'Published' });
    renderAt('/jds');
    fireEvent.click(screen.getByRole('button', { name: 'Actions Temp role' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unpublish' }));
    expect(useStore.getState().jds.find((j) => j.id === jd.id)!.status).toBe('Draft');

    fireEvent.click(screen.getByRole('button', { name: 'Actions Temp role' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(useStore.getState().jds.some((j) => j.id === jd.id)).toBe(true);
    const dialog = screen.getByRole('dialog', { name: 'Delete job description' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(useStore.getState().jds.some((j) => j.id === jd.id)).toBe(false);
  });
});

describe('JdDetailPage', () => {
  it('shows requirements and "Create Job from this JD" navigates to /jobs?fromJd=', () => {
    renderAt('/jds/jd-2026-002');
    expect(screen.getByRole('heading', { name: 'Senior Frontend Developer' })).toBeInTheDocument();
    expect(screen.getByText('5 yrs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Create Job from this JD/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/jobs?fromJd=jd-2026-002');
  });

  it('hides new actions in fixture mode and shows the mockup JD', () => {
    window.history.pushState({}, '', '/?fixture=mockup');
    useStore.setState({ ...buildMockupFixture() });
    try {
      renderAt('/jds/jd-2026-002');
      expect(screen.queryByRole('button', { name: /Create Job/ })).toBeNull();
      expect(screen.getByText('None')).toBeInTheDocument();
      expect(screen.getByText('Healthcare or SaaS industry experience')).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('shows a message for an unknown JD', () => {
    renderAt('/jds/nope');
    expect(screen.getByText('JD not found')).toBeInTheDocument();
  });
});

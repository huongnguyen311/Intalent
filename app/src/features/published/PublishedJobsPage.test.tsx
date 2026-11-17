import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { PublishedJobsPage } from './PublishedJobsPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/published']}>
      <Routes>
        <Route path="/published" element={<PublishedJobsPage />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
});

const openFirstMenu = () => {
  const job = useStore.getState().jobs.filter((j) => j.status === 'open').sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Actions ${job.title}`) }));
  return job;
};

describe('PublishedJobsPage', () => {
  it('unpublish asks confirm then closes job and removes row', () => {
    renderPage();
    const job = openFirstMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from careers page' }));
    const dialog = screen.getByRole('dialog');
    expect(useStore.getState().jobs.find((j) => j.id === job.id)!.status).toBe('open');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(useStore.getState().jobs.find((j) => j.id === job.id)!.status).toBe('closed');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('link', { name: job.title })).toBeNull();
  });

  it('cancel keeps job open', () => {
    renderPage();
    const job = openFirstMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from careers page' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useStore.getState().jobs.find((j) => j.id === job.id)!.status).toBe('open');
  });

  it('renders empty state when no open jobs', () => {
    useStore.setState({ jobs: useStore.getState().jobs.map((j) => ({ ...j, status: 'closed' as const })) });
    renderPage();
    expect(screen.getByText('No jobs are published yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Jobs' })).toHaveAttribute('href', '/jobs');
  });

  it('view as candidate link opens careers job in new tab', () => {
    renderPage();
    const job = useStore.getState().jobs.filter((j) => j.status === 'open').sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
    const link = screen.getAllByRole('link', { name: 'View as candidate' })[0];
    expect(link).toHaveAttribute('href', `/careers/${job.id}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('view as candidate is inline, not inside the actions menu', () => {
    renderPage();
    openFirstMenu();
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('link', { name: 'View as candidate' })).toBeNull();
    expect(within(menu).getByRole('link', { name: 'Pipeline' })).toBeInTheDocument();
  });
});

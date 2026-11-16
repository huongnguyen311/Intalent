import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMockupFixture } from '../../data/fixtureMockup';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { CandidatePoolPage } from './CandidatePoolPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <CandidatePoolPage />
    </MemoryRouter>,
  );

beforeEach(() => useStore.setState(buildSeed()));

describe('CandidatePoolPage', () => {
  it('lists 10 candidates per page with a footer', () => {
    renderPage();
    expect(screen.getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText(/candidates$/)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    useStore.setState({ candidates: [] });
    renderPage();
    expect(screen.getByText('No candidates match your filters')).toBeInTheDocument();
  });

  it('masks contacts while PII is locked and unlocks on click', () => {
    renderPage();
    expect(screen.getAllByText('•••••').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByTitle('PII Locked')[0]);
    expect(useStore.getState().ui.piiUnlocked).toBe(true);
  });

  it('search narrows the list', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: 'zzzz-no-match' } });
    expect(screen.getByText('No candidates match your filters')).toBeInTheDocument();
  });

  it('bulk select shows the Add to Pipeline action', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Pipeline' })).toBeInTheDocument();
  });

  it('row menu opens Add to Pipeline for that candidate only', () => {
    renderPage();
    const { candidates } = useStore.getState();
    const first = candidates.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    fireEvent.click(screen.getByRole('button', { name: `Actions for ${first.name}` }));
    fireEvent.click(screen.getByText('Add to Pipeline'));
    const dialog = screen.getByRole('dialog', { name: 'Add to Pipeline' });
    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(first.name);
  });

  it('bulk bar opens Add to Pipeline with every selected candidate', () => {
    renderPage();
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[1]);
    fireEvent.click(boxes[3]);
    const names = [boxes[1], boxes[3]].map((b) => b.getAttribute('aria-label')!.replace('Select ', ''));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Pipeline' }));
    const dialog = screen.getByRole('dialog', { name: 'Add to Pipeline' });
    const items = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(names);
  });

  it('mockup fixture reports the full 781-candidate pool over 10 rows', () => {
    useStore.setState(buildMockupFixture());
    const { container } = renderPage();
    expect(screen.getAllByRole('row')).toHaveLength(11);
    expect(container.textContent).toContain('Showing 1-10 of 781 candidates');
    expect(screen.getByRole('button', { name: '79' })).toBeInTheDocument();
    expect(screen.getAllByText('Tran Bao Ngoc')).toHaveLength(10);
  });
});

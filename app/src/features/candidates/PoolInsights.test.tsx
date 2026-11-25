import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { useStore } from '../../store/store';
import { PoolInsightsPage } from './PoolInsights';

const renderPage = () =>
  render(
    <MemoryRouter>
      <PoolInsightsPage />
    </MemoryRouter>,
  );

const recent = new Date(Date.now() - 5 * 86_400_000).toISOString();

beforeEach(() => {
  const s = buildSeed();
  const base = s.candidates.map((c) => ({ ...c, email: c.email || 'x@x.demo', createdAt: recent, anonymizedAt: undefined }));
  useStore.setState({
    ...s,
    candidates: [
      ...base,
      { ...base[0], id: 'gap-new', name: 'Gap Recent', email: '' },
      { ...base[0], id: 'gap-old', name: 'Gap Old', email: '', createdAt: '2025-01-01T00:00:00.000Z' },
    ],
  });
});

describe('PoolInsightsPage', () => {
  it('renders KPIs, composition and quality sections', () => {
    renderPage();
    for (const id of ['pool-period', 'pool-kpis', 'pool-composition', 'pool-quality']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('missing-email figure links to the filtered pool', () => {
    renderPage();
    const link = within(screen.getByTestId('pool-quality')).getByRole('link', { name: /Missing email/ });
    expect(link).toHaveAttribute('href', '/candidates?gap=email');
    expect(link).toHaveTextContent('2');
  });

  it('period change updates quality and its links', () => {
    renderPage();
    fireEvent.click(within(screen.getByTestId('pool-period')).getByRole('button', { name: '3M' }));
    const link = within(screen.getByTestId('pool-quality')).getByRole('link', { name: /Missing email/ });
    expect(link).toHaveAttribute('href', '/candidates?gap=email&since=3m');
    expect(link).toHaveTextContent('1');
  });

  it('missing-email KPI hint agrees with the quality row when someone is anonymized', () => {
    const { candidates } = useStore.getState();
    useStore.setState({ candidates: [...candidates, { ...candidates[0], id: 'anon', email: '', anonymizedAt: recent }] });
    renderPage();
    expect(screen.getByTestId('pool-kpis')).toHaveTextContent('2 missing email');
  });

  it('empty pool shows zeros, no NaN', () => {
    useStore.setState({ candidates: [] });
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(within(screen.getByTestId('pool-quality')).queryAllByRole('link')).toHaveLength(0);
  });
});

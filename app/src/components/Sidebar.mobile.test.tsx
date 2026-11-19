import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const narrowScreen = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><Sidebar /></MemoryRouter>);

describe('Sidebar on a phone', () => {
  it('starts as an icon rail so the page keeps most of the screen', () => {
    narrowScreen(true);
    renderAt('/jobs');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jobs' })).not.toHaveTextContent('Jobs');
  });

  it('can still be opened, without changing the saved desktop preference', () => {
    narrowScreen(true);
    renderAt('/jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('link', { name: /Jobs/ })).toHaveTextContent('Jobs');
    expect(window.localStorage.getItem('intalent-ui-nav') ?? '').not.toContain('"rail":true');
  });

  it('stays expanded on a wide screen', () => {
    narrowScreen(false);
    renderAt('/jobs');
    expect(screen.getByRole('link', { name: /Jobs/ })).toHaveTextContent('Jobs');
  });
});

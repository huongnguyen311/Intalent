import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from './routes';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe('routes', () => {
  it('renders internal pages inside the app layout with the page title', () => {
    at('/jobs');
    expect(screen.getByRole('heading', { level: 2, name: 'Jobs' })).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('renders public careers and login without the app layout', () => {
    for (const p of ['/careers', '/careers/j1', '/careers/j1/apply', '/careers/applied', '/login']) {
      const { unmount } = at(p);
      expect(screen.queryByRole('complementary')).toBeNull();
      unmount();
    }
  });
});

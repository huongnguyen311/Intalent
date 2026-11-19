import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { EMPTY_QUERY, PipelineHeader } from './PipelineHeader';

const job = buildSeed().jobs[0];

describe('PipelineHeader', () => {
  it('shows no summary, filter or sort controls', () => {
    render(
      <MemoryRouter>
        <PipelineHeader job={job} query={EMPTY_QUERY} onQuery={() => {}} view="kanban" onView={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/overdue · Open/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Filters/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sort/ })).not.toBeInTheDocument();
  });
});

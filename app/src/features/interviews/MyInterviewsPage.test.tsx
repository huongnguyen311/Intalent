import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../routes';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { renderHook } from '@testing-library/react';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

/** One interview the signed-in user sits on, with its candidate's name. */
function myInterview() {
  const me = renderHook(() => useMe()).result.current;
  const s = useStore.getState();
  for (const app of s.applications)
    for (const iv of app.interviews ?? [])
      if (iv.interviewers.includes(me.id) && iv.status !== 'cancelled')
        return { iv, name: s.candidates.find((c) => c.id === app.candidateId)!.name };
  throw new Error('seed has no interview for the signed-in user');
}

describe('My interviews calendar', () => {
  it('opens on the week calendar, with Month and List as the other options', () => {
    at('/my-interviews');
    expect(screen.getByRole('button', { name: /Week/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId(/^cal-day-/)).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: /Month/ }));
    expect(screen.getAllByTestId(/^cal-day-/)).toHaveLength(42);
    fireEvent.click(screen.getByRole('button', { name: /List/ }));
    expect(screen.queryAllByTestId(/^cal-day-/)).toHaveLength(0);
    expect(screen.getByRole('heading', { name: /Upcoming/ })).toBeInTheDocument();
    // The switch stays on the list, so the calendar is one click back.
    fireEvent.click(screen.getByRole('button', { name: /Week/ }));
    expect(screen.getAllByTestId(/^cal-day-/)).toHaveLength(7);
  });

  it('places an interview on its day and opens the application from it', () => {
    const { iv, name } = myInterview();
    const day = iv.at.slice(0, 10);
    at(`/my-interviews?d=${day}`);
    const cell = screen.getByTestId(`cal-day-${day}`);
    const card = within(cell).getAllByRole('button').find((b) => b.textContent?.includes(name))!;
    expect(card).toHaveTextContent(iv.at.slice(11, 16));
    fireEvent.click(card);
    const drawer = screen.getByRole('dialog', { name });
    // Each block is its own labelled section, with this round first.
    const headings = within(drawer).getAllByRole('region').map((r) => within(r).getAllByRole('heading')[0].textContent ?? '');
    expect(headings[0]).toBe('This interview');
    expect(headings.some((h) => h.startsWith('Comments'))).toBe(false);
    expect(within(drawer).getByRole('tab', { name: /Comments/ })).toHaveAttribute('aria-selected', 'false');
    // The applied job sits under the name and opens the job page.
    const app = useStore.getState().applications.find((a) => a.interviews?.some((x) => x.id === iv.id))!;
    const job = useStore.getState().jobs.find((j) => j.id === app.jobId)!;
    expect(within(drawer).getByText('Applying for')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: job.title })).toHaveAttribute('href', `/jobs/${job.id}`);
  });

  it('pages the week forward and back', () => {
    at('/my-interviews?d=2026-11-20');
    expect(screen.getByTestId('cal-day-2026-11-17')).toBeInTheDocument(); // Monday
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('cal-day-2026-11-24')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByTestId('cal-day-2026-11-10')).toBeInTheDocument();
  });
});

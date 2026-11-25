import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { todayIso } from '../../domain/jobUrgency';
import { AppRoutes } from '../../routes';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname}</div>;
}
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
      <Where />
    </MemoryRouter>,
  );
const where = () => screen.getByTestId('where').textContent;
const day = (offset: number) => todayIso(new Date(Date.now() + offset * 86_400_000));
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

const fillValid = (start = day(0), end = day(30)) => {
  change('Campaign name', 'Q1 2027 Tech Hiring');
  change('Start date', start);
  change('End date', end);
};

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
  signInAs(undefined);
});

describe('CampaignEditorPage: create', () => {
  it('Launch with empty fields shows the errors and saves nothing', () => {
    renderAt('/campaigns/new');
    const before = useStore.getState().campaigns.length;
    change('Owner', '');
    click('Launch');
    for (const msg of ['Enter a campaign name', 'Pick an owner']) {
      expect(screen.getByText(msg)).toBeInTheDocument();
    }
    expect(useStore.getState().campaigns).toHaveLength(before);
  });

  it('launches without jobs (they join from the job form), with a code, and lands on the campaign', () => {
    renderAt('/campaigns/new');
    fillValid();
    click('Launch');
    const c = useStore.getState().campaigns[0];
    expect(c).toMatchObject({ name: 'Q1 2027 Tech Hiring', status: 'active', owner: 'u-admin' });
    expect(c.code).toMatch(/^CMP-\d{4}-\d{3}$/);
    expect(where()).toBe(`/campaigns/${c.id}`);
  });

  it('saves goals and budget', () => {
    renderAt('/campaigns/new');
    fillValid();
    change('Target applicants', '40');
    change('Budget', '5000');
    change('Currency', 'USD');
    click('Save as draft');
    expect(useStore.getState().campaigns[0]).toMatchObject({ status: 'draft', goals: { targetApplicants: 40, budget: 5000, currency: 'USD' } });
  });

  it('a future start launches as scheduled', () => {
    renderAt('/campaigns/new');
    fillValid(day(10), day(40));
    click('Launch');
    expect(useStore.getState().campaigns[0].status).toBe('scheduled');
  });

  it('cannot launch once the end date has passed, but can save a draft', () => {
    renderAt('/campaigns/new');
    fillValid(day(-20), day(-1));
    click('Launch');
    expect(screen.getByText('End date has passed; change it before launching')).toBeInTheDocument();
    click('Save as draft');
    expect(useStore.getState().campaigns[0]).toMatchObject({ name: 'Q1 2027 Tech Hiring', status: 'draft' });
  });

  it('checks the deadline and the date order', () => {
    renderAt('/campaigns/new');
    fillValid(day(0), day(30));
    change('Application deadline', day(40));
    click('Launch');
    expect(screen.getByText('Application deadline must be between start and end')).toBeInTheDocument();
    change('End date', day(-5));
    click('Launch');
    expect(screen.getByText('End date must be on or after the start date')).toBeInTheDocument();
  });

  it('rejects negative goal numbers', () => {
    renderAt('/campaigns/new');
    fillValid();
    change('Budget', '-1');
    click('Launch');
    expect(screen.getByText('Enter 0 or more')).toBeInTheDocument();
  });

  it('has no type, department, hiring manager, job picker or links', () => {
    renderAt('/campaigns/new');
    for (const label of ['Campaign type', 'Department', 'Hiring manager', 'Target shortlisted', 'Cost-per-hire target']) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Jobs & targets|Campaign links/ })).toBeNull();
  });

  it('Cancel after typing asks before leaving', () => {
    renderAt('/campaigns/new');
    change('Campaign name', 'Half done');
    click('Cancel');
    expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    click('Discard');
    expect(where()).toBe('/campaigns');
  });
});

describe('CampaignEditorPage: edit', () => {
  it('marks the End date when it is before the start', () => {
    renderAt('/campaigns/camp-4/edit');
    change('End date', '2020-01-01');
    click('Save changes');
    expect(screen.getByLabelText('End date')).toHaveAttribute('aria-invalid', 'true');
  });

  it('saves changes and keeps the code and status', () => {
    const before = useStore.getState().campaigns.find((c) => c.id === 'camp-1')!;
    renderAt('/campaigns/camp-1/edit');
    change('Campaign name', 'Frontend Push v2');
    click('Save changes');
    const after = useStore.getState().campaigns.find((c) => c.id === 'camp-1')!;
    expect(after).toMatchObject({ name: 'Frontend Push v2', code: before.code, status: before.status });
    expect(where()).toBe('/campaigns/camp-1');
  });

  it('completed campaigns are read-only and unknown ids are not found', () => {
    const a = renderAt('/campaigns/camp-3/edit');
    expect(screen.getByText('This campaign is finished and can no longer be edited.')).toBeInTheDocument();
    a.unmount();
    renderAt('/campaigns/nope/edit');
    expect(screen.getByText('Campaign not found')).toBeInTheDocument();
  });

  it('the list button opens the create page', () => {
    renderAt('/campaigns');
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/ }));
    expect(where()).toBe('/campaigns/new');
    expect(within(document.body).getByRole('heading', { name: 'New campaign' })).toBeInTheDocument();
  });
});

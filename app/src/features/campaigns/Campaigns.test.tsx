import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { toast } from '../../components/Toast';
import { campaignStats } from '../../domain/campaigns';
import { jobsInScope } from '../../domain/permissions';
import { signInAs } from '../../store/session';
import { useStore } from '../../store/store';
import { CampaignDetailPage } from './CampaignDetailPage';
import { CampaignsPage } from './CampaignsPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/pipeline/:jobId" element={<div>pipeline page</div>} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );

const newCampaign = () =>
  useStore.getState().createCampaign({ name: 'Empty One', jobIds: ['job-1'], channels: ['facebook', 'referral'], goal: 10, start: '2026-12-01', end: '2026-12-31' });

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
  vi.mocked(toast).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('CampaignsPage', () => {
  it('lists campaigns with applicants against goal and status', () => {
    renderAt('/campaigns');
    const state = useStore.getState();
    const row = screen.getByRole('link', { name: 'Frontend Summer Push' }).closest('tr')!;
    const stats = campaignStats(state, 'camp-1');
    expect(within(row).getByText(`${stats.applicants} / 40`)).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Frontend Summer Push' })).toHaveAttribute('href', '/campaigns/camp-1');
    expect(screen.getAllByRole('row')).toHaveLength(1 + state.campaigns.length);
  });

  it('filters by search text and shows an empty message', () => {
    renderAt('/campaigns');
    fireEvent.change(screen.getByPlaceholderText('Search campaigns...'), { target: { value: 'mobile' } });
    expect(screen.queryByText('Frontend Summer Push')).toBeNull();
    expect(screen.getByText('Mobile Talent Hunt')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search campaigns...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No campaigns found')).toBeInTheDocument();
  });

  it('wizard only offers open jobs', () => {
    renderAt('/campaigns');
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/ }));
    const dlg = screen.getByRole('dialog');
    const jobs = useStore.getState().jobs;
    for (const j of jobs) {
      const el = within(dlg).queryByRole('checkbox', { name: j.title });
      expect(Boolean(el)).toBe(j.status === 'open');
    }
  });

  it('creates a campaign through the 3-step wizard with tracking links and post previews', () => {
    renderAt('/campaigns');
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/ }));
    const dlg = screen.getByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Next' }));
    expect(within(dlg).getByText('Enter a campaign name')).toBeInTheDocument();
    expect(within(dlg).getByText('Select at least one job')).toBeInTheDocument();

    const job = useStore.getState().jobs.find((j) => j.status === 'open')!;
    fireEvent.change(within(dlg).getByLabelText('Campaign name'), { target: { value: 'Autumn Push' } });
    fireEvent.click(within(dlg).getByRole('checkbox', { name: job.title }));
    fireEvent.change(within(dlg).getByLabelText('Goal (applicants)'), { target: { value: '30' } });
    fireEvent.change(within(dlg).getByLabelText('Start'), { target: { value: '2026-12-01' } });
    fireEvent.change(within(dlg).getByLabelText('End'), { target: { value: '2026-12-31' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Next' }));

    fireEvent.click(within(dlg).getByRole('button', { name: 'Next' }));
    expect(within(dlg).getByText('Select at least one channel')).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('checkbox', { name: 'TopCV' }));
    fireEvent.click(within(dlg).getByRole('checkbox', { name: 'Referral' }));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Next' }));

    // Links only work once the campaign exists, so the review step shows them without Copy.
    expect(within(dlg).queryAllByRole('button', { name: /Copy link/ })).toHaveLength(0);
    expect(within(dlg).getByText('These links start working once you create the campaign.')).toBeInTheDocument();
    expect(within(dlg).getAllByText(/careers\/.*\?src=camp-.*-topcv/).length).toBeGreaterThan(0);
    expect(within(dlg).getByText(/We're hiring/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Know someone great/)).toBeInTheDocument();

    fireEvent.click(within(dlg).getByRole('button', { name: 'Create campaign' }));
    const created = useStore.getState().campaigns[0];
    expect(created).toMatchObject({ name: 'Autumn Push', jobIds: [job.id], channels: ['topcv', 'referral'], goal: 30, start: '2026-12-01', end: '2026-12-31', status: 'active' });
    expect(screen.queryByRole('dialog')).toBeNull();
    // Lands on the new campaign, where its links can be copied.
    expect(screen.getAllByText('Autumn Push').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Copy link/ })).toHaveLength(2);
  });

  it('a recruiter can only pick the open jobs they work on', () => {
    signInAs('u-huy');
    renderAt('/campaigns');
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/ }));
    const dlg = screen.getByRole('dialog');
    const s = useStore.getState();
    const mine = new Set(jobsInScope(s.users.find((u) => u.id === 'u-huy'), s.jobs).map((j) => j.id));
    for (const j of s.jobs.filter((x) => x.status === 'open')) {
      expect(Boolean(within(dlg).queryByRole('checkbox', { name: j.title }))).toBe(mine.has(j.id));
    }
    signInAs(undefined);
  });

  it('rejects an end date before the start date', () => {
    renderAt('/campaigns');
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/ }));
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Start'), { target: { value: '2026-12-10' } });
    fireEvent.change(within(dlg).getByLabelText('End'), { target: { value: '2026-12-01' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Next' }));
    expect(within(dlg).getByText('End date must be on or after the start date')).toBeInTheDocument();
  });
});

describe('CampaignDetailPage', () => {
  it('renders an empty state for a campaign without applicants', () => {
    const c = newCampaign();
    renderAt(`/campaigns/${c.id}`);
    expect(screen.getByText('No applicants yet')).toBeInTheDocument();
    expect(screen.getByText('Share the tracking links below to start collecting applicants.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByTestId('kpi-applicants')).toHaveTextContent('0');
  });

  it('shows KPIs, applicants by channel and the applicants table', () => {
    const stats = campaignStats(useStore.getState(), 'camp-1');
    expect(stats.applicants).toBeGreaterThan(0);
    renderAt('/campaigns/camp-1');
    expect(screen.getByTestId('kpi-applicants')).toHaveTextContent(String(stats.applicants));
    expect(screen.getByTestId('kpi-hires')).toHaveTextContent(String(stats.hires));
    expect(screen.getByTestId('kpi-views')).toHaveTextContent(stats.views.toLocaleString('en-US'));
    expect(screen.getByTestId('bar-linkedin')).toHaveTextContent(String(stats.byChannel.linkedin));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(1 + stats.applicants);
    const title = useStore.getState().jobs.find((j) => j.id === 'job-1')!.title;
    expect(screen.getByRole('link', { name: new RegExp(`Pipeline: ${title}`) })).toHaveAttribute('href', '/pipeline/job-1');
  });

  it('copies a tracking link and toasts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderAt('/campaigns/camp-1');
    fireEvent.click(screen.getAllByRole('button', { name: /Copy link/ })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toMatch(/\/careers\/job-1\?src=camp-1-linkedin$/);
    expect(toast).toHaveBeenCalledWith('Link copied');
  });

  it('reports failure instead of throwing when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    renderAt('/campaigns/camp-1');
    fireEvent.click(screen.getAllByRole('button', { name: /Copy link/ })[0]);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Could not copy. Select the link and copy it manually.', 'error'));
  });

  it('pauses and resumes a campaign', () => {
    renderAt('/campaigns/camp-1');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-1')!.status).toBe('paused');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-1')!.status).toBe('active');
  });

  it('shows a not-found message for an unknown campaign', () => {
    renderAt('/campaigns/nope');
    expect(screen.getByText('Campaign not found')).toBeInTheDocument();
  });
});

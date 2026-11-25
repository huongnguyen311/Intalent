import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import { toast } from '../../components/Toast';
import { campaignJobRows, campaignPerformance, campaignStats, filledHires, launchStatus, targetHires } from '../../domain/campaigns';
import { todayIso } from '../../domain/jobUrgency';
import { useStore } from '../../store/store';
import { CampaignDetailPage } from './CampaignDetailPage';
import { CampaignsPage } from './CampaignsPage';

vi.mock('../../components/Toast', () => ({ toast: vi.fn(), Toaster: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/new" element={<div>create page</div>} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/campaigns/:id/edit" element={<div>edit page</div>} />
        <Route path="/pipeline/:jobId" element={<div>pipeline page</div>} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );

const newCampaign = () =>
  useStore.getState().createCampaign({ name: 'Empty One', owner: 'u-huy', goals: { targetApplicants: 10 }, start: '2026-12-01', end: '2026-12-31' }, { launch: true });
/** Points `ids` at camp-1 and every other job away from it. */
const camp1Jobs = (ids: string[]) =>
  useStore.setState({ jobs: useStore.getState().jobs.map((j) => ({ ...j, campaignId: ids.includes(j.id) ? 'camp-1' : j.campaignId === 'camp-1' ? undefined : j.campaignId })) });

beforeEach(() => {
  useStore.setState({ ...buildSeed() });
  vi.mocked(toast).mockClear();
});

describe('CampaignsPage', () => {
  it('lists campaigns with code, owner, hires against target, status and priority', () => {
    renderAt('/campaigns');
    const state = useStore.getState();
    const heads = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Campaign', 'Owner', 'Jobs', 'Period', 'Status', 'Progress']);
    const c = state.campaigns.find((x) => x.id === 'camp-1')!;
    const row = screen.getByRole('link', { name: 'Frontend Summer Push' }).closest('tr')!;
    expect(within(row).getByText(c.code)).toBeInTheDocument();
    expect(within(row).getByText('Pham Gia Huy')).toBeInTheDocument();
    expect(within(row).getByText(`${filledHires(state, c)}/${targetHires(state, c)} hired`)).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByText('High')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Frontend Summer Push' })).toHaveAttribute('href', '/campaigns/camp-1');
    expect(screen.getAllByRole('row')).toHaveLength(1 + state.campaigns.length);
  });

  it('caps the progress bar at 100%', () => {
    const st = useStore.getState();
    camp1Jobs(['job-2']);
    useStore.setState({ applications: st.applications.map((a) => (a.campaignId === 'camp-1' ? { ...a, jobId: 'job-2', stage: 'hired' as const } : a)) });
    renderAt('/campaigns');
    const row = screen.getByRole('link', { name: 'Frontend Summer Push' }).closest('tr')!;
    expect(within(row).getByTestId('progress-bar')).toHaveStyle({ width: '100%' });
  });

  it('progress counts each job only up to its target', () => {
    const st = useStore.getState();
    // job-2 has 1 opening, job-3 has 3: two hires on job-2 fill only one seat.
    camp1Jobs(['job-2', 'job-3']);
    const a = st.applications.filter((x) => x.campaignId === 'camp-1').slice(0, 2);
    useStore.setState({ applications: st.applications.filter((x) => x.campaignId !== 'camp-1' || a.includes(x)).map((x) => (a.includes(x) ? { ...x, jobId: 'job-2', stage: 'hired' as const } : x)) });
    renderAt('/campaigns');
    const row = screen.getByRole('link', { name: 'Frontend Summer Push' }).closest('tr')!;
    expect(within(row).getByText('1/4 hired')).toBeInTheDocument();
  });

  it('search matches the code', () => {
    renderAt('/campaigns');
    const c = useStore.getState().campaigns.find((x) => x.id === 'camp-2')!;
    fireEvent.change(screen.getByPlaceholderText('Search campaigns...'), { target: { value: c.code.toLowerCase() } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Mobile Talent Hunt')).toBeInTheDocument();
  });

  it('filters by effective status: a scheduled campaign past its start shows under Active', () => {
    const st = useStore.getState();
    useStore.setState({ campaigns: st.campaigns.map((c) => (c.id === 'camp-4' ? { ...c, start: '2020-01-01' } : c)) });
    renderAt('/campaigns');
    fireEvent.click(screen.getByRole('button', { name: /Status:/ }));
    for (const s of ['Draft', 'Scheduled', 'Active', 'Paused', 'Completed', 'Cancelled']) expect(screen.getByRole('menuitem', { name: s })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Active' }));
    expect(screen.getByText('Graduate Program 2027')).toBeInTheDocument();
    expect(screen.queryByText('Winter Internship')).toBeNull();
  });

  it('has no Type filter; the Jobs column lists the jobs picked on the job form', () => {
    renderAt('/campaigns');
    expect(screen.queryByRole('button', { name: /Type:/ })).toBeNull();
    const row = screen.getByRole('link', { name: 'Graduate Program 2027' }).closest('tr')!;
    expect(within(row).getByText('Mobile Engineer (Flutter)')).toBeInTheDocument();
  });

  it('New Campaign opens the create page', () => {
    renderAt('/campaigns');
    fireEvent.click(screen.getByRole('button', { name: /New Campaign/ }));
    expect(screen.getByText('create page')).toBeInTheDocument();
  });

  it('filters by search text and shows an empty message', () => {
    renderAt('/campaigns');
    fireEvent.change(screen.getByPlaceholderText('Search campaigns...'), { target: { value: 'mobile' } });
    expect(screen.queryByText('Frontend Summer Push')).toBeNull();
    expect(screen.getByText('Mobile Talent Hunt')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search campaigns...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No campaigns found')).toBeInTheDocument();
  });




});

describe('CampaignDetailPage', () => {
  it('renders an empty state for a campaign without applicants', () => {
    const c = newCampaign();
    renderAt(`/campaigns/${c.id}`);
    expect(screen.getByText('No applicants yet')).toBeInTheDocument();
    expect(screen.getByText('No jobs yet. Pick this campaign on the Create / Edit Job form to add one.')).toBeInTheDocument();
    // No jobs table and no applicants table: both show their empty state.
    expect(screen.queryAllByRole('table')).toHaveLength(0);
    expect(screen.getByTestId('kpi-applicants')).toHaveTextContent('0');
  });

  it('shows KPIs, the jobs table and the applicants table', () => {
    const stats = campaignStats(useStore.getState(), 'camp-1');
    expect(stats.applicants).toBeGreaterThan(0);
    renderAt('/campaigns/camp-1');
    expect(screen.getByTestId('kpi-applicants')).toHaveTextContent(String(stats.applicants));
    expect(screen.getByTestId('kpi-hires')).toHaveTextContent(String(stats.hires));
    expect(screen.getByTestId('kpi-views')).toHaveTextContent(stats.views.toLocaleString('en-US'));
    const table = screen.getAllByRole('table')[1];
    expect(within(table).getAllByRole('row')).toHaveLength(1 + stats.applicants);
    const title = useStore.getState().jobs.find((j) => j.id === 'job-1')!.title;
    expect(within(screen.getByTestId('campaign-jobs')).getByRole('link', { name: title })).toHaveAttribute('href', '/pipeline/job-1');
  });

  it('has no tracking links section', () => {
    renderAt('/campaigns/camp-1');
    expect(screen.queryByText('Campaign links')).toBeNull();
    expect(screen.queryByRole('button', { name: /Copy link/ })).toBeNull();
  });

  it('pauses and resumes a campaign', () => {
    renderAt('/campaigns/camp-1');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-1')!.status).toBe('paused');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-1')!.status).toBe('active');
  });

  it('shows the code and owner in the header', () => {
    const c = useStore.getState().campaigns.find((x) => x.id === 'camp-1')!;
    renderAt('/campaigns/camp-1');
    const head = screen.getByTestId('campaign-header');
    expect(within(head).getByText(c.code)).toBeInTheDocument();
    expect(within(head).getByText(/Pham Gia Huy/)).toBeInTheDocument();
  });

  it('Complete finishes the campaign and removes every action', () => {
    renderAt('/campaigns/camp-1');
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-1')!.status).toBe('completed');
    for (const name of ['Edit', 'Pause', 'Complete', 'Cancel campaign']) expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('a draft offers Launch, which starts it by its start date', () => {
    const st = useStore.getState();
    renderAt('/campaigns/camp-5');
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    const c = useStore.getState().campaigns.find((x) => x.id === 'camp-5')!;
    expect(c.status).toBe(launchStatus(st.campaigns.find((x) => x.id === 'camp-5')!.start, todayIso()));
  });

  it('Cancel asks first, then cancels', () => {
    renderAt('/campaigns/camp-1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel campaign' }));
    const dlg = screen.getByRole('dialog', { name: 'Cancel this campaign?' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Keep it' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-1')!.status).toBe('active');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel campaign' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel campaign' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-1')!.status).toBe('cancelled');
  });

  it('a campaign past its end offers to mark it completed', () => {
    renderAt('/campaigns/camp-2');
    const banner = screen.getByTestId('past-end');
    expect(banner).toHaveTextContent(/Ended on .*\. Mark completed\?/);
    fireEvent.click(within(banner).getByRole('button', { name: 'Complete' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-2')!.status).toBe('completed');
    expect(screen.queryByTestId('past-end')).toBeNull();
  });

  it('the jobs table matches the per-job numbers and totals', () => {
    const st = useStore.getState();
    const c = st.campaigns.find((x) => x.id === 'camp-1')!;
    const { rows, totals } = campaignJobRows(st, c);
    expect(rows.map((r) => r.target)).toEqual(rows.map((r) => st.jobs.find((j) => j.id === r.jobId)!.headcount ?? 1));
    renderAt('/campaigns/camp-1');
    const table = screen.getByTestId('campaign-jobs');
    for (const r of rows) {
      const row = within(table).getByRole('link', { name: r.title }).closest('tr')!;
      expect(within(row).getByTestId('cell-target')).toHaveTextContent(String(r.target));
      expect(within(row).getByTestId('cell-hired')).toHaveTextContent(String(r.hired));
      expect(within(row).getByTestId('cell-remaining')).toHaveTextContent(String(r.remaining));
    }
    const total = within(table).getByTestId('jobs-total');
    expect(within(total).getByTestId('cell-target')).toHaveTextContent(String(totals.target));
    expect(within(total).getByTestId('cell-hired')).toHaveTextContent(String(totals.hired));
    expect(within(total).getByTestId('cell-remaining')).toHaveTextContent(String(totals.remaining));
  });

  it('a job moved to another campaign stays listed, marked as moved', () => {
    camp1Jobs(['job-1']);
    const st = useStore.getState();
    const a = st.applications.find((x) => x.campaignId === 'camp-1')!;
    useStore.setState({ applications: st.applications.map((x) => (x.id === a.id ? { ...x, jobId: 'job-2' } : x)) });
    renderAt('/campaigns/camp-1');
    const title = useStore.getState().jobs.find((j) => j.id === 'job-2')!.title;
    const row = within(screen.getByTestId('campaign-jobs')).getByRole('link', { name: title }).closest('tr')!;
    expect(within(row).getByText('Moved to another campaign')).toBeInTheDocument();
  });

  it('a job missing from the store shows its id and a dash', () => {
    const st = useStore.getState();
    const a = st.applications.find((x) => x.campaignId === 'camp-1')!;
    useStore.setState({ applications: st.applications.map((x) => (x.id === a.id ? { ...x, jobId: 'job-gone' } : x)) });
    renderAt('/campaigns/camp-1');
    const row = within(screen.getByTestId('campaign-jobs')).getByText('job-gone').closest('tr')!;
    expect(within(row).getByTestId('cell-status')).toHaveTextContent('—');
  });

  it('the funnel shows the performance counts', () => {
    const st = useStore.getState();
    const p = campaignPerformance(st, 'camp-1', new Date());
    renderAt('/campaigns/camp-1');
    for (const k of ['total', 'new', 'aiScreened', 'shortlisted', 'interviewed', 'offers', 'hired', 'rejected'] as const) {
      expect(screen.getByTestId(`funnel-${k}`)).toHaveTextContent(String(p[k]));
    }
  });

  it('cost per hire shows a dash without hires', () => {
    const c = newCampaign();
    renderAt(`/campaigns/${c.id}`);
    expect(screen.getByTestId('kpi-cph')).toHaveTextContent('—');
  });

  it('a scheduled campaign past its start offers Pause and Complete', () => {
    const st = useStore.getState();
    useStore.setState({ campaigns: st.campaigns.map((c) => (c.id === 'camp-4' ? { ...c, start: '2020-01-01', end: '2020-02-01' } : c)) });
    renderAt('/campaigns/camp-4');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('past-end')).getByRole('button', { name: 'Complete' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-4')!.status).toBe('completed');
  });

  it('Launch on a draft whose end has passed explains why it did not launch', () => {
    const st = useStore.getState();
    useStore.setState({ campaigns: st.campaigns.map((c) => (c.id === 'camp-5' ? { ...c, start: '2020-01-01', end: '2020-02-01' } : c)) });
    renderAt('/campaigns/camp-5');
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    expect(useStore.getState().campaigns.find((c) => c.id === 'camp-5')!.status).toBe('draft');
    expect(toast).toHaveBeenCalledWith('End date has passed; change it before launching', 'error');
  });

  it('the applicants table has no Source column (every row came from the campaign)', () => {
    renderAt('/campaigns/camp-1');
    const table = screen.getAllByRole('table')[1];
    expect(within(table).queryByRole('columnheader', { name: 'Source' })).toBeNull();
  });

  it('shows a not-found message for an unknown campaign', () => {
    renderAt('/campaigns/nope');
    expect(screen.getByText('Campaign not found')).toBeInTheDocument();
  });
});

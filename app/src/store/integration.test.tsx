import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { campaignStats, creditedCampaign } from '../domain/campaigns';
import { dashboardMetrics } from '../domain/metrics';
import { ApplicationHistory } from '../features/candidates/ApplicationHistory';
import { useStore } from './store';

beforeEach(() => {
  useStore.setState({ ...buildSeed(), applications: [], activities: [] });
});

describe('campaign apply, end to end', () => {
  it('a tracked apply reaches the candidate, the pipeline, the dashboard, the campaign stats and the profile', () => {
    const s = useStore.getState();
    const campaign = s.campaigns.find((c) => c.status === 'active')!;
    const jobId = s.jobs.find((j) => j.campaignId === campaign.id && j.status === 'open')!.id;
    const applicant = { name: 'Tester Chain', email: 'Chain.Tester@Example.com', phone: '0909 111 222' };
    const candidatesBefore = s.candidates.length;

    // First apply to a job in a running campaign: new candidate, application in New credited to the campaign.
    const first = s.applyFromCareers(applicant, jobId);
    if (!first.ok) throw new Error('expected ok');
    expect(first.created).toBe(true);
    expect(useStore.getState().candidates).toHaveLength(candidatesBefore + 1);
    expect(first.application).toMatchObject({ stage: 'new', via: 'campaign', source: campaign.name, campaignId: campaign.id, jobId });

    // Same person again (different case): dup-blocked, no second candidate or application.
    const again = useStore.getState().applyFromCareers({ ...applicant, email: 'chain.tester@example.com' }, jobId);
    expect(again).toEqual({ ok: false, reason: 'duplicate', stage: 'new' });
    expect(useStore.getState().candidates).toHaveLength(candidatesBefore + 1);
    expect(useStore.getState().applications).toHaveLength(1);

    // Same person on another job merges into the same profile.
    // Another open job whose campaign is not running: a plain careers-page apply.
    const st = useStore.getState();
    const other = st.jobs.find((j) => j.status === 'open' && j.id !== jobId && !creditedCampaign(j, st.campaigns, new Date().toISOString().slice(0, 10)))!;
    const second = useStore.getState().applyFromCareers(applicant, other.id);
    if (!second.ok) throw new Error('expected ok');
    expect(second.created).toBe(false);
    expect(second.application.candidateId).toBe(first.application.candidateId);

    const state = useStore.getState();
    // Dashboard recruitment sources.
    const sources = dashboardMetrics(state, 'all', new Date()).recruitment.topSources;
    expect(sources).toEqual(expect.arrayContaining([expect.objectContaining({ source: campaign.name, count: 1 }), expect.objectContaining({ source: 'Careers page', count: 1 })]));
    // Campaign stats count it under its job.
    const stats = campaignStats(state, campaign.id);
    expect(stats.applicants).toBe(1);
    expect(stats.byJob[jobId].applicants).toBe(1);
    // Candidate profile "Application history" lists both applications with their sources.
    const cand = useStore.getState().candidates.find((x) => x.id === first.application.candidateId)!;
    render(
      <MemoryRouter>
        <ApplicationHistory c={cand} showFeedback={false} />
      </MemoryRouter>,
    );
    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(2);
    // The campaign name is the source of the credited apply.
    const history = screen.getByRole('region', { name: 'Application history' });
    expect(within(history).getByText(new RegExp(campaign.name))).toBeInTheDocument();
    expect(within(history).getAllByText(/Careers page/).length).toBeGreaterThan(0);
  });
});

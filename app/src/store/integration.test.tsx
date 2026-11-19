import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { campaignStats } from '../domain/campaigns';
import { dashboardMetrics } from '../domain/metrics';
import { UsedIn } from '../features/candidates/UsedIn';
import { useStore } from './store';

beforeEach(() => {
  useStore.setState({ ...buildSeed(), applications: [], activities: [] });
});

describe('campaign apply, end to end', () => {
  it('a tracked apply reaches the candidate, the pipeline, the dashboard, the campaign stats and the profile', () => {
    const s = useStore.getState();
    const campaign = s.campaigns[0];
    const jobId = campaign.jobIds[0];
    const applicant = { name: 'Tester Chain', email: 'Chain.Tester@Example.com', phone: '0909 111 222' };
    const candidatesBefore = s.candidates.length;

    // First apply through a tracking link: new candidate, application in New with campaign + channel source.
    const first = s.applyFromCareers(applicant, jobId, `${campaign.id}-linkedin`);
    if (!first.ok) throw new Error('expected ok');
    expect(first.created).toBe(true);
    expect(useStore.getState().candidates).toHaveLength(candidatesBefore + 1);
    expect(first.application).toMatchObject({ stage: 'new', via: 'campaign', source: 'LinkedIn', campaignId: campaign.id, jobId });

    // Same person again (different case): dup-blocked, no second candidate or application.
    const again = useStore.getState().applyFromCareers({ ...applicant, email: 'chain.tester@example.com' }, jobId, `${campaign.id}-linkedin`);
    expect(again).toEqual({ ok: false, reason: 'duplicate', stage: 'new' });
    expect(useStore.getState().candidates).toHaveLength(candidatesBefore + 1);
    expect(useStore.getState().applications).toHaveLength(1);

    // Same person on another job merges into the same profile.
    const other = useStore.getState().jobs.find((j) => j.status === 'open' && j.id !== jobId)!;
    const second = useStore.getState().applyFromCareers(applicant, other.id);
    if (!second.ok) throw new Error('expected ok');
    expect(second.created).toBe(false);
    expect(second.application.candidateId).toBe(first.application.candidateId);

    const state = useStore.getState();
    // Dashboard recruitment sources.
    const sources = dashboardMetrics(state, 'all', new Date()).recruitment.topSources;
    expect(sources).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'LinkedIn', count: 1 }), expect.objectContaining({ source: 'Careers page', count: 1 })]));
    // Campaign stats count it under its channel.
    const stats = campaignStats(state, campaign.id);
    expect(stats.applicants).toBe(1);
    expect(stats.byChannel.linkedin).toBe(1);
    // Candidate profile "Used in" lists both applications with their sources.
    render(
      <MemoryRouter>
        <UsedIn candidateId={first.application.candidateId} />
      </MemoryRouter>,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(screen.getByRole('table')).getByText('LinkedIn')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Careers page')).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { taContribution, UNATTRIBUTED } from '../domain/taContribution';
import { createDemoStore } from './store';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};

const setup = () => {
  const s = createDemoStore(memoryStorage(), () => '2026-11-16T10:00:00.000Z');
  const st = s.getState();
  return { s, openJob: st.jobs.find((j) => j.status === 'open')!, campaign: st.campaigns[0] };
};
const applicant = { name: 'Le Thi Test', email: 'le.test@example.com', phone: '0900000001' };

describe('applyFromCareers', () => {
  it('apply creates application in new with Careers page source', () => {
    const { s, openJob } = setup();
    s.setState({ jobs: s.getState().jobs.map((j) => (j.id === openJob.id ? { ...j, campaignId: undefined } : j)) });
    const before = s.getState().candidates.length;
    const r = s.getState().applyFromCareers(applicant, openJob.id);
    expect(r.ok).toBe(true);
    expect(s.getState().candidates).toHaveLength(before + 1);
    const app = s.getState().applications.find((a) => a.jobId === openJob.id && a.candidateId === (r.ok && r.application.candidateId))!;
    expect(app).toMatchObject({ stage: 'new', source: 'Careers page', via: 'careers' });
    expect(app.campaignId).toBeUndefined();
  });

  it("apply to a job in a running campaign credits it, with the campaign name as source", () => {
    const { s, openJob, campaign } = setup();
    s.setState({ jobs: s.getState().jobs.map((j) => (j.id === openJob.id ? { ...j, campaignId: campaign.id } : j)) });
    s.setState({ campaigns: s.getState().campaigns.map((c) => (c.id === campaign.id ? { ...c, status: 'active', start: '2026-01-01' } : c)) });
    const r = s.getState().applyFromCareers(applicant, openJob.id);
    expect(r.ok && r.application).toMatchObject({ via: 'campaign', source: campaign.name, campaignId: campaign.id });
  });

  it('only an active campaign (or a scheduled one past its start) credits applicants', () => {
    for (const [status, credited] of [['active', true], ['scheduled', true], ['draft', false], ['paused', false], ['completed', false], ['cancelled', false]] as const) {
      const { s, openJob, campaign } = setup();
      s.setState({ jobs: s.getState().jobs.map((j) => (j.id === openJob.id ? { ...j, campaignId: campaign.id } : j)) });
      s.setState({ campaigns: s.getState().campaigns.map((c) => (c.id === campaign.id ? { ...c, status, start: '2026-01-01' } : c)) });
      const r = s.getState().applyFromCareers(applicant, openJob.id);
      expect(r.ok && r.application.via).toBe(credited ? 'campaign' : 'careers');
      expect(r.ok && r.application.campaignId).toBe(credited ? campaign.id : undefined);
    }
  });

  it('a job with no campaign counts as the careers page', () => {
    const { s, openJob } = setup();
    s.setState({ jobs: s.getState().jobs.map((j) => (j.id === openJob.id ? { ...j, campaignId: undefined } : j)) });
    const r = s.getState().applyFromCareers(applicant, openJob.id);
    expect(r.ok && r.application).toMatchObject({ via: 'careers', source: 'Careers page' });
    expect(r.ok && r.application.campaignId).toBeUndefined();
  });

  it('careers-created profiles have no CV owner and do not count as TA uploads', () => {
    const { s, openJob } = setup();
    const r = s.getState().applyFromCareers(applicant, openJob.id);
    const cand = s.getState().candidates.find((c) => c.id === (r.ok && r.application.candidateId))!;
    expect(cand.cvOwner).toBe('');
    expect(taContribution(s.getState(), 'all').rows.some((row) => row.ta === UNATTRIBUTED)).toBe(false);
  });

  it('closed job cannot be applied to', () => {
    const { s } = setup();
    const closed = s.getState().jobs.find((j) => j.status !== 'open')!;
    const apps = s.getState().applications.length;
    const cands = s.getState().candidates.length;
    expect(s.getState().applyFromCareers(applicant, closed.id)).toEqual({ ok: false, reason: 'unavailable' });
    expect(s.getState().applyFromCareers(applicant, 'missing')).toEqual({ ok: false, reason: 'unavailable' });
    expect(s.getState().applications).toHaveLength(apps);
    expect(s.getState().candidates).toHaveLength(cands);
  });

  it('re-apply shows already applied and creates nothing', () => {
    const { s, openJob } = setup();
    s.getState().applyFromCareers(applicant, openJob.id);
    const apps = s.getState().applications.length;
    const cands = s.getState().candidates.length;
    const candSnap = structuredClone(s.getState().candidates);
    const actSnap = structuredClone(s.getState().activities);
    const r = s.getState().applyFromCareers({ ...applicant, name: 'Other Name', linkedin: 'https://linkedin.com/in/x' }, openJob.id);
    expect(r).toEqual({ ok: false, reason: 'duplicate', stage: 'new' });
    expect(s.getState().applications).toHaveLength(apps);
    expect(s.getState().candidates).toHaveLength(cands);
    expect(s.getState().candidates).toEqual(candSnap);
    expect(s.getState().activities).toEqual(actSnap);
  });

  it('saves linkedin on the candidate and fills it when blank on merge', () => {
    const { s, openJob } = setup();
    const other = s.getState().jobs.filter((j) => j.status === 'open')[1];
    const r = s.getState().applyFromCareers({ ...applicant, linkedin: 'https://linkedin.com/in/le' }, openJob.id);
    expect(r.ok && s.getState().candidates.find((c) => c.id === r.application.candidateId)?.linkedin).toBe('https://linkedin.com/in/le');
    const r2 = s.getState().applyFromCareers({ ...applicant, email: 'blank.li@example.com' }, openJob.id);
    s.getState().applyFromCareers({ ...applicant, email: 'blank.li@example.com', linkedin: 'linkedin.com/in/b' }, other.id);
    expect(r2.ok && s.getState().candidates.find((c) => c.id === r2.application.candidateId)?.linkedin).toBe('linkedin.com/in/b');
  });
});

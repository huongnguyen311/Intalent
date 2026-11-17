import { describe, expect, it } from 'vitest';
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
    const before = s.getState().candidates.length;
    const r = s.getState().applyFromCareers(applicant, openJob.id);
    expect(r.ok).toBe(true);
    expect(s.getState().candidates).toHaveLength(before + 1);
    const app = s.getState().applications.find((a) => a.jobId === openJob.id && a.candidateId === (r.ok && r.application.candidateId))!;
    expect(app).toMatchObject({ stage: 'new', source: 'Careers page', via: 'careers' });
    expect(app.campaignId).toBeUndefined();
  });

  it('apply with campaign src sets campaignId and channel source', () => {
    const { s, openJob, campaign } = setup();
    const r = s.getState().applyFromCareers(applicant, openJob.id, `${campaign.id}-linkedin`);
    expect(r.ok && r.application).toMatchObject({ via: 'campaign', source: 'LinkedIn', campaignId: campaign.id });
  });

  it('unknown src falls back to Careers page', () => {
    const { s, openJob } = setup();
    const r = s.getState().applyFromCareers(applicant, openJob.id, 'nope-facebook');
    expect(r.ok && r.application).toMatchObject({ via: 'careers', source: 'Careers page' });
    expect(r.ok && r.application.campaignId).toBeUndefined();
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
    const r = s.getState().applyFromCareers({ ...applicant, name: 'Other Name' }, openJob.id);
    expect(r).toEqual({ ok: false, reason: 'duplicate', stage: 'new' });
    expect(s.getState().applications).toHaveLength(apps);
    expect(s.getState().candidates).toHaveLength(cands);
  });
});

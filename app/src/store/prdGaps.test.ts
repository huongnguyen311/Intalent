import { jobStages } from '../domain/pipelineConfig';
import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { dashboardMetrics } from '../domain/metrics';
import { notificationsFor, unreadCount } from '../domain/notifications';
import { canMoveTo } from '../domain/permissions';
import { fieldsToCheck, parseReport } from '../domain/parseCv';
import { filterApplications } from '../domain/pipelineFilter';
import { END_STAGES, STAGES, CUSTOM_STAGES } from '../domain/stages';
import { formatMoney } from '../domain/hiring';
import { createDemoStore } from './store';
import { publicJobs } from './selectors';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}
const NOW = '2026-11-16T10:00:00.000Z';
const store = () => createDemoStore(memoryStorage(), () => NOW);

describe('PRD 3.5 pipeline stages', () => {
  it('follows the PRD order and ends with Hired / Rejected / Withdrawn', () => {
    expect(STAGES).toEqual(['new', 'ai_screening', 'screening', 'interview', 'assessment', 'final_interview', ...CUSTOM_STAGES, 'offer', 'hired', 'rejected', 'withdrawn']);
    expect(END_STAGES).toEqual(['hired', 'rejected', 'withdrawn']);
  });

  it('the seed has cards in every stage', () => {
    const s = buildSeed();
    // Every column of the default board has demo cards.
    for (const st of jobStages({})) expect(s.applications.some((a) => a.stage === st)).toBe(true);
  });

  it('a Hiring Manager moves one step forward through the new stages, never to Withdrawn', () => {
    const hm = { role: 'Hiring Manager' } as never;
    expect(canMoveTo(hm, { stage: 'interview' }, 'assessment')).toBe(true);
    expect(canMoveTo(hm, { stage: 'assessment' }, 'final_interview')).toBe(true);
    expect(canMoveTo(hm, { stage: 'interview' }, 'offer')).toBe(false);
    expect(canMoveTo(hm, { stage: 'interview' }, 'withdrawn')).toBe(false);
    expect(canMoveTo({ role: 'Recruiter' } as never, { stage: 'interview' }, 'withdrawn')).toBe(true);
  });

  it('moving to Withdrawn is logged with actor, time and from/to (AC-09)', () => {
    const s = store();
    const app = s.getState().applications.find((a) => a.stage === 'screening')!;
    expect(s.getState().moveStage(app.id, 'withdrawn', 'u-admin', undefined, 'Took another offer')).toBe(true);
    const moved = s.getState().applications.find((a) => a.id === app.id)!;
    expect(moved.history.slice(-1)[0]).toMatchObject({ stage: 'withdrawn', by: 'u-admin', at: NOW, note: 'Took another offer' });
  });
});

describe('PRD 3.2 job status On Hold', () => {
  it('hides the job from the careers page and logs the change', () => {
    const s = store();
    const job = s.getState().jobs.find((j) => j.status === 'open')!;
    s.getState().setJobStatus(job.id, 'on_hold');
    expect(publicJobs(s.getState()).some((j) => j.id === job.id)).toBe(false);
    expect(s.getState().activities.slice(-1)[0]).toMatchObject({ type: 'job_status_changed', jobId: job.id, detail: 'open → on_hold' });
  });
});

describe('PRD 3.2 / 6.1 money', () => {
  it('formats ISO currencies, not only VND and USD', () => {
    expect(formatMoney(3000, 'USD')).toBe('$3,000');
    expect(formatMoney(5000, 'EUR')).toBe('€5,000');
    expect(formatMoney(40_000_000, 'VND')).toBe('40.000.000 ₫');
  });
});

describe('PRD 3.8 dashboard', () => {
  it('counts new applications and interviews within the period', () => {
    const s = buildSeed();
    const m = dashboardMetrics(s, 'all', new Date());
    expect(m.recruitment.newApplications).toBe(s.applications.length);
    const interviews = s.applications.flatMap((a) => a.interviews ?? []).filter((i) => i.status !== 'cancelled').length;
    expect(m.recruitment.interviews).toBe(interviews);
  });
});

describe('PRD 3.5 pipeline filters', () => {
  it('filters by stage, recruiter and applied-within days', () => {
    const s = buildSeed();
    const now = Date.parse(NOW);
    expect(filterApplications(s.applications, s.candidates, { stage: 'offer' }).every((a) => a.stage === 'offer')).toBe(true);
    const by = s.applications[0].addedBy;
    expect(filterApplications(s.applications, s.candidates, { recruiter: by }).every((a) => a.addedBy === by)).toBe(true);
    const recent = filterApplications(s.applications, s.candidates, { sinceDays: 7 }, now);
    expect(recent.every((a) => Date.parse(a.addedAt) >= now - 7 * 86_400_000)).toBe(true);
  });
});

describe('PRD 3.4 / AC-07 parse confidence', () => {
  it('reports empty fields as missing (never invented) and flags low confidence', () => {
    const r = parseReport('Nguyen_Van_A.pdf', { name: 'Nguyen Van A', email: '', phone: '0901', english: '', skills: ['React'] }, NOW);
    expect(r.missing).toEqual(expect.arrayContaining(['email', 'english', 'title', 'seniority']));
    expect(r.confidence.email).toBeUndefined();
    for (const v of Object.values(r.confidence)) expect(v).toBeGreaterThanOrEqual(0.5);
    expect(fieldsToCheck(r).missing).toEqual(r.missing);
  });
});

describe('PRD AC-12 privacy and audit', () => {
  it('anonymizes PII, withdraws consent, removes emails and logs it', () => {
    const s = store();
    const c = s.getState().candidates.find((x) => x.email && s.getState().emails.some((e) => e.candidateId === x.id))
      ?? s.getState().candidates[0];
    s.getState().updateCandidate(c.id, { consents: [{ purpose: 'recruitment', policyVersion: '2026-11', at: NOW }] });
    expect(s.getState().anonymizeCandidate(c.id, 'u-admin')).toBe(true);
    const after = s.getState().candidates.find((x) => x.id === c.id)!;
    expect(after).toMatchObject({ email: '', phone: '', cv: '', anonymizedAt: NOW });
    expect(after.name).toMatch(/^Anonymized #/);
    expect(after.consents?.[0].withdrawnAt).toBe(NOW);
    expect(s.getState().emails.some((e) => e.candidateId === c.id)).toBe(false);
    expect(s.getState().activities.slice(-1)[0]).toMatchObject({ type: 'candidate_anonymized', candidateId: c.id, by: 'u-admin' });
    expect(s.getState().anonymizeCandidate(c.id, 'u-admin')).toBe(false);
  });

  it('careers applications store the consent with the policy version', () => {
    const s = store();
    const job = publicJobs(s.getState())[0];
    const r = s.getState().applyFromCareers({ name: 'Le Thi Consent', email: 'consent@example.demo', phone: '' }, job.id);
    expect(r.ok).toBe(true);
    const c = s.getState().candidates.find((x) => x.email === 'consent@example.demo')!;
    expect(c.consents?.[0]).toMatchObject({ purpose: 'recruitment', policyVersion: '2026-11' });
    expect(s.getState().activities.some((a) => a.type === 'consent_captured' && a.candidateId === c.id)).toBe(true);
  });

  it('logs user invitations and role changes', () => {
    const s = store();
    const r = s.getState().addUser({ name: 'Audit Me', email: 'audit@company.demo', role: 'Recruiter' });
    if (!r.ok) throw new Error('setup');
    expect(r.user.status).toBe('Invited');
    s.getState().setUserRole(r.user.id, 'Hiring Manager');
    const types = s.getState().activities.filter((a) => a.userId === r.user.id).map((a) => a.type);
    expect(types).toEqual(['user_invited', 'user_role_changed']);
  });
});

describe('PRD 3.8 notifications', () => {
  it('tells job owners about careers applications and stays read once seen', () => {
    const s = store();
    const job = publicJobs(s.getState())[0];
    s.getState().applyFromCareers({ name: 'Tran Notify', email: 'notify@example.demo', phone: '' }, job.id);
    const st = s.getState();
    const owner = st.users.find((u) => u.id === job.hiringManager)!;
    const list = notificationsFor(owner, st.activities, st.applications, st.jobs);
    const n = list.find((x) => x.kind === 'new_application' && x.jobId === job.id);
    expect(n).toBeDefined();
    expect(unreadCount([n!], undefined)).toBe(1);
    expect(unreadCount([n!], '2999-01-01T00:00:00.000Z')).toBe(0);
  });
});

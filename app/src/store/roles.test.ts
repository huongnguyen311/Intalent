import { describe, expect, it } from 'vitest';
import { can, candidateInScope, canMoveTo, homeFor, jobsInScope, normalizeRole } from '../domain/permissions';
import type { Job, User } from '../domain/types';
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
const NOW = '2026-11-16T10:00:00.000Z';
const user = (role: string, id = 'u-x'): User => ({ id, name: 'X', email: 'x@company.demo', role, status: 'Active', createdAt: '' });
const job = (id: string, hiringManager: string, collaborators: string[] = []) => ({ id, hiringManager, collaborators }) as unknown as Job;

describe('permissions', () => {
  it('maps legacy role names', () => {
    expect(normalizeRole('Admin')).toBe('Recruitment Lead');
    expect(normalizeRole('User')).toBe('Recruiter');
    expect(normalizeRole('Interviewer')).toBe('Interviewer');
  });

  it('follows the role matrix', () => {
    expect(can(user('Super Admin'), 'config')).toBe(true);
    expect(can(user('Recruitment Lead'), 'config')).toBe(false);
    expect(can(user('Recruitment Lead'), 'reports')).toBe(true);
    expect(can(user('Recruiter'), 'reports')).toBe(false);
    expect(can(user('Recruiter'), 'offer.manage')).toBe(true);
    expect(can(user('Hiring Manager'), 'pii')).toBe(false);
    expect(can(user('Hiring Manager'), 'offer.view')).toBe(true);
    expect(can(user('Hiring Manager'), 'offer.manage')).toBe(false);
    expect(can(user('Interviewer'), 'pipeline')).toBe(false);
    expect(can(user('Interviewer'), 'scorecard')).toBe(true);
    expect(can(user('Candidate'), 'review')).toBe(false);
  });

  it('scopes jobs per role', () => {
    const jobs = [job('a', 'u-x'), job('b', 'u-y', ['u-x']), job('c', 'u-y')];
    expect(jobsInScope(user('Recruitment Lead'), jobs)).toHaveLength(3);
    expect(jobsInScope(user('Recruiter'), jobs).map((j) => j.id)).toEqual(['a', 'b']);
    expect(jobsInScope(user('Hiring Manager'), jobs).map((j) => j.id)).toEqual(['a']);
    expect(jobsInScope(user('Interviewer'), jobs)).toEqual([]);
  });

  it('lets Hiring Managers only advance one step or reject', () => {
    const hm = user('Hiring Manager');
    expect(canMoveTo(hm, { stage: 'screening' }, 'interview')).toBe(true);
    expect(canMoveTo(hm, { stage: 'screening' }, 'offer')).toBe(false);
    expect(canMoveTo(hm, { stage: 'interview' }, 'new')).toBe(false);
    expect(canMoveTo(hm, { stage: 'offer' }, 'hired')).toBe(false);
    expect(canMoveTo(hm, { stage: 'offer' }, 'rejected')).toBe(true);
    expect(canMoveTo(user('Recruiter'), { stage: 'new' }, 'hired')).toBe(true);
    expect(canMoveTo(user('Interviewer'), { stage: 'new' }, 'screening')).toBe(false);
  });

  it("advances Hiring Managers to the job's own next column", () => {
    const hm = user('Hiring Manager');
    // Default pipeline: no AI Screening or Assessment column.
    const order = ['new', 'screening', 'interview', 'final_interview', 'offer', 'hired', 'rejected'] as const;
    expect(canMoveTo(hm, { stage: 'new' }, 'screening', [...order])).toBe(true);
    expect(canMoveTo(hm, { stage: 'interview' }, 'final_interview', [...order])).toBe(true);
    expect(canMoveTo(hm, { stage: 'final_interview' }, 'offer', [...order])).toBe(true);
    expect(canMoveTo(hm, { stage: 'interview' }, 'offer', [...order])).toBe(false);
    expect(canMoveTo(hm, { stage: 'offer' }, 'hired', [...order])).toBe(false);
  });

  it('sends each role to its own start page', () => {
    expect(homeFor(user('Candidate'))).toBe('/me');
    expect(homeFor(user('Interviewer'))).toBe('/my-interviews');
    expect(homeFor(user('Hiring Manager'))).toBe('/jobs');
    expect(homeFor(user('Recruiter'))).toBe('/');
  });

  it('limits candidate profiles to the jobs and interviews in scope', () => {
    const s = createDemoStore(memoryStorage(), () => NOW).getState();
    const hm = s.users.find((u) => u.id === 'u-nam')!;
    const inHmJob = s.applications.find((a) => s.jobs.find((j) => j.id === a.jobId)?.hiringManager === 'u-nam')!;
    const outside = s.candidates.find((c) => !s.applications.some((a) => a.candidateId === c.id))!;
    expect(candidateInScope(hm, inHmJob.candidateId, s.applications, s.jobs)).toBe(true);
    expect(candidateInScope(hm, outside.id, s.applications, s.jobs)).toBe(false);
    const iv = s.applications.find((a) => a.interviews?.some((i) => i.interviewers.includes('u-quang')))!;
    const interviewer = s.users.find((u) => u.id === 'u-quang')!;
    expect(candidateInScope(interviewer, iv.candidateId, s.applications, s.jobs)).toBe(true);
    expect(candidateInScope(interviewer, outside.id, s.applications, s.jobs)).toBe(false);
  });
});

describe('candidate self-service', () => {
  const setup = () => {
    const store = createDemoStore(memoryStorage(), () => NOW);
    const c = store.getState().candidates.find((x) => x.email && !x.suggestions)!;
    return { store, c, s: () => store.getState(), find: () => store.getState().candidates.find((x) => x.id === c.id)! };
  };

  it('signs in by email, creating the linked account once', () => {
    const { s, c } = setup();
    const before = s().users.length;
    const u = s().candidateSignIn(`  ${c.email.toUpperCase()} `)!;
    expect(u).toMatchObject({ role: 'Candidate', candidateId: c.id });
    expect(s().candidateSignIn(c.email)!.id).toBe(u.id);
    expect(s().users).toHaveLength(before + 1);
    expect(s().candidateSignIn('nobody@example.com')).toBeNull();
  });

  it('signs in by phone for people who applied without an email', () => {
    const { s, store } = setup();
    const c = s().candidates.find((x) => x.phone)!;
    store.setState({ candidates: s().candidates.map((x) => (x.id === c.id ? { ...x, email: '' } : x)) });
    const u = s().candidateSignIn(c.phone!.replace(/\D/g, ' '))!;
    expect(u).toMatchObject({ role: 'Candidate', candidateId: c.id });
    expect(s().candidateSignIn(c.phone!)!.id).toBe(u.id);
    expect(s().candidateSignIn('0000000000')).toBeNull();
  });

  it('applies contact changes at once, keeps the login email in sync and logs it', () => {
    const { s, c, find } = setup();
    const u = s().candidateSignIn(c.email)!;
    const r = s().selfUpdate(c.id, { email: 'new.mail@example.com', openToWork: true, location: ' Da Nang ' }, u.id);
    expect(r.ok).toBe(true);
    expect(find()).toMatchObject({ email: 'new.mail@example.com', openToWork: true, location: 'Da Nang' });
    expect(s().users.find((x) => x.id === u.id)!.email).toBe('new.mail@example.com');
    expect(s().activities.slice(-1)[0]).toMatchObject({ type: 'candidate_self_update', candidateId: c.id, by: u.id });
  });

  it('refuses a duplicate email and removing every contact', () => {
    const { s, c, find } = setup();
    const other = s().candidates.find((x) => x.id !== c.id && x.email)!;
    expect(s().selfUpdate(c.id, { email: other.email }, 'u')).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(s().selfUpdate(c.id, { email: '', phone: '' }, 'u')).toMatchObject({ ok: false, reason: 'no_contact' });
    expect(find().email).toBe(c.email);
  });

  it('keeps every uploaded CV version', () => {
    const { s, c, find } = setup();
    s().uploadCvVersion(c.id, 'cv-2026.pdf', 'u');
    s().uploadCvVersion(c.id, 'cv-2027.pdf', 'u');
    expect(find().cvVersions!.map((v) => v.fileName)).toEqual(['cv-2026.pdf', 'cv-2027.pdf']);
    expect(s().uploadCvVersion(c.id, '  ', 'u')).toBeNull();
  });

  it('only proposes standardised fields until HR approves', () => {
    const { s, c, find } = setup();
    const target = c.seniority === 'Lead' ? 'Senior' : 'Lead';
    expect(s().suggestChange(c.id, 'seniority', target)).toBe(true);
    expect(s().suggestChange(c.id, 'skills', [' Go ', 'Go', 'Rust'])).toBe(true);
    expect(find().seniority).toBe(c.seniority);
    expect(find().suggestions!.find((x) => x.field === 'skills')!.value).toEqual(['Go', 'Rust']);
    const sen = find().suggestions!.find((x) => x.field === 'seniority')!;
    expect(s().reviewSuggestion(c.id, sen.id, true, 'u-thu')).toBe(true);
    expect(find().seniority).toBe(target);
    const sk = find().suggestions!.find((x) => x.field === 'skills')!;
    expect(s().reviewSuggestion(c.id, sk.id, false, 'u-thu')).toBe(true);
    expect(find().skills).toEqual(c.skills);
    expect(find().suggestions).toEqual([]);
    expect(s().activities.slice(-1)[0]).toMatchObject({ type: 'suggestion_reviewed', by: 'u-thu' });
  });

  it('proposing the current value withdraws the pending proposal', () => {
    const { s, c, find } = setup();
    s().suggestChange(c.id, 'english', 'Fluent-ish');
    s().suggestChange(c.id, 'english', c.english);
    expect(find().suggestions ?? []).toEqual([]);
  });
});

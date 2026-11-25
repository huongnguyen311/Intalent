import { jobStages } from '../domain/pipelineConfig';
import { jobPostFromJd } from '../domain/jobPost';
import { buildSeed, mulberry32, SEED_BASE_TIME } from './seed';
import { isOverSla } from '../domain/pipeline';
import { buildMockupFixture, isFixtureMode } from './fixtureMockup';
import { normalizeEmail, normalizePhone } from '../domain/normalize';
import { SOURCE_CAREERS, SOURCE_CV_UPLOAD, SOURCE_MANUAL, SOURCE_REFERRAL } from '../domain/sources';
import { createDemoStore } from '../store/store';

describe('seed', () => {
  it('every seeded application has one AI evaluation and none are pending', () => {
    const s = buildSeed();
    expect(s.applications.every((a) => a.aiEvaluations?.length === 1 && !a.aiPending)).toBe(true);
  });

  it('seed source labels match the live flows', () => {
    const s = buildSeed();
    const known = new Set([SOURCE_CAREERS, SOURCE_CV_UPLOAD, SOURCE_REFERRAL, SOURCE_MANUAL]);
    expect(s.candidates.every((c) => known.has(c.source))).toBe(true);
    const careers = s.applications.filter((a) => a.via === 'careers');
    expect(careers.length).toBeGreaterThan(0);
    expect(careers.every((a) => a.source === SOURCE_CAREERS)).toBe(true);
    expect(s.applications.some((a) => a.source === 'Careers site')).toBe(false);
  });

  it('every seeded job carries its post content from its JD', () => {
    const s = buildSeed();
    for (const job of s.jobs) {
      const jd = s.jds.find((d) => d.id === job.jdId)!;
      expect(job.summary, job.id).toBeTruthy();
      expect(job.mustHave, job.id).toEqual(jobPostFromJd(jd).mustHave);
      expect(job.skills, job.id).toEqual(jd.skills);
    }
  });

  it('seed volumes match spec', () => {
    const s = buildSeed();
    expect(s.candidates).toHaveLength(150);
    // 8 staff (one demo account per internal role at least) + 2 candidate logins.
    expect(s.users.filter((u) => u.role !== 'Candidate')).toHaveLength(8);
    expect(s.users.filter((u) => u.role === 'Candidate' && u.candidateId)).toHaveLength(2);
    expect(s.users.some((u) => u.email === 'admin@company.demo' && u.role === 'Super Admin')).toBe(true);
    expect(s.jobs).toHaveLength(7);
    expect(s.jobs.filter((j) => j.status === 'open')).toHaveLength(5);
    // The one unpublished job waits for approval, so the approval flow can be demoed straight away.
    expect(s.jobs.filter((j) => j.status === 'pending_approval')).toHaveLength(1);
    expect(s.jobs.filter((j) => j.status === 'closed')).toHaveLength(1);
    expect(s.applications).toHaveLength(49);
    // Every column of the default board has cards; optional columns (AI Screening, Assessment, custom...) start empty.
    for (const stage of jobStages({})) {
      expect(s.applications.some((a) => a.stage === stage)).toBe(true);
    }
    expect(new Set(s.campaigns.map((c) => c.status))).toEqual(new Set(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']));
    expect(s.notes).toHaveLength(10);
    expect(s.jds.map((j) => j.title)).toEqual([
      'Senior Growth Marketing Lead',
      'Tech Lead / Senior Engineer',
      'Senior Frontend Developer',
      'Senior Flutter & Java Engineer',
      'Senior Backend Engineer (Node.js)',
    ]);
    expect(s.taxonomy.filter((t) => t.kind === 'english').map((t) => t.label)).toEqual([
      'Advanced', 'Intermediate', 'Basic', 'Fluent',
    ]);
    expect(s.prompts.filter((p) => !/^(email|content)-/.test(p.id)).map((p) => p.name)).toEqual([
      'Candidate Evaluation', 'Jd Matching', 'Jd Generation', 'Cv Extraction Batch',
    ]);
    expect(s.meta).toBeUndefined();
  });

  it('seed has no duplicate normalized emails or phones', () => {
    const { candidates } = buildSeed();
    const emails = candidates.map((c) => normalizeEmail(c.email)).filter(Boolean);
    const phones = candidates.map((c) => normalizePhone(c.phone)).filter(Boolean);
    expect(new Set(emails).size).toBe(emails.length);
    expect(new Set(phones).size).toBe(phones.length);
  });

  it('every application references existing candidate and job', () => {
    const s = buildSeed();
    const cands = new Set(s.candidates.map((c) => c.id));
    const jobs = new Map(s.jobs.map((j) => [j.id, j]));
    const camps = new Map(s.campaigns.map((c) => [c.id, c]));
    const pairs = new Set<string>();
    for (const a of s.applications) {
      expect(cands.has(a.candidateId)).toBe(true);
      expect(jobs.has(a.jobId)).toBe(true);
      expect(a.source).toBeTruthy();
      if (a.via === 'campaign') expect(a.source).toBe(camps.get(a.campaignId!)?.name);
      if (a.stage === 'rejected') expect(a.rejectedReason).toBeTruthy();
      expect(a.history[a.history.length - 1].stage).toBe(a.stage);
      pairs.add(`${a.candidateId}|${a.jobId}`);
    }
    expect(pairs.size).toBe(s.applications.length);
    for (const j of s.jobs) expect(s.jds.some((d) => d.id === j.jdId)).toBe(true);
  });

  it('seed is deterministic', () => {
    expect(buildSeed()).toEqual(buildSeed());
    expect(buildSeed(mulberry32(1))).not.toEqual(buildSeed(mulberry32(2)));
  });

  it('most active applications are within their stage SLA at seed time', () => {
    for (const base of [SEED_BASE_TIME, Date.parse('2027-03-01T08:00:00.000Z')]) {
      const s = buildSeed(undefined, base);
      const jobs = new Map(s.jobs.map((j) => [j.id, j]));
      const active = s.applications.filter((a) => a.stage !== 'hired' && a.stage !== 'rejected');
      const over = active.filter((a) => isOverSla(a, jobs.get(a.jobId)!, base));
      expect(over.length).toBeGreaterThan(0);
      expect(over.length / active.length).toBeLessThan(0.3);
    }
  });

  it('timestamps are relative to the reference time', () => {
    const base = Date.parse('2027-03-01T08:00:00.000Z');
    const shift = base - SEED_BASE_TIME;
    const a = buildSeed(undefined, SEED_BASE_TIME).applications[0];
    const b = buildSeed(undefined, base).applications[0];
    expect(Date.parse(b.stageEnteredAt) - Date.parse(a.stageEnteredAt)).toBe(shift);
    expect(Date.parse(b.stageEnteredAt)).toBeLessThanOrEqual(base);
  });

  it('seed uses only fictional email domains', () => {
    const s = buildSeed();
    const emails = [...s.candidates.map((c) => c.email), ...s.users.map((u) => u.email)].filter(Boolean);
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e).toMatch(/@(example\.com|company\.demo)$/);
  });
});

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('mockup fixture', () => {
  it('reproduces the 10 candidate rows including both Thinh rows', () => {
    const f = buildMockupFixture();
    expect(f.candidates).toHaveLength(10);
    expect(f.candidates.map((c) => c.name)).toEqual([
      'PHAM MINH KHOA', 'Võ Thành Đạt', 'Hoang Gia Bao', 'NGO DUC THINH', 'LAM VAN HAI',
      'Ngô Đức Thịnh', 'Truong Quoc Viet', 'MAI TUAN (KEVIN)', 'Đặng Thị Thu Hà', 'BUI NGOC ANH',
    ]);
    const [a, b] = [f.candidates[3], f.candidates[5]];
    expect(a.phone).toBe(b.phone);
    expect(a.email).not.toBe(b.email);
    expect(f.candidates.every((c) => /@example\.com$/.test(c.email))).toBe(true);
  });

  it('carries the mockup totals as meta overrides', () => {
    const t = buildMockupFixture().meta!.totals!;
    expect(t.dashboard.totalCandidates).toBe(781);
    expect(t.dashboard.activeCandidates).toBe(781);
    expect(t.dashboard.parsing).toEqual({ ok: 891, of: 1000 });
    expect(t.dashboard.missingEmail).toBe(95);
    expect(t.dashboard.topStacks.map((s) => s.pct)).toEqual([18.12, 17.9, 17.74, 16.81, 14.79, 14.63]);
    expect(t.dashboard.seniority.map((s) => s.count)).toEqual([5, 95, 182, 411, 57, 25, 2]);
    expect(t.dashboard.contributors.map((c) => c.total)).toEqual([170, 138, 4]);
    expect(t.dashboard.english.map((e) => e.count)).toEqual([379, 354, 36]);
    expect(t.dashboard.domains.map((d) => d.pct)).toEqual([38, 25, 14, 14, 10]);
    expect(t.users).toEqual({ total: 17, superAdmins: 9, admins: 3, users: 5 });
    expect(t.taContribution.rows).toHaveLength(4);
    expect(t.taContribution.totals.total).toBe(312);
  });

  it('shows 10 users, 4 JDs, 4 english levels, 4 prompts and no pipeline data', () => {
    const f = buildMockupFixture();
    expect(f.users).toHaveLength(10);
    expect(f.jds).toHaveLength(4);
    expect(f.taxonomy).toHaveLength(4);
    expect(f.prompts).toHaveLength(4);
    expect(f.applications).toHaveLength(0);
    expect(f.jobs).toHaveLength(0);
  });

  it('isFixtureMode reads ?fixture=mockup', () => {
    expect(isFixtureMode('?fixture=mockup')).toBe(true);
    expect(isFixtureMode('?x=1&fixture=mockup')).toBe(true);
    expect(isFixtureMode('?fixture=other')).toBe(false);
    expect(isFixtureMode('')).toBe(false);
  });

  it('a store seeded with the fixture does not touch storage', () => {
    const calls: string[] = [];
    const spy = {
      length: 0,
      clear: () => calls.push('clear'),
      getItem: (k: string) => (calls.push(`get ${k}`), null),
      key: () => null,
      removeItem: () => calls.push('remove'),
      setItem: (k: string) => calls.push(`set ${k}`),
    } as Storage;
    const store = createDemoStore(spy, undefined, { fixture: true });
    expect(store.getState().candidates).toHaveLength(10);
    store.getState().addNote({ name: 'x', contact: 'y', text: 'z' }, 'u-admin');
    expect(calls).toEqual([]);
    store.getState().resetDemo();
    expect(store.getState().candidates).toHaveLength(10);
    expect(store.getState().notes).toHaveLength(0);
  });

  it('seeds urgent jobs and an overdue one', async () => {
    const { isOverdue, isUrgent, todayIso } = await import('../domain/jobUrgency');
    const s = buildSeed();
    expect(s.jobs.filter(isUrgent).length).toBeGreaterThanOrEqual(2);
    expect(s.jobs.filter((j) => isOverdue(j, s.applications, todayIso())).length).toBeGreaterThanOrEqual(1);
  });
});

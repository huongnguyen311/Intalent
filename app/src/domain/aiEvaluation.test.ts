import { describe, expect, it } from 'vitest';
import { AI_MODEL, evaluateApplication, findEvidence, latestEvaluation, requirementsForJob } from './aiEvaluation';
import type { Candidate, Job } from './types';

const base: Candidate = {
  id: 'c', name: 'Test Person', title: 'Frontend Developer', email: 't@example.com', phone: '', seniority: 'Senior',
  english: 'Advanced', skills: ['React', 'TypeScript'], domains: ['Healthcare'], tags: [], groups: [],
  cvOwner: 'u-admin', source: 'Upload', inTalentPool: true, createdAt: '2026-01-01', cv: '',
};
const req = { stack: ['React', 'TypeScript', 'Vue'], seniority: 'Senior', years: 5, domains: ['Healthcare', 'SaaS'], english: 'Intermediate' };
const AT = '2026-11-18T08:00:00.000Z';

describe('evaluateApplication', () => {
  it('breakdown sums to score with maxes 40/30/20/10', () => {
    const e = evaluateApplication(base, req, AT, 'ai-1');
    expect(e.breakdown.map((b) => [b.key, b.max])).toEqual([['stack', 40], ['experience', 30], ['domain', 20], ['english', 10]]);
    expect(e.breakdown.reduce((s, b) => s + b.points, 0)).toBe(e.score);
  });

  it('strengths and gaps are stored as i18n keys with params', () => {
    const e = evaluateApplication(base, req, AT, 'ai-1');
    expect(e.strengths).toContainEqual(expect.objectContaining({ criterion: 'stack', key: 'ai.f.has', params: { s: 'React' } }));
    expect(e.gaps).toContainEqual(expect.objectContaining({ criterion: 'stack', key: 'ai.f.noSkill', params: { s: 'Vue' } }));
    expect(e.gaps).toContainEqual(expect.objectContaining({ criterion: 'domain', key: 'ai.f.noDomain', params: { d: 'SaaS' } }));
    expect(e.questions).toContainEqual({ key: 'ai.q.skill', params: { s: 'Vue' } });
  });

  it('flags a JD without criteria instead of scoring 100', () => {
    const e = evaluateApplication(base, { stack: [] }, AT, 'ai-1');
    expect(e.noCriteria).toBe(true);
    expect(e.score).toBe(0);
    expect(e.strengths).toEqual([]);
    expect(e.gaps).toEqual([{ criterion: 'stack', key: 'ai.f.noCriteria' }]);
    expect(e.questions).toEqual([{ key: 'ai.q.noCriteria' }]);
  });

  it('cites a CV sentence as evidence', () => {
    const cv = 'Senior engineer. Built dashboards in React and TypeScript for clinics.';
    const e = evaluateApplication({ ...base, cv }, req, AT, 'ai-1');
    const react = e.strengths.find((f) => f.params?.s === 'React')!;
    expect(react.evidence).toBe('Built dashboards in React and TypeScript for clinics.');
    expect(cv).toContain(react.evidence!);
  });

  it('never invents evidence', () => {
    const e = evaluateApplication({ ...base, cv: '' }, req, AT, 'ai-1');
    expect([...e.strengths, ...e.gaps].every((f) => f.evidence === undefined)).toBe(true);
  });

  it('asks one question per gap', () => {
    const e = evaluateApplication({ ...base, english: 'Basic', seniority: 'Junior' }, req, AT, 'ai-1');
    expect(e.gaps.length).toBeGreaterThan(0);
    expect(e.questions).toHaveLength(e.gaps.length);
    expect(e.questions.every((q) => q.key.startsWith('ai.q.'))).toBe(true);
  });

  it('passes model, id and time through', () => {
    const e = evaluateApplication(base, req, AT, 'ai-9');
    expect(e).toMatchObject({ id: 'ai-9', at: AT, model: 'intalent-match-v1' });
    expect(AI_MODEL).toBe('intalent-match-v1');
  });

  it('handles a job without a JD', () => {
    const job = { id: 'j', jdId: 'missing' } as Job;
    const r = requirementsForJob(job, [], []);
    expect(r).toEqual({ stack: [] });
    expect(Number.isFinite(evaluateApplication(base, r, AT, 'ai-1').score)).toBe(true);
  });
});

describe('findEvidence', () => {
  it('searches experience descriptions too', () => {
    const c = { ...base, experience: [{ title: 'Dev', company: 'X', start: '2020-01', end: '', description: 'Shipped a Vue app.' }] };
    expect(findEvidence(c, 'Vue')).toBe('Shipped a Vue app.');
    expect(findEvidence(c, 'Kafka')).toBeUndefined();
  });
});

describe('latestEvaluation', () => {
  it('returns the newest version or undefined', () => {
    const a = evaluateApplication(base, req, AT, 'a');
    const b = evaluateApplication(base, req, AT, 'b');
    expect(latestEvaluation({ aiEvaluations: [a, b] })?.id).toBe('b');
    expect(latestEvaluation({})).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import type { Candidate } from './types';
import { parseQuery, scoreCandidate, searchCandidates } from './scoring';

const base: Candidate = {
  id: 'c', name: 'Test Person', title: 'Frontend Developer', email: 't@example.com', phone: '', seniority: 'Senior',
  english: 'Advanced', skills: ['React', 'TypeScript', 'Vue'], domains: ['Healthcare', 'SaaS'], tags: [], groups: [],
  cvOwner: 'u-admin', source: 'Upload', inTalentPool: true, createdAt: '2026-01-01', cv: '',
};
const req = { stack: ['React', 'TypeScript', 'Vue'], seniority: 'Senior', years: 5, domains: ['Healthcare', 'SaaS'], english: 'Intermediate' };

describe('scoreCandidate', () => {
  it('full stack match scores higher than partial', () => {
    const full = scoreCandidate(base, req);
    const partial = scoreCandidate({ ...base, skills: ['React'], domains: [] }, req);
    expect(full.score).toBe(100);
    expect(partial.score).toBeLessThan(full.score);
  });

  it('critical skills count double in the stack score', () => {
    const onlyReact = { ...base, skills: ['React'] };
    // React is 1 of 3 skills (13 / 40), or 2 of 4 weight points when critical (20 / 40).
    expect(scoreCandidate(onlyReact, req).breakdown.stack).toBe(13);
    expect(scoreCandidate(onlyReact, { ...req, critical: ['react'] }).breakdown.stack).toBe(20);
    expect(scoreCandidate({ ...base, skills: ['TypeScript', 'Vue'] }, { ...req, critical: ['React'] }).breakdown.stack).toBe(20);
  });

  it('breakdown sums to score', () => {
    const r = scoreCandidate({ ...base, skills: ['React'], english: 'Basic' }, req);
    const { stack, experience, domain, english } = r.breakdown;
    expect(stack + experience + domain + english).toBe(r.score);
  });

  it('missing skills listed', () => {
    const r = scoreCandidate({ ...base, skills: ['react', 'Node.js'] }, req);
    expect(r.have).toEqual(['React']);
    expect(r.miss).toEqual(['TypeScript', 'Vue']);
    expect(r.reason).toContain('Vue');
  });

  it('weights stack 40, experience+seniority 30, domain 20, English 10', () => {
    const only = (patch: Partial<Candidate>, r: Parameters<typeof scoreCandidate>[1]) =>
      scoreCandidate({ ...base, skills: [], seniority: 'Intern', domains: [], english: '', ...patch }, r).score;
    expect(only({ skills: ['React'] }, { stack: ['React'], seniority: 'Senior', years: 5, domains: ['SaaS'], english: 'Advanced' })).toBe(40);
    expect(only({ seniority: 'Senior' }, { stack: ['React'], seniority: 'Senior', years: 5, domains: ['SaaS'], english: 'Advanced' }))
      .toBe(30 * 1 + 0 + 0 + 0);
    expect(only({ domains: ['SaaS'] }, { stack: ['React'], seniority: 'Senior', years: 5, domains: ['SaaS'], english: 'Advanced' })).toBe(20);
    expect(only({ english: 'Advanced' }, { stack: ['React'], seniority: 'Senior', years: 5, domains: ['SaaS'], english: 'Advanced' })).toBe(10);
  });

  it('matches skill aliases and a lower English level earns partial credit', () => {
    const r = scoreCandidate({ ...base, skills: ['ReactJS', 'TS'], english: 'Intermediate' }, { stack: ['React', 'TypeScript'], english: 'Advanced' });
    expect(r.miss).toEqual([]);
    expect(r.score).toBe(95);
  });
});

describe('parseQuery', () => {
  const taxonomy = buildSeed().taxonomy;

  it('reads "senior .Net, tiếng Anh tốt"', () => {
    expect(parseQuery('senior .Net, tiếng Anh tốt', taxonomy)).toEqual({ stack: ['.NET'], seniority: 'Senior', english: 'Advanced' });
  });

  it('reads English words, years and domains', () => {
    const q = parseQuery('Looking for a junior React and TypeScript dev, 3 years, healthcare, good English', taxonomy);
    expect(q).toEqual({ stack: ['React', 'TypeScript'], seniority: 'Junior', years: 3, domains: ['Healthcare'], english: 'Advanced' });
  });

  it('expands a role keyword and returns no criteria for chit-chat', () => {
    expect(parseQuery('Frontend Developer', taxonomy).stack).toContain('React');
    expect(parseQuery('hello there', taxonomy)).toEqual({ stack: [] });
  });
});

describe('searchCandidates', () => {
  it('ranks matches by score and drops candidates with none of the requested stack', () => {
    const cands = [
      { ...base, id: 'a', skills: ['React'] },
      { ...base, id: 'b', skills: ['React', 'TypeScript'] },
      { ...base, id: 'c', skills: ['Python'] },
    ];
    const out = searchCandidates(cands, { stack: ['React', 'TypeScript'] });
    expect(out.map((r) => r.candidate.id)).toEqual(['b', 'a']);
  });
});

import { describe, expect, it } from 'vitest';
import { filterCandidates } from './filters';
import type { Candidate } from './types';

const make = (o: Partial<Candidate> & { id: string; name: string }): Candidate => ({
  title: '', email: '', phone: '', seniority: 'Mid', english: 'Advanced', skills: [], domains: [], tags: [],
  groups: [], cvOwner: 'u-thu', source: 'Manual', inTalentPool: true, createdAt: '2026-01-01T00:00:00.000Z', cv: '',
  ...o,
});

const A = make({ id: 'a', name: 'An Nguyen', email: 'an@example.com', title: 'Frontend Engineer', seniority: 'Senior', skills: ['React', 'TypeScript'], createdAt: '2026-03-01T00:00:00.000Z', tags: ['vip'] });
const B = make({ id: 'b', name: 'Binh Tran', email: 'binh@example.com', title: 'Data Analyst', seniority: 'Junior', skills: ['SQL'], english: 'Basic', cvOwner: 'u-huy', createdAt: '2026-02-01T00:00:00.000Z' });
const C = make({ id: 'c', name: 'Chi Le', email: 'chi@example.com', title: 'Backend Engineer', seniority: 'Senior', skills: ['Node.js'], createdAt: '2026-04-01T00:00:00.000Z', tags: ['vip', 'remote'] });
const ALL = [A, B, C];
const ids = (l: Candidate[]) => l.map((c) => c.id);

describe('filterCandidates', () => {
  it('filters by seniority and stack', () => {
    expect(ids(filterCandidates(ALL, { seniority: 'Senior' }, 'name'))).toEqual(['a', 'c']);
    expect(ids(filterCandidates(ALL, { seniority: 'Senior', stack: 'react' }, 'name'))).toEqual(['a']);
  });

  it('text search matches name, email, title', () => {
    expect(ids(filterCandidates(ALL, { text: 'binh' }, 'name'))).toEqual(['b']);
    expect(ids(filterCandidates(ALL, { text: 'chi@EXAMPLE' }, 'name'))).toEqual(['c']);
    expect(ids(filterCandidates(ALL, { text: 'engineer' }, 'name'))).toEqual(['a', 'c']);
  });

  it('filters by english, owner and tags (all tags must match)', () => {
    expect(ids(filterCandidates(ALL, { english: 'Basic' }, 'name'))).toEqual(['b']);
    expect(ids(filterCandidates(ALL, { owner: 'u-huy' }, 'name'))).toEqual(['b']);
    expect(ids(filterCandidates(ALL, { tags: ['vip', 'remote'] }, 'name'))).toEqual(['c']);
  });

  it('sorts newest first, by name, or by seniority (high to low)', () => {
    expect(ids(filterCandidates(ALL, {}, 'newest'))).toEqual(['c', 'a', 'b']);
    expect(ids(filterCandidates(ALL, {}, 'name'))).toEqual(['a', 'b', 'c']);
    expect(ids(filterCandidates(ALL, {}, 'seniority'))).toEqual(['a', 'c', 'b']);
  });

  it('gap keeps only candidates with that CV-quality gap', () => {
    const noEmail = make({ id: 'd', name: 'Dung', createdAt: '2026-11-20T00:00:00.000Z' });
    expect(ids(filterCandidates([...ALL, noEmail], { gap: 'email' }, 'name', new Date('2026-11-25')))).toEqual(['d']);
  });

  it('since keeps candidates created within the period', () => {
    const recent = make({ id: 'r', name: 'Rin', email: 'r@x', createdAt: '2026-11-20T00:00:00.000Z' });
    expect(ids(filterCandidates([...ALL, recent], { since: '3m' }, 'name', new Date('2026-11-25')))).toEqual(['r']);
  });
});

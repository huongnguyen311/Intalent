import { describe, expect, it } from 'vitest';
import { activeApplicationsByCandidate, filterCandidates, poolStateFromParams, poolStateToParams, type PoolState } from './filters';
import type { Application, Candidate } from './types';

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
    expect(ids(filterCandidates(ALL, { seniorities: ['Senior'] }, 'name'))).toEqual(['a', 'c']);
    expect(ids(filterCandidates(ALL, { seniorities: ['Senior'], stack: 'react' }, 'name'))).toEqual(['a']);
  });

  it('several seniorities match any of them', () => {
    expect(ids(filterCandidates(ALL, { seniorities: ['Senior', 'Junior'] }, 'name'))).toEqual(['a', 'b', 'c']);
  });

  it('comma-separated stack needs every term', () => {
    expect(ids(filterCandidates(ALL, { stack: 'react, typescript' }, 'name'))).toEqual(['a']);
    expect(ids(filterCandidates(ALL, { stack: 'react, sql' }, 'name'))).toEqual([]);
  });

  it('text search also matches phone digits and skills', () => {
    const P = make({ id: 'p', name: 'Phuong', phone: '+84 912 345 678', skills: ['Golang'] });
    expect(ids(filterCandidates([...ALL, P], { text: '0912345' }, 'name'))).toEqual([]);
    expect(ids(filterCandidates([...ALL, P], { text: '912 345' }, 'name'))).toEqual(['p']);
    expect(ids(filterCandidates([...ALL, P], { text: 'golang' }, 'name'))).toEqual(['p']);
    expect(ids(filterCandidates([...ALL, P], { text: 'sql' }, 'name'))).toEqual(['b']);
  });

  it('filters by open to work, location, domain and pipeline status', () => {
    const X = make({ id: 'x', name: 'Xuan', openToWork: true, location: 'Ha Noi', domains: ['Fintech'] });
    const all = [...ALL, X];
    expect(ids(filterCandidates(all, { openToWork: true }, 'name'))).toEqual(['x']);
    expect(ids(filterCandidates(all, { openToWork: false }, 'name'))).toEqual(['a', 'b', 'c']);
    expect(ids(filterCandidates(all, { location: 'Ha Noi' }, 'name'))).toEqual(['x']);
    expect(ids(filterCandidates(all, { domain: 'Fintech' }, 'name'))).toEqual(['x']);
    const active = new Set(['b']);
    expect(ids(filterCandidates(all, { inPipeline: true }, 'name', new Date(), active))).toEqual(['b']);
    expect(ids(filterCandidates(all, { inPipeline: false }, 'name', new Date(), active))).toEqual(['a', 'c', 'x']);
  });

  it('sorts by last CV update', () => {
    const U = make({ id: 'u', name: 'Uyen', createdAt: '2025-01-01T00:00:00.000Z', cvVersions: [{ id: 'v', fileName: 'cv.pdf', at: '2026-10-01T00:00:00.000Z', by: 'u' }] });
    expect(ids(filterCandidates([...ALL, U], {}, 'updated'))).toEqual(['u', 'c', 'a', 'b']);
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

describe('activeApplicationsByCandidate', () => {
  it('keeps only in-progress applications, newest first', () => {
    const app = (id: string, candidateId: string, stage: string, addedAt: string) =>
      ({ id, candidateId, jobId: 'j', stage, addedAt } as unknown as Application);
    const m = activeApplicationsByCandidate([
      app('1', 'a', 'screening', '2026-01-01'),
      app('2', 'a', 'interview', '2026-02-01'),
      app('3', 'b', 'hired', '2026-02-01'),
      app('4', 'c', 'rejected', '2026-02-01'),
    ]);
    expect([...m.keys()]).toEqual(['a']);
    expect(m.get('a')!.map((x) => x.id)).toEqual(['2', '1']);
  });
});

describe('pool URL state', () => {
  it('round-trips filters, sort and page and keeps foreign params', () => {
    const state: PoolState = {
      q: { text: 'an', seniorities: ['Senior', 'Lead'], stack: 'react, node', tags: ['vip'], openToWork: true, inPipeline: false, location: 'Ha Noi', domain: 'Fintech', gap: 'email', since: '3m' },
      sort: 'updated',
      page: 3,
    };
    const p = poolStateToParams(state, new URLSearchParams('fixture=mockup&page=9'));
    expect(p.get('fixture')).toBe('mockup');
    expect(poolStateFromParams(p)).toEqual(state);
  });

  it('defaults and ignores bad values', () => {
    expect(poolStateFromParams(new URLSearchParams('sort=bogus&page=-2&gap=foo&since=3m&open=x'))).toEqual({ q: {}, sort: 'newest', page: 1 });
    expect(poolStateToParams({ q: {}, sort: 'newest', page: 1 }).toString()).toBe('');
  });
});

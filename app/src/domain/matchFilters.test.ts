import { describe, expect, it } from 'vitest';
import { filterMatches, sortMatches } from './matchFilters';
import type { MatchRow } from './types';

const row = (o: Partial<MatchRow>): MatchRow => ({
  candidateId: o.name ?? 'x', name: 'x', title: 't', score: 80, seniority: 'Senior', years: 6, english: 'Advanced',
  have: [], miss: [], reason: '', ...o,
});
const TODAY = '2026-11-26';

describe('filterMatches', () => {
  const rows = [
    row({ name: 'jr', seniority: 'Junior', english: 'Basic', availableFrom: '2027-03-01', openToWork: false, workModes: ['onsite'] }),
    row({ name: 'sr', seniority: 'Senior', english: 'Advanced', availableFrom: '2026-12-05', workModes: ['remote'] }),
    row({ name: 'lead', seniority: 'Lead', english: 'Fluent' }),
  ];
  const names = (f: Parameters<typeof filterMatches>[1]) => filterMatches(rows, f, TODAY).map((r) => r.name);

  it('keeps everyone with no filters', () => expect(names({})).toEqual(['jr', 'sr', 'lead']));
  it('minimum seniority', () => expect(names({ seniority: 'Senior' })).toEqual(['sr', 'lead']));
  it('minimum English', () => expect(names({ english: 'Advanced' })).toEqual(['sr', 'lead']));
  it('Upper-Intermediate sits between Intermediate and Advanced', () => {
    const r = [row({ name: 'i', english: 'Intermediate' }), row({ name: 'u', english: 'Upper-Intermediate' }), row({ name: 'a', english: 'Advanced' })];
    expect(filterMatches(r, { english: 'Upper-Intermediate' }, TODAY).map((x) => x.name)).toEqual(['u', 'a']);
  });
  it('work mode keeps people who did not state one', () => expect(names({ mode: 'remote' })).toEqual(['sr', 'lead']));
  it('available within N days keeps people with no date', () => expect(names({ withinDays: 30 })).toEqual(['sr', 'lead']));
  it('location matches exactly and keeps people with none', () => {
    const r = [row({ name: 'h', location: 'Hanoi' }), row({ name: 's', location: 'Ho Chi Minh City' }), row({ name: 'n' })];
    expect(filterMatches(r, { location: 'hanoi' }, TODAY).map((x) => x.name)).toEqual(['h', 'n']);
  });
  it('drops only those explicitly not open to work', () => expect(names({ openOnly: true })).toEqual(['sr', 'lead']));
});

describe('sortMatches', () => {
  const rows = [
    row({ name: 'a', score: 90, rate: 3000, years: 4, availableFrom: '2027-01-01' }),
    row({ name: 'b', score: 70, years: 9, availableFrom: '2026-12-01' }),
    row({ name: 'c', score: 80, rate: 1500, years: 6 }),
  ];
  const order = (s: Parameters<typeof sortMatches>[1]) => sortMatches(rows, s).map((r) => r.name);

  it('score high to low', () => expect(order('score')).toEqual(['a', 'c', 'b']));
  it('rate low to high, unknown rate last', () => expect(order('rate')).toEqual(['c', 'a', 'b']));
  it('soonest start, unknown last', () => expect(order('available')).toEqual(['b', 'a', 'c']));
  it('most experience first', () => expect(order('experience')).toEqual(['b', 'c', 'a']));
});

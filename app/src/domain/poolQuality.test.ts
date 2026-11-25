import { describe, expect, it } from 'vitest';
import { GAPS, isGap, matchesGap, poolQuality } from './poolQuality';
import type { Candidate } from './types';

const NOW = new Date('2026-11-25T09:00:00.000Z');

function cand(p: Partial<Candidate> = {}): Candidate {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'A',
    title: 'Dev',
    email: 'a@x.demo',
    phone: '0900',
    seniority: 'Senior',
    english: 'Advanced',
    skills: ['Go'],
    domains: [],
    tags: [],
    groups: [],
    cvOwner: 'u-admin',
    source: 'Upload',
    inTalentPool: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    cv: '',
    consents: [{ purpose: 'recruitment', policyVersion: '1', at: '2026-11-01T00:00:00.000Z' }],
    ...p,
  };
}

describe('poolQuality', () => {
  it('complete profile counts only when all five fields present', () => {
    const q = poolQuality([cand(), cand({ email: '  ' }), cand({ skills: [] })], NOW);
    expect(q.total).toBe(3);
    expect(q.complete).toBe(1);
    expect(q.missing.email).toBe(1);
    expect(q.missing.skills).toBe(1);
    expect(q.missing.phone).toBe(0);
  });

  it('freshness buckets by latest CV upload, falling back to createdAt', () => {
    const q = poolQuality(
      [
        cand({ createdAt: '2025-01-01T00:00:00.000Z', cvVersions: [{ id: 'v', fileName: 'a.pdf', at: '2026-10-01T00:00:00.000Z', by: 'u' }] }),
        cand({ createdAt: '2026-03-01T00:00:00.000Z' }),
        cand({ createdAt: '2025-06-01T00:00:00.000Z' }),
      ],
      NOW,
    );
    expect(q.freshness).toEqual({ fresh: 1, aging: 1, stale: 1 });
  });

  it('parse needs review when a confidence is below 0.6 and not reviewed', () => {
    const parse = (confidence: number, reviewedAt?: string) => ({ model: 'm', at: '2026-11-01', confidence: { email: confidence }, missing: [], reviewedAt });
    const q = poolQuality([cand({ parse: parse(0.5) }), cand({ parse: parse(0.5, '2026-11-02') }), cand({ parse: parse(0.6) }), cand()], NOW);
    expect(q.parseReview).toBe(1);
  });

  it('noConsent counts missing, empty or withdrawn consents', () => {
    const withdrawn = [{ purpose: 'recruitment' as const, policyVersion: '1', at: '2026-11-01', withdrawnAt: '2026-11-05' }];
    const q = poolQuality([cand(), cand({ consents: undefined }), cand({ consents: [] }), cand({ consents: withdrawn })], NOW);
    expect(q.noConsent).toBe(3);
  });

  it('anonymized candidates are excluded', () => {
    const anon = cand({ email: '', anonymizedAt: '2026-11-10T00:00:00.000Z', consents: [] });
    const q = poolQuality([cand(), anon], NOW);
    expect(q.total).toBe(1);
    expect(q.missing.email).toBe(0);
    expect(q.noConsent).toBe(0);
    expect(matchesGap(anon, 'email', NOW)).toBe(false);
  });

  it('isGap rejects unknown values', () => {
    expect(isGap('foo')).toBe(false);
    expect(isGap(null)).toBe(false);
    expect(isGap('stale')).toBe(true);
  });

  it('matchesGap agrees with poolQuality counts', () => {
    const cands = [
      cand(),
      cand({ email: '', phone: '' }),
      cand({ seniority: '', english: '', skills: [] }),
      cand({ createdAt: '2024-01-01T00:00:00.000Z', consents: [] }),
      cand({ parse: { model: 'm', at: 'x', confidence: { phone: 0.2 }, missing: [] } }),
    ];
    const q = poolQuality(cands, NOW);
    const count = (g: (typeof GAPS)[number]) => cands.filter((c) => matchesGap(c, g, NOW)).length;
    expect(count('email')).toBe(q.missing.email);
    expect(count('phone')).toBe(q.missing.phone);
    expect(count('seniority')).toBe(q.missing.seniority);
    expect(count('english')).toBe(q.missing.english);
    expect(count('skills')).toBe(q.missing.skills);
    expect(count('stale')).toBe(q.freshness.stale);
    expect(count('parse')).toBe(q.parseReview);
    expect(count('consent')).toBe(q.noConsent);
  });
});

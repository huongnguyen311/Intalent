import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { domainOptions, skillOptions, suggestDomains, suggestMustHave, suggestNiceToHave, suggestSkills } from './jdSuggest';
import type { Candidate } from './types';

const seed = buildSeed();
const cand = (skills: string[]): Candidate => ({ ...seed.candidates[0], skills, techStack: [] });

describe('jdSuggest', () => {
  it('lists pool skills by frequency and keeps vocabulary skills nobody has yet', () => {
    const opts = skillOptions([cand(['Go', 'Docker']), cand(['Go'])], []);
    expect(opts.slice(0, 2)).toEqual(['Go', 'Docker']);
    expect(opts).toContain('Kubernetes');
  });

  it('suggests the role stack first, then skills that pool candidates have alongside the picked ones', () => {
    expect(suggestSkills('Senior Backend Engineer', [], [], [])).toEqual(['Node.js', 'Java', 'Python', 'PostgreSQL']);
    const pool = [cand(['Go', 'Kafka']), cand(['Go', 'Kafka', 'Redis']), cand(['React'])];
    expect(suggestSkills('', ['Go'], pool, [])).toEqual(['Kafka', 'Redis']);
    // Never repeats a picked skill, whatever its spelling.
    expect(suggestSkills('Frontend Developer', ['reactjs'], [], [])).not.toContain('React');
  });

  it('suggests domains the text points at, then the most used ones', () => {
    const tax = seed.taxonomy;
    expect(domainOptions(tax)[0]).toBe(tax.filter((x) => x.kind === 'domain').sort((a, b) => b.usage - a.usage)[0].label);
    const out = suggestDomains('Payments platform for a fintech bank', [], tax);
    expect(out[0]).toBe('Fintech');
    expect(suggestDomains('fintech', ['Fintech'], tax)).not.toContain('Fintech');
  });

  it('builds must-have lines from the other fields and skips ones already listed', () => {
    const facts = { title: 'Senior Backend Engineer', skills: ['Go', 'PostgreSQL'], critical: ['Go'], minYears: 5, english: 'Advanced', domains: ['Fintech'], seniority: 'Senior' };
    const out = suggestMustHave(facts, ['5+ years of experience as a Backend Engineer'], [], 10);
    expect(out).toEqual([
      'Hands-on production experience with Go',
      'Strong Go skills, able to work without close guidance',
      'Advanced English, able to work with international teams',
      'Experience building products in Fintech',
      'Experience mentoring other engineers and reviewing code',
    ]);
  });

  it('turns role skills not in the stack into nice-to-have lines', () => {
    expect(suggestNiceToHave('Frontend Developer', ['React'], ['Experience with Vue'], [])).toEqual(['Experience with TypeScript', 'Experience with JavaScript']);
  });
});

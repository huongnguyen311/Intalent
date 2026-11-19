import { describe, expect, it } from 'vitest';
import { draftAdditionalInfo, draftSkillsExperience, rewritePoints, textBlocks } from './jdWriter';

describe('draftSkillsExperience', () => {
  it('turns requirements into bullets', () => {
    const text = draftSkillsExperience({ stack: ['React', 'TypeScript'], seniority: 'Senior', years: 5, domains: ['Fintech'], english: 'Fluent' });
    expect(text.split('\n')).toEqual([
      '- 5+ years of professional experience at Senior-level',
      '- Strong hands-on skills in React and TypeScript',
      '- Experience building products in Fintech',
      '- Fluent English, able to work directly with international clients',
      '- Ownership mindset, clear communication and a habit of writing clean, tested code',
    ]);
  });

  it('splits a long stack into must-have and good-to-have', () => {
    const text = draftSkillsExperience({ stack: ['A', 'B', 'C', 'D', 'E', 'F'] });
    expect(text).toContain('- Strong hands-on skills in A, B, C and D');
    expect(text).toContain('- Good to have: E and F');
  });
});

describe('draftAdditionalInfo', () => {
  it('lists the job facts, then the company template', () => {
    expect(draftAdditionalInfo({ location: 'Ho Chi Minh City', employment: 'Full-time' }, '- Hybrid, 2 days remote')).toBe(
      '- Working location: Ho Chi Minh City\n- Employment type: Full-time\n- Hybrid, 2 days remote',
    );
  });
});

describe('rewritePoints', () => {
  it('splits, trims filler, sentence-cases and de-duplicates', () => {
    expect(rewritePoints('you must know react; good english.\n* good english\n\n2) Team player.')).toBe(
      '- Know react\n- Good english\n- Team player',
    );
  });

  it('returns empty for blank input', () => {
    expect(rewritePoints('  \n ')).toBe('');
  });
});

describe('textBlocks', () => {
  it('groups bullet lines into lists between paragraphs', () => {
    expect(textBlocks('Intro\n- a\n- b\nOutro')).toEqual([
      { kind: 'p', text: 'Intro' },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'p', text: 'Outro' },
    ]);
  });
});

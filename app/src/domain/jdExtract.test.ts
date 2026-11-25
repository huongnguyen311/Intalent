import { describe, expect, it } from 'vitest';
import { extractJd, jdRequirements } from './jdExtract';
import { generateJdFromTitle } from './jdWriter';
import type { Jd } from './types';

const TEXT = [
  'BACKEND ENGINEER',
  'Join us to build the payment APIs that thousands of shops rely on.',
  '',
  'About the team',
  'Six engineers owning checkout and payouts.',
  '',
  'A typical day',
  '- Review pull requests',
  '- Pair on API design',
  '',
  'Requirements',
  "- Bachelor's degree in Computer Science or related field",
  '- 4+ years with Java and PostgreSQL',
  '',
  'Certifications',
  '- AWS Certified Developer',
].join('\n');

describe('extractJd', () => {
  it('reads summary, team, daily tasks, education, major and certifications', () => {
    const x = extractJd(TEXT);
    expect(x.summary).toBe('Join us to build the payment APIs that thousands of shops rely on.');
    expect(x.aboutTeam).toBe('Six engineers owning checkout and payouts.');
    expect(x.dailyTasks).toEqual(['Review pull requests', 'Pair on API design']);
    expect(x.education).toBe('bachelor');
    expect(x.major).toBe('Computer Science');
    expect(x.certifications).toEqual(['AWS Certified Developer']);
    expect(x.mustHave).not.toContain('AWS Certified Developer');
    expect(x.mustHave).not.toContain('Review pull requests');
  });
});

describe('jdRequirements', () => {
  const jd: Jd = { id: 'j', code: 'J', title: 'Dev', client: '', domains: [], skills: ['Go', 'SQL'], body: '', status: 'Draft', createdAt: '', updatedAt: '' };
  it('prefers structured fields and keeps only critical skills still in the stack', () => {
    const r = jdRequirements({ ...jd, seniority: 'Lead', minYears: 8, english: 'Fluent', criticalSkills: ['Go', 'Rust'] });
    expect(r).toMatchObject({ seniority: 'Lead', years: 8, english: 'Fluent', critical: ['Go'] });
  });
});

describe('generateJdFromTitle', () => {
  it('uses the level in the title over the form seniority', () => {
    const x = generateJdFromTitle('Junior QA Engineer', 'Senior');
    expect(x.seniority).toBe('Junior');
    expect(x.minYears).toBe(1);
    expect(x.responsibilities).toContain('Plan and run manual and automated tests');
    expect(x.skills).toEqual(['Selenium', 'Jira']);
  });

  it('falls back to the form seniority and generic duties', () => {
    const x = generateJdFromTitle('Product Owner', 'Lead');
    expect(x).toMatchObject({ seniority: 'Lead', minYears: 7, education: 'bachelor' });
    expect(x.summary).toContain('Product Owner');
    expect(x.responsibilities).toContain('Lead, mentor and grow the team');
  });
});

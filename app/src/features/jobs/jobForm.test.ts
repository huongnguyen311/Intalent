import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { normalizeRole } from '../../domain/permissions';
import { firstErrorStep, isRecruiterRole, recruiterOptions, validateJobForm } from './jobForm';

const valid = { jd: 'jd-1', title: 'Dev', recruiters: ['u-1'] };

describe('validateJobForm', () => {
  it('requires a JD and a non-blank title', () => {
    expect(validateJobForm({ jd: '', title: '  ', recruiters: [] }, false)).toEqual({ jd: 'jobs.drawer.err.jd', title: 'jobs.drawer.err.title' });
  });

  it('requires a recruiter only when asked to', () => {
    expect(validateJobForm({ ...valid, recruiters: [] }, true)).toEqual({ recruiters: 'jobs.drawer.err.recruiters' });
    expect(validateJobForm({ ...valid, recruiters: [] }, false)).toEqual({});
  });

  it('rejects a salary range whose From is above To', () => {
    expect(validateJobForm({ ...valid, salaryMin: 50, salaryMax: 40 }, true)).toEqual({ salary: 'jobs.drawer.err.salary' });
    expect(validateJobForm({ ...valid, salaryMin: 50 }, true)).toEqual({});
  });

  it('passes a complete form', () => {
    expect(validateJobForm(valid, true)).toEqual({});
  });
});

describe('firstErrorStep', () => {
  it('picks the earliest step with an error', () => {
    expect(firstErrorStep({ salary: 'x', title: 'y' })).toBe(0);
    expect(firstErrorStep({ recruiters: 'x' })).toBe(2);
    expect(firstErrorStep({})).toBeUndefined();
  });
});

describe('recruiter options', () => {
  const { users } = buildSeed();

  it('treats Super Admin, Recruitment Lead and Recruiter as recruiters', () => {
    expect(['Super Admin', 'Recruitment Lead', 'Recruiter'].every(isRecruiterRole)).toBe(true);
    expect(['Hiring Manager', 'Interviewer', 'Candidate'].some(isRecruiterRole)).toBe(false);
  });

  it('lists only recruiter roles, plus anyone already selected', () => {
    const plain = recruiterOptions(users, []);
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.every((u) => ['Super Admin', 'Recruitment Lead', 'Recruiter'].includes(normalizeRole(u.role)))).toBe(true);
    const hm = users.find((u) => u.status === 'Active' && normalizeRole(u.role) === 'Hiring Manager')!;
    expect(recruiterOptions(users, [hm.id]).map((u) => u.id)).toContain(hm.id);
  });

  it('keeps an inactive recruiter who is already on the job visible, so it can be unticked', () => {
    const gone = { ...users.find((u) => u.id === 'u-huy')!, status: 'Inactive' };
    const others = users.filter((u) => u.id !== 'u-huy');
    expect(recruiterOptions([...others, gone], ['u-huy']).map((u) => u.id)).toContain('u-huy');
    expect(recruiterOptions([...others, gone], []).map((u) => u.id)).not.toContain('u-huy');
  });
});

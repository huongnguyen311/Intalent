import { describe, expect, it } from 'vitest';
import { buildShowcaseJd } from '../data/showcaseJob';
import { jobPostFromJd, jobPostOf } from './jobPost';
import type { Job } from './types';

const jd = buildShowcaseJd();
const job = (p: Partial<Job>) => ({ id: 'j', jdId: jd.id, ...p }) as Job;

describe('jobPostFromJd', () => {
  it('copies the JD post sections, daily tasks among the duties', () => {
    const post = jobPostFromJd(jd);
    expect(post.responsibilities).toHaveLength(10);
    expect(post.mustHave[0]).toBe('4+ years building backend services with Node.js and TypeScript');
    expect(post.niceToHave).toHaveLength(4);
    expect(post.skills[0]).toBe('Node.js');
    expect(post.summary).toBe(jd.summary);
    expect(post.aboutTeam).toBe(jd.aboutTeam);
  });
});

describe('jobPostOf', () => {
  it('prefers the job copy, field by field', () => {
    const post = jobPostOf(job({ summary: 'Own it', skills: ['Go'] }), jd);
    expect(post.summary).toBe('Own it');
    expect(post.skills).toEqual(['Go']);
    expect(post.aboutTeam).toBe(jd.aboutTeam);
  });

  it('keeps a section the job cleared empty; only sections the job never had fall back to the JD', () => {
    const post = jobPostOf(job({ summary: '   ', mustHave: [], niceToHave: [' '] }), jd);
    expect(post.summary).toBe('');
    expect(post.mustHave).toEqual([]);
    expect(post.niceToHave).toEqual([]);
    expect(post.responsibilities).toEqual(jobPostFromJd(jd).responsibilities);
  });

  it('is empty with neither a job copy nor a JD', () => {
    expect(jobPostOf(job({}), undefined)).toEqual({ summary: '', responsibilities: [], skills: [], mustHave: [], niceToHave: [], aboutTeam: '' });
  });
});

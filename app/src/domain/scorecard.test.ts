import { describe, expect, it } from 'vitest';
import { averageOf, criteriaOf, roleFamily, roundFocus, scorecardTemplate, validScores } from './scorecard';
import type { Job } from './types';

const job = (p: Partial<Job>) => ({ id: 'j', jdId: 'jd', title: 'Senior Frontend Developer', department: 'Engineering', level: 'Senior', ...p }) as Job;
const keys = (j: Job, round: string, skills = ['React', 'TypeScript', 'Vue']) => scorecardTemplate(j, { skills }, round).criteria.map((c) => c.key);

describe('scorecard template', () => {
  it('reads the job family and the round focus', () => {
    expect(roleFamily(job({}))).toBe('engineering');
    expect(roleFamily(job({ department: 'Marketing', title: 'Growth Marketing Manager' }))).toBe('marketing');
    expect(roleFamily(job({ department: 'Finance', title: 'Accountant' }))).toBe('general');
    expect(roundFocus('Technical interview')).toBe('technical');
    expect(roundFocus('Final interview')).toBe('final');
    expect(roundFocus('Phỏng vấn vòng cuối')).toBe('final');
    expect(roundFocus('Intro call')).toBe('general');
  });

  it('a technical round of an engineering job leads with the JD skills, then engineering competencies', () => {
    expect(keys(job({}), 'Technical interview')).toEqual(['skill:React', 'skill:TypeScript', 'skill:Vue', 'problem', 'design', 'communication', 'culture']);
  });

  it('a final round leads with competencies and adds motivation; lead roles add leadership', () => {
    expect(keys(job({ level: 'Lead', title: 'Tech Lead' }), 'Final interview', ['Node.js'])).toEqual(
      ['problem', 'design', 'communication', 'leadership', 'culture', 'motivation', 'skill:Node.js'],
    );
  });

  it('a marketing job is scored on marketing competencies and caps the JD skills at five', () => {
    const k = keys(job({ department: 'Marketing', title: 'Growth Marketing Manager', level: 'Middle' }), 'Case study', ['A', 'B', 'C', 'D', 'E', 'F']);
    expect(k.filter((x) => x.startsWith('skill:'))).toHaveLength(5);
    expect(k).toEqual(expect.arrayContaining(['strategy', 'analytics', 'execution', 'communication', 'culture', 'leadership']));
  });

  it('requires every competency but lets skills go unscored; averages only what was scored', () => {
    const c = scorecardTemplate(job({}), { skills: ['React'] }, 'Technical interview').criteria;
    const core = { problem: 4, design: 3, communication: 5, culture: 4 };
    expect(validScores(core, c)).toBe(true);
    expect(validScores({ ...core, design: 0 }, c)).toBe(false);
    expect(validScores({ ...core, 'skill:React': 6 }, c)).toBe(false);
    expect(averageOf({ ...core, 'skill:React': 0 })).toBe(4);
  });

  it('cards saved before templates keep the four fixed criteria', () => {
    expect(criteriaOf({}).map((c) => c.key)).toEqual(['technical', 'communication', 'problem', 'culture']);
  });
});

import { describe, expect, it } from 'vitest';
import { scorecardsHiddenFrom, zoneLabel } from './hiring';
import type { Interview, User } from './types';

const iv = (extra: Partial<Interview> = {}): Interview => ({
  id: 'iv', round: 'Tech', at: '2026-11-20T10:00', durationMin: 60, mode: 'online', place: '', interviewers: ['u-hr', 'u-int'],
  status: 'done', createdBy: 'u-hr',
  scorecards: [{ by: 'u-int', scores: { technical: 4, communication: 4, problem: 4, culture: 4 }, recommendation: 'yes', at: '2026-11-20T11:00' }],
  ...extra,
} as Interview);
const user = (id: string, role: string): User => ({ id, name: id, email: '', role, status: 'Active', createdAt: '' });

describe('scorecardsHiddenFrom', () => {
  it('keeps feedback independent for an Interviewer who has not scored yet', () => {
    expect(scorecardsHiddenFrom(iv({ interviewers: ['u-int2', 'u-int'] }), user('u-int2', 'Interviewer'))).toBe(true);
  });
  it('never hides feedback from recruiters who scheduled themselves onto the panel', () => {
    expect(scorecardsHiddenFrom(iv(), user('u-hr', 'Recruiter'))).toBe(false);
    expect(scorecardsHiddenFrom(iv(), user('u-hr', 'Super Admin'))).toBe(false);
  });
  it('shows feedback once the interviewer has sent theirs', () => {
    expect(scorecardsHiddenFrom(iv(), user('u-int', 'Interviewer'))).toBe(false);
  });
});

describe('zoneLabel', () => {
  it('names the offset of an IANA zone on that date', () => {
    expect(zoneLabel('Asia/Ho_Chi_Minh', '2026-11-20T10:00')).toBe('GMT+7');
    expect(zoneLabel('Europe/Berlin', '2026-07-01T10:00')).toBe('GMT+2');
  });
  it('is empty without a zone (older interviews)', () => {
    expect(zoneLabel(undefined, '2026-11-20T10:00')).toBe('');
  });
});

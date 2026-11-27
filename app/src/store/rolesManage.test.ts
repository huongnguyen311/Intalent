import { describe, expect, it } from 'vitest';
import {
  can, canEditCampaign, canEditJd, canManageUser, contactAccess, homeFor, jobsInScope, manageableRoles, roleOf,
} from '../domain/permissions';
import type { Job, User } from '../domain/types';
import { createDemoStore } from './store';

const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
};
const NOW = '2026-11-27T10:00:00.000Z';
const user = (role: string, id = 'u-x'): User => ({ id, name: 'X', email: 'x@company.demo', role, status: 'Active', createdAt: '' });
const job = (id: string, hiringManager: string, collaborators: string[] = [], jdId = '') =>
  ({ id, hiringManager, collaborators, jdId }) as unknown as Job;
const store = (actingAs?: string) => {
  const st = createDemoStore(memoryStorage(), () => NOW);
  if (actingAs) st.setState((s) => ({ ui: { ...s.ui, actingAs } }));
  return st;
};

describe('unknown roles fail closed', () => {
  it('gives no permission and no jobs to an unknown role', () => {
    const odd = user('Recuiter');
    expect(roleOf('Recuiter')).toBeUndefined();
    expect(roleOf('Admin')).toBe('Recruitment Lead');
    expect(can(odd, 'pool')).toBe(false);
    expect(can(odd, 'pii')).toBe(false);
    expect(jobsInScope(odd, [job('a', 'u-x')])).toEqual([]);
    expect(homeFor(odd)).toBe('/');
  });
});

describe('user management', () => {
  it('lets Leads manage only the hiring-team roles', () => {
    expect(manageableRoles(user('Super Admin'))).toContain('Super Admin');
    expect(manageableRoles(user('Recruitment Lead'))).toEqual(['Recruiter', 'Hiring Manager', 'Interviewer']);
    expect(manageableRoles(user('Recruiter'))).toEqual([]);
    expect(canManageUser(user('Recruitment Lead'), user('Recruiter'))).toBe(true);
    expect(canManageUser(user('Recruitment Lead'), user('Recruitment Lead'))).toBe(false);
    expect(canManageUser(user('Recruitment Lead'), user('Super Admin'))).toBe(false);
    expect(can(user('Recruitment Lead'), 'users.manage')).toBe(true);
    expect(can(user('Recruitment Lead'), 'taxonomy')).toBe(true);
    expect(can(user('Recruitment Lead'), 'config')).toBe(false);
  });

  it('enforces the role ceiling in the store', () => {
    const st = store('u-thu'); // Recruitment Lead
    const s = () => st.getState();
    expect(s().addUser({ name: 'A', email: 'a@company.demo', role: 'Recruiter' }).ok).toBe(true);
    expect(s().addUser({ name: 'B', email: 'b@company.demo', role: 'Super Admin' })).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(s().setUserRole('u-huy', 'Hiring Manager').ok).toBe(true);
    expect(s().setUserRole('u-huy', 'Recruitment Lead')).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(s().setUserRole('u-tam', 'Recruiter')).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(s().setUserActive('u-tam', false)).toMatchObject({ ok: false, reason: 'forbidden' });
    expect(s().setUserActive('u-quang', false).ok).toBe(true);
  });

  it('never leaves a workspace without an active Super Admin', () => {
    const st = store();
    const owner: User = { ...user('Super Admin', 'u-ws-owner'), email: 'owner@company.demo' };
    // A tenant whose only Super Admin is its owner (not the protected demo user).
    st.setState((s) => ({ users: [...s.users.filter((u) => u.id !== 'u-admin'), owner], ui: { ...s.ui, actingAs: owner.id } }));
    const s = () => st.getState();
    expect(s().setUserRole(owner.id, 'Recruiter')).toMatchObject({ ok: false, reason: 'last_admin' });
    expect(s().setUserActive(owner.id, false)).toMatchObject({ ok: false, reason: 'last_admin' });
    expect(s().setUserRole('u-thu', 'Super Admin').ok).toBe(true);
    expect(s().setUserRole(owner.id, 'Recruiter').ok).toBe(true);
  });
});

describe('JD and campaign ownership', () => {
  const rec = user('Recruiter', 'u-r');
  const jobs = [job('j1', 'u-other', ['u-r'], 'jd-used'), job('j2', 'u-other', [], 'jd-theirs')];

  it('lets Recruiters edit their own JDs and the ones behind their jobs', () => {
    expect(canEditJd(rec, { id: 'jd-mine', createdBy: 'u-r' }, jobs)).toBe(true);
    expect(canEditJd(rec, { id: 'jd-used' }, jobs)).toBe(true);
    expect(canEditJd(rec, { id: 'jd-theirs', createdBy: 'u-other' }, jobs)).toBe(false);
    expect(canEditJd(user('Recruitment Lead'), { id: 'jd-theirs', createdBy: 'u-other' }, jobs)).toBe(true);
    expect(canEditJd(user('Hiring Manager'), { id: 'jd-mine', createdBy: 'u-x' }, jobs)).toBe(false);
  });

  it('records the author of a new JD', () => {
    const jd = store('u-huy').getState().createJd({ title: 'X', client: '', domains: [], skills: [], body: '' });
    expect(jd.createdBy).toBe('u-huy');
  });

  it('lets only the owner and Super Admin / Lead edit a campaign', () => {
    expect(canEditCampaign(rec, { owner: 'u-r' })).toBe(true);
    expect(canEditCampaign(rec, { owner: 'u-other' })).toBe(false);
    expect(canEditCampaign(user('Recruitment Lead'), { owner: 'u-other' })).toBe(true);
  });
});

describe('contact data', () => {
  it('shows contacts in scope, asks a Recruiter to reveal the rest and logs it', () => {
    const st = store();
    const s = () => st.getState();
    const by = (id: string) => s().users.find((u) => u.id === id)!;
    const recruiter = by('u-huy');
    const scoped = new Set(jobsInScope(recruiter, s().jobs).map((j) => j.id));
    const outside = s().candidates.find(
      (c) => c.cvOwner !== recruiter.id && !s().applications.some((a) => a.candidateId === c.id && scoped.has(a.jobId)),
    )!;
    const access = (u: User) => contactAccess(u, outside, s().applications, s().jobs, s().activities);
    expect(access(recruiter)).toBe('reveal');
    expect(access(by('u-thu'))).toBe('full');
    expect(access(by('u-nam'))).toBe('none');
    expect(s().revealContact(outside.id, recruiter.id)).toBe(true);
    expect(access(recruiter)).toBe('full');
    expect(s().activities.slice(-1)[0]).toMatchObject({ type: 'pii_revealed', candidateId: outside.id, by: recruiter.id });
  });

  it('keeps CSV export with contacts for Super Admin and Lead', () => {
    expect(can(user('Recruiter'), 'pii.export')).toBe(false);
    expect(can(user('Recruitment Lead'), 'pii.export')).toBe(true);
    expect(can(user('Super Admin'), 'pii.export')).toBe(true);
  });
});

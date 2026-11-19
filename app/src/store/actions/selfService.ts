import { normalizeEmail, normalizePhone } from '../../domain/normalize';
import type { Activity, Candidate, CvVersion, ProfileSuggestion, User } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

type Keys = 'candidateSignIn' | 'selfUpdate' | 'uploadCvVersion' | 'suggestChange' | 'reviewSuggestion';

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Candidate self-service: sign-in by email, direct contact edits, CV uploads, and HR review of proposed changes. */
export function selfServiceActions(set: Set, get: Get, env: Env): Pick<DemoActions, Keys> {
  const log = (candidateId: string, type: Activity['type'], by: string, detail: string) =>
    set((s) => ({ activities: [...s.activities, { type, candidateId, by, at: env.now(), detail }] }));
  const patchCandidate = (id: string, fn: (c: Candidate) => Candidate) =>
    set((s) => ({ candidates: s.candidates.map((c) => (c.id === id ? fn(c) : c)) }));

  return {
    candidateSignIn(email) {
      // Email, or the phone number for people who applied with a phone only.
      const byPhone = !email.includes('@');
      const key = byPhone ? normalizePhone(email) : normalizeEmail(email);
      if (!key) return null;
      const candidate = get().candidates.find((c) => (byPhone ? !!c.phone && normalizePhone(c.phone) === key : normalizeEmail(c.email) === key));
      const linked = get().users.find((u) => u.candidateId && (byPhone ? u.candidateId === candidate?.id : normalizeEmail(u.email) === key));
      if (linked) return linked.status === 'Active' ? linked : null;
      if (!candidate) return null;
      // First sign-in creates the account and ties it to the existing profile (never a second profile).
      const user: User = {
        id: env.id('u-cand'), name: candidate.name, email: candidate.email, role: 'Candidate', status: 'Active',
        createdAt: env.now().slice(0, 10), candidateId: candidate.id,
      };
      set((s) => ({ users: [...s.users, user] }));
      return user;
    },

    selfUpdate(candidateId, patch, by) {
      const before = get().candidates.find((c) => c.id === candidateId);
      if (!before) return { ok: false, reason: 'not_found' };
      const clean = Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
      ) as typeof patch;
      if (clean.email !== undefined && !clean.email && !(clean.phone ?? before.phone)) return { ok: false, reason: 'no_contact' };
      const r = get().updateCandidate(candidateId, clean);
      if (!r.ok) return r;
      const changed = (Object.keys(clean) as Array<keyof typeof clean>).filter((k) => before[k] !== r.candidate[k]);
      if (changed.length === 0) return r;
      // Keep the linked login on the profile's (possibly new) email.
      if (clean.email !== undefined) {
        set((s) => ({ users: s.users.map((u) => (u.candidateId === candidateId ? { ...u, email: r.candidate.email } : u)) }));
      }
      log(candidateId, 'candidate_self_update', by, `Candidate updated ${changed.join(', ')}`);
      return r;
    },

    uploadCvVersion(candidateId, fileName, by) {
      const name = fileName.trim();
      if (!name || !get().candidates.some((c) => c.id === candidateId)) return null;
      const version: CvVersion = { id: env.id('cv'), fileName: name, at: env.now(), by };
      patchCandidate(candidateId, (c) => ({ ...c, cvVersions: [...(c.cvVersions ?? []), version] }));
      log(candidateId, 'candidate_self_update', by, `New CV uploaded: ${name}`);
      return version;
    },

    suggestChange(candidateId, field, value) {
      const c = get().candidates.find((x) => x.id === candidateId);
      if (!c) return false;
      const v = Array.isArray(value) ? [...new Set(value.map((s) => s.trim()).filter(Boolean))] : value.trim();
      if (Array.isArray(v) ? v.length === 0 : !v) return false;
      const current = c[field];
      if (Array.isArray(v) ? sameList(v, current as string[]) : v === current) {
        // Proposing the current value withdraws any pending proposal for that field.
        patchCandidate(candidateId, (x) => ({ ...x, suggestions: (x.suggestions ?? []).filter((s) => s.field !== field) }));
        return true;
      }
      const suggestion: ProfileSuggestion = { id: env.id('sg'), field, value: v, at: env.now() };
      patchCandidate(candidateId, (x) => ({ ...x, suggestions: [...(x.suggestions ?? []).filter((s) => s.field !== field), suggestion] }));
      return true;
    },

    reviewSuggestion(candidateId, suggestionId, approve, by) {
      const c = get().candidates.find((x) => x.id === candidateId);
      const sg = c?.suggestions?.find((s) => s.id === suggestionId);
      if (!c || !sg) return false;
      patchCandidate(candidateId, (x) => ({
        ...x,
        ...(approve ? { [sg.field]: sg.value } : {}),
        suggestions: (x.suggestions ?? []).filter((s) => s.id !== suggestionId),
      }));
      const shown = Array.isArray(sg.value) ? sg.value.join(', ') : sg.value;
      log(candidateId, 'suggestion_reviewed', by, `${approve ? 'Approved' : 'Rejected'} ${sg.field} change: ${shown}`);
      return true;
    },
  };
}

import { normalizeEmail } from '../../domain/normalize';
import type { User } from '../../domain/types';
import { CURRENT_USER_ID, ROLES } from '../../domain/users';
import type { DemoActions, Env, Get, Set } from './types';

export function userActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'addUser' | 'updateUser' | 'setUserRole' | 'setUserActive'> {
  const emailTaken = (email: string, exceptId?: string) =>
    get().users.some((u) => u.id !== exceptId && normalizeEmail(u.email) === email);
  const patchUser = (id: string, change: Partial<User>) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...change } : u)) }));

  return {
    addUser(input) {
      const name = input.name.trim();
      const email = normalizeEmail(input.email);
      if (!name || !email || !ROLES.includes(input.role)) return { ok: false, reason: 'invalid' };
      if (emailTaken(email)) return { ok: false, reason: 'duplicate' };
      const user: User = { id: env.id('user'), name, email, role: input.role, status: 'Active', createdAt: env.now().slice(0, 10) };
      set((s) => ({ users: [...s.users, user] }));
      return { ok: true, user };
    },

    updateUser(id, patch) {
      const user = get().users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'not_found' };
      const name = patch.name.trim();
      const email = normalizeEmail(patch.email);
      if (!name || !email) return { ok: false, reason: 'invalid' };
      if (emailTaken(email, id)) return { ok: false, reason: 'duplicate' };
      patchUser(id, { name, email });
      return { ok: true, user: { ...user, name, email } };
    },

    // The demo user stays an active Super Admin so the demo can never lock itself out.
    setUserRole(id, role) {
      const user = get().users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'not_found' };
      if (id === CURRENT_USER_ID && role !== 'Super Admin') return { ok: false, reason: 'protected' };
      patchUser(id, { role });
      return { ok: true, user: { ...user, role } };
    },

    setUserActive(id, active) {
      const user = get().users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'not_found' };
      if (id === CURRENT_USER_ID && !active) return { ok: false, reason: 'protected' };
      const status = active ? 'Active' : 'Inactive';
      patchUser(id, { status });
      return { ok: true, user: { ...user, status } };
    },
  };
}

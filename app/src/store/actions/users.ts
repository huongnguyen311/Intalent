import { normalizeEmail } from '../../domain/normalize';
import type { User } from '../../domain/types';
import { CURRENT_USER_ID, ROLES } from '../../domain/users';
import type { DemoActions, Env, Get, Set } from './types';
import { actorOf, logAudit } from './audit';
import { activeSuperAdmins, canManageUser, manageableRoles } from '../../domain/permissions';
import { companyOf } from '../../domain/company';
import { updateWorkspaceEntry } from '../platform';

export function userActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'addUser' | 'updateUser' | 'setUserRole' | 'setUserActive' | 'acceptInvitation' | 'updateCompany' | 'setUserPassword'> {
  const emailTaken = (email: string, exceptId?: string) =>
    get().users.some((u) => u.id !== exceptId && normalizeEmail(u.email) === email);
  const patchUser = (id: string, change: Partial<User>) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...change } : u)) }));
  /** The signed-in user; the demo workspace without its admin record still acts as Super Admin (as the session does). */
  const actor = (): Pick<User, 'role'> | undefined => {
    const id = actorOf(get);
    return get().users.find((u) => u.id === id) ?? (id === CURRENT_USER_ID ? { role: 'Super Admin' } : undefined);
  };
  /** Demoting or deactivating this user would leave the workspace without an active Super Admin. */
  const isLastAdmin = (user: User) => {
    const admins = activeSuperAdmins(get().users);
    return admins.length === 1 && admins[0].id === user.id;
  };

  return {
    addUser(input) {
      const name = input.name.trim();
      const email = normalizeEmail(input.email);
      if (!name || !email || !ROLES.includes(input.role)) return { ok: false, reason: 'invalid' };
      if (!manageableRoles(actor()).includes(input.role)) return { ok: false, reason: 'forbidden' };
      if (emailTaken(email)) return { ok: false, reason: 'duplicate' };
      const user: User = { id: env.id('user'), name, email, role: input.role, status: 'Invited', createdAt: env.now().slice(0, 10) };
      set((s) => ({ users: [...s.users, user] }));
      logAudit(set, get, env.now(), { type: 'user_invited', userId: user.id, detail: `${user.email} as ${user.role}` });
      return { ok: true, user };
    },

    updateUser(id, patch) {
      const user = get().users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'not_found' };
      if (!canManageUser(actor(), user)) return { ok: false, reason: 'forbidden' };
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
      if (!canManageUser(actor(), user) || !manageableRoles(actor()).includes(role)) return { ok: false, reason: 'forbidden' };
      if (role !== 'Super Admin' && isLastAdmin(user)) return { ok: false, reason: 'last_admin' };
      patchUser(id, { role });
      if (user.role !== role) logAudit(set, get, env.now(), { type: 'user_role_changed', userId: id, detail: `${user.role} → ${role}` });
      return { ok: true, user: { ...user, role } };
    },

    acceptInvitation(id, patch = {}) {
      const user = get().users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'not_found' };
      if (user.status !== 'Invited') return { ok: false, reason: 'invalid' };
      const change = { status: 'Active', ...(patch.name?.trim() ? { name: patch.name.trim() } : {}), ...(patch.passwordHash ? { passwordHash: patch.passwordHash } : {}) };
      patchUser(id, change);
      logAudit(set, get, env.now(), { type: 'user_joined', userId: id, by: id, detail: `${user.email} accepted the invitation` });
      return { ok: true, user: { ...user, ...change } };
    },

    setUserPassword(id, passwordHash) {
      const user = get().users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'not_found' };
      patchUser(id, { passwordHash });
      logAudit(set, get, env.now(), { type: 'user_status_changed', userId: id, by: id, detail: 'Password changed' });
      return { ok: true, user: { ...user, passwordHash } };
    },

    updateCompany(patch) {
      set((s) => ({
        company: { ...companyOf(s), ...patch },
        // The careers site starts in the company's default language.
        ...(patch.language ? { ui: { ...s.ui, careersLang: patch.language } } : {}),
      }));
      const c = companyOf(get());
      updateWorkspaceEntry(c.workspaceId, { name: c.name, slug: c.careersSlug });
      logAudit(set, get, env.now(), { type: 'settings_updated', detail: `Company settings: ${Object.keys(patch).join(', ')}` });
    },

    setUserActive(id, active) {
      const user = get().users.find((u) => u.id === id);
      if (!user) return { ok: false, reason: 'not_found' };
      if (id === CURRENT_USER_ID && !active) return { ok: false, reason: 'protected' };
      if (!canManageUser(actor(), user)) return { ok: false, reason: 'forbidden' };
      if (!active && isLastAdmin(user)) return { ok: false, reason: 'last_admin' };
      const status = active ? 'Active' : 'Inactive';
      patchUser(id, { status });
      if (user.status !== status) logAudit(set, get, env.now(), { type: 'user_status_changed', userId: id, detail: `${user.status} → ${status}` });
      return { ok: true, user: { ...user, status } };
    },
  };
}

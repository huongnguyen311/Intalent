import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import type { User } from '../../domain/types';
import { normalizeRole } from '../../domain/permissions';
import { CURRENT_USER_ID, ROLES, type Role } from '../../domain/users';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { currentUser } from '../../store/session';
import { sendInvitation } from '../auth/accounts';

const FIELD = 'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white';
const LABEL = 'block text-xs font-bold text-[#896a61] uppercase tracking-wider mb-1';

const REASONS: Record<string, TKey> = {
  invalid: 'users.err.invalid',
  duplicate: 'users.err.duplicate',
  protected: 'users.err.protected',
  not_found: 'users.err.invalid',
};

/** Add (no `user`) or edit a user; the role is changed here too. */
export function UserDialog({ user, onClose }: { user?: User; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Role>(user ? normalizeRole(user.role) : 'Recruiter');
  const [error, setError] = useState<TKey | null>(null);

  const submit = () => {
    const { addUser, updateUser, setUserRole } = useStore.getState();
    // All-or-nothing: refuse a protected role change before anything is saved.
    if (user?.id === CURRENT_USER_ID && role !== 'Super Admin') return setError(REASONS.protected);
    const res = user ? updateUser(user.id, { name, email }) : addUser({ name, email, role });
    if (!res.ok) return setError(REASONS[res.reason]);
    // New users get an invitation email (demo mailbox) with a link to set their password.
    if (!user) sendInvitation(res.user, currentUser().name);
    if (user && role !== user.role) {
      const changed = setUserRole(user.id, role);
      if (!changed.ok) return setError(REASONS[changed.reason]);
    }
    toast(t(user ? 'users.saved' : 'users.added'));
    onClose();
  };

  return (
    <Modal
      open
      title={t(user ? 'users.edit.title' : 'users.new.title')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#5a4a46] hover:text-[#181211]">{t('common.cancel')}</button>
          <button onClick={submit} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold text-sm transition-colors">{t('users.save')}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="user-name">{t('users.field.name')}</label>
          <input id="user-name" autoFocus className={FIELD} value={name} onChange={(e) => { setName(e.target.value); setError(null); }} />
        </div>
        <div>
          <label className={LABEL} htmlFor="user-email">{t('users.field.email')}</label>
          <input id="user-email" type="email" className={FIELD} value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} />
        </div>
        <div>
          <label className={LABEL} htmlFor="user-role">{t('users.field.role')}</label>
          <select id="user-role" className={FIELD} value={role} onChange={(e) => { setRole(e.target.value as Role); setError(null); }}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{t(error)}</p>}
      </div>
    </Modal>
  );
}

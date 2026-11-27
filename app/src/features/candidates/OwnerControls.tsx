import { MenuItem, Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import type { Candidate } from '../../domain/types';
import { assignableUsers, userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { me, useCan } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';

const LINK = 'text-sm font-semibold hover:underline';

/**
 * "Change owner" (pick an active staff member) and "Owner history" (past transfers) under the CV Owner field.
 * Changing the owner moves CV credit between TAs, so it needs the reports permission (as the bulk action does).
 */
export function OwnerControls({ c, fixture }: { c: Candidate; fixture: boolean }) {
  const t = useT();
  const users = useStore((s) => s.users);
  const activities = useStore((s) => s.activities);
  const canChange = useCan()('reports');
  const history = activities.filter((a) => a.type === 'owner_transferred' && a.candidateId === c.id).reverse();

  const change = (to: string) => {
    const r = useStore.getState().transferOwner(c.id, to, me());
    if (r.ok) toast(t('profile.ownerChanged', { name: userName(users, to) }));
  };

  return (
    <div className="flex items-center gap-4">
      {canChange && <Popover
        trigger={({ toggle }) => (
          <button type="button" data-testid="candidate-detail-change-owner" onClick={toggle} className={`${LINK} text-primary`}>
            {fixture ? 'Đổi owner' : t('profile.changeOwner')}
          </button>
        )}
      >
        {(close) =>
          assignableUsers(users).map((u) => (
            <MenuItem key={u.id} active={u.id === c.cvOwner} onClick={() => { close(); if (u.id !== c.cvOwner) change(u.id); }}>
              {u.name}
            </MenuItem>
          ))
        }
      </Popover>}
      <Popover
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle} className={`${LINK} text-ink-muted`}>
            {fixture ? 'Lịch sử đổi owner' : t('profile.ownerHistory')}
          </button>
        )}
      >
        {() => (
          <div className="px-3 py-2 text-sm max-w-xs">
            {history.length === 0 ? (
              <p className="text-ink-muted">{t('profile.ownerHistoryEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {history.map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    <div>{userName(users, a.from ?? '') || '—'} → <span className="font-semibold">{userName(users, a.to ?? '')}</span></div>
                    <div className="text-xs text-ink-muted">{fullDate(a.at)} · {userName(users, a.by)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}

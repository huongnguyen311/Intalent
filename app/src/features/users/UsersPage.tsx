import { useMemo, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { initials } from '../../components/Avatar';
import { MenuItem, Popover } from '../../components/Popover';
import { Pagination } from '../../components/Pagination';
import { StatCard } from '../../components/StatCard';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { User } from '../../domain/types';
import { canManageUser, normalizeRole } from '../../domain/permissions';
import { ROLES } from '../../domain/users';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { UserDialog } from './UserDialog';
import { currentUser, useMe } from '../../store/session';
import { sendInvitation } from '../auth/accounts';

const PAGE_SIZE = 10;
type SortKey = 'name' | 'email' | 'role' | 'status' | 'createdAt';

const CARD = 'bg-white dark:bg-dark-surface p-4 rounded-[24px] border border-gray-200 dark:border-dark-raised shadow-sm';
const CARD_LABEL = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';
const CARD_NUM = 'ty-kpi text-3xl font-bold text-gray-900 dark:text-white';
const FILTER_BTN =
  'flex w-full items-center gap-2 px-3 py-2 bg-white dark:bg-dark-raised border border-gray-200 dark:border-dark-line rounded-[16px] text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-400 transition-colors focus:outline-none focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1';
const TH = 'px-6 py-4 text-xs font-bold text-ink-muted uppercase tracking-wider border-b border-line dark:border-dark-raised cursor-pointer hover:text-primary group ';
const CHECK = 'rounded border-gray-300 text-primary focus:ring-primary dark:bg-dark-surface dark:border-dark-line';
const CHIP = 'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ';
const ROLE_CHIP: Record<string, string> = {
  'Super Admin': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  'Recruitment Lead': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Candidate: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  Recruiter: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  'Hiring Manager': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Interviewer: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};
/** Older data still says Admin / User; those keep their original colours. */
ROLE_CHIP.Admin = ROLE_CHIP['Recruitment Lead'];
ROLE_CHIP.User = ROLE_CHIP.Recruiter;
const COLS: Array<[SortKey, TKey]> = [
  ['name', 'users.col.name'], ['email', 'users.col.email'], ['role', 'users.col.role'], ['status', 'users.col.status'], ['createdAt', 'users.col.created'],
];

function Stat({ label, value, total, bar }: { label: string; value: number; total?: number; bar?: string }) {
  return (
    <div className={CARD}>
      <p className={CARD_LABEL}>{label}</p>
      {bar ? (
        <div className="flex flex-col gap-3">
          <span className={CARD_NUM}>{value}</span>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1">
            <div className={`${bar} h-1 rounded-full`} style={{ width: `${total ? (value / total) * 100 : 0}%` }}></div>
          </div>
        </div>
      ) : (
        <div className="flex items-end justify-between"><span className={CARD_NUM}>{value}</span></div>
      )}
    </div>
  );
}

function FilterButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-haspopup="listbox" onClick={onClick} className={FILTER_BTN}>
      <span className="material-symbols-outlined text-[18px] text-gray-500 dark:text-white" style={{ fontVariationSettings: '"FILL" 1' }}>{icon}</span>
      <span style={{ pointerEvents: 'none' }}>{label}</span>
      <span className="material-symbols-outlined text-[18px] text-gray-500 ml-auto" aria-hidden="true">expand_more</span>
    </button>
  );
}

export function UsersPage() {
  const t = useT();
  const users = useStore((s) => s.users);
  const totals = useStore((s) => s.meta?.totals?.users);
  const fixture = isFixtureMode();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ user?: User } | null>(null);
  const me = useMe();

  const count = (r: string) => users.filter((u) => normalizeRole(u.role) === r).length;
  // Admins = Recruitment Leads; Users = every other staff role (candidates excluded).
  const stats = totals ?? {
    total: users.length, superAdmins: count('Super Admin'), admins: count('Recruitment Lead'),
    users: count('Recruiter') + count('Hiring Manager') + count('Interviewer'),
  };

  const candidates = count('Candidate');
  const staff = users.length - candidates;
  const recruitment = count('Super Admin') + count('Recruitment Lead') + count('Recruiter');
  const panel = count('Hiring Manager') + count('Interviewer');
  const staffBy = (st: User['status']) => users.filter((u) => normalizeRole(u.role) !== 'Candidate' && u.status === st).length;
  const candidateActive = users.filter((u) => normalizeRole(u.role) === 'Candidate' && u.status === 'Active').length;
  const pct = (n: number) => (staff ? Math.round((n / staff) * 100) : 0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = users.filter(
      (u) =>
        (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)) &&
        (!role || normalizeRole(u.role) === role) &&
        (!status || u.status === status),
    );
    if (sort) out.sort((a, b) => a[sort.key].localeCompare(b[sort.key]) * sort.dir);
    return out;
  }, [users, q, role, status, sort]);
  const unfiltered = !q.trim() && !role && !status;
  // The mockup lists 10 of 17 users; its count comes from the fixture totals.
  const total = fixture && unfiltered && totals ? totals.total : filtered.length;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSelected = rows.length > 0 && rows.every((u) => selected.has(u.id));

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const clickSort = (key: SortKey) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((u) => u.id)));
  const setActive = (u: User) => {
    const res = useStore.getState().setUserActive(u.id, u.status !== 'Active');
    const fail: Record<string, TKey> = { last_admin: 'users.err.lastAdmin', forbidden: 'users.err.forbidden' };
    toast(res.ok ? t(u.status === 'Active' ? 'users.deactivated' : 'users.activated') : t(fail[res.reason] ?? 'users.err.protected'), res.ok ? 'success' : 'error');
  };
  const sortIcon = (key: SortKey) => {
    if (sort?.key === key) return sort.dir === 1 ? 'arrow_upward' : 'arrow_downward';
    return key === 'name' && !sort ? 'arrow_upward' : 'unfold_more';
  };

  return (
    <AppLayout title={t('nav.userManagement')} subtitle={t('users.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8">
        <div className="flex items-center justify-end">
          <button onClick={() => setDialog({})} className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[24px] font-bold ty-btn shadow-lg shadow-primary/20 flex items-center gap-2 transition-all">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>person_add</span> {t('users.new')}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {totals ? (
            <>
              <Stat label={t('users.stat.total')} value={stats.total} />
              <Stat label={t('users.stat.superAdmins')} value={stats.superAdmins} total={stats.total} bar="bg-primary" />
              <Stat label={t('users.stat.admins')} value={stats.admins} total={stats.total} bar="bg-blue-500" />
              <Stat label={t('users.stat.users')} value={stats.users} total={stats.total} bar="bg-violet-500" />
            </>
          ) : (
            // The app's six roles, grouped by what they do (the mockup's Super Admin / Admin / User split is gone).
            <>
              <StatCard
                accent="solid"
                icon="groups" tone="primary" label={t('users.stat.staff')} value={staff}
                hint={t('users.stat.hint.status', { active: staffBy('Active'), invited: staffBy('Invited') })}
                segments={[
                  { value: staffBy('Active'), className: 'bg-emerald-500', title: t('users.active') },
                  { value: staffBy('Invited'), className: 'bg-amber-400', title: t('users.invited') },
                  { value: staffBy('Inactive'), className: 'bg-gray-400', title: t('users.inactive') },
                ]}
              />
              <StatCard
                accent="solid"
                icon="person_search" tone="blue" label={t('users.stat.recruitment')} value={recruitment}
                hint={t('users.stat.hint.share', { pct: pct(recruitment) })}
                bar={pct(recruitment)}
              />
              <StatCard
                accent="solid"
                icon="how_to_reg" tone="violet" label={t('users.stat.panel')} value={panel}
                hint={t('users.stat.hint.share', { pct: pct(panel) })}
                bar={pct(panel)}
              />
              <StatCard
                accent="solid"
                icon="badge" tone="emerald" label={t('users.stat.candidates')} value={candidates}
                hint={t('users.stat.hint.candidates', { active: candidateActive })}
                bar={candidates ? (candidateActive / candidates) * 100 : 0}
              />
            </>
          )}
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-raised shadow-sm p-5">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[20px]">search</span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-raised border border-gray-200 dark:border-dark-line rounded-[16px] text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-primary focus:border-primary transition-all"
                placeholder={t('users.search')}
                type="text"
                value={q}
                onChange={(e) => reset(setQ)(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <Popover wrapperClass="w-full" trigger={({ toggle: tg }) => <FilterButton icon="badge" label={t('users.filter.role', { value: role || t('users.filter.all') })} onClick={tg} />}>
                {(close) => (
                  <>
                    <MenuItem active={!role} onClick={() => { reset(setRole)(''); close(); }}>{t('users.filter.all')}</MenuItem>
                    {ROLES.map((r) => <MenuItem key={r} active={r === role} onClick={() => { reset(setRole)(r); close(); }}>{r}</MenuItem>)}
                  </>
                )}
              </Popover>
              <Popover wrapperClass="w-full" trigger={({ toggle: tg }) => <FilterButton icon="toggle_on" label={t('users.filter.status', { value: status ? t(status === 'Active' ? 'users.active' : status === 'Invited' ? 'users.invited' : 'users.inactive') : t('users.filter.all') })} onClick={tg} />}>
                {(close) => (
                  <>
                    <MenuItem active={!status} onClick={() => { reset(setStatus)(''); close(); }}>{t('users.filter.all')}</MenuItem>
                    <MenuItem active={status === 'Active'} onClick={() => { reset(setStatus)('Active'); close(); }}>{t('users.active')}</MenuItem>
                    <MenuItem active={status === 'Inactive'} onClick={() => { reset(setStatus)('Inactive'); close(); }}>{t('users.inactive')}</MenuItem>
                    <MenuItem active={status === 'Invited'} onClick={() => { reset(setStatus)('Invited'); close(); }}>{t('users.invited')}</MenuItem>
                  </>
                )}
              </Popover>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-line dark:border-dark-raised shadow-sm flex flex-col ">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-274px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-background-light dark:bg-dark-surface sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 w-12 border-b border-line dark:border-dark-raised">
                    <div className="flex items-center"><input aria-label={t('users.selectAll')} className={CHECK} type="checkbox" checked={allSelected} onChange={toggleAll} /></div>
                  </th>
                  {COLS.map(([key, label]) => (
                    <th key={key} onClick={() => clickSort(key)} className={TH}>
                      <div className="flex items-center gap-1">
                        {t(label)}
                        <span className={`material-symbols-outlined text-[14px] ${sort?.key === key ? '' : 'opacity-0 group-hover:opacity-100'}`}>{sortIcon(key)}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 w-16 border-b border-line dark:border-dark-raised text-xs font-bold text-ink-muted uppercase tracking-wider text-center">{t('users.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline dark:divide-dark-raised">
                {rows.map((u) => {
                  const active = u.status === 'Active';
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ">
                      <td className="px-6 py-4 whitespace-nowrap"><input className={CHECK} type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
                      <td className="px-6 py-4 whitespace-nowrap ">
                        <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-primary/10 text-primary-ink dark:bg-primary/20 dark:text-primary-hover' : 'bg-gray-100 text-muted dark:bg-gray-800 dark:text-gray-500'}`}>{initials(u.name)}</div>
                          <span className={`font-semibold text-sm ${active ? 'text-gray-900 dark:text-white' : 'text-muted'}`}>{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap "><span className="text-sm text-gray-600 dark:text-gray-400">{u.email}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap "><span className={CHIP + (ROLE_CHIP[u.role] ?? ROLE_CHIP.Recruiter)}>{u.role}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap ">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${active ? 'bg-emerald-500' : u.status === 'Invited' ? 'bg-amber-400' : 'bg-gray-400'}`}></span>
                          <span className={`text-sm font-medium ${active ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>{t(active ? 'users.active' : u.status === 'Invited' ? 'users.invited' : 'users.inactive')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap "><span className="text-sm text-gray-500">{fullDate(u.createdAt)}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {/* Recruitment Leads see the menu only on the hiring-team roles they manage. */}
                        {canManageUser(me, u) && <Popover
                          wrapperClass="relative inline-block"
                          align="right"
                          trigger={({ toggle: tg }) => (
                            <button aria-label={t('users.col.actions')} onClick={tg} className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1 rounded transition-colors">
                              <span className="material-symbols-outlined text-[20px]">more_vert</span>
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuItem onClick={() => { close(); setDialog({ user: u }); }}>{t('users.menu.edit')}</MenuItem>
                              {u.status === 'Invited' && <MenuItem onClick={() => { close(); sendInvitation(u, currentUser().name); toast(t('users.inviteResent', { email: u.email })); }}>{t('users.menu.resend')}</MenuItem>}
                              {u.status === 'Invited' && <MenuItem onClick={() => { close(); useStore.getState().acceptInvitation(u.id); toast(t('users.joined', { name: u.name })); }}>{t('users.menu.accept')}</MenuItem>}
                              <MenuItem onClick={() => { close(); setActive(u); }}>{t(active ? 'users.menu.deactivate' : 'users.menu.activate')}</MenuItem>
                            </>
                          )}
                        </Popover>}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-ink-muted">{t('users.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} noun="users" onPage={setPage} />
        </div>
      </div>
      {dialog && <UserDialog key={dialog.user?.id ?? 'new'} user={dialog.user} onClose={() => setDialog(null)} />}
    </AppLayout>
  );
}

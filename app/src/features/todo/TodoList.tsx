import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Popover } from '../../components/Popover';
import { actionItems, type ActionItem } from '../../domain/actionItems';
import { notificationsFor, unreadCount, type AppNotification } from '../../domain/notifications';
import { can, normalizeRole } from '../../domain/permissions';
import { stageLabel } from '../../domain/stages';
import type { Job } from '../../domain/types';
import { userName } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';

export const TODO_ICON: Record<ActionItem['kind'], [string, string]> = {
  offer: ['request_quote', 'text-blue-600'],
  scorecard: ['rate_review', 'text-violet-600'],
  overdue: ['schedule', 'text-red-600'],
  new: ['fiber_new', 'text-emerald-600'],
};

/** The signed-in user's to-do items (see `actionItems`). */
export function useTodo(): ActionItem[] {
  const apps = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const user = useMe();
  return useMemo(() => actionItems(apps, jobs, user), [apps, jobs, user]);
}

/** Jobs waiting for the signed-in user's approval (Recruitment Lead / Super Admin); empty for everyone else. */
export function useApprovals(): Job[] {
  const jobs = useStore((s) => s.jobs);
  const user = useMe();
  return useMemo(() => (can(user, 'job.approve') ? jobs.filter((j) => j.status === 'pending_approval') : []), [jobs, user]);
}

export const APPROVALS_HREF = '/jobs?status=pending_approval';

/** One row pointing to the jobs waiting for approval; nothing when there are none. */
export function ApprovalsRow({ jobs, className, onClick }: { jobs: Job[]; className?: string; onClick?: () => void }) {
  const t = useT();
  if (jobs.length === 0) return null;
  return (
    <Link to={APPROVALS_HREF} onClick={onClick} className={className ?? 'flex items-start gap-2 px-3 py-2 hover:bg-[#f8f6f6] dark:hover:bg-white/5'}>
      <span aria-hidden="true" className="material-symbols-outlined text-[18px] mt-0.5 text-amber-600">approval</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-800 dark:text-white truncate">{t('todo.approvals', { n: jobs.length })}</span>
        <span className="block text-xs text-[#896a61] truncate">{jobs.map((j) => j.title).join(', ')}</span>
      </span>
    </Link>
  );
}

/** Where an item opens: the pipeline drawer, or My interviews for interviewers (who have no pipeline). */
export function useTodoHref(): (i: ActionItem) => string {
  const user = useMe();
  const interviewer = normalizeRole(user.role) === 'Interviewer';
  return (i) => (interviewer ? `/my-interviews?app=${i.appId}` : `/pipeline/${i.jobId}?app=${i.appId}`);
}

export function useTodoLabels() {
  const t = useT();
  const [lang] = useLang();
  const applications = useStore((s) => s.applications);
  const candidates = useStore((s) => s.candidates);
  const jobs = useStore((s) => s.jobs);
  const users = useStore((s) => s.users);
  return (i: ActionItem) => {
    const app = applications.find((a) => a.id === i.appId);
    const name = candidates.find((c) => c.id === i.candidateId)?.name ?? i.candidateId;
    const job = jobs.find((j) => j.id === i.jobId)?.title ?? '';
    const reason =
      i.kind === 'scorecard'
        ? t('todo.kind.scorecard', { who: (i.waitingOn ?? []).map((u) => userName(users, u)).join(', ') })
        : i.kind === 'overdue'
          ? t('todo.kind.overdue', { stage: app ? stageLabel(app.stage, lang) : '' })
          : t(`todo.kind.${i.kind}`);
    return { name, job, reason };
  };
}

/** Header bell with the to-do count; each entry opens the application. */
const NOTIF_ICON: Record<AppNotification['kind'], [string, string]> = {
  new_application: ['person_add', 'text-emerald-600'],
  interview_assigned: ['event', 'text-blue-600'],
  feedback_due: ['rate_review', 'text-violet-600'],
};

/** The signed-in user's notifications plus how many are unread. */
export function useNotifications(): { list: AppNotification[]; unread: number; markSeen: () => void } {
  const activities = useStore((s) => s.activities);
  const apps = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const seen = useStore((s) => s.ui.notifSeen);
  const user = useMe();
  const list = useMemo(() => notificationsFor(user, activities, apps, jobs), [user, activities, apps, jobs]);
  const markSeen = () =>
    useStore.setState((s) => ({ ui: { ...s.ui, notifSeen: { ...s.ui.notifSeen, [user.id]: new Date().toISOString() } } }));
  return { list, unread: unreadCount(list, seen?.[user.id]), markSeen };
}

export function TodoBell() {
  const t = useT();
  const items = useTodo();
  const href = useTodoHref();
  const label = useTodoLabels();
  const notes = useNotifications();
  const approvals = useApprovals();
  const candidates = useStore((s) => s.candidates);
  const jobs = useStore((s) => s.jobs);
  const count = items.length + (approvals.length ? 1 : 0);
  const name = t('todo.bell', { n: count });
  return (
    <Popover
      align="right"
      trigger={({ toggle }) => (
        <button
          onClick={() => { toggle(); notes.markSeen(); }}
          aria-label={name}
          title={name}
          className="relative size-10 rounded-full flex items-center justify-center text-[#896a61] hover:bg-[#f8f6f6] dark:hover:bg-white/5"
        >
          <span aria-hidden="true" className="material-symbols-outlined">notifications</span>
          {count > 0 && (
            <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
              {count > 99 ? '99+' : count}
            </span>
          )}
          {notes.unread > 0 && (
            <span data-testid="notif-dot" aria-label={t('notif.unread', { n: notes.unread })} className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-[#1e1e1e]" />
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="w-80 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="px-3 py-2 text-xs font-bold text-[#896a61] uppercase tracking-wider">{t('notif.title')}</div>
          {notes.list.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-[#896a61]">{t('notif.empty')}</p>
          ) : (
            notes.list.slice(0, 8).map((n) => {
              const who = candidates.find((c) => c.id === n.candidateId)?.name ?? '';
              const job = jobs.find((j) => j.id === n.jobId)?.title ?? '';
              return (
                <Link key={n.id} to={href({ kind: 'new', appId: n.appId, jobId: n.jobId, candidateId: n.candidateId })} onClick={close} role="menuitem" className="flex items-start gap-2 px-3 py-2 hover:bg-[#f8f6f6] dark:hover:bg-white/5">
                  <span aria-hidden="true" className={`material-symbols-outlined text-[18px] mt-0.5 ${NOTIF_ICON[n.kind][1]}`}>{NOTIF_ICON[n.kind][0]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-800 dark:text-white">{t(`notif.kind.${n.kind}`, { name: who, job })}</span>
                    <span className="block text-xs text-[#896a61]">{new Date(n.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </span>
                </Link>
              );
            })
          )}
          <div className="border-t border-gray-100 dark:border-white/10 mt-1" />
          <div className="px-3 py-2 text-xs font-bold text-[#896a61] uppercase tracking-wider">{t('todo.title')}</div>
          <ApprovalsRow jobs={approvals} onClick={close} />
          {items.length === 0 ? (
            approvals.length === 0 && <p className="px-3 pb-3 text-sm text-[#896a61]">{t('todo.empty')}</p>
          ) : (
            items.slice(0, 20).map((i) => {
              const l = label(i);
              return (
                <Link key={i.appId} to={href(i)} onClick={close} role="menuitem" className="flex items-start gap-2 px-3 py-2 hover:bg-[#f8f6f6] dark:hover:bg-white/5">
                  <span aria-hidden="true" className={`material-symbols-outlined text-[18px] mt-0.5 ${TODO_ICON[i.kind][1]}`}>{TODO_ICON[i.kind][0]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-800 dark:text-white truncate">{l.name}</span>
                    <span className="block text-xs text-[#896a61] truncate">{l.reason} · {l.job}</span>
                  </span>
                </Link>
              );
            })
          )}
          {items.length > 20 && <p className="px-3 py-2 text-xs text-[#896a61]">{t('todo.more', { n: items.length - 20 })}</p>}
        </div>
      )}
    </Popover>
  );
}

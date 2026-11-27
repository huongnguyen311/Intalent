import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Pagination } from '../../components/Pagination';
import type { Activity, ActivityType } from '../../domain/types';
import { userName } from '../../domain/users';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const PAGE_SIZE = 25;
const FIELD = 'h-9 rounded-xl border border-line dark:border-dark-line bg-white dark:bg-dark-raised px-3 text-sm text-slate-700 dark:text-white';
const TH = 'px-4 py-3 text-left text-xs font-bold text-ink-muted uppercase tracking-wider border-b border-line dark:border-dark-raised';
const TD = 'px-4 py-3 text-sm border-b border-hairline dark:border-dark-raised align-top';

/** Groups shown in the action filter; every ActivityType belongs to one. */
const GROUPS: Record<string, ActivityType[]> = {
  candidate: ['candidate_created', 'candidate_merged', 'candidate_self_update', 'suggestion_reviewed', 'owner_transferred', 'note_added', 'note_converted'],
  application: ['added_to_pipeline', 'stage_changed', 'email_sent', 'ai_evaluated', 'interview_scheduled', 'interview_cancelled', 'scorecard_submitted', 'offer_updated', 'handed_off'],
  job: ['job_created', 'job_status_changed', 'job_approval_requested', 'job_approved', 'job_rejected'],
  user: ['user_invited', 'user_joined', 'user_role_changed', 'user_status_changed', 'settings_updated'],
  privacy: ['consent_captured', 'candidate_anonymized', 'pii_revealed', 'pii_exported'],
};
const groupOf = (type: ActivityType) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(type)) ?? 'candidate';

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

/** PRD 3.1 / BE-11: every important action (user, job, application, stage, privacy), newest first. */
export function AuditLogPage() {
  const t = useT();
  const activities = useStore((s) => s.activities);
  const users = useStore((s) => s.users);
  const candidates = useStore((s) => s.candidates);
  const jobs = useStore((s) => s.jobs);
  const [group, setGroup] = useState('');
  const [actor, setActor] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const actors = useMemo(() => [...new Set(activities.map((a) => a.by))].filter(Boolean), [activities]);
  const rows = useMemo(() => {
    const text = q.trim().toLowerCase();
    return activities
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => (!group || groupOf(a.type) === group) && (!actor || a.by === actor))
      .filter(({ a }) => !text || `${a.detail} ${a.type}`.toLowerCase().includes(text))
      .sort((x, y) => y.a.at.localeCompare(x.a.at) || y.i - x.i)
      .map(({ a }) => a);
  }, [activities, group, actor, q]);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  const target = (a: Activity) => {
    if (a.candidateId) {
      const c = candidates.find((x) => x.id === a.candidateId);
      return c ? <Link className="text-primary font-semibold hover:underline" to={`/candidates/${c.id}`}>{c.name}</Link> : a.candidateId;
    }
    if (a.jobId) {
      const j = jobs.find((x) => x.id === a.jobId);
      return j ? <Link className="text-primary font-semibold hover:underline" to={`/jobs/${j.id}`}>{j.title}</Link> : a.jobId;
    }
    if (a.userId) return userName(users, a.userId);
    return '—';
  };

  return (
    <AppLayout title={t('nav.audit')} subtitle={t('audit.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" aria-label={t('audit.search')} placeholder={t('audit.search')} className={`${FIELD} w-64`} value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          <select aria-label={t('audit.filter.action')} className={FIELD} value={group} onChange={(e) => reset(setGroup)(e.target.value)}>
            <option value="">{t('audit.filter.allActions')}</option>
            {Object.keys(GROUPS).map((g) => <option key={g} value={g}>{t(`audit.group.${g}` as TKey)}</option>)}
          </select>
          <select aria-label={t('audit.filter.actor')} className={FIELD} value={actor} onChange={(e) => reset(setActor)(e.target.value)}>
            <option value="">{t('audit.filter.allActors')}</option>
            {actors.map((id) => <option key={id} value={id}>{userName(users, id)}</option>)}
          </select>
          <span className="ml-auto text-sm text-ink-muted">{t('audit.count', { n: rows.length })}</span>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-line dark:border-dark-raised overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>{t('audit.col.time')}</th>
                <th className={TH}>{t('audit.col.actor')}</th>
                <th className={TH}>{t('audit.col.action')}</th>
                <th className={TH}>{t('audit.col.target')}</th>
                <th className={TH}>{t('audit.col.detail')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a, i) => (
                <tr key={`${a.at}-${i}`} data-testid="audit-row">
                  <td className={`${TD} whitespace-nowrap text-ink-muted`}>{fmt(a.at)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{userName(users, a.by) || a.by}</td>
                  <td className={TD}>
                    <span className="px-2 py-0.5 rounded-full bg-background-light dark:bg-white/5 text-xs font-bold whitespace-nowrap">{a.type.replace(/_/g, ' ')}</span>
                  </td>
                  <td className={TD}>{target(a)}</td>
                  <td className={`${TD} text-slate-600 dark:text-gray-300`}>{a.detail}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={5} className={`${TD} text-center text-ink-muted py-10`}>{t('audit.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
      </div>
    </AppLayout>
  );
}

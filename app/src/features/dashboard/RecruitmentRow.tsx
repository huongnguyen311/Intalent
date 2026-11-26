import { Link } from 'react-router-dom';
import { AI_MATCH_THRESHOLD, type DashboardMetrics } from '../../domain/metrics';
import type { User } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useApprovals, useTodo } from '../todo/TodoList';
import { Funnel } from './Funnel';
import { SourcesDonut } from './SourcesDonut';
import { CAPTION, OpenJobs, PANEL, Panel, TodayPanel, ActivityPanel, TRACK } from './DashboardWidgets';

/*
 * Visual system for the app Dashboard (recruitment only):
 * - one surface style: white, 16px radius, hairline border, no drop shadow; inner marks use 4px radius;
 * - sentence-case titles and muted captions, no uppercase eyebrow labels;
 * - data colour is the brand primary only (each chart is a single series); red is kept for the funnel's weakest step;
 * - the KPIs read as one band split by hairlines rather than five separate cards.
 */
const SELECT = 'h-9 rounded-lg border border-hairline bg-white dark:bg-[#1e1e1e] dark:border-white/10 pl-3 pr-9 text-xs font-semibold text-slate-700 dark:text-gray-200';

const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : undefined);

/** A percentage with a thin meter under it; the meter makes 6% and 75% read differently at a glance. */
function Meter({ label, value, caption, testId }: { label: string; value?: number; caption: string; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">{label}</span>
        <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value === undefined ? '—' : `${value}%`}</span>
      </div>
      <div className={`mt-2 ${TRACK}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0}>
        <div className="h-2 rounded bg-primary" style={{ width: `${value ?? 0}%` }} />
      </div>
      <p className={`mt-2 ${CAPTION}`}>{caption}</p>
    </div>
  );
}

/** Common Vietnamese family names (unaccented), to tell "Pham Gia Huy" from "Anna Smith". */
const VN_FAMILY = new Set(['nguyen', 'tran', 'le', 'pham', 'hoang', 'huynh', 'phan', 'vu', 'vo', 'dang', 'bui', 'do', 'ho', 'ngo', 'duong', 'ly', 'mai', 'truong', 'dinh', 'ha', 'cao', 'lam', 'trinh', 'doan', 'luong', 'luu', 'ta', 'chu', 'kieu', 'quach', 'to', 'thai', 'nong', 'la']);

/**
 * New (non-mockup) row: recruitment pipeline health (PRD 3.8). Hidden in fixture mode via useShowNew.
 * Order: greeting with today's load and the filters; KPI band; to-do | interview week; funnel | quality;
 * open jobs | sources + reject reasons; recent activity last (context, not a call to act).
 * Over-SLA cases are not a tile of their own: the to-do list already names each one.
 * Recruitment cost is left out on purpose: the app records no cost data yet.
 */
export function RecruitmentRow({ metrics, recruiters, recruiterFilter, onRecruiter, period, now = Date.now() }: {
  metrics: DashboardMetrics['recruitment'];
  /** The date-range buttons, shown with the job / recruiter filters. */
  period?: React.ReactNode;
  now?: number;
  /** Omitted when the viewer only sees their own jobs: the recruiter filter is then hidden. */
  recruiters?: User[];
  recruiterFilter: string;
  onRecruiter: (id: string) => void;
}) {
  const t = useT();
  const [lang] = useLang();
  const me = useMe();
  const todo = useTodo();
  const approvals = useApprovals();
  const top = metrics.funnel[0]?.reached ?? 0;
  const maxReason = Math.max(1, ...metrics.topRejectReasons.map((r) => r.count));
  const offerTotal = metrics.offers.accepted + metrics.offers.declined;

  const kpis: { key: string; label: string; value: string | number; unit?: string; caption: React.ReactNode; icon: string; testId?: string; href?: string }[] = [
    {
      key: 'open',
      label: t('dashboard.openJobs'),
      value: metrics.openJobs,
      icon: 'work',
      href: '/jobs?status=open',
      caption: <span className="font-semibold text-primary group-hover:underline">{t('dashboard.viewJobs')}</span>,
    },
    { key: 'new', label: t('dashboard.newApplications'), value: metrics.newApplications, icon: 'person_add', caption: t('dashboard.cap.period') },
    { key: 'progress', label: t('dashboard.inProgress'), value: metrics.inProgress, icon: 'pending_actions', caption: t('dashboard.cap.inProgress'), testId: 'kpi-in-progress' },
    { key: 'hires', label: t('dashboard.hires'), value: metrics.hires, icon: 'how_to_reg', caption: t('dashboard.cap.period') },
    {
      // Applications from this period that ended in Rejected, with their share of the period's intake.
      key: 'rejected',
      label: t('dashboard.rejected'),
      value: metrics.closedOut.rejected,
      icon: 'person_remove',
      caption: metrics.newApplications ? t('dashboard.cap.rejected', { pct: pct(metrics.closedOut.rejected, metrics.newApplications) ?? 0 }) : t('dashboard.cap.period'),
      testId: 'kpi-rejected',
    },
  ];

  const hour = new Date(now).getHours();
  // A Vietnamese name (family name first: "Pham Gia Huy") is greeted by its last word whatever the UI language.
  const parts = me?.name.trim().split(/\s+/) ?? [];
  const firstName = (VN_FAMILY.has(parts[0]?.toLowerCase() ?? '') || lang === 'vi' ? parts[parts.length - 1] : parts[0]) ?? '';
  const greeting = t(hour < 12 ? 'dashboard.hello.morning' : hour < 18 ? 'dashboard.hello.afternoon' : 'dashboard.hello.evening', { name: firstName });
  const todayInterviews = metrics.week.interviews.filter((i) => i.at.startsWith(metrics.week.today)).length;
  const dateLine = new Date(now).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section data-testid="dashboard-recruitment" className="space-y-6">
      {/* Greeting and today's load on the left; the scope (period, job, recruiter) and the primary action on the right. */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted first-letter:uppercase">{dateLine}</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{greeting}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{t(todayInterviews === 1 ? 'dashboard.todayLineOne' : 'dashboard.todayLine', { interviews: todayInterviews, todo: todo.length + (approvals.length ? 1 : 0) })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {period}
          {recruiters && (
            <select aria-label={t('dashboard.filter.recruiter')} className={SELECT} value={recruiterFilter} onChange={(e) => onRecruiter(e.target.value)}>
              <option value="">{t('dashboard.filter.allRecruiters')}</option>
              {recruiters.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* One band, hairline-separated: the gap-px grid on a hairline background draws the dividers even when it wraps. */}
      <div className={`${PANEL} overflow-hidden`}>
        <dl className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-hairline dark:bg-white/10">
          {kpis.map((k) => {
            const body = (
              <>
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-gray-400">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400 dark:text-gray-500">{k.icon}</span>
                  {k.label}
                </dt>
                <dd className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[30px] sm:text-[34px] leading-none font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">{k.value}</span>
                  {k.unit && <span className="text-sm text-muted">{k.unit}</span>}
                </dd>
                <dd className={`mt-2 ${CAPTION}`}>{k.caption}</dd>
              </>
            );
            // Two per row on small screens; the fifth (Rejected) takes the full last row there.
            const cell = `block bg-white dark:bg-[#1e1e1e] px-4 py-4 sm:px-6 sm:py-5 ${k.key === 'rejected' ? 'col-span-2 lg:col-span-1' : ''}`;
            // The whole Open-jobs cell is the link: a bigger target than the caption alone.
            return k.href ? (
              <Link key={k.key} to={k.href} className={`${cell} group hover:bg-slate-50 dark:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary`}>
                {body}
              </Link>
            ) : (
              <div key={k.key} data-testid={k.testId} className={cell}>{body}</div>
            );
          })}
        </dl>
      </div>

      <TodayPanel week={metrics.week} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title={t('dashboard.funnel')} caption={t('dashboard.funnelHint')} testId="dashboard-funnel" className="lg:col-span-2">
          <Funnel funnel={metrics.funnel} />
        </Panel>

        <Panel title={t('dashboard.quality')}>
          <div className="space-y-6">
            <Meter
              testId="kpi-ai-match"
              label={t('dashboard.aiMatch')}
              value={pct(metrics.aiMatch.matched, metrics.aiMatch.scored)}
              caption={t('dashboard.aiMatchHint', { matched: metrics.aiMatch.matched, scored: metrics.aiMatch.scored, min: AI_MATCH_THRESHOLD })}
            />
            <Meter
              testId="kpi-drop-out"
              label={t('dashboard.dropOut')}
              value={pct(metrics.closedOut.rejected + metrics.closedOut.withdrawn, top)}
              caption={t('dashboard.closedOut', { rejected: metrics.closedOut.rejected, withdrawn: metrics.closedOut.withdrawn })}
            />
            <Meter
              testId="kpi-offer"
              label={t('dashboard.offerAcceptance')}
              value={pct(metrics.offers.accepted, offerTotal)}
              caption={t('dashboard.offerHint', { accepted: metrics.offers.accepted, declined: metrics.offers.declined })}
            />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OpenJobs jobs={metrics.openJobsList} now={now} />
        <div className="grid content-start gap-6">
        <Panel title={t('dashboard.topSources')} testId="dashboard-sources">
          {metrics.topSources.length === 0 ? (
            <p className={CAPTION}>{t('dashboard.noData')}</p>
          ) : (
            <SourcesDonut sources={metrics.topSources} />
          )}
        </Panel>

        <Panel title={t('dashboard.rejectReasons')} testId="dashboard-reject-reasons">
          {metrics.topRejectReasons.length === 0 ? (
            <p className={CAPTION}>{t('dashboard.noData')}</p>
          ) : (
            <ol className="space-y-3">
              {metrics.topRejectReasons.slice(0, 4).map((r, i) => (
                <li key={r.reason} title={`${r.reason}: ${r.count}`} className="flex items-center gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold tabular-nums text-slate-500 dark:bg-white/10 dark:text-gray-300">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-700 dark:text-gray-200">{r.reason}</span>
                    {/* Neutral bar: secondary context, not a headline series. */}
                    <span className="mt-1.5 block h-1 rounded bg-slate-100 dark:bg-white/10">
                      <span className="block h-1 rounded bg-slate-400 dark:bg-gray-500" style={{ width: `${(100 * r.count) / maxReason}%` }} />
                    </span>
                  </span>
                  <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{r.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        </div>
      </div>

      <ActivityPanel items={metrics.recentActivity} now={now} />
    </section>
  );
}

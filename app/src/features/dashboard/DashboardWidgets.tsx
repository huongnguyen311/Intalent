import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, toneFor } from '../../components/Avatar';
import { PERIODS, type DashboardMetrics, type OpenJobRow, type Period, type WeekInterview } from '../../domain/metrics';
import { stageLabel } from '../../domain/stages';
import type { Stage } from '../../domain/types';
import { useLang, useT, type TKey } from '../../i18n/i18n';
import { ApprovalsRow, TODO_ICON, useApprovals, useTodo, useTodoHref, useTodoLabels } from '../todo/TodoList';

/*
 * Shared look for the app Dashboard: white panels, 16px radius, hairline border, no drop shadow;
 * sentence-case titles with a muted caption; brand primary is the only data colour.
 */
export const PANEL = 'rounded-2xl border border-hairline bg-white dark:bg-[#1e1e1e] dark:border-white/10';
export const CAPTION = 'text-xs text-muted';
export const TRACK = 'h-2 rounded bg-slate-100 dark:bg-white/10';
const TITLE = 'ty-section text-base font-bold text-slate-900 dark:text-white';

export function Panel({ title, caption, action, testId, className = '', children }: {
  title: string;
  caption?: string;
  /** A small link or control at the top right (e.g. "View all"). */
  action?: React.ReactNode;
  testId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${PANEL} p-5 sm:p-6 ${className}`} data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className={TITLE}>{title}</h4>
          {caption && <p className={`mt-0.5 ${CAPTION}`}>{caption}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Segmented Ngày/Tuần/3M/6M/All control: the chosen range sits raised on a quiet track. */
export function PeriodControl({ value, onChange, testId }: { value: Period; onChange: (p: Period) => void; testId?: string }) {
  const t = useT();
  return (
    <div data-testid={testId} className="flex h-9 items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-white/10 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            value === p
              ? 'bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
              : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          {t(`dash.period.${p}` as TKey)}
        </button>
      ))}
    </div>
  );
}

/** Soft status pill: green for hired, red for rejected/withdrawn, amber for offer, neutral otherwise. Always a text label. */
export function StagePill({ stage }: { stage: Stage }) {
  const [lang] = useLang();
  const tone =
    stage === 'hired' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : stage === 'rejected' || stage === 'withdrawn' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : stage === 'offer' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-gray-200';
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{stageLabel(stage, lang)}</span>;
}

const pad = (n: number) => String(n).padStart(2, '0');
const looksLikeLink = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+\/\S*/i.test(s.trim());

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(id);
  }, [done]);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => setDone(true), () => undefined);
      }}
      aria-label={done ? t('dashboard.copied') : t('dashboard.copyLink')}
      title={done ? t('dashboard.copied') : `${t('dashboard.copyLink')}: ${text}`}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{done ? 'check' : 'content_copy'}</span>
    </button>
  );
}

/** "2 hours ago" / "2 giờ trước", falling back to a date after a week. */
function relative(iso: string, now: number, locale: string): string {
  const mins = Math.round((Date.parse(iso) - now) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  if (Math.abs(mins) < 60 * 24) return rtf.format(Math.round(mins / 60), 'hour');
  if (Math.abs(mins) < 60 * 24 * 7) return rtf.format(Math.round(mins / 1440), 'day');
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

/*
 * Every block of the Today area has the same anatomy, so they read as one:
 * header (title, count, action) · optional control · rows of one height · footer pinned to the bottom.
 * A row: fixed-width lead (icon / time / avatar), two lines of text, a short trail.
 */
function Column({ id, title, count, action, control, footer, children }: {
  id: string;
  title: string;
  count?: number;
  action?: React.ReactNode;
  control?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex h-full min-w-0 flex-col bg-white p-5 dark:bg-[#1e1e1e] sm:p-6">
      <div className="flex h-7 items-center gap-2">
        <h4 id={id} className="text-base font-bold text-slate-900 dark:text-white">{title}</h4>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">{count}</span>
        )}
        <span className="ml-auto">{action}</span>
      </div>
      {control && <div className="mt-3">{control}</div>}
      <div className="mt-3 flex-1">{children}</div>
      <div className="mt-3 h-5 text-xs text-muted">{footer}</div>
    </section>
  );
}

const ROW = 'flex h-14 items-center gap-3';
const ROW_HOVER = '-mx-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const LINE1 = 'block truncate text-sm font-semibold text-slate-900 dark:text-white';
const LINE2 = 'block truncate text-xs text-muted';
const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-4 text-sm text-muted">{children}</p>;
/** The to-do (left, 2/3 wide) lays rows two across; ten items make five rows, about the schedule's height. */
const WIDE_ROWS = 10;
const WIDE_LIST = 'grid grid-cols-1 gap-x-8 sm:grid-cols-2';

function TodoColumn() {
  const t = useT();
  const items = useTodo();
  const href = useTodoHref();
  const label = useTodoLabels();
  // Jobs waiting for this user's approval come first: nothing else tells an approver they are there.
  const approvals = useApprovals();
  // No filter: the list is already in priority order (actionItems), so the top of it is what to do first.
  const shown = items.slice(0, WIDE_ROWS);
  return (
    <Column
      id="todo-title"
      title={t('todo.title')}
      count={items.length + (approvals.length ? 1 : 0)}
      footer={items.length > WIDE_ROWS && t('todo.more', { n: items.length - WIDE_ROWS })}
    >
      <ApprovalsRow jobs={approvals} className={`${ROW} ${ROW_HOVER} mb-1`} />
      {items.length === 0 ? (
        approvals.length === 0 &&
        <Empty>{t('todo.empty')}</Empty>
      ) : (
        // Filled down the first column, then the second, so priority reads top to bottom, not zig-zag.
        <ul className={`${WIDE_LIST} sm:grid-flow-col`} style={{ gridTemplateRows: `repeat(${Math.ceil(shown.length / 2)}, auto)` }}>
          {shown.map((i) => {
            const l = label(i);
            return (
              <li key={i.appId}>
                <Link to={href(i)} title={l.job} className={`${ROW} ${ROW_HOVER}`}>
                  <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-lg bg-slate-50 dark:bg-white/5 ${TODO_ICON[i.kind][1]}`}>
                    <span className="material-symbols-outlined text-[18px]">{TODO_ICON[i.kind][0]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={LINE1}>{l.name}</span>
                    <span className={LINE2}>{l.reason}</span>
                  </span>
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-slate-300 dark:text-gray-600">chevron_right</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Column>
  );
}

const MODE_ICON: Record<WeekInterview['mode'], string> = { online: 'videocam', onsite: 'location_on', phone: 'call' };

function ScheduleColumn({ week }: { week: DashboardMetrics['recruitment']['week'] }) {
  const t = useT();
  const [lang] = useLang();
  const [day, setDay] = useState(week.days.includes(week.today) ? week.today : week.days[0]);
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const items = week.interviews.filter((i) => i.at.startsWith(day));
  const busy = new Set(week.interviews.map((i) => i.at.slice(0, 10)));
  const dateOf = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Date(y, m - 1, dd);
  };
  return (
    <Column
      id="schedule-title"
      title={t('dashboard.schedule')}
      count={items.length}
      control={
        <div role="group" aria-label={t('dashboard.schedule')} className="grid grid-cols-7 gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-white/10">
          {week.days.map((d) => {
            const date = dateOf(d);
            const selected = d === day;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                aria-pressed={selected}
                aria-label={date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'numeric' })}
                className={`relative flex flex-col items-center rounded-md pb-1.5 pt-1 leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  selected ? 'bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] dark:bg-[#2a2a2a]' : 'hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <span className="text-[11px] text-muted">{date.toLocaleDateString(locale, { weekday: 'narrow' })}</span>
                <span className={`text-sm font-bold tabular-nums ${d === week.today ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{date.getDate()}</span>
                {busy.has(d) && <span aria-hidden="true" className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      }
      footer={items.length > DAY_ROWS && t('dashboard.moreInterviews', { n: items.length - DAY_ROWS })}
    >
      {items.length === 0 ? (
        <Empty>{t('dashboard.noInterviewsDay')}</Empty>
      ) : (
        <ul>
          {items.slice(0, DAY_ROWS).map((i) => (
            <InterviewRow key={i.id} i={i} lead={<><b className="block text-sm font-bold text-slate-900 dark:text-white">{i.at.slice(11, 16)}</b><span className="block text-[11px] text-muted">{endOf(i)}</span></>} />
          ))}
        </ul>
      )}
    </Column>
  );
}

/** Interviews shown for the chosen day in the narrow right column, one per row. */
const DAY_ROWS = 5;
/** The full-width activity panel at the bottom: three across on wide screens, so six items make two rows. */
const ACTIVITY_ROWS = 6;

function endOf(i: WeekInterview) {
  const [h, m] = i.at.slice(11, 16).split(':').map(Number);
  const e = h * 60 + m + i.durationMin;
  return `${pad(Math.floor(e / 60) % 24)}:${pad(e % 60)}`;
}

/** One interview: start/end time, a thin rail, candidate + round/place, and a copy button for meeting links. */
function InterviewRow({ i, lead }: { i: WeekInterview; lead: React.ReactNode }) {
  const t = useT();
  const link = looksLikeLink(i.place);
  return (
    <li className={ROW}>
      <span className="w-12 shrink-0 text-left leading-tight tabular-nums">{lead}</span>
      <span aria-hidden="true" className="h-9 w-0.5 shrink-0 rounded bg-primary/30" />
      <Link to={`/pipeline/${i.jobId}?app=${i.appId}`} className={`min-w-0 flex-1 py-1 ${ROW_HOVER}`}>
        <span className={LINE1}>{i.candidate}</span>
        <span className={`${LINE2} flex items-center gap-1`} title={`${t(`interview.mode.${i.mode}` as TKey)}: ${i.place}`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{MODE_ICON[i.mode]}</span>
          <span className="truncate">{i.round}{i.place && !link ? `, ${i.place}` : ''}</span>
        </span>
      </Link>
      {link && <CopyButton text={i.place} />}
    </li>
  );
}

function ActivityColumn({ items, now }: { items: DashboardMetrics['recruitment']['recentActivity']; now: number }) {
  const t = useT();
  const [lang] = useLang();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  return (
    <Column
      id="activity-title"
      title={t('dashboard.recent')}
      action={
        <Link to="/pipeline" className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          {t('dashboard.openPipeline')}
        </Link>
      }
    >
      {items.length === 0 ? (
        <Empty>{t('dashboard.noActivity')}</Empty>
      ) : (
        <ul data-testid="dashboard-recent" className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
          {items.slice(0, ACTIVITY_ROWS).map((a) => (
            <li key={a.id}>
              <Link to={`/pipeline/${a.jobId}?app=${a.appId}`} title={a.job} className={`${ROW} ${ROW_HOVER}`}>
                <Avatar name={a.candidate} tone={toneFor(a.candidate)} />
                <span className="min-w-0 flex-1">
                  <span className={LINE1}>{a.candidate}</span>
                  <span className={LINE2}>{relative(a.at, now, locale)}, {a.job}</span>
                </span>
                <StagePill stage={a.stage} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Column>
  );
}

/**
 * The day at a glance, on the same 2/3 + 1/3 grid as the dashboard rows below:
 * left, what waits on me (to-do, rows two across); right, the interview week.
 */
export function TodayPanel({ week }: { week: DashboardMetrics['recruitment']['week'] }) {
  return (
    // 3/5 + 2/5: the schedule gets more room than the 1/3 columns below, so places and meeting links fit on one line.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5" data-testid="dashboard-today">
      <div className={`${PANEL} overflow-hidden lg:col-span-3`}>
        <TodoColumn />
      </div>
      <div className={`${PANEL} overflow-hidden lg:col-span-2`} data-testid="dashboard-today-interviews">
        <ScheduleColumn week={week} />
      </div>
    </div>
  );
}

/** What just moved, at the foot of the page: context rather than a call to act, so it comes last. */
export function ActivityPanel({ items, now }: { items: DashboardMetrics['recruitment']['recentActivity']; now: number }) {
  return (
    <div className={`${PANEL} overflow-hidden`}>
      <ActivityColumn items={items} now={now} />
    </div>
  );
}

const JOB_GRID = 'grid grid-cols-[minmax(0,1fr)_72px_20px] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_80px_80px_72px_20px]';

/** Open jobs at a glance: where, what kind, pay, and how many applied (with this week's new ones). */
export function OpenJobs({ jobs, now }: { jobs: OpenJobRow[]; now: number }) {
  const t = useT();
  return (
    <Panel
      title={t('dashboard.openJobsTitle')}
      caption={t('dashboard.openJobsHint')}
      testId="dashboard-open-jobs"
      className="lg:col-span-2"
      action={
        <Link to="/jobs?status=open" className="shrink-0 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          {t('dashboard.viewAll')}
        </Link>
      }
    >
      {jobs.length === 0 ? (
        <p className={CAPTION}>{t('dashboard.noOpenJobs')}</p>
      ) : (
        // A compact table: one line of facts per job, numbers in right-aligned columns that scan down.
        <div className="-mx-5 sm:-mx-6">
          <div className={`${JOB_GRID} border-b border-hairline px-5 pb-2 text-xs font-semibold text-muted dark:border-white/10 sm:px-6`} aria-hidden="true">
            <span>{t('dashboard.col.job')}</span>
            <span className="text-right">{t('dashboard.col.applicants')}</span>
            <span className="hidden text-right sm:block">{t('dashboard.col.new')}</span>
            <span className="hidden text-right sm:block">{t('dashboard.col.open')}</span>
            <span />
          </div>
          <ul className="divide-y divide-hairline dark:divide-white/10">
            {jobs.slice(0, 5).map((j) => {
              const days = Math.max(0, Math.floor((now - Date.parse(j.openedAt)) / 86_400_000));
              return (
                <li key={j.id}>
                  <Link
                    to={`/pipeline/${j.id}`}
                    title={t('dashboard.applicants', { n: j.applicants })}
                    className={`${JOB_GRID} px-5 py-3.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary dark:hover:bg-white/5 sm:px-6`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{j.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {[j.department, j.location, j.employment, j.salary].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{j.applicants}</span>
                    <span className={`hidden text-right text-sm tabular-nums sm:block ${j.newThisWeek > 0 ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-muted'}`}>
                      {j.newThisWeek > 0 ? `+${j.newThisWeek}` : '0'}
                    </span>
                    <span className="hidden text-right text-sm tabular-nums text-muted sm:block">{t('dashboard.daysShort', { n: days })}</span>
                    <span aria-hidden="true" className="material-symbols-outlined text-right text-[18px] text-slate-300 dark:text-gray-600">chevron_right</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** Urgent and overdue open jobs (current state, so the period filter does not apply); each links to the filtered Jobs list. */
export function UrgencyTiles({ urgent, overdue }: { urgent: number; overdue: number }) {
  const t = useT();
  const tile = (id: string, to: string, icon: string, label: string, n: number, alert: boolean) => (
    <Link
      data-testid={id}
      to={to}
      className={`${PANEL} flex items-center gap-3 px-4 py-3 hover:border-primary/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
    >
      <span aria-hidden="true" className={`material-symbols-outlined text-[22px] ${alert && n > 0 ? 'text-red-600' : 'text-muted'}`}>{icon}</span>
      <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">{label}</span>
      <span className={`ml-auto text-2xl font-bold ${alert && n > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{n}</span>
    </Link>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 mb-4">
      {tile('tile-urgent-jobs', '/jobs?priority=urgent,critical&status=open', 'priority_high', t('dashboard.urgentJobs'), urgent, false)}
      {tile('tile-overdue-jobs', '/jobs?overdue=1', 'event_busy', t('dashboard.overdueJobs'), overdue, true)}
    </div>
  );
}

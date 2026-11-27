import { useMemo } from 'react';
import { localStamp } from '../../domain/hiring';
import type { Application, Interview, Job } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';

export type CalRow = { iv: Interview; app: Application; job?: Job; name: string; tone: 'green' | 'amber' | 'violet' };
export type CalMode = 'week' | 'month';
export type InterviewView = CalMode | 'list';

const VIEW_ICON = { week: 'view_week', month: 'calendar_month', list: 'view_list' } as const;

/** Week | Month | List switch, shown at the right of the calendar header and of the list's first section. */
export function ViewSwitch({ view, onChange }: { view: InterviewView; onChange: (v: InterviewView) => void }) {
  const t = useT();
  return (
    <div className="ui-seg inline-flex items-center gap-1 rounded-xl border border-gray-100 dark:border-white/10 p-0.5">
      {(['week', 'month', 'list'] as const).map((v) => (
        <button
          key={v}
          onClick={() => v !== view && onChange(v)}
          aria-pressed={view === v}
          className={`ui-seg-item flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${view === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-muted hover:text-slate-700 dark:hover:text-white'}`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{VIEW_ICON[v]}</span>
          {t(`myInterviews.view.${v}`)}
        </button>
      ))}
    </div>
  );
}

const MODE_ICON = { online: 'videocam', onsite: 'apartment', phone: 'call' } as const;
const TONE = {
  green: 'border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20',
  amber: 'border-l-amber-500 bg-amber-50/70 dark:bg-amber-900/20',
  violet: 'border-l-violet-500 bg-violet-50/70 dark:bg-violet-900/20',
} as const;
const DOT = { green: 'bg-emerald-500', amber: 'bg-amber-500', violet: 'bg-violet-500' } as const;

const dayKey = (d: Date) => localStamp(d).slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week holding `d` (weeks start on Monday, as in Vietnam). */
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
/** Parses YYYY-MM-DD as a local date (no UTC shift). */
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Week or month calendar of the user's interviews. `cursor` (YYYY-MM-DD) is any day inside the shown range;
 * the parent owns it so the range survives switching views and lives in the URL.
 */
export function InterviewCalendar({
  rows,
  mode,
  cursor,
  onCursor,
  onMode,
  onOpen,
}: {
  rows: CalRow[];
  mode: CalMode;
  cursor: string;
  onCursor: (day: string) => void;
  /** Switches week/month; `day` also moves the range there ("+N more" opens that day's week). */
  onMode: (m: InterviewView, day?: string) => void;
  onOpen: (r: CalRow) => void;
}) {
  const t = useT();
  const [lang] = useLang();
  const locale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const today = dayKey(new Date());
  const base = parseDay(cursor);

  const byDay = useMemo(() => {
    const m = new Map<string, CalRow[]>();
    for (const r of [...rows].sort((a, b) => a.iv.at.localeCompare(b.iv.at))) {
      const k = r.iv.at.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rows]);

  const weekStart = startOfWeek(base);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const days =
    mode === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      : Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(monthStart), i));

  const step = (dir: -1 | 1) =>
    onCursor(dayKey(mode === 'week' ? addDays(base, dir * 7) : new Date(base.getFullYear(), base.getMonth() + dir, 1)));

  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, o);
  const label =
    mode === 'month'
      ? fmt(base, { month: 'long', year: 'numeric' })
      : `${fmt(days[0], { day: 'numeric', month: 'short' })} – ${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(addDays(weekStart, i), { weekday: 'short' }));

  const card = (r: CalRow, compact: boolean) => (
    <button
      key={r.iv.id}
      onClick={() => onOpen(r)}
      title={`${r.iv.at.slice(11, 16)} · ${r.name} · ${r.job?.title ?? ''} · ${r.iv.round}`}
      className={`w-full text-left rounded-lg border-l-[3px] hover:brightness-95 dark:hover:brightness-125 transition ${TONE[r.tone]} ${compact ? 'px-1.5 py-0.5' : 'px-2 py-1.5'}`}
    >
      {compact ? (
        <span className="flex items-center gap-1 text-2xs leading-4 text-slate-700 dark:text-gray-200 min-w-0">
          <span className="font-semibold tabular-nums shrink-0">{r.iv.at.slice(11, 16)}</span>
          <span className="truncate">{r.name}</span>
        </span>
      ) : (
        <>
          <span className="flex items-center gap-1 text-2xs font-semibold tabular-nums text-slate-600 dark:text-gray-300">
            {r.iv.at.slice(11, 16)}
            <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-ink-muted">{MODE_ICON[r.iv.mode]}</span>
          </span>
          <span className="block text-xs font-bold text-slate-800 dark:text-white truncate">{r.name}</span>
          <span className="block text-2xs text-ink-muted truncate">{r.iv.round}</span>
        </>
      )}
    </button>
  );

  const navBtn = 'size-8 grid place-items-center rounded-lg text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10';

  return (
    <section className="bg-white dark:bg-dark-surface rounded-2xl border border-line dark:border-white/10 overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-hairline dark:border-dark-raised">
        <button onClick={() => onCursor(today)} className="px-3 h-8 rounded-lg border border-gray-200 dark:border-white/15 text-xs font-bold text-slate-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
          {t('myInterviews.today')}
        </button>
        <button onClick={() => step(-1)} aria-label={t('myInterviews.prev')} className={navBtn}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <button onClick={() => step(1)} aria-label={t('myInterviews.next')} className={navBtn}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
        <h2 className="ty-section text-sm font-bold text-slate-800 dark:text-white capitalize" aria-live="polite">
          {label}
        </h2>
        <div className="ml-auto">
          <ViewSwitch view={mode} onChange={onMode} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-hairline dark:border-dark-raised">
            {weekdays.map((w, i) =>
              mode === 'week' ? (
                <div key={w} className="px-2 py-2 text-center">
                  <div className="text-2xs uppercase tracking-wide text-ink-muted">{w}</div>
                  <div
                    className={`mx-auto mt-0.5 size-7 grid place-items-center rounded-full text-sm font-bold tabular-nums ${dayKey(days[i]) === today ? 'bg-primary text-white' : 'text-slate-800 dark:text-white'}`}
                  >
                    {days[i].getDate()}
                  </div>
                </div>
              ) : (
                <div key={w} className="px-2 py-2 text-center text-2xs uppercase tracking-wide text-ink-muted">{w}</div>
              ),
            )}
          </div>

          {mode === 'week' ? (
            <div className="grid grid-cols-7 divide-x divide-hairline dark:divide-dark-raised min-h-[360px]">
              {days.map((d) => {
                const list = byDay.get(dayKey(d)) ?? [];
                return (
                  <div key={dayKey(d)} data-testid={`cal-day-${dayKey(d)}`} className={`p-1.5 space-y-1.5 ${dayKey(d) === today ? 'bg-primary/[0.03]' : ''}`}>
                    {list.map((r) => card(r, false))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 [&>*]:border-hairline dark:[&>*]:border-dark-raised">
              {days.map((d, i) => {
                const k = dayKey(d);
                const list = byDay.get(k) ?? [];
                const out = d.getMonth() !== base.getMonth();
                const more = list.length - 3;
                return (
                  <div
                    key={k}
                    data-testid={`cal-day-${k}`}
                    className={`min-h-[104px] p-1 space-y-0.5 border-b ${i % 7 ? 'border-l' : ''} ${out ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''}`}
                  >
                    <div
                      className={`ml-auto size-6 grid place-items-center rounded-full text-xs tabular-nums ${k === today ? 'bg-primary text-white font-bold' : out ? 'text-gray-300 dark:text-gray-600' : 'text-slate-700 dark:text-gray-300'}`}
                    >
                      {d.getDate()}
                    </div>
                    {list.slice(0, 3).map((r) => card(r, true))}
                    {more > 0 && (
                      <button
                        onClick={() => onMode('week', k)}
                        className="px-1.5 text-2xs font-bold text-ink-muted hover:text-primary"
                      >
                        {t('myInterviews.more', { n: more })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 flex flex-wrap gap-4 border-t border-hairline dark:border-dark-raised text-2xs text-ink-muted">
        {(['violet', 'amber', 'green'] as const).map((tone) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${DOT[tone]}`} />
            {t(tone === 'violet' ? 'interview.status.scheduled' : tone === 'amber' ? 'myInterviews.needsScore' : 'myInterviews.scored')}
          </span>
        ))}
      </div>
    </section>
  );
}

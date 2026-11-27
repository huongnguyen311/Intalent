import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/*
 * The app's one stat-card look (Users, Dashboard, Talent pool overview, Campaign detail, Usage):
 * white 12px card, hairline border, soft shadow, one per-page `accent`; a tinted icon tile beside the label,
 * the figure, an optional thin bar and a muted hint. Fixture (mockup) pages keep their own cards.
 */
export type StatTone = 'primary' | 'blue' | 'violet' | 'emerald' | 'amber' | 'red' | 'slate';

const TONE: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-gray-300',
};

/** Bar colour per tone (used when a single-value bar is given as `bar`). */
export const STAT_BAR: Record<StatTone, string> = {
  primary: 'bg-primary', blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500',
  amber: 'bg-amber-400', red: 'bg-red-500', slate: 'bg-slate-400',
};

export const STAT_GRID = 'grid gap-3';

/** Solid icon tile for the `solid` accent. */
const SOLID: Record<StatTone, string> = {
  primary: 'bg-primary text-white', blue: 'bg-blue-500 text-white', violet: 'bg-violet-500 text-white', emerald: 'bg-emerald-500 text-white',
  amber: 'bg-amber-500 text-white', red: 'bg-red-500 text-white', slate: 'bg-slate-600 text-white',
};

/**
 * Each page picks one accent so its cards read as its own while sharing the frame:
 * - `top`: thin tone strip along the top edge (Dashboard);
 * - `left`: tone strip down the left edge (Campaign detail);
 * - `solid`: solid icon tile (Users);
 * - `watermark`: a large faint icon in the bottom-right corner (Talent pool overview, Usage).
 */
export type StatAccent = 'none' | 'top' | 'left' | 'solid' | 'watermark';

const SHELL =
  'relative block overflow-hidden rounded-xl border border-line bg-white px-4 pt-3 pb-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_-4px_rgba(16,24,40,0.08)] transition-shadow dark:border-dark-raised dark:bg-dark-surface';

export type StatSegment = { value: number; className: string; title: string };

export function StatCard({ icon, tone = 'primary', accent = 'none', label, value, hint, bar, segments, href, testId, valueTestId, className = '' }: {
  icon?: string;
  tone?: StatTone;
  accent?: StatAccent;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Single-value bar, 0–100, in the tone's colour. */
  bar?: number;
  /** Stacked bar; segments are scaled to their sum. Takes precedence over `bar`. */
  segments?: StatSegment[];
  /** Makes the whole card a link. */
  href?: string;
  testId?: string;
  valueTestId?: string;
  className?: string;
}) {
  const sum = segments?.reduce((n, s) => n + s.value, 0) ?? 0;
  const body = (
    <div data-stat-card="" className="relative">
      <div className="flex items-center gap-2">
        {icon && (
          <span aria-hidden="true" className={`material-symbols-outlined grid size-7 shrink-0 place-items-center rounded-lg text-[16px] ${accent === 'solid' ? `${SOLID[tone]} shadow-sm` : TONE[tone]}`}>{icon}</span>
        )}
        {/* Two lines tall so figures line up across a row even when one label wraps. */}
        <p className="flex min-h-7 min-w-0 items-center text-xs font-semibold leading-[14px] text-ink-muted dark:text-gray-400"><span className="line-clamp-2">{label}</span></p>
      </div>
      <span data-testid={valueTestId} className="ty-kpi mt-2 block text-2xl font-bold leading-7 tabular-nums text-gray-900 dark:text-white">{value}</span>
      {(segments || bar !== undefined) && (
        <div className="mt-1.5 flex h-1 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          {segments
            ? sum > 0 && segments.filter((s) => s.value > 0).map((s) => (
              <div key={s.title} title={`${s.title}: ${s.value}`} className={`h-full ${s.className}`} style={{ width: `${(s.value / sum) * 100}%` }} />
            ))
            : <div className={`h-full rounded-full ${STAT_BAR[tone]}`} style={{ width: `${Math.max(0, Math.min(100, bar ?? 0))}%` }} />}
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-ink-muted dark:text-gray-400">{hint}</p>}
    </div>
  );
  const deco = (
    <>
      {accent === 'top' && <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${STAT_BAR[tone]}`} />}
      {accent === 'left' && <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${STAT_BAR[tone]}`} />}
      {accent === 'watermark' && icon && (
        <span aria-hidden="true" className={`material-symbols-outlined pointer-events-none absolute -bottom-3 right-1 !text-[72px] leading-none opacity-[0.07] dark:opacity-[0.12] ${TONE[tone].split(' ').filter((c) => c.startsWith('text-') || c.startsWith('dark:text-')).join(' ')}`}>{icon}</span>
      )}
    </>
  );
  return href ? (
    <Link to={href} data-testid={testId} className={`${SHELL} group hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${className}`}>{deco}{body}</Link>
  ) : (
    <div data-testid={testId} className={`${SHELL} ${className}`}>{deco}{body}</div>
  );
}

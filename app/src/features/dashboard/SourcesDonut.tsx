import { useState } from 'react';
import type { DashboardMetrics } from '../../domain/metrics';
import { useT } from '../../i18n/i18n';
import { Donut } from './charts';

/*
 * Categorical palette: brand orange for the biggest source, then hues far apart on the wheel
 * (blue, teal, amber, violet) so neighbouring slices never look alike. All mid-tone, so they hold
 * on white and on the dark surface; the legend names every slice, so colour is never the only cue.
 */
const SHADES = ['#ef5125', '#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6'];

/**
 * Top sources as a donut: share of the period's CVs by source, the total in the middle.
 * Hovering a slice or a legend row puts that source's numbers in the middle instead.
 * The legend carries the exact counts, the share and the hires, so nothing depends on reading angles.
 */
export function SourcesDonut({ sources }: { sources: DashboardMetrics['recruitment']['topSources'] }) {
  const t = useT();
  const [hover, setHover] = useState<string>();
  const total = sources.reduce((n, s) => n + s.count, 0);
  const slices = sources.map((s, i) => ({ name: s.source, value: s.count, color: SHADES[i % SHADES.length] }));
  const active = sources.find((s) => s.source === hover);
  const share = (n: number) => (total ? Math.round((100 * n) / total) : 0);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-40 text-white dark:text-[#1e1e1e]">
        <Donut data={slices} onHover={setHover} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
          <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{active ? `${share(active.count)}%` : total}</span>
          <span className="max-w-24 truncate text-xs text-muted">{active ? active.source : t('dashboard.sourceApps')}</span>
        </div>
      </div>

      <ul className="w-full space-y-1">
        {sources.map((s, i) => (
          <li
            key={s.source}
            onMouseEnter={() => setHover(s.source)}
            onMouseLeave={() => setHover(undefined)}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${hover === s.source ? 'bg-slate-50 dark:bg-white/5' : ''}`}
            title={`${s.source}: ${s.count} ${t('dashboard.sourceApps')}, ${s.hires} ${t('dashboard.sourceHires')}`}
          >
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: SHADES[i % SHADES.length] }} />
            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-gray-200">{s.source}</span>
            <span className="w-8 text-right text-xs tabular-nums text-muted">{share(s.count)}%</span>
            <span className="w-7 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{s.count}</span>
            {/* Hires: the outcome per source, kept from the old bar view. */}
            <span className={`w-14 text-right text-xs tabular-nums ${s.hires ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-muted'}`}>
              {s.hires} {t('dashboard.sourceHires').toLowerCase()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { dashboardMetrics } from '../../domain/metrics';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { SeniorityBars } from '../dashboard/charts';
import { seniorityRows } from '../dashboard/DashboardPage';

const KEY = 'intalent.poolInsights.open';
const CARD = 'rounded-xl border border-[#e6dddb] dark:border-[#2a2423] bg-white dark:bg-[#1e1e1e] p-4 min-w-0';
const TITLE = 'text-xs font-bold text-[#896a61] uppercase tracking-wider mb-3';

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** A ranked list of bars: name, bar scaled to the top value, figure. */
function Ranked({ rows, unit = '' }: { rows: { name: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-2">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[88px_1fr_40px] items-center gap-2 text-xs font-semibold">
          <span className="truncate text-slate-700 dark:text-gray-200" title={r.name}>{r.name}</span>
          <span className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10">
            <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${(100 * r.value) / max}%` }} />
          </span>
          <span className="text-right tabular-nums text-gray-500">{unit === '%' ? r.value.toFixed(0) : r.value}{unit}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Talent-pool overview (moved off the Dashboard, which is now recruitment only): whole-pool data quality,
 * tech stacks, seniority, domains and who brings CVs in. Collapsed by default so the table keeps its room.
 */
export function PoolInsights() {
  const t = useT();
  const [open, setOpen] = useState(readOpen);
  const data = useStore(useShallow((s) => ({ candidates: s.candidates, applications: s.applications, jobs: s.jobs, users: s.users, meta: s.meta })));
  const m = useMemo(() => dashboardMetrics(data as Parameters<typeof dashboardMetrics>[0], 'all', new Date()), [data]);
  const parsedPct = m.parsingSuccess.total ? Math.round((100 * m.parsingSuccess.ok) / m.parsingSuccess.total) : 0;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* private mode: the panel just won't remember */
    }
  };

  return (
    <section data-testid="pool-insights" className="border-b border-[#e6dddb] dark:border-[#2a2423] bg-background-light dark:bg-background-dark">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/60 dark:hover:bg-white/5"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">insights</span>
        <span className="text-sm font-bold text-slate-800 dark:text-white">{t('pool.insights.title')}</span>
        <span className="flex-1 truncate text-xs text-[#896a61]">
          {t('pool.insights.summary', { total: m.total, missing: m.missingEmail, parsed: parsedPct })}
        </span>
        <span aria-hidden="true" className={`material-symbols-outlined text-[20px] text-[#896a61] transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 px-4 pb-4">
          <div className={CARD}>
            <p className={TITLE}>{t('pool.insights.stacks')}</p>
            <Ranked rows={m.topStacks.map((s) => ({ name: s.name, value: s.pct }))} unit="%" />
          </div>
          <div className={CARD}>
            <p className={TITLE}>{t('pool.insights.seniority')}</p>
            <div className="h-36">
              <SeniorityBars data={seniorityRows(m.seniority)} />
            </div>
          </div>
          <div className={CARD}>
            <p className={TITLE}>{t('pool.insights.domains')}</p>
            <Ranked rows={m.domains.map((d) => ({ name: d.name, value: d.pct }))} unit="%" />
          </div>
          <div className={CARD} data-testid="dashboard-top-contributors">
            <p className={TITLE} title={t('dash.ta.totalHint')}>{t('pool.insights.contributors')}</p>
            <Ranked rows={m.topTa.map((c) => ({ name: c.name, value: c.files }))} />
          </div>
        </div>
      )}
    </section>
  );
}

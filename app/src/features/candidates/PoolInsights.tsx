import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { AppLayout } from '../../components/AppLayout';
import { StatCard } from '../../components/StatCard';
import { dashboardMetrics, inPeriod, type Period } from '../../domain/metrics';
import { poolQuality, type Gap } from '../../domain/poolQuality';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { EnglishDonut, SeniorityBars, StackPie } from '../dashboard/charts';
import { seniorityRows } from '../dashboard/DashboardPage';
import { CAPTION, Panel, PeriodControl, TRACK } from '../dashboard/DashboardWidgets';

/** Brand primary and its tints: the overview stays in one hue, like the app Dashboard. */
const RAMP = ['#ef5125', '#f47c5a', '#f8a68e', '#fbc9ba', '#94a3b8', '#cbd5e1'];
const SECTION = 'ty-section text-lg font-bold text-slate-900 dark:text-white';
const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0);

/** A ranked list of bars: name, bar scaled to the top value, figure. */
function Ranked({ rows, unit = '' }: { rows: { name: string; value: number }[]; unit?: string }) {
  const t = useT();
  if (!rows.length) return <p className={CAPTION}>{t('pool.insights.empty')}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li key={r.name} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="truncate text-slate-700 dark:text-gray-200" title={r.name}>{r.name}</span>
            <span className="tabular-nums text-slate-900 dark:text-white">{unit === '%' ? Math.round(r.value) : r.value}{unit}</span>
          </div>
          <div className={TRACK}>
            <div className="h-2 rounded bg-primary" style={{ width: `${(100 * r.value) / max}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Legend row for a pie/donut: swatch, name, figure. */
function Legend({ rows }: { rows: { name: string; value: string; color: string }[] }) {
  return (
    <ul className="space-y-2 text-sm font-semibold">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-gray-200">
            <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
            <span className="truncate">{r.name}</span>
          </span>
          <span className="tabular-nums text-slate-500 dark:text-gray-400">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One CV-quality figure. Non-zero counts link to Candidate Pool filtered to exactly these
 * candidates (same gap, same period), so the number and the list always match.
 */
function GapRow({ gap, label, name = label, count, total, period }: { gap?: Gap; label: string; /** Full accessible name when `label` is shortened by the card title. */ name?: string; count: number; total: number; period: Period }) {
  const body = (
    <>
      <span className="truncate" title={name}>{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className="text-slate-900 dark:text-white font-bold">{count}</span>
        <span className="w-10 text-right text-xs text-muted dark:text-gray-400">{pct(count, total)}%</span>
        {gap && count > 0 && <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-primary">chevron_right</span>}
      </span>
    </>
  );
  const cls = 'group flex items-center justify-between gap-3 rounded-lg px-2 py-2 -mx-2 text-sm font-semibold text-slate-700 dark:text-gray-200';
  if (!gap || count === 0) return <li className={cls}>{body}</li>;
  const search = `?gap=${gap}${period === 'all' ? '' : `&since=${period}`}`;
  return (
    <li>
      <Link to={{ pathname: '/candidates', search }} aria-label={`${name}: ${count}`} className={`${cls} hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}>
        {body}
      </Link>
    </li>
  );
}

/**
 * Talent-pool overview (its own menu item above Candidate Pool; the Dashboard is recruitment only).
 * Answers two questions for TA leads and recruiters: what is in the pool, and how good the CVs are.
 * The period filter drives every figure, CV quality included.
 */
export function PoolInsightsPage() {
  const t = useT();
  const [period, setPeriod] = useState<Period>('all');
  const data = useStore(useShallow((s) => ({ candidates: s.candidates, applications: s.applications, jobs: s.jobs, users: s.users, meta: s.meta })));
  const now = useMemo(() => new Date(), []);
  const m = useMemo(() => dashboardMetrics(data as Parameters<typeof dashboardMetrics>[0], period, now), [data, period, now]);
  const q = useMemo(() => poolQuality(data.candidates.filter((c) => inPeriod(c, period, now)), now), [data.candidates, period, now]);

  const stacks = m.topStacks.map((s, i) => ({ name: s.name, value: s.pct, color: RAMP[i % RAMP.length] }));
  const english = Object.entries(m.english)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: RAMP[i % RAMP.length] }));
  const englishTotal = english.reduce((n, e) => n + e.value, 0);
  const field = (g: Gap & keyof typeof q.missing) => ({ g, label: t(`pool.insights.field.${g}` as TKey), name: t(`candidates.gap.${g}` as TKey), count: q.missing[g] });
  const fields = [field('email'), field('phone'), field('seniority'), field('english'), field('skills')];

  return (
    <AppLayout title={t('pool.insights.title')}>
      <section data-testid="pool-insights" className="h-full overflow-y-auto custom-scrollbar bg-background-light dark:bg-dark-canvas p-4 md:p-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={CAPTION}>{t('pool.insights.subtitle')}</p>
          <PeriodControl value={period} onChange={setPeriod} testId="pool-period" />
        </div>

        <div data-testid="pool-kpis" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard icon="groups" tone="primary" label={t('pool.insights.kpi.total')} value={String(m.total)} hint={t('pool.insights.kpi.totalHint', { n: q.missing.email })} />
          <StatCard icon="work_history" tone="blue" bar={pct(m.available, m.total)} label={t('pool.insights.kpi.open')} value={String(m.available)} hint={t('pool.insights.kpi.openHint', { pct: pct(m.available, m.total) })} />
          <StatCard
            icon="auto_awesome"
            tone="violet"
            bar={pct(m.parsingSuccess.ok, m.parsingSuccess.total)}
            label={t('pool.insights.kpi.parsed')}
            value={`${pct(m.parsingSuccess.ok, m.parsingSuccess.total)}%`}
            hint={t('pool.insights.kpi.parsedHint', { ok: m.parsingSuccess.ok, total: m.parsingSuccess.total })}
          />
          <StatCard icon="verified" tone="emerald" bar={pct(q.complete, q.total)} label={t('pool.insights.kpi.complete')} value={`${pct(q.complete, q.total)}%`} hint={<span title={t('pool.insights.kpi.completeFields')}>{t('pool.insights.kpi.completeHint', { n: q.complete, total: q.total })}</span>} />
        </div>

        <div data-testid="pool-composition" className="space-y-4">
          <h3 className={SECTION}>{t('pool.insights.composition')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Panel title={t('pool.insights.stacks')} caption={t('pool.insights.stacksCaption')}>
              {stacks.length ? (
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <div className="size-[140px]"><StackPie data={stacks} radius={68} /></div>
                  <Legend rows={stacks.map((s) => ({ ...s, value: `${Math.round(s.value)}%` }))} />
                </div>
              ) : (
                <p className={CAPTION}>{t('pool.insights.empty')}</p>
              )}
            </Panel>
            <Panel title={t('pool.insights.seniority')}>
              <div className="h-44"><SeniorityBars data={seniorityRows(m.seniority)} /></div>
            </Panel>
            <Panel title={t('pool.insights.english')} caption={t('pool.insights.englishCaption')}>
              {englishTotal ? (
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <div className="relative size-[140px]">
                    <EnglishDonut data={english} inner={52} outer={68} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{pct(english[0].value, englishTotal)}%</span>
                      <span className="text-2xs font-bold uppercase text-muted dark:text-gray-400">{english[0].name}</span>
                    </div>
                  </div>
                  <Legend rows={english.map((e) => ({ ...e, value: String(e.value) }))} />
                </div>
              ) : (
                <p className={CAPTION}>{t('pool.insights.empty')}</p>
              )}
            </Panel>
            <Panel title={t('pool.insights.domains')} caption={t('pool.insights.domainsCaption')}>
              <Ranked rows={m.domains.map((d) => ({ name: d.name, value: d.pct }))} unit="%" />
            </Panel>
            <Panel title={t('pool.insights.openStacks')} caption={t('pool.insights.openStacksCaption')}>
              <Ranked rows={m.availableStacks.map((s) => ({ name: s.name, value: s.count }))} />
            </Panel>
            <Panel title={t('pool.insights.contributors')} caption={t('pool.insights.contributorsCaption')} testId="dashboard-top-contributors">
              <Ranked rows={m.topTa.map((c) => ({ name: c.name, value: c.files }))} />
            </Panel>
          </div>
        </div>

        <div data-testid="pool-quality" className="space-y-4">
          <div>
            <h3 className={SECTION}>{t('pool.insights.quality')}</h3>
            <p className={CAPTION}>{t('pool.insights.qualityCaption', { total: q.total })}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Panel title={t('pool.insights.missingFields')} caption={t('pool.insights.missingFieldsCaption')}>
              <ul>{fields.map((f) => <GapRow key={f.g} gap={f.g} label={f.label} name={f.name} count={f.count} total={q.total} period={period} />)}</ul>
            </Panel>
            <Panel title={t('pool.insights.freshness')} caption={t('pool.insights.freshnessCaption')}>
              <ul>
                <GapRow label={t('pool.insights.fresh')} count={q.freshness.fresh} total={q.total} period={period} />
                <GapRow label={t('pool.insights.aging')} count={q.freshness.aging} total={q.total} period={period} />
                <GapRow gap="stale" label={t('pool.insights.stale')} name={t('candidates.gap.stale')} count={q.freshness.stale} total={q.total} period={period} />
              </ul>
            </Panel>
            <Panel title={t('pool.insights.parse')} caption={t('pool.insights.parseCaption')}>
              <ul><GapRow gap="parse" label={t('pool.insights.needsReview')} name={t('candidates.gap.parse')} count={q.parseReview} total={q.total} period={period} /></ul>
            </Panel>
            <Panel title={t('pool.insights.consent')} caption={t('pool.insights.consentCaption')}>
              <ul><GapRow gap="consent" label={t('pool.insights.noConsent')} name={t('candidates.gap.consent')} count={q.noConsent} total={q.total} period={period} /></ul>
            </Panel>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

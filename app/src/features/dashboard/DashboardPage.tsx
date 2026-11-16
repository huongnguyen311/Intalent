import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AppLayout } from '../../components/AppLayout';
import { stageLabel, STAGES } from '../../domain/stages';
import { dashboardMetrics, type DashboardMetrics, type Period } from '../../domain/metrics';
import { useShowNew } from '../../hooks';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { EnglishDonut, SeniorityBars, StackPie } from './charts';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: 'all', label: 'All' },
];

const STACK_COLORS = ['#3b82f6', '#8b5cf6', '#fbbf24', '#10b981', '#f97316', '#ef4444'];
const BAR_TONES = [
  { bar: 'bg-blue-500', icon: 'bg-blue-50 text-blue-500' },
  { bar: 'bg-purple-500', icon: 'bg-purple-50 text-purple-500' },
];
const CONTRIBUTOR_BARS = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500'];
const DOMAIN_BARS = ['bg-orange-500', 'bg-blue-500', 'bg-red-400', 'bg-slate-800', 'bg-purple-500'];
const ENGLISH_COLORS: Record<string, string> = { Advanced: '#ef5125', Intermediate: '#fca5a5' };
const ENGLISH_FALLBACK = '#fef3f2';

const SENIORITY_ORDER = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead', 'Prin.', 'Arch.'];
const SENIORITY_ABBR: Record<string, string> = { Middle: 'Mid', Principal: 'Prin.', Architect: 'Arch.' };

const CARD = 'bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm';
const LABEL = 'text-[10px] font-bold text-gray-400 uppercase tracking-widest';

function seniorityRows(seniority: Record<string, number>) {
  const merged: Record<string, number> = {};
  for (const [k, v] of Object.entries(seniority)) {
    const name = SENIORITY_ABBR[k] ?? k;
    merged[name] = (merged[name] ?? 0) + v;
  }
  const rank = (n: string) => (SENIORITY_ORDER.includes(n) ? SENIORITY_ORDER.indexOf(n) : SENIORITY_ORDER.length);
  return Object.entries(merged)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => rank(a.name) - rank(b.name));
}

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('all');
  const data = useStore(
    useShallow((s) => ({
      candidates: s.candidates,
      applications: s.applications,
      jobs: s.jobs,
      users: s.users,
      meta: s.meta,
    })),
  );
  const m = useMemo(
    // dashboardMetrics only reads these slices of DemoState.
    () => dashboardMetrics(data as Parameters<typeof dashboardMetrics>[0], period, new Date()),
    [data, period],
  );
  const showNew = useShowNew();

  const stacks = m.topStacks.map((s, i) => ({ name: s.name, value: s.pct, color: s.color ?? STACK_COLORS[i % STACK_COLORS.length] }));
  const english = Object.entries(m.english).map(([name, value]) => ({ name, value, color: ENGLISH_COLORS[name] ?? ENGLISH_FALLBACK }));
  const englishTotal = english.reduce((n, e) => n + e.value, 0);
  const topEnglish = english[0];
  const maxFiles = Math.max(1, ...m.topTa.map((t) => t.files));
  const parsingPct = m.parsingSuccess.total ? (m.parsingSuccess.ok / m.parsingSuccess.total) * 100 : 0;

  return (
    <AppLayout title="Dashboard">
      <div className="p-8 space-y-8 max-w-[1600px] mx-auto bg-[#f9fafb] min-h-full">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                aria-pressed={period === p.id}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  period === p.id ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`${CARD} flex flex-col justify-between h-40`}>
            <div className="flex justify-between items-start">
              <div className="size-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                <span className="material-symbols-outlined !text-[24px]">groups</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold">
                <span className="material-symbols-outlined !text-[14px]">check_circle</span> {m.active} active
              </div>
            </div>
            <div>
              <p className={LABEL}>Total Candidates</p>
              <h3 className="text-4xl font-bold text-slate-900">{m.total}</h3>
            </div>
          </div>
          <div className={`${CARD} flex flex-col justify-between h-40`}>
            <div className="flex justify-between items-start">
              <div className="size-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
                <span className="material-symbols-outlined !text-[24px]">auto_awesome</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">
                <span className="material-symbols-outlined !text-[14px]">trending_up</span> {m.parsingSuccess.ok}/{m.parsingSuccess.total}
              </div>
            </div>
            <div>
              <p className={LABEL}>Parsing Success</p>
              <h3 className="text-4xl font-bold text-slate-900">{parsingPct.toFixed(2)}%</h3>
            </div>
          </div>
          <div className={`${CARD} flex flex-col justify-between h-40`}>
            <div className="flex justify-between items-start">
              <div className="size-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                <span className="material-symbols-outlined !text-[24px]">mail_off</span>
              </div>
            </div>
            <div>
              <p className={LABEL}>Missing Email</p>
              <h3 className="text-4xl font-bold text-slate-900">{m.missingEmail}</h3>
            </div>
          </div>
        </div>

        {showNew && <RecruitmentRow metrics={m.recruitment} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-2 ${CARD}`}>
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900">Top Tech Stacks</h3>
              <p className="text-xs text-gray-400 font-bold">Skills distribution (Showing &gt;10%)</p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-around gap-8">
              <div className="size-64">
                <StackPie data={stacks} />
              </div>
              <div className="flex-1 space-y-4 w-full max-w-xs">
                {stacks.map((s) => (
                  <div key={s.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="size-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                      <span className="text-sm font-bold text-slate-700">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400">{s.value.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={CARD}>
            <h3 className="text-xl font-bold text-slate-900 mb-8">Seniority Distribution</h3>
            <div className="h-64 relative">
              <div className="absolute inset-0 bg-gray-50/50 rounded-3xl -z-0"></div>
              <SeniorityBars data={seniorityRows(m.seniority)} />
            </div>
          </div>
        </div>

        <div data-testid="dashboard-top-contributors" className={CARD}>
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-bold text-slate-900">Top TA contributors</h3>
            <span className={LABEL} title="Tổng file trong kỳ: upload + nhận chuyển giao − chuyển đi">Tổng file trong kỳ</span>
          </div>
          <div className="space-y-4">
            {m.topTa.map((t, i) => (
              <div key={t.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{t.name}</span>
                  <span className="text-sm font-bold " title={t.newCv === undefined ? undefined : `${t.newCv} CV mới trong kỳ`}>{t.files}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${CONTRIBUTOR_BARS[i % CONTRIBUTOR_BARS.length]}`} style={{ width: `${(t.files / maxFiles) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={CARD}>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-slate-900 max-w-[120px]">Available Candidates</h3>
              <div className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold text-center">
                {m.active}
                <br />
                Active
              </div>
            </div>
            <p className={`${LABEL} mb-6`}>Top Available Tech Stacks</p>
            <div className="space-y-8">
              {m.availableStacks.map((s, i) => {
                const tone = BAR_TONES[i % BAR_TONES.length];
                return (
                  <div key={s.name} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-lg flex items-center justify-center ${tone.icon}`}>
                          <span className="material-symbols-outlined !text-[18px]">code</span>
                        </div>
                        <span className="text-sm font-bold text-slate-800">{s.name}</span>
                      </div>
                      <span className="text-sm font-bold">{s.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${tone.bar}`} style={{ width: `${s.pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${CARD} flex flex-col h-full`}>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900">English Level</h3>
              <p className="text-xs text-gray-400 font-bold">Candidate self-assessment</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
              <div className="relative size-48">
                <EnglishDonut data={english} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-slate-900 leading-none">
                    {englishTotal ? Math.round((topEnglish.value / englishTotal) * 100) : 0}%
                  </span>
                  <span className={`${LABEL} mt-1`}>{topEnglish?.name}</span>
                </div>
              </div>
              <div className="w-full space-y-4 px-2">
                {english.map((e) => (
                  <div key={e.name} className="flex items-center justify-between group cursor-default">
                    <div className="flex items-center gap-3">
                      <div className="size-3.5 rounded-sm" style={{ backgroundColor: e.color }}></div>
                      <span className="text-sm font-bold text-slate-700">{e.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400 group-hover:text-slate-900 transition-colors">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={CARD}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Top Domains</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-8">Industry specializations</p>
            <div className="space-y-6">
              {m.domains.map((d, i) => (
                <div key={`${d.name}-${i}`} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-gray-500">{d.name}</span>
                    <span className="text-slate-900 font-bold">{d.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${DOMAIN_BARS[i % DOMAIN_BARS.length]}`} style={{ width: `${d.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/** New (non-mockup) row: recruitment pipeline health. Hidden in fixture mode via useShowNew. */
function RecruitmentRow({ metrics }: { metrics: DashboardMetrics['recruitment'] }) {
  const t = useT();
  const [lang] = useLang();
  const totalApps = STAGES.reduce((n, s) => n + metrics.byStage[s], 0);
  return (
    <div data-testid="dashboard-recruitment" className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className={CARD}>
        <p className={LABEL}>{t('dashboard.openJobs')}</p>
        <h3 className="text-4xl font-bold text-slate-900">{metrics.openJobs}</h3>
      </div>
      <div className={CARD}>
        <p className={`${LABEL} mb-4`}>{t('dashboard.byStage')}</p>
        {totalApps === 0 ? (
          <p className="text-xs text-gray-400 font-bold">{t('dashboard.noApplications')}</p>
        ) : (
          <div className="space-y-2">
            {STAGES.map((s) => (
              <div key={s} className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-500">{stageLabel(s, lang)}</span>
                <span className="text-slate-900">{metrics.byStage[s]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={CARD}>
        <p className={LABEL}>{t('dashboard.hires')}</p>
        <h3 className="text-4xl font-bold text-slate-900">{metrics.hires}</h3>
      </div>
      <div className={CARD}>
        <p className={`${LABEL} mb-4`}>{t('dashboard.topSources')}</p>
        <div className="space-y-2">
          {metrics.topSources.map((s) => (
            <div key={s.source} className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-500">{s.source}</span>
              <span className="text-slate-900">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

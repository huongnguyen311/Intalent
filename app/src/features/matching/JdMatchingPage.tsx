import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { MenuItem, Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import { jdRequirements } from '../../domain/jdExtract';
import { estimateYears, scoreCandidate, WEIGHTS, type Requirements } from '../../domain/scoring';
import type { MatchRow } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { MatchPager, MatchRowItem } from './MatchList';

const PAGE_SIZE = 8;
const BTN =
  'flex items-center gap-2 px-3 py-2 bg-white border border-[#e6dddb] rounded-lg text-sm font-medium text-[#181211] hover:border-primary/50 transition-colors whitespace-nowrap';
const CARD = 'bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm';
const LABEL = 'text-[10px] font-bold text-gray-400 uppercase tracking-widest';
const THRESHOLDS = [80, 60, 40, 0];

function Stat({ icon, tone, label, value, sub }: { icon: string; tone: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-3">
        <div className={`size-12 rounded-2xl flex items-center justify-center ${tone}`}>
          <span className="material-symbols-outlined !text-[24px]">{icon}</span>
        </div>
        <div>
          <p className={LABEL}>{label}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
          {sub && <p className="text-xs text-[#896a61]">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Weight({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span className="text-slate-700 font-medium">{label}</span><span className="font-bold">{pct}%</span></div>
      <div className="jm-bar"><div className="bg-primary" style={{ width: `${pct}%` }}></div></div>
    </div>
  );
}

function csv(rows: MatchRow[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    ['Rank', 'Name', 'Title', 'Score', 'Matched', 'Missing', 'Reason'].map(cell).join(','),
    ...rows.map((r, i) => [i + 1, r.name, r.title, r.score, r.have.join('; '), r.miss.join('; '), r.reason].map(cell).join(',')),
  ].join('\n');
}

function asRows(candidates: ReturnType<typeof useStore.getState>['candidates'], req: Requirements): MatchRow[] {
  return candidates
    .map((c) => {
      const r = scoreCandidate(c, req);
      return {
        candidateId: c.id, name: c.name, title: c.title, score: r.score, seniority: c.seniority, years: estimateYears(c),
        english: c.english || '—', have: r.have, miss: r.miss, reason: r.reason,
      };
    })
    .sort((a, b) => b.score - a.score);
}

const clock = (d: Date) => ({
  time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
});

export function JdMatchingPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jds = useStore((s) => s.jds);
  const candidates = useStore((s) => s.candidates);
  const taxonomy = useStore((s) => s.taxonomy);
  const fixture = useStore((s) => s.meta?.matching);

  const [jdId, setJdId] = useState(() => params.get('jd') ?? fixture?.jdId ?? (jds.find((j) => j.status === 'Published') ?? jds[0])?.id);
  const [min, setMin] = useState(60);
  const [page, setPage] = useState(1);
  const [runAt, setRunAt] = useState(() => new Date());
  const search = isFixtureMode() ? '?fixture=mockup' : '';

  const jd = jds.find((j) => j.id === jdId);
  const req = useMemo(() => (jd ? jdRequirements(jd, taxonomy) : { stack: [] }), [jd, taxonomy]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runAt re-runs the (deterministic) scoring on demand
  const all = useMemo(() => fixture?.rows ?? (jd ? asRows(candidates, req) : []), [fixture, jd, candidates, req, runAt]);

  const strong = fixture?.strong ?? all.filter((r) => r.score >= 80).length;
  const partial = fixture?.partial ?? all.filter((r) => r.score >= 60 && r.score < 80).length;
  const scanned = fixture?.scanned ?? candidates.length;
  const shown = all.filter((r) => r.score >= min);
  const total = fixture ? strong + partial : shown.length;
  const last = fixture?.lastRun ?? clock(runAt);
  const rows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const english = fixture?.english ?? (req.english ? `${req.english}+` : t('matching.englishAny'));

  const rerun = () => {
    setRunAt(new Date());
    setPage(1);
    toast(t('matching.reran'));
  };
  const exportCsv = () => {
    if (typeof URL.createObjectURL === 'function') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv(shown)], { type: 'text/csv' }));
      a.download = `jd-matching-${jd?.code ?? 'export'}.csv`;
      a.click();
    }
    toast(t('matching.exported'));
  };

  return (
    <AppLayout title={t('nav.jdMatching')} subtitle={t('matching.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-6 min-h-full bg-[#f9fafb]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Stat icon="groups" tone="bg-blue-50 text-blue-600" label={t('matching.scanned')} value={scanned} />
          <Stat icon="verified" tone="bg-emerald-50 text-emerald-600" label={t('matching.strong')} value={strong} />
          <Stat icon="trending_up" tone="bg-amber-50 text-amber-600" label={t('matching.partial')} value={partial} />
          <Stat icon="auto_awesome" tone="bg-purple-50 text-purple-600" label={t('matching.lastRun')} value={last.time} sub={last.date} />
        </div>

        <div className="jm-grid">
          <div className="jm-sticky space-y-6">
            <div className={`${CARD} space-y-5`}>
              <div className="flex items-center justify-between">
                <p className={LABEL}>{t('matching.jd')}</p>
                {jd && <Link to={{ pathname: `/jds/${jd.id}`, search }} className="text-xs font-bold text-primary hover:underline">{t('matching.viewJd')}</Link>}
              </div>
              <Popover
                trigger={({ toggle }) => (
                  <button onClick={toggle} className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white border border-[#e6dddb] rounded-xl text-left hover:border-primary/50 transition-colors">
                    <div>
                      <div className="font-bold text-[#181211]">{jd?.title ?? t('matching.noJds')}</div>
                      {jd && <div className="text-xs text-[#896a61]">{t('jds.id', { code: jd.code })} · {t(jd.status === 'Published' ? 'jds.status.published' : 'jds.status.draft')}</div>}
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-[#896a61]">expand_more</span>
                  </button>
                )}
              >
                {(close) => jds.map((j) => (
                  <MenuItem key={j.id} active={j.id === jdId} onClick={() => { setJdId(j.id); setPage(1); close(); }}>{j.title}</MenuItem>
                ))}
              </Popover>
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#896a61] uppercase tracking-wide">{t('matching.w.stack')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {req.stack.map((s) => <span key={s} className="px-2 py-0.5 text-xs font-bold bg-orange-50 text-orange-600 rounded border border-orange-100">{s}</span>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className={LABEL}>{t('jd.seniority')}</p><p className="text-sm font-bold text-slate-900">{req.seniority ?? '—'}</p></div>
                <div><p className={LABEL}>{t('jd.experience')}</p><p className="text-sm font-bold text-slate-900">{req.years ? t('jd.yrs', { n: req.years }) : '—'}</p></div>
                <div><p className={LABEL}>{t('jd.domain')}</p><p className="text-sm font-bold text-slate-900">{req.domains?.join(', ') || '—'}</p></div>
                <div><p className={LABEL}>{t('jd.english')}</p><p className="text-sm font-bold text-slate-900">{english}</p></div>
              </div>
              <hr className="border-[#e6dddb]" />
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#896a61] uppercase tracking-wide">{t('matching.weights')}</p>
                <Weight label={t('matching.w.stack')} pct={WEIGHTS.stack} />
                <Weight label={t('matching.w.exp')} pct={WEIGHTS.experience} />
                <Weight label={t('matching.w.domain')} pct={WEIGHTS.domain} />
                <Weight label={t('matching.w.english')} pct={WEIGHTS.english} />
              </div>
              <button onClick={rerun} className="w-full h-11 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 text-sm">
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span> {t('matching.rerun')}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between gap-4 border-b border-[#f4f1f0]">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t('matching.ranked')}</h3>
                <p className="text-xs text-[#896a61]">{t('matching.top', { n: total, total: scanned })}</p>
              </div>
              <div className="flex items-center gap-2">
                <Popover
                  align="right"
                  trigger={({ toggle }) => (
                    <button onClick={toggle} className={BTN}>
                      <span className="material-symbols-outlined text-[18px] text-[#896a61]">filter_list</span>
                      <span>{min ? t('matching.score', { n: min }) : t('matching.scoreAll')}</span>
                      <span className="material-symbols-outlined text-[18px] text-[#896a61]">expand_more</span>
                    </button>
                  )}
                >
                  {(close) => THRESHOLDS.map((n) => (
                    <MenuItem key={n} active={n === min} onClick={() => { setMin(n); setPage(1); close(); }}>
                      {n ? t('matching.score', { n }) : t('matching.scoreAll')}
                    </MenuItem>
                  ))}
                </Popover>
                <button onClick={exportCsv} className={BTN}>
                  <span className="material-symbols-outlined text-[18px] text-[#896a61]">download</span>
                  <span>{t('matching.export')}</span>
                </button>
              </div>
            </div>
            <div className="divide-y divide-[#f4f1f0]">
              {rows.map((r, i) => (
                <MatchRowItem key={`${r.candidateId}-${i}`} row={r} rank={(page - 1) * PAGE_SIZE + i + 1} onOpen={() => navigate({ pathname: `/candidates/${r.candidateId}`, search })} />
              ))}
              {rows.length === 0 && <div className="px-6 py-10 text-center text-sm text-[#896a61]">{t(jd || fixture ? 'matching.empty' : 'matching.noJds')}</div>}
            </div>
            <MatchPager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

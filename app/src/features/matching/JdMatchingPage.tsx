import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/BackButton';
import { MenuItem, Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import { jdRequirements } from '../../domain/jdExtract';
import { estimateYears, scoreCandidate, type Requirements } from '../../domain/scoring';
import type { Candidate, MatchRow } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { MatchCard, MatchPager } from './MatchList';
import { AddToPipelineModal } from '../candidates/AddToPipelineModal';
import { useShowNew } from '../../hooks';

const PAGE_SIZE = 8;
const DEFAULT_MIN = 70;
/** How long the simulated AI run shows its "analyzing" state. */
export const ANALYZE_MS = 900;
const LOWER_STEPS = [60, 50, 40, 0];
const LABEL = 'text-xs font-bold text-[#6b5550] dark:text-gray-400 uppercase tracking-wider';
const FIELD = 'w-full h-12 px-4 rounded-xl border border-[#e6dddb] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#181211] dark:text-gray-100';

function csv(rows: MatchRow[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    ['Rank', 'Name', 'Title', 'Score', 'Years', 'Location', 'Rate (USD/mo)', 'Matched', 'Missing', 'Reason'].map(cell).join(','),
    ...rows.map((r, i) =>
      [i + 1, r.name, r.title, r.score, r.years, r.location ?? '', r.rate ?? '', r.have.join('; '), r.miss.join('; '), r.reason].map(cell).join(','),
    ),
  ].join('\n');
}

function asRows(candidates: Candidate[], req: Requirements, maxRate: number | undefined): MatchRow[] {
  return candidates
    // Candidates without a stated rate stay in: "Contact for rate" is not a reason to drop them.
    .filter((c) => !maxRate || !c.expectedRate || c.expectedRate <= maxRate)
    .map((c) => {
      const r = scoreCandidate(c, req);
      return {
        candidateId: c.id, name: c.name, title: c.title, score: r.score, seniority: c.seniority, years: estimateYears(c),
        english: c.english || '—', have: r.have, miss: r.miss, reason: r.reason,
        location: c.location, rate: c.expectedRate, breakdown: r.breakdown,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Multi-select of skills: chips in the trigger, a searchable checklist in the panel. */
function SkillPicker({ value, options, onChange }: { value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const picked = new Set(value.map((s) => s.toLowerCase()));
  const shown = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (s: string) => onChange(picked.has(s.toLowerCase()) ? value.filter((v) => v.toLowerCase() !== s.toLowerCase()) : [...value, s]);
  return (
    <Popover
      trigger={({ toggle: open, open: isOpen }) => (
        <button type="button" onClick={open} aria-expanded={isOpen} aria-label={t('matching.f.skills')} className={`${FIELD} flex items-center justify-between gap-2 text-left hover:border-primary/50`}>
          <span className="flex-1 min-w-0 truncate">
            {value.length ? (
              <span className="flex gap-1 overflow-hidden">
                {value.slice(0, 3).map((s) => <span key={s} className="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-500/10 text-primary text-xs font-bold whitespace-nowrap">{s}</span>)}
                {value.length > 3 && <span className="px-1 text-xs font-bold text-[#896a61] whitespace-nowrap">+{value.length - 3}</span>}
              </span>
            ) : (
              <span className="text-[#896a61]">{t('matching.f.selectSkills')}</span>
            )}
          </span>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-[#896a61]">expand_more</span>
        </button>
      )}
    >
      {() => (
        <div className="w-72">
          <div className="px-2 pb-1">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('matching.f.searchSkills')}
              aria-label={t('matching.f.searchSkills')}
              className="w-full h-9 px-3 rounded-lg border border-[#e6dddb] dark:border-white/15 bg-white dark:bg-white/5 text-sm"
            />
          </div>
          {shown.map((s) => (
            <label key={s} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
              <input type="checkbox" checked={picked.has(s.toLowerCase())} onChange={() => toggle(s)} className="accent-[var(--color-primary,#ea580c)]" />
              {s}
            </label>
          ))}
          {shown.length === 0 && <p className="px-3 py-2 text-sm text-[#896a61]">{t('matching.f.noSkills')}</p>}
        </div>
      )}
    </Popover>
  );
}

export function JdMatchingPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const jds = useStore((s) => s.jds);
  const candidates = useStore((s) => s.candidates);
  const taxonomy = useStore((s) => s.taxonomy);
  const fixture = useStore((s) => s.meta?.matching);
  const showNew = useShowNew();
  const search = isFixtureMode() ? '?fixture=mockup' : '';

  // Applied filters live in the URL so Back from a profile returns to the same list.
  const jdId = params.get('jd') ?? fixture?.jdId ?? (jds.find((j) => j.status === 'Published') ?? jds[0])?.id;
  const jd = jds.find((j) => j.id === jdId);
  const base = useMemo(() => (jd ? jdRequirements(jd, taxonomy) : { stack: [] }), [jd, taxonomy]);
  const skillsParam = params.get('skills');
  const skills = useMemo(() => (skillsParam === null ? base.stack : skillsParam.split(',').filter(Boolean)), [skillsParam, base]);
  const maxRate = Number(params.get('rate')) || undefined;
  const min = Number(params.get('min') ?? DEFAULT_MIN);
  const page = Number(params.get('page') ?? 1);

  // Filter drafts: edited freely, used only on Apply.
  const [draftSkills, setDraftSkills] = useState(skills);
  const [draftRate, setDraftRate] = useState(maxRate ? String(maxRate) : '');
  const [draftMin, setDraftMin] = useState(min);
  useEffect(() => {
    setDraftSkills(skills);
    setDraftRate(maxRate ? String(maxRate) : '');
    setDraftMin(min);
  }, [skills, maxRate, min]);

  // Every run (opening the page, Apply, Reset, switching JD) shows the AI "analyzing" state first.
  const [run, setRun] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);
  useEffect(() => {
    setAnalyzing(true);
    const id = window.setTimeout(() => setAnalyzing(false), ANALYZE_MS);
    return () => window.clearTimeout(id);
  }, [run, jdId]);

  const [adding, setAdding] = useState<string | null>(null);

  const req = useMemo<Requirements>(() => {
    const keys = new Set(skills.map((s) => s.toLowerCase()));
    return { ...base, stack: skills, critical: base.critical?.filter((s) => keys.has(s.toLowerCase())) };
  }, [base, skills]);
  const all = useMemo(() => fixture?.rows ?? (jd ? asRows(candidates, req, maxRate) : []), [fixture, jd, candidates, req, maxRate]);
  const shown = all.filter((r) => r.score >= min);
  const rows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const lower = LOWER_STEPS.find((n) => n < min && all.some((r) => r.score >= n));

  const skillOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of [...base.stack, ...draftSkills, ...candidates.flatMap((c) => c.skills)]) {
      if (!seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
    }
    const jdKeys = new Set(base.stack.map((s) => s.toLowerCase()));
    // The JD's own skills first, then the rest alphabetically.
    return [...seen.values()].sort((a, b) => Number(jdKeys.has(b.toLowerCase())) - Number(jdKeys.has(a.toLowerCase())) || a.localeCompare(b));
  }, [base.stack, draftSkills, candidates]);

  const commit = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    setParams(q, { replace: true });
  };
  const apply = () => {
    commit({ skills: draftSkills.join(','), rate: draftRate ? String(Number(draftRate)) : null, min: String(draftMin), page: '1' });
    setRun((n) => n + 1);
  };
  const reset = () => {
    commit({ skills: null, rate: null, min: null, page: '1' });
    setRun((n) => n + 1);
  };
  const setJd = (id: string) => commit({ jd: id, skills: null, page: '1' });
  const exportCsv = () => {
    if (typeof URL.createObjectURL === 'function') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv(shown)], { type: 'text/csv' }));
      a.download = `jd-matching-${jd?.code ?? 'export'}.csv`;
      a.click();
    }
    toast(t('matching.exported'));
  };
  // Came from inside the app: go back there; opened directly: the JD it matched.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate(jd ? `/jds/${jd.id}${search}` : `/jds${search}`));

  const title = jd?.title;

  return (
    <AppLayout title="">
      <div className="p-8 max-w-[1400px] mx-auto space-y-6 min-h-full">
        <div className="flex items-start gap-4">
          <BackButton label={t('matching.back')} onClick={back} />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold tracking-tight text-[#181211] dark:text-white">{t('matching.title')}</h1>
              {jds.length > 1 && !fixture ? (
                <Popover
                  trigger={({ toggle, open }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      aria-label={t('matching.switchJd')}
                      title={t('matching.switchJd')}
                      className="flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-primary text-sm font-bold uppercase tracking-wide hover:border-primary/60"
                    >
                      {title ?? t('matching.noJds')}
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">expand_more</span>
                    </button>
                  )}
                >
                  {(close) => jds.map((j) => (
                    <MenuItem key={j.id} active={j.id === jdId} onClick={() => { setJd(j.id); close(); }}>{j.title}</MenuItem>
                  ))}
                </Popover>
              ) : (
                title && <span className="px-3 py-1 rounded-full border border-orange-200 bg-orange-50 text-primary text-sm font-bold uppercase tracking-wide">{title}</span>
              )}
            </div>
            <p className="text-[#896a61]">{t('matching.resultsSub')}</p>
          </div>
        </div>

        <section aria-label={t('matching.filters')} className="bg-white dark:bg-surface-dark rounded-[1.5rem] border border-gray-100 dark:border-white/10 shadow-sm p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className={LABEL}>{t('matching.f.skills')}</p>
              <SkillPicker value={draftSkills} options={skillOptions} onChange={setDraftSkills} />
            </div>
            <div className="space-y-2">
              <p className={LABEL}>{t('matching.f.constraints')}</p>
              <label className="relative block">
                <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#896a61]">$</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  inputMode="numeric"
                  value={draftRate}
                  onChange={(e) => setDraftRate(e.target.value)}
                  placeholder={t('matching.f.maxRate')}
                  aria-label={t('matching.f.maxRateAria')}
                  className={`${FIELD} pl-8 pr-24`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#896a61]">{t('matching.f.perMonth')}</span>
              </label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={LABEL} id="jm-min-label">{t('matching.f.minScore')}</p>
                <span className="text-sm font-bold text-primary">{draftMin}%</span>
              </div>
              <div className="h-12 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={draftMin}
                  onChange={(e) => setDraftMin(Number(e.target.value))}
                  aria-labelledby="jm-min-label"
                  className="w-full accent-[#ea580c]"
                />
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-[#f4f1f0] dark:border-white/10 flex items-center justify-end gap-3">
            <button type="button" onClick={reset} disabled={analyzing} className="px-4 h-11 text-sm font-medium text-[#6b5550] dark:text-gray-300 hover:text-primary disabled:opacity-50">
              {t('matching.reset')}
            </button>
            <button type="button" onClick={apply} disabled={analyzing} className="px-5 h-11 rounded-xl bg-[#181211] dark:bg-white text-white dark:text-[#181211] text-sm font-bold hover:bg-black disabled:bg-gray-500 disabled:text-white min-w-[140px]">
              {analyzing ? t('matching.analyzing') : t('matching.apply')}
            </button>
          </div>
        </section>

        {analyzing ? (
          <div role="status" className="bg-white dark:bg-surface-dark rounded-[1.5rem] border border-gray-100 dark:border-white/10 shadow-sm py-20 px-6 flex flex-col items-center text-center gap-4">
            <div className="relative size-20">
              <div className="absolute inset-0 rounded-full border-4 border-orange-100 dark:border-orange-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-r-primary animate-spin" />
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center material-symbols-outlined text-primary text-[30px]">auto_awesome</span>
            </div>
            <h2 className="text-xl font-bold text-[#181211] dark:text-white">{t('matching.analyzingTitle')}</h2>
            <p className="text-[#6b5550] dark:text-gray-400">{t('matching.analyzingSub')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {shown.length > 0 && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[#6b5550] dark:text-gray-400">{t('matching.found', { n: shown.length, min })}</p>
                <button type="button" onClick={exportCsv} className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[#e6dddb] dark:border-white/15 bg-white dark:bg-transparent text-sm font-medium hover:border-primary/50">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-[#896a61]">download</span>
                  {t('matching.export')}
                </button>
              </div>
            )}
            {rows.map((r, i) => (
              <MatchCard
                key={`${r.candidateId}-${i}`}
                row={r}
                onOpen={() => navigate({ pathname: `/candidates/${r.candidateId}`, search })}
                onAdd={showNew ? () => setAdding(r.candidateId) : undefined}
              />
            ))}
            {rows.length === 0 && (
              <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] border border-gray-100 dark:border-white/10 px-6 py-12 text-center text-sm text-[#896a61] space-y-3">
                <p>{t(jd || fixture ? 'matching.empty' : 'matching.noJds')}</p>
                {/* Not a dead end: offer the highest threshold that has results. */}
                {lower !== undefined && (
                  <button
                    type="button"
                    onClick={() => { commit({ min: String(lower), page: '1' }); setRun((n) => n + 1); }}
                    className="px-4 py-2 rounded-full border border-primary text-primary font-bold hover:bg-primary/5"
                  >
                    {lower ? t('matching.lower', { n: lower }) : t('matching.lowerAll')}
                  </button>
                )}
              </div>
            )}
            {shown.length > PAGE_SIZE && (
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/10">
                <MatchPager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={(n) => commit({ page: String(n) })} />
              </div>
            )}
          </div>
        )}
      </div>
      <AddToPipelineModal open={adding !== null} onClose={() => setAdding(null)} candidateIds={adding ? [adding] : []} />
    </AppLayout>
  );
}

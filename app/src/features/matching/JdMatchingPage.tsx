import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/BackButton';
import { Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import { jdRequirements } from '../../domain/jdExtract';
import { todayIso } from '../../domain/jobUrgency';
import {
  filterMatches, MATCH_SORTS, MATCH_WITHIN_DAYS, sortMatches,
  type MatchFilters, type MatchSort,
} from '../../domain/matchFilters';
import { estimateYears, scoreCandidate, type Requirements } from '../../domain/scoring';
import { isClosedOut } from '../../domain/stages';
import type { Application, Candidate, Job, MatchRow } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { MatchCard, MatchPager } from './MatchList';
import { MatchTable } from './MatchTable';
import { AddToPipelineModal } from '../candidates/AddToPipelineModal';
import { useShowNew } from '../../hooks';

const PAGE_SIZE = 8;
const DEFAULT_MIN = 70;
/** How long the simulated AI run shows its "analyzing" state. */
export const ANALYZE_MS = 900;
const LOWER_STEPS = [60, 50, 40, 0];
/** Filter bar control: a small pill that shows its current value; orange when it differs from the default. */
const PILL = 'w-full min-w-0 h-10 px-3 rounded-lg border text-sm flex items-center gap-1.5 whitespace-nowrap transition-colors';
const pillTone = (active: boolean) =>
  active
    ? 'border-primary/60 bg-orange-50 text-ink dark:bg-orange-500/10 dark:text-white'
    : 'border-line dark:border-white/15 bg-white dark:bg-white/5 text-ink dark:text-gray-100 hover:border-gray-400';
// Preflight is off, so native select/input styling (border, padding, font) is reset by hand.
const PILL_SELECT = 'border-0 py-0 pl-0 pr-6 m-0 bg-transparent text-sm font-semibold text-ink dark:text-gray-100 [font-family:inherit] focus:outline-none cursor-pointer';
const MIN_STEPS = [0, 50, 60, 70, 80, 90];

function csv(rows: MatchRow[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    [
      'Rank', 'Name', 'Title', 'Score', 'Seniority', 'Years', 'English', 'Location', 'Work mode', 'Rate (USD/mo)', 'Available from',
      'Open to work', 'Matched', 'Missing', 'Domains matched', 'In pipeline', 'Do not hire', 'Profile updated', 'Reason',
    ].map(cell).join(','),
    ...rows.map((r, i) =>
      [
        i + 1, r.name, r.title, r.score, r.seniority, r.years, r.english, r.location ?? '', (r.workModes ?? []).join('; '), r.rate ?? '',
        r.availableFrom ?? '', r.openToWork === undefined ? '' : r.openToWork ? 'Yes' : 'No', r.have.join('; '), r.miss.join('; '),
        (r.domainHave ?? []).join('; '), r.pipeline ? `${r.pipeline.jobTitle} (${r.pipeline.stage})` : '', r.doNotHire ?? '',
        r.updatedAt?.slice(0, 10) ?? '', r.reason,
      ].map(cell).join(','),
    ),
  ].join('\n');
}

/** Latest open application per candidate on a job built from this JD (rejected/withdrawn don't count). */
function pipelineOf(jdId: string | undefined, jobs: Job[], applications: Application[]): Map<string, MatchRow['pipeline']> {
  const jobsOfJd = new Map(jobs.filter((j) => j.jdId === jdId).map((j) => [j.id, j.title]));
  const out = new Map<string, NonNullable<MatchRow['pipeline']> & { at: string }>();
  for (const a of applications) {
    const jobTitle = jobsOfJd.get(a.jobId);
    if (!jobTitle || isClosedOut(a.stage)) continue;
    const prev = out.get(a.candidateId);
    if (!prev || a.addedAt > prev.at) out.set(a.candidateId, { jobTitle, stage: a.stage, at: a.addedAt });
  }
  return new Map([...out].map(([id, { jobTitle, stage }]) => [id, { jobTitle, stage }]));
}

function asRows(
  candidates: Candidate[], req: Requirements, maxRate: number | undefined, inPipeline: Map<string, MatchRow['pipeline']>,
): MatchRow[] {
  return candidates
    // Anonymized profiles (privacy request) are never ranked.
    .filter((c) => !c.anonymizedAt)
    // Candidates without a stated rate stay in: "Contact for rate" is not a reason to drop them.
    .filter((c) => !maxRate || !c.expectedRate || c.expectedRate <= maxRate)
    .map((c) => {
      const r = scoreCandidate(c, req);
      return {
        candidateId: c.id, name: c.name, title: c.title, score: r.score, seniority: c.seniority, years: estimateYears(c),
        english: c.english || '—', have: r.have, miss: r.miss, reason: r.reason,
        location: c.location, rate: c.expectedRate, availableFrom: c.availableFrom, breakdown: r.breakdown,
        critical: req.critical, domainHave: r.domainHave, domainMiss: r.domainMiss, openToWork: c.openToWork,
        workModes: c.workModes, willingToRelocate: c.willingToRelocate, updatedAt: c.updatedAt ?? c.createdAt,
        doNotHire: c.doNotHire?.reason, pipeline: inPipeline.get(c.id),
      };
    })
    .sort((a, b) => b.score - a.score);
}


/** Skills: the pill lists the first two; the panel is a searchable checklist applied in one go. */
function SkillPicker({ value, options, changed, onApply }: { value: string[]; options: string[]; changed: boolean; onApply: (v: string[]) => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState(value);
  const picked = new Set(draft.map((s) => s.toLowerCase()));
  const shown = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (s: string) => setDraft((d) => (picked.has(s.toLowerCase()) ? d.filter((v) => v.toLowerCase() !== s.toLowerCase()) : [...d, s]));
  return (
    <Popover
      trigger={({ toggle: open, open: isOpen }) => (
        <button
          type="button"
          onClick={() => { if (!isOpen) { setDraft(value); setQ(''); } open(); }}
          aria-expanded={isOpen}
          aria-label={t('matching.f.skills')}
          title={value.join(', ')}
          className={`${PILL} ${pillTone(changed)}`}
        >
          <span className="text-ink-muted">{t('matching.f.skillsShort')}</span>
          <span className="flex-1 min-w-0 text-left font-semibold truncate">
            {value.length ? value.slice(0, 2).join(', ') : t('matching.f.any')}
            {value.length > 2 && <span className="text-ink-muted font-medium"> +{value.length - 2}</span>}
          </span>
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted">expand_more</span>
        </button>
      )}
    >
      {(close) => (
        <div className="w-72">
          <div className="px-2 pb-1">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('matching.f.searchSkills')}
              aria-label={t('matching.f.searchSkills')}
              className="w-full h-9 px-3 rounded-lg border border-line dark:border-white/15 bg-white dark:bg-white/5 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {shown.map((s) => (
              <label key={s} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                <input type="checkbox" checked={picked.has(s.toLowerCase())} onChange={() => toggle(s)} className="accent-[var(--color-primary,#ea580c)]" />
                {s}
              </label>
            ))}
            {shown.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">{t('matching.f.noSkills')}</p>}
          </div>
          <div className="mt-1 px-3 pt-2 border-t border-hairline dark:border-white/10 flex items-center justify-between">
            <span className="text-xs text-ink-muted">{t('matching.selected', { n: draft.length })}</span>
            <button
              type="button"
              onClick={() => { onApply(draft); close(); }}
              className="px-3 h-8 rounded-lg bg-primary text-white text-sm font-bold hover:brightness-110"
            >
              {t('matching.f.applySkills')}
            </button>
          </div>
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
  const jobs = useStore((s) => s.jobs);
  const applications = useStore((s) => s.applications);
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
  const withinParam = params.get('within'), openParam = params.get('open'), locParam = params.get('loc');
  const extra = useMemo<MatchFilters>(() => ({
    withinDays: Number(withinParam) || undefined,
    openOnly: openParam === '1',
    location: locParam ?? undefined,
  }), [withinParam, openParam, locParam]);
  const sortParam = params.get('sort');
  const view = params.get('view') === 'table' ? 'table' : 'cards';
  const sort: MatchSort = (MATCH_SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as MatchSort) : 'score';

  // The rate box is typed into; it applies on Enter or when focus leaves it.
  const [rateDraft, setRateDraft] = useState(maxRate ? String(maxRate) : '');
  useEffect(() => setRateDraft(maxRate ? String(maxRate) : ''), [maxRate]);

  // Every run (opening the page, Apply, Reset, switching JD) shows the AI "analyzing" state first.
  const [run, setRun] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);
  useEffect(() => {
    setAnalyzing(true);
    const id = window.setTimeout(() => setAnalyzing(false), ANALYZE_MS);
    return () => window.clearTimeout(id);
  }, [run, jdId]);

  const [adding, setAdding] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [run, jdId]);

  const req = useMemo<Requirements>(() => {
    const keys = new Set(skills.map((s) => s.toLowerCase()));
    return { ...base, stack: skills, critical: base.critical?.filter((s) => keys.has(s.toLowerCase())) };
  }, [base, skills]);
  const inPipeline = useMemo(() => pipelineOf(jd?.id, jobs, applications), [jd, jobs, applications]);
  const all = useMemo(
    () => fixture?.rows ?? (jd ? filterMatches(asRows(candidates, req, maxRate, inPipeline), extra, todayIso()) : []),
    [fixture, jd, candidates, req, maxRate, inPipeline, extra],
  );
  const anonCount = useMemo(() => (fixture || !jd ? 0 : candidates.filter((c) => c.anonymizedAt).length), [fixture, jd, candidates]);
  const shown = useMemo(() => sortMatches(all.filter((r) => r.score >= min), sort), [all, min, sort]);
  const rows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const lower = LOWER_STEPS.find((n) => n < min && all.some((r) => r.score >= n));
  const toggleSelect = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const today = todayIso();
  const need = useMemo(() => ({ seniority: req.seniority, years: req.years, english: req.english }), [req]);
  // "Select all" covers this page's candidates that can still be added.
  const selectable = rows.filter((r) => !r.doNotHire && !r.pipeline).map((r) => r.candidateId);
  const pageSelected = selectable.filter((id) => selected.has(id)).length;
  const selectPage = (on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      for (const id of selectable) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });


  const skillOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of [...base.stack, ...skills, ...candidates.flatMap((c) => c.skills)]) {
      if (!seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
    }
    const jdKeys = new Set(base.stack.map((s) => s.toLowerCase()));
    // The JD's own skills first, then the rest alphabetically.
    return [...seen.values()].sort((a, b) => Number(jdKeys.has(b.toLowerCase())) - Number(jdKeys.has(a.toLowerCase())) || a.localeCompare(b));
  }, [base.stack, skills, candidates]);

  const commit = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    setParams(q, { replace: true });
  };
  // Every filter change applies at once and re-runs the match.
  const update = (next: Record<string, string | null>) => {
    commit({ ...next, page: '1' });
    setRun((n) => n + 1);
  };
  const reset = () => update({ skills: null, rate: null, min: null, within: null, open: null, loc: null });
  const applyRate = () => {
    const n = Number(rateDraft);
    const next = rateDraft && n > 0 ? String(n) : null;
    if (next !== (maxRate ? String(maxRate) : null)) update({ rate: next });
  };
  // Locations people in the pool actually have, most common first.
  const locations = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of candidates) if (c.location && !c.anonymizedAt) n.set(c.location, (n.get(c.location) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
  }, [candidates]);

  const skillsChanged = skillsParam !== null && skills.join(',').toLowerCase() !== base.stack.join(',').toLowerCase();
  const anyActive = skillsChanged || min !== DEFAULT_MIN || !!maxRate || !!extra.location || !!extra.withinDays || !!extra.openOnly;

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
    <AppLayout title={isFixtureMode() ? '' : t('nav.jdMatching')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-4 min-h-full">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <BackButton label={t('matching.back')} onClick={back} />
          <h1 className="ty-title text-2xl font-extrabold tracking-tight text-ink dark:text-white whitespace-nowrap">{t('matching.title')}</h1>
          {title && (
            <p className="min-w-0 flex items-baseline gap-2 text-base truncate">
              <span aria-hidden="true" className="text-gray-300 dark:text-white/20">/</span>
              <span className="font-semibold text-ink dark:text-gray-200 truncate">{title}</span>
              {jd?.code && <span className="text-sm text-ink-muted whitespace-nowrap">{jd.code}</span>}
            </p>
          )}
        </div>

        <section aria-label={t('matching.filters')} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))_40px] gap-2 items-center">
          <SkillPicker key={skills.join(',')} value={skills} options={skillOptions} changed={skillsChanged} onApply={(v) => update({ skills: v.join(',') })} />
          <label className={`${PILL} ${pillTone(!!maxRate)}`}>
            <span className="text-ink-muted">{t('matching.f.rateShort')}</span>
            <span aria-hidden="true" className="text-ink-muted">$</span>
            <input
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
              onBlur={applyRate}
              onKeyDown={(e) => e.key === 'Enter' && applyRate()}
              placeholder={t('matching.f.any')}
              aria-label={t('matching.f.maxRateAria')}
              className="flex-1 min-w-0 w-full border-0 p-0 m-0 bg-transparent text-sm font-semibold text-ink dark:text-gray-100 [font-family:inherit] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-xs text-ink-muted">{t('matching.f.perMo')}</span>
          </label>
          {showNew && (
            <label className={`${PILL} ${pillTone(!!extra.location)}`}>
              <span className="text-ink-muted">{t('matching.f.location')}</span>
              <select aria-label={t('matching.f.location')} className={`${PILL_SELECT} flex-1 min-w-0 w-full`} value={extra.location ?? ''} onChange={(e) => update({ loc: e.target.value || null })}>
                <option value="">{t('matching.f.any')}</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          )}
          {showNew && (
            <label className={`${PILL} ${pillTone(!!extra.withinDays)}`}>
              <span className="text-ink-muted">{t('matching.f.available')}</span>
              <select aria-label={t('matching.f.available')} className={`${PILL_SELECT} flex-1 min-w-0 w-full`} value={extra.withinDays ?? ''} onChange={(e) => update({ within: e.target.value || null })}>
                <option value="">{t('matching.f.any')}</option>
                {MATCH_WITHIN_DAYS.map((n) => <option key={n} value={n}>{t('matching.f.within', { n })}</option>)}
              </select>
            </label>
          )}
          <label className={`${PILL} ${pillTone(min !== DEFAULT_MIN)}`}>
            <span className="text-ink-muted">{t('matching.f.scoreShort')}</span>
            <select aria-label={t('matching.f.minScore')} className={`${PILL_SELECT} flex-1 min-w-0 w-full`} value={min} onChange={(e) => update({ min: e.target.value })}>
              {[...new Set([...MIN_STEPS, min])].sort((a, b) => a - b).map((n) => (
                <option key={n} value={n}>{n === 0 ? t('matching.f.any') : `≥ ${n}%`}</option>
              ))}
            </select>
          </label>
          {showNew && (
            <label className={`${PILL} ${pillTone(!!extra.openOnly)} cursor-pointer`}>
              <input
                type="checkbox"
                checked={!!extra.openOnly}
                onChange={(e) => update({ open: e.target.checked ? '1' : null })}
                className="size-4 accent-[var(--color-primary,#ea580c)]"
              />
              {t('matching.f.openShort')}
            </label>
          )}
          {anyActive && (
            <button
              type="button"
              onClick={reset}
              aria-label={t('matching.clearAll')}
              title={t('matching.clearAll')}
              className="size-10 justify-self-end shrink-0 flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-orange-50 dark:hover:bg-orange-500/10"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">filter_alt_off</span>
            </button>
          )}
        </section>

        {analyzing ? (
          <div role="status" className="bg-white dark:bg-dark-surface rounded-[1.5rem] border border-gray-100 dark:border-white/10 shadow-sm py-20 px-6 flex flex-col items-center text-center gap-4">
            <div className="relative size-20">
              <div className="absolute inset-0 rounded-full border-4 border-orange-100 dark:border-orange-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-r-primary animate-spin" />
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center material-symbols-outlined text-primary text-[30px]">auto_awesome</span>
            </div>
            <h2 className="text-xl font-bold text-ink dark:text-white">{t('matching.analyzingTitle')}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('matching.analyzingSub')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {shown.length > 0 && (
              // One toolbar: select-all + count on the left, actions on the right. While people are picked it sticks and turns orange.
              <div
                role="region"
                aria-label={t('matching.selectionBar')}
                className={`flex items-center justify-between gap-3 flex-wrap px-3 py-2 rounded-xl border ${selected.size ? 'sticky top-2 z-10 border-primary/40 bg-orange-50 dark:bg-[#2a1d14] shadow-sm' : 'border-transparent'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {showNew && rows.length > 0 && (
                    <input
                      type="checkbox"
                      ref={(el) => { if (el) el.indeterminate = pageSelected > 0 && pageSelected < selectable.length; }}
                      checked={selectable.length > 0 && pageSelected === selectable.length}
                      disabled={selectable.length === 0}
                      onChange={(e) => selectPage(e.target.checked)}
                      aria-label={t('matching.selectPage')}
                      title={t('matching.selectPage')}
                      className="size-4 accent-[var(--color-primary,#ea580c)]"
                    />
                  )}
                  {selected.size > 0 ? (
                    <p className="flex items-center gap-2 text-sm">
                      <b className="text-ink dark:text-white">{t('matching.selected', { n: selected.size })}</b>
                      <button type="button" onClick={() => setSelected(new Set())} className="text-ink-muted hover:text-ink underline-offset-2 hover:underline">
                        {t('matching.clearSelection')}
                      </button>
                    </p>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>{t('matching.found', { n: shown.length, min })}</p>
                      {anonCount > 0 && <p className="text-xs text-ink-muted">{t('matching.hiddenAnon', { n: anonCount })}</p>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setAdding([...selected])}
                      className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-primary text-white text-sm font-bold hover:brightness-110 whitespace-nowrap"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">person_add</span>
                      {t('matching.addN', { n: selected.size })}
                    </button>
                  )}
                  {showNew && (
                    <div role="group" aria-label={t('matching.view')} className="hidden md:flex items-center p-0.5 rounded-lg border border-line dark:border-white/15 bg-white dark:bg-transparent">
                      {(['cards', 'table'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={view === v}
                          aria-label={t(`matching.view.${v}`)}
                          title={t(`matching.view.${v}`)}
                          onClick={() => commit({ view: v === 'table' ? 'table' : null })}
                          className={`size-8 flex items-center justify-center rounded-md ${view === v ? 'bg-gray-100 text-ink dark:bg-white/15 dark:text-white' : 'text-ink-muted hover:text-ink'}`}
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{v === 'table' ? 'table_rows' : 'view_agenda'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={exportCsv}
                    aria-label={t('matching.export')}
                    title={t('matching.export')}
                    className="size-9 flex items-center justify-center rounded-lg border border-line dark:border-white/15 bg-white dark:bg-transparent text-ink-muted hover:text-ink hover:border-primary/50"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">download</span>
                  </button>
                </div>
              </div>
            )}
            {showNew && view === 'table' && rows.length > 0 && (
              <div className="hidden md:block">
                <MatchTable
                  rows={rows}
                  need={fixture ? undefined : need}
                  today={today}
                  sort={sort}
                  onSort={(v) => commit({ sort: v === 'score' ? null : v, page: '1' })}
                  onOpen={(id) => navigate({ pathname: `/candidates/${id}`, search })}
                  onAdd={(id) => setAdding([id])}
                  selected={selected}
                  onSelect={toggleSelect}
                />
              </div>
            )}
            {/* Phones always get cards: a wide table does not fit. */}
            <div className={`space-y-5 ${showNew && view === 'table' ? 'md:hidden' : ''}`}>
            {rows.map((r, i) => (
              <MatchCard
                key={`${r.candidateId}-${i}`}
                row={r}
                onOpen={() => navigate({ pathname: `/candidates/${r.candidateId}`, search })}
                onAdd={showNew ? () => setAdding([r.candidateId]) : undefined}
                selected={showNew ? selected.has(r.candidateId) : undefined}
                onSelect={showNew ? (on) => toggleSelect(r.candidateId, on) : undefined}
                need={fixture ? undefined : need}
                today={today}
              />
            ))}
            </div>
            {rows.length === 0 && (
              <div className="bg-white dark:bg-dark-surface rounded-[1.5rem] border border-gray-100 dark:border-white/10 px-6 py-12 text-center text-sm text-ink-muted space-y-3">
                <p>{t(jd || fixture ? 'matching.empty' : 'matching.noJds')}</p>
                {/* Not a dead end: offer the highest threshold that has results. */}
                {lower !== undefined && (
                  <button
                    type="button"
                    onClick={() => update({ min: String(lower) })}
                    className="px-4 py-2 rounded-full border border-primary text-primary font-bold hover:bg-primary/5"
                  >
                    {lower ? t('matching.lower', { n: lower }) : t('matching.lowerAll')}
                  </button>
                )}
              </div>
            )}
            {shown.length > PAGE_SIZE && (
              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-white/10">
                <MatchPager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={(n) => commit({ page: String(n) })} />
              </div>
            )}
          </div>
        )}
      </div>
      <AddToPipelineModal
        open={adding !== null}
        onClose={() => { setAdding(null); setSelected(new Set()); }}
        candidateIds={adding ?? []}
      />
    </AppLayout>
  );
}

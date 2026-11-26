import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Avatar, toneFor } from '../../components/Avatar';
import { downloadCsv } from '../../components/download';
import { MenuItem, Popover } from '../../components/Popover';
import { Pagination } from '../../components/Pagination';
import { toast } from '../../components/Toast';
import { isFixtureMode, MOCKUP_AVATAR_TONES } from '../../data/fixtureMockup';
import { toCsv } from '../../domain/csv';
import {
  activeApplicationsByCandidate,
  CANDIDATE_SORTS,
  filterCandidates,
  isQueryActive,
  PAGE_SIZE,
  poolStateFromParams,
  poolStateToParams,
  seniorityRank,
  type CandidateQuery,
  type CandidateSort,
} from '../../domain/filters';
import { shortDate } from '../../domain/hiring';
import { jobStageLabel } from '../../domain/pipelineConfig';
import { cvFreshness, GAPS, lastCvAt, matchesGap } from '../../domain/poolQuality';
import { estimateYears } from '../../domain/scoring';
import type { Application, Candidate, Job } from '../../domain/types';
import { assignableUsers, userName } from '../../domain/users';
import { useShowNew } from '../../hooks';
import { useLang, useT, type TKey } from '../../i18n/i18n';
import { me, useCan } from '../../store/session';
import { useStore } from '../../store/store';
import { AddToPipelineModal } from './AddToPipelineModal';

const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm font-medium text-[#181211] dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const FILTER_ON = 'border-primary/60 text-primary';
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';
const TD = 'px-6 py-4 whitespace-nowrap ';
/** The table is wider than a 1440px screen: keep the row menu (Add to pipeline, Edit…) in view without scrolling sideways. */
const STICKY_HEAD = 'sticky right-0 bg-[#f8f6f6] dark:bg-[#251f1e] shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]';
const STICKY_CELL = 'sticky right-0 bg-white dark:bg-surface-dark group-hover:bg-gray-50 dark:group-hover:bg-[#2a2423] shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]';
const CHIP = 'px-2 py-0.5 text-xs font-medium bg-[#f4f1f0] dark:bg-[#2a2423] text-[#181211] dark:text-[#e6dddb] rounded border border-[#e6dddb] dark:border-[#3a3433]';
const TAG = 'px-1.5 py-px text-[10px] font-semibold rounded bg-primary/10 text-primary';
const BADGE = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs';
const CHECKBOX = 'rounded border-gray-300 text-primary focus:ring-primary dark:bg-[#1e1e1e] dark:border-[#3a3433] disabled:opacity-40';
const BULK_BTN = 'px-3 py-1.5 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] rounded-lg hover:border-primary/50 hover:text-primary transition-colors';

const BADGES = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
};

const SENIORITY_BADGE: Record<string, keyof typeof BADGES> = {
  intern: 'gray', junior: 'green', mid: 'blue', middle: 'blue', senior: 'purple', lead: 'indigo', principal: 'orange', architect: 'orange',
};
const ENGLISH_BADGE: Record<string, keyof typeof BADGES> = { advanced: 'green', native: 'green', intermediate: 'blue' };

/** Skill chips are shown while their names fit this budget (at least one), the rest collapse into "+N". */
const SKILL_CHAR_BUDGET = 24;

function splitSkills(skills: string[], budget = SKILL_CHAR_BUDGET): { shown: string[]; hidden: number } {
  let used = 0;
  let n = 0;
  for (const s of skills) {
    if (n > 0 && used + s.length > budget) break;
    used += s.length;
    n += 1;
  }
  return { shown: skills.slice(0, n), hidden: skills.length - n };
}

function FilterButton({ icon, label, wide, open, on, onClick }: { icon: string; label: string; wide?: boolean; open?: boolean; on?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-expanded={open} className={`${FILTER_BTN}${on ? FILTER_ON : ''}`}>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">{icon}</span>
      {wide ? <span className="max-w-[150px] truncate">{label}</span> : <span>{label}</span>}
      <span className={`material-symbols-outlined text-[18px] text-[#896a61]${wide ? ' ml-auto' : ''}`}>expand_more</span>
    </button>
  );
}

type Option = { value: string; label: string };

function FilterMenu({ icon, label, wide, options, value, onChange, anyLabel, testId, highlight }: {
  icon: string; label: string; wide?: boolean; options: Option[]; value: string; onChange: (v: string) => void;
  anyLabel: string; testId?: string; highlight?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Popover
      trigger={({ open, toggle }) => (
        <div data-testid={testId}>
          <FilterButton icon={icon} label={current?.label ?? label} wide={wide} open={open} on={highlight && !!current} onClick={toggle} />
        </div>
      )}
    >
      {(close) => (
        <>
          <MenuItem active={value === ''} onClick={() => { onChange(''); close(); }}>{anyLabel}</MenuItem>
          {options.map((o) => (
            <MenuItem key={o.value} active={o.value === value} onClick={() => { onChange(o.value); close(); }}>{o.label}</MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

/** Checkbox list that stays open while several values are picked. */
function MultiFilterMenu({ icon, label, options, values, onChange, anyLabel, wide }: {
  icon: string; label: string; options: Option[]; values: string[]; onChange: (v: string[]) => void; anyLabel: string; wide?: boolean;
}) {
  const picked = options.filter((o) => values.includes(o.value));
  const shown = picked.length === 0 ? label : picked.length === 1 ? picked[0].label : `${label} (${picked.length})`;
  const flip = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <Popover trigger={({ open, toggle }) => <FilterButton icon={icon} label={shown} wide={wide} open={open} on={picked.length > 0} onClick={toggle} />}>
      {() => (
        <>
          <MenuItem active={values.length === 0} onClick={() => onChange([])}>{anyLabel}</MenuItem>
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-3 py-2 text-sm text-[#181211] dark:text-white hover:bg-[#f8f6f6] dark:hover:bg-white/5 cursor-pointer">
              <input type="checkbox" className={CHECKBOX} checked={values.includes(o.value)} onChange={() => flip(o.value)} />
              {o.label}
            </label>
          ))}
        </>
      )}
    </Popover>
  );
}

function BulkTag({ tags, onApply }: { tags: string[]; onApply: (tag: string) => void }) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const matches = tags.filter((x) => x.toLowerCase().includes(draft.trim().toLowerCase())).slice(0, 8);
  return (
    <Popover trigger={({ toggle }) => <button onClick={toggle} className={BULK_BTN}>{t('candidates.bulk.tag')}</button>}>
      {(close) => {
        const apply = (tag: string) => {
          if (!tag.trim()) return;
          onApply(tag.trim());
          setDraft('');
          close();
        };
        return (
          <div className="p-2 w-60">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); apply(draft); }}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('candidates.bulk.tagPlaceholder')}
                aria-label={t('candidates.bulk.tagPlaceholder')}
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-[#e6dddb] dark:border-[#3a3433] dark:bg-[#251f1e] rounded-md focus:border-primary focus:ring-0"
              />
              <button type="submit" className="px-2 text-sm font-semibold text-primary disabled:opacity-40" disabled={!draft.trim()}>{t('candidates.bulk.tagApply')}</button>
            </form>
            {matches.length > 0 && (
              <div className="mt-1 -mx-2">
                {matches.map((x) => <MenuItem key={x} onClick={() => apply(x)}>{x}</MenuItem>)}
              </div>
            )}
          </div>
        );
      }}
    </Popover>
  );
}

function PipelineCell({ apps, jobs }: { apps: Application[] | undefined; jobs: Job[] }) {
  const t = useT();
  const [lang] = useLang();
  if (!apps?.length) return <span className="text-sm text-[#896a61]">—</span>;
  const line = (a: Application) => {
    const job = jobs.find((j) => j.id === a.jobId);
    return { job: job?.title ?? a.jobId, stage: jobStageLabel(job, a.stage, lang) };
  };
  const first = line(apps[0]);
  const all = apps.map((a) => { const l = line(a); return `${l.job} (${l.stage})`; }).join(', ');
  return (
    <div className="max-w-[180px]" title={t('candidates.pipeline.list', { list: all })}>
      <div className="text-sm font-medium text-[#181211] dark:text-white truncate">{first.job}</div>
      <div className="text-xs text-[#896a61] truncate">
        <span className="text-primary font-semibold">{first.stage}</span>
        {apps.length > 1 && <> · {t('candidates.pipeline.more', { n: apps.length - 1 })}</>}
      </div>
    </div>
  );
}

const distinct = (vals: (string | undefined)[]) => [...new Set(vals.filter((v): v is string => !!v))];

export function CandidatePoolPage() {
  const t = useT();
  const navigate = useNavigate();
  const showNew = useShowNew();
  const can = useCan();
  // App mode: tighter cell padding and a smaller skill budget so the columns fit without hiding under the pinned Actions column.
  const th = showNew ? TH.replace('px-6', 'px-4') : TH;
  const td = showNew ? TD.replace('px-6', 'px-4') : TD;
  const tdAction = showNew ? TD.replace('px-6', 'px-3') : TD;
  const skillBudget = showNew ? 12 : SKILL_CHAR_BUDGET;
  const [params, setParams] = useSearchParams();
  const candidates = useStore((s) => s.candidates);
  const users = useStore((s) => s.users);
  const applications = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const piiUnlocked = useStore((s) => s.ui.piiUnlocked);
  const fixtureTotal = useStore((s) => s.meta?.totals?.dashboard.totalCandidates);

  // Filters, sort and page live in the URL: Back from a profile (or a shared link) restores the same view.
  const { q, sort, page } = useMemo(() => poolStateFromParams(params), [params]);
  const write = (next: { q?: CandidateQuery; sort?: CandidateSort; page?: number }) =>
    setParams(poolStateToParams({ q: next.q ?? q, sort: next.sort ?? sort, page: next.page ?? 1 }, params), { replace: true });
  const patch = (p: Partial<CandidateQuery>) => write({ q: { ...q, ...p } });
  const setPage = (n: number) => write({ page: n });
  const clearGap = () => write({ q: { ...q, gap: undefined, since: undefined } });
  const clearFilters = () => write({ q: {}, sort: 'newest' });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Candidates queued for the Add to Pipeline modal; null while it is closed. */
  const [pipelineIds, setPipelineIds] = useState<string[] | null>(null);
  const onAddToPipeline = setPipelineIds;

  const active = useMemo(() => activeApplicationsByCandidate(applications), [applications]);
  const now = useMemo(() => new Date(), []);
  const filtered = useMemo(() => filterCandidates(candidates, q, sort, now, new Set(active.keys())), [candidates, q, sort, now, active]);
  const filtersActive = isQueryActive(q);
  // The mockup fixture shows a 781-row pool while only holding the first 10 rows.
  const overrideTotal = fixtureTotal !== undefined && !filtersActive ? fixtureTotal : undefined;
  const total = overrideTotal ?? filtered.length;
  const start = overrideTotal !== undefined ? 0 : (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  const seniorities = distinct(candidates.map((c) => c.seniority)).sort((a, b) => seniorityRank(a) - seniorityRank(b));
  const englishLevels = distinct(candidates.map((c) => c.english));
  const owners = distinct(candidates.map((c) => c.cvOwner));
  const tags = distinct(candidates.flatMap((c) => c.tags)).sort();
  const locations = distinct(candidates.map((c) => c.location)).sort();
  const domains = distinct(candidates.flatMap((c) => c.domains)).sort();
  const opt = (vals: string[], label: (v: string) => string = (v) => v): Option[] => vals.map((v) => ({ value: v, label: label(v) }));
  const any = t('candidates.filter.any');
  const flag = (v: boolean | undefined) => (v === undefined ? '' : v ? '1' : '0');
  const unflag = (v: string) => (v === '' ? undefined : v === '1');

  const fixtureSearch = isFixtureMode() ? '?fixture=mockup' : '';
  const poolSearch = params.toString() ? `?${params.toString()}` : '';
  const go = (c: Candidate, edit = false) =>
    navigate(
      { pathname: `/candidates/${c.id}`, search: edit ? `${fixtureSearch ? `${fixtureSearch}&` : '?'}edit=1` : fixtureSearch },
      { state: { poolSearch } },
    );

  /** Anonymized records stay listed for reporting, but cannot be selected or added to a pipeline. */
  const selectable = rows.filter((c) => !c.anonymizedAt);
  const allOnPage = selectable.length > 0 && selectable.every((c) => selected.has(c.id));
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const c of selectable) allOnPage ? next.delete(c.id) : next.add(c.id);
      return next;
    });
  const selectedCandidates = candidates.filter((c) => selected.has(c.id));

  const mask = (s: string) => (piiUnlocked ? s : '•••••');
  const setPii = (unlocked: boolean) => useStore.setState((s) => ({ ui: { ...s.ui, piiUnlocked: unlocked } }));
  const piiButton = (
    <button
      onClick={() => setPii(!piiUnlocked)}
      className="size-8 flex items-center justify-center rounded-lg border border-[#e6dddb] dark:border-[#3a3433] text-[#896a61] hover:bg-white dark:hover:bg-[#2a2423] hover:text-primary transition-colors hover:shadow-sm"
      title={t(piiUnlocked ? 'candidates.pii.unlocked' : 'candidates.pii.locked')}
      aria-label={t('candidates.pii.toggle')}
      aria-pressed={piiUnlocked}
    >
      <span className="material-symbols-outlined text-[18px]">{piiUnlocked ? 'lock_open' : 'lock'}</span>
    </button>
  );

  const sortOptions: Option[] = CANDIDATE_SORTS.filter((k) => showNew || k !== 'updated').map((k) => ({
    value: k,
    label: t(`candidates.sort.${k}` as TKey),
  }));

  const bulkTag = (tag: string) => {
    const store = useStore.getState();
    for (const c of selectedCandidates) if (!c.tags.includes(tag)) store.updateCandidate(c.id, { tags: [...c.tags, tag] }, me());
    toast(t('candidates.bulk.tagged', { tag, count: selectedCandidates.length }));
  };
  const bulkOwner = (to: string) => {
    const store = useStore.getState();
    const moved = selectedCandidates.filter((c) => store.transferOwner(c.id, to, me()).ok).length;
    toast(t('candidates.bulk.ownerChanged', { count: moved, name: userName(users, to) }));
  };
  const bulkExport = () => {
    const rowsOut = selectedCandidates.map((c) => ({
      Name: c.name,
      Title: c.title,
      ...(piiUnlocked ? { Email: c.email, Phone: c.phone } : {}),
      Seniority: c.seniority,
      English: c.english,
      Skills: c.skills.join('; '),
      Location: c.location ?? '',
      'Open to work': c.openToWork ? 'Yes' : 'No',
      'CV owner': userName(users, c.cvOwner),
      Tags: c.tags.join('; '),
      'CV updated': shortDate(lastCvAt(c)),
      Pipeline: (active.get(c.id) ?? []).map((a) => jobs.find((j) => j.id === a.jobId)?.title ?? a.jobId).join('; '),
    }));
    downloadCsv('ung-vien.csv', toCsv(rowsOut));
    toast(t(piiUnlocked ? 'candidates.bulk.exported' : 'candidates.bulk.exportedNoPii', { count: rowsOut.length }));
  };

  return (
    <AppLayout title={t('nav.candidatePool')}>
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        <div className="bg-white dark:bg-[#1e1e1e] border-b border-[#e6dddb] dark:border-[#2a2423] p-4 flex flex-col gap-4 z-10 shadow-soft">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
            <div className={`relative w-full ${showNew ? 'md:w-96' : 'md:w-64'} group`}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61] group-focus-within:text-primary transition-colors">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-[#f8f6f6] dark:bg-[#251f1e] border border-transparent focus:bg-white dark:focus:bg-[#1e1e1e] border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white transition-all placeholder-[#896a61]"
                placeholder={t('candidates.search')}
                type="text"
                value={q.text ?? ''}
                onChange={(e) => patch({ text: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate({ pathname: '/upload', search: fixtureSearch })}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                {t('candidates.add')}
              </button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
            <div className={`flex gap-2 w-full md:w-auto ${showNew ? 'flex-wrap' : 'overflow-x-auto pb-1 md:pb-1 custom-scrollbar'}`}>
              {showNew ? (
                <MultiFilterMenu icon="workspace_premium" label={t('candidates.filter.seniority')} wide options={opt(seniorities)} values={q.seniorities ?? []} onChange={(v) => patch({ seniorities: v })} anyLabel={any} />
              ) : (
                <FilterMenu icon="workspace_premium" label={t('candidates.filter.seniority')} wide options={opt(seniorities)} value={q.seniorities?.[0] ?? ''} onChange={(v) => patch({ seniorities: v ? [v] : [] })} anyLabel={any} />
              )}
              <div className="space-y-1.5 w-64">
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[20px] pointer-events-none group-focus-within:text-primary transition-colors">category</span>
                  <input
                    className="w-full py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed pl-10 pr-4 hover:border-primary/50"
                    placeholder={t('candidates.filter.stack')}
                    title={t('candidates.filter.stackHint')}
                    type="text"
                    value={q.stack ?? ''}
                    onChange={(e) => patch({ stack: e.target.value })}
                  />
                </div>
              </div>
              <FilterMenu icon="translate" label={t('candidates.filter.english')} options={opt(englishLevels)} value={q.english ?? ''} onChange={(v) => patch({ english: v })} anyLabel={any} highlight={showNew} />
              <FilterMenu icon="person" label={t('candidates.filter.owner')} options={opt(owners, (v) => userName(users, v))} value={q.owner ?? ''} onChange={(v) => patch({ owner: v })} anyLabel={any} testId="candidates-cvowner-filter" highlight={showNew} />
              {showNew && (
                <>
                  <MultiFilterMenu icon="sell" label={t('candidates.filter.tag')} options={opt(tags)} values={q.tags ?? []} onChange={(v) => patch({ tags: v })} anyLabel={any} />
                  <FilterMenu
                    icon="work_history"
                    label={t('candidates.filter.openToWork')}
                    options={[{ value: '1', label: t('candidates.filter.yes') }, { value: '0', label: t('candidates.filter.no') }]}
                    value={flag(q.openToWork)}
                    onChange={(v) => patch({ openToWork: unflag(v) })}
                    anyLabel={any}
                    highlight
                    testId="pool-filter-open"
                  />
                  <FilterMenu
                    icon="view_kanban"
                    label={t('candidates.filter.pipeline')}
                    options={[{ value: '1', label: t('candidates.filter.inPipeline') }, { value: '0', label: t('candidates.filter.notInPipeline') }]}
                    value={flag(q.inPipeline)}
                    onChange={(v) => patch({ inPipeline: unflag(v) })}
                    anyLabel={any}
                    highlight
                    testId="pool-filter-pipeline"
                  />
                  <FilterMenu icon="location_on" label={t('candidates.filter.location')} options={opt(locations)} value={q.location ?? ''} onChange={(v) => patch({ location: v })} anyLabel={any} highlight />
                  <FilterMenu icon="domain" label={t('candidates.filter.domain')} options={opt(domains)} value={q.domain ?? ''} onChange={(v) => patch({ domain: v })} anyLabel={any} highlight />
                </>
              )}
              {q.gap && (
                <span data-testid="pool-gap-chip" className="flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold whitespace-nowrap">
                  {t(`candidates.gap.${q.gap}` as TKey)}
                  {q.since && <span className="text-xs font-bold opacity-80">· {t(`dash.period.${q.since}` as TKey)}</span>}
                  <button type="button" onClick={clearGap} aria-label={t('candidates.gap.remove')} className="flex items-center rounded p-0.5 hover:bg-primary/15">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              )}
              <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#896a61] hover:text-primary transition-colors whitespace-nowrap">
                <span className="material-symbols-outlined text-[18px]">filter_list_off</span>
                {t('candidates.filter.clear')}
              </button>
            </div>
            <FilterMenu icon="sort" label={t('candidates.filter.sort')} options={sortOptions} value={sort === 'newest' ? '' : sort} onChange={(v) => write({ sort: (v || 'newest') as CandidateSort })} anyLabel={t('candidates.sort.newest')} />
          </div>
        </div>

        <div className="flex-1 bg-[#f8f6f6] dark:bg-[#221410] p-4 md:p-6">
          {showNew && selected.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 bg-white dark:bg-[#1e1e1e] border border-primary/40 rounded-xl shadow-sm">
              <span className="text-sm font-medium text-[#181211] dark:text-white">{t('candidates.bulk.selected', { count: selected.size })}</span>
              <button
                onClick={() => onAddToPipeline([...selected])}
                className="px-3 py-1.5 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
              >
                {t('candidates.bulk.addToPipeline')}
              </button>
              <BulkTag tags={tags} onApply={bulkTag} />
              {can('reports') && (
                <Popover trigger={({ toggle: open }) => <button onClick={open} className={BULK_BTN}>{t('candidates.bulk.owner')}</button>}>
                  {(close) =>
                    assignableUsers(users).map((u) => (
                      <MenuItem key={u.id} onClick={() => { close(); bulkOwner(u.id); }}>{u.name}</MenuItem>
                    ))
                  }
                </Popover>
              )}
              <button onClick={bulkExport} className={BULK_BTN}>{t('candidates.bulk.export')}</button>
              <button onClick={() => setSelected(new Set())} className="text-sm font-medium text-[#896a61] hover:text-primary transition-colors">
                {t('candidates.bulk.clear')}
              </button>
            </div>
          )}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm flex flex-col border-0 shadow-none rounded-none">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-274px)] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                  <tr>
                    <th className={`${showNew ? 'pl-6 pr-2' : 'px-6'} py-4 w-12 border-b border-[#e6dddb] dark:border-[#2a2423]`}>
                      <div className="flex items-center">
                        <input className={CHECKBOX} type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all" />
                      </div>
                    </th>
                    <th className={th}><div className="flex items-center gap-1">{t('candidates.col.name')}</div></th>
                    <th className={th}>
                      <div className="flex items-center gap-2">
                        {t('candidates.col.contact')}
                        {showNew ? piiButton : <span className="material-symbols-outlined text-[14px]" title={t('candidates.pii.protected')}>lock</span>}
                      </div>
                    </th>
                    <th className={th}><div className="flex items-center gap-1">{t('candidates.col.seniority')}</div></th>
                    <th className={th}><div className="flex items-center gap-1">{t('candidates.col.stack')}</div></th>
                    <th className={th}><div className={`flex items-center gap-1 ${showNew ? 'max-w-[72px]' : ''}`}>{t('candidates.col.english')}</div></th>
                    {showNew && <th className={th}>{t('candidates.col.pipeline')}</th>}
                    {showNew && <th className={th}>{t('candidates.col.location')}</th>}
                    {showNew && <th className={th}>{t('candidates.col.updated')}</th>}
                    <th className={th}><div className="flex items-center gap-1">{t('candidates.col.openToWork')}</div></th>
                    <th className={th}><div className="flex items-center gap-1">{t('candidates.col.owner')}</div></th>
                    <th className={`${showNew ? 'px-3' : 'px-6'} py-4 w-16 border-b border-[#e6dddb] dark:border-[#2a2423] text-xs font-bold text-[#896a61] uppercase tracking-wider text-center ${showNew ? STICKY_HEAD : ''}`}>{t('candidates.col.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                  {rows.map((c) => {
                    const { shown, hidden } = splitSkills(c.skills, skillBudget);
                    const anon = !!c.anonymizedAt;
                    const gaps = anon ? [] : GAPS.filter((g) => g !== 'stale' && matchesGap(c, g, now));
                    const fresh = cvFreshness(c, now);
                    return (
                      <tr key={c.id} data-testid={`pool-row-${c.id}`} onClick={() => go(c)} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer ${anon ? 'opacity-60' : ''}`}>
                        <td className={`${showNew ? 'pl-6 pr-2' : 'px-6'} py-4 whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                          <input className={CHECKBOX} type="checkbox" checked={selected.has(c.id)} disabled={anon} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
                        </td>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} tone={MOCKUP_AVATAR_TONES[c.id] ?? toneFor(c.name)} />
                            <div className={showNew ? 'min-w-0 max-w-[170px]' : ''}>
                              <div className="flex items-center gap-1">
                                <div className={`ty-cell-main font-bold text-[#181211] dark:text-white ${showNew ? 'truncate' : ''}`} title={showNew ? c.name : undefined}>{c.name}</div>
                                {showNew && gaps.length > 0 && (
                                  <span
                                    data-testid={`pool-quality-${c.id}`}
                                    className="material-symbols-outlined text-[16px] text-amber-500 flex-shrink-0"
                                    title={t('candidates.quality', { list: gaps.map((g) => t(`candidates.gap.${g}` as TKey)).join(', ') })}
                                  >
                                    error
                                  </span>
                                )}
                              </div>
                              {anon && showNew ? (
                                <span className="inline-block mt-0.5 px-1.5 py-px text-[10px] font-semibold rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200" title={t('candidates.anonymizedHint')}>
                                  {t('candidates.anonymized')}
                                </span>
                              ) : (
                                <div className={`text-xs text-[#896a61] ${showNew ? 'truncate' : ''}`} title={showNew ? c.title : undefined}>{c.title}</div>
                              )}
                              {showNew && c.tags.length > 0 && (
                                <div className="flex gap-1 mt-1" title={c.tags.join(', ')}>
                                  {c.tags.slice(0, 2).map((x) => <span key={x} className={TAG}>{x}</span>)}
                                  {c.tags.length > 2 && <span className={TAG}>+{c.tags.length - 2}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={td} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5 relative">
                              <span className="text-sm text-[#181211] dark:text-white ">{anon ? '—' : mask(c.email)}</span>
                              <span className="text-xs text-[#896a61] ">{anon ? '' : mask(c.phone)}</span>
                            </div>
                            {!showNew && piiButton}
                          </div>
                        </td>
                        <td className={td}>
                          <span className={`${BADGE} font-semibold ${BADGES[SENIORITY_BADGE[c.seniority.toLowerCase()] ?? 'gray']}`}>
                            <span className="size-1.5 rounded-full bg-current"></span>{c.seniority}
                          </span>
                          {showNew && !!c.experience?.length && estimateYears(c) > 0 && (
                            <div className="mt-1 text-xs text-[#896a61]">{t('candidates.years', { n: estimateYears(c) })}</div>
                          )}
                        </td>
                        <td className={td}>
                          <div className="flex flex-nowrap gap-1.5 max-w-[300px]">
                            {shown.map((s) => <span key={s} className={`${CHIP} whitespace-nowrap`}>{s}</span>)}
                            {hidden > 0 && <span className={`${CHIP} flex-shrink-0`}>+{hidden}</span>}
                          </div>
                        </td>
                        <td className={td}>
                          <span className={`${BADGE} font-medium ${BADGES[ENGLISH_BADGE[c.english.toLowerCase()] ?? 'gray']}`}>
                            <span className="size-1.5 rounded-full bg-current"></span>{c.english}
                          </span>
                        </td>
                        {showNew && (
                          <td className={td} data-testid={`pool-pipeline-${c.id}`}>
                            <PipelineCell apps={active.get(c.id)} jobs={jobs} />
                          </td>
                        )}
                        {showNew && <td className={`${td}text-sm text-[#181211] dark:text-[#e6dddb]`}>{c.location || <span className="text-[#896a61]">—</span>}</td>}
                        {showNew && (
                          <td className={td}>
                            <span
                              className={`text-sm ${fresh === 'stale' ? 'text-red-600 dark:text-red-400 font-semibold' : fresh === 'aging' ? 'text-amber-600 dark:text-amber-400' : 'text-[#181211] dark:text-[#e6dddb]'}`}
                              title={fresh === 'fresh' ? undefined : t(`candidates.updated.${fresh}` as TKey)}
                            >
                              {shortDate(lastCvAt(c))}
                            </span>
                          </td>
                        )}
                        <td className={td}>
                          {showNew ? (
                            <span data-testid={`pool-open-${c.id}`} className={`${BADGE} font-medium ${c.openToWork ? BADGES.green : BADGES.gray}`}>
                              <span className="size-1.5 rounded-full bg-current"></span>
                              {t(c.openToWork ? 'candidates.open.yes' : 'candidates.open.no')}
                            </span>
                          ) : (
                            <div className="pointer-events-none opacity-60">
                              <div className="flex flex-col gap-2 ">
                                <div className="flex items-center gap-3 mt-1">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input className="sr-only peer" type="checkbox" checked={Boolean(c.openToWork)} readOnly tabIndex={-1} aria-label="Open to Work" />
                                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-[#2a2423] peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                  </label>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className={td}>
                          <span data-testid={`candidate-cvowner-${c.id}`} className="text-sm text-[#181211] dark:text-[#e6dddb] whitespace-nowrap">{userName(users, c.cvOwner)}</span>
                        </td>
                        <td className={`${tdAction}text-center ${showNew ? STICKY_CELL : ''}`} onClick={(e) => e.stopPropagation()}>
                          <Popover
                            wrapperClass="relative inline-block text-left"
                            align="right"
                            trigger={({ toggle: open }) => (
                              <button onClick={open} aria-label={`Actions for ${c.name}`} className="text-[#896a61] hover:text-[#181211] dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined">more_vert</span>
                              </button>
                            )}
                          >
                            {(close) => (
                              <>
                                <MenuItem onClick={() => { close(); go(c); }}>{t('candidates.menu.view')}</MenuItem>
                                {!anon && <MenuItem onClick={() => { close(); onAddToPipeline([c.id]); }}>{t('candidates.menu.addToPipeline')}</MenuItem>}
                                {!anon && <MenuItem onClick={() => { close(); go(c, true); }}>{t('candidates.menu.edit')}</MenuItem>}
                              </>
                            )}
                          </Popover>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && (
                <div className="py-16 flex flex-col items-center gap-3 text-sm text-[#896a61]">
                  {t('candidates.empty')}
                  {showNew && filtersActive && (
                    <button onClick={clearFilters} className="px-3 py-1.5 font-semibold text-primary border border-primary/40 rounded-lg hover:bg-primary/5">
                      {t('candidates.empty.clear')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} noun="candidates" onPage={setPage} />
          </div>
        </div>
      </div>
      {showNew && (
        <AddToPipelineModal open={pipelineIds !== null} onClose={() => setPipelineIds(null)} candidateIds={pipelineIds ?? []} />
      )}
    </AppLayout>
  );
}

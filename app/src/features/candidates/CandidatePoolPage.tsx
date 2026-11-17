import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Avatar, toneFor } from '../../components/Avatar';
import { MenuItem, Popover } from '../../components/Popover';
import { Pagination } from '../../components/Pagination';
import { isFixtureMode, MOCKUP_AVATAR_TONES } from '../../data/fixtureMockup';
import { filterCandidates, PAGE_SIZE, seniorityRank, type CandidateQuery, type CandidateSort } from '../../domain/filters';
import type { Candidate } from '../../domain/types';
import { userName } from '../../domain/users';
import { useShowNew } from '../../hooks';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { NotesPanel } from '../notes/NotesPage';
import { IntakeModal } from '../intake/IntakeModal';
import { AddToPipelineModal } from './AddToPipelineModal';

const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm font-medium text-[#181211] dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';
const TD = 'px-6 py-4 whitespace-nowrap ';
const CHIP = 'px-2 py-0.5 text-xs font-medium bg-[#f4f1f0] dark:bg-[#2a2423] text-[#181211] dark:text-[#e6dddb] rounded border border-[#e6dddb] dark:border-[#3a3433]';
const BADGE = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs';
const CHECKBOX = 'rounded border-gray-300 text-primary focus:ring-primary dark:bg-[#1e1e1e] dark:border-[#3a3433]';

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

function splitSkills(skills: string[]): { shown: string[]; hidden: number } {
  let used = 0;
  let n = 0;
  for (const s of skills) {
    if (n > 0 && used + s.length > SKILL_CHAR_BUDGET) break;
    used += s.length;
    n += 1;
  }
  return { shown: skills.slice(0, n), hidden: skills.length - n };
}

function FilterButton({ icon, label, wide, open, onClick }: { icon: string; label: string; wide?: boolean; open?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-expanded={open} className={FILTER_BTN}>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">{icon}</span>
      {wide ? <span className="max-w-[150px] truncate">{label}</span> : <span>{label}</span>}
      <span className={`material-symbols-outlined text-[18px] text-[#896a61]${wide ? ' ml-auto' : ''}`}>expand_more</span>
    </button>
  );
}

type Option = { value: string; label: string };

function FilterMenu({ icon, label, wide, options, value, onChange, anyLabel, testId }: {
  icon: string; label: string; wide?: boolean; options: Option[]; value: string; onChange: (v: string) => void;
  anyLabel: string; testId?: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Popover
      trigger={({ open, toggle }) => (
        <div data-testid={testId}>
          <FilterButton icon={icon} label={current?.label ?? label} wide={wide} open={open} onClick={toggle} />
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

const distinct = (vals: string[]) => [...new Set(vals.filter(Boolean))];

function PoolTabs({ notes, onChange }: { notes: boolean; onChange: (notes: boolean) => void }) {
  const t = useT();
  const items = [
    { notes: false, label: t('pool.tab.profiles') },
    { notes: true, label: t('pool.tab.notes') },
  ];
  return (
    <div className="px-4 pt-4 bg-white dark:bg-[#1e1e1e]">
      <div className="inline-flex items-center gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
        {items.map((i) => (
          <button
            key={i.label}
            onClick={() => onChange(i.notes)}
            aria-pressed={notes === i.notes}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${notes === i.notes ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-slate-700'}`}
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CandidatePoolPage() {
  const t = useT();
  const navigate = useNavigate();
  const showNew = useShowNew();
  const [params, setParams] = useSearchParams();
  const notesTab = showNew && params.get('tab') === 'notes';
  const candidates = useStore((s) => s.candidates);
  const users = useStore((s) => s.users);
  const piiUnlocked = useStore((s) => s.ui.piiUnlocked);
  const fixtureTotal = useStore((s) => s.meta?.totals?.dashboard.totalCandidates);

  const [q, setQ] = useState<CandidateQuery>({});
  const [sort, setSort] = useState<CandidateSort>('newest');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [intakeOpen, setIntakeOpen] = useState(false);
  /** Candidates queued for the Add to Pipeline modal; null while it is closed. */
  const [pipelineIds, setPipelineIds] = useState<string[] | null>(null);
  const onAddToPipeline = setPipelineIds;

  const patch = (p: Partial<CandidateQuery>) => {
    setQ((cur) => ({ ...cur, ...p }));
    setPage(1);
  };
  const clearFilters = () => {
    setQ({});
    setSort('newest');
    setPage(1);
  };

  const filtered = useMemo(() => filterCandidates(candidates, q, sort), [candidates, q, sort]);
  const filtersActive = Object.values(q).some((v) => (Array.isArray(v) ? v.length : Boolean(v)));
  // The mockup fixture shows a 781-row pool while only holding the first 10 rows.
  const overrideTotal = fixtureTotal !== undefined && !filtersActive ? fixtureTotal : undefined;
  const total = overrideTotal ?? filtered.length;
  const start = overrideTotal !== undefined ? 0 : (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  const seniorities = distinct(candidates.map((c) => c.seniority)).sort((a, b) => seniorityRank(a) - seniorityRank(b));
  const englishLevels = distinct(candidates.map((c) => c.english));
  const owners = distinct(candidates.map((c) => c.cvOwner));
  const tags = distinct(candidates.flatMap((c) => c.tags)).sort();
  const opt = (vals: string[], label: (v: string) => string = (v) => v): Option[] => vals.map((v) => ({ value: v, label: label(v) }));
  const any = t('candidates.filter.any');

  const search = isFixtureMode() ? '?fixture=mockup' : '';
  const go = (c: Candidate, edit = false) =>
    navigate({ pathname: `/candidates/${c.id}`, search: edit ? `${search ? `${search}&` : '?'}edit=1` : search });

  const allOnPage = rows.length > 0 && rows.every((c) => selected.has(c.id));
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const c of rows) allOnPage ? next.delete(c.id) : next.add(c.id);
      return next;
    });

  const mask = (s: string) => (piiUnlocked ? s : '•••••');
  const setPii = (unlocked: boolean) => useStore.setState((s) => ({ ui: { ...s.ui, piiUnlocked: unlocked } }));

  const sortOptions: Option[] = (['newest', 'name', 'seniority'] as const).map((k) => ({
    value: k,
    label: t(`candidates.sort.${k}` as TKey),
  }));

  if (notesTab) {
    return (
      <AppLayout title={t('nav.candidatePool')}>
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
          <PoolTabs notes onChange={(v: boolean) => setParams(v ? { tab: 'notes' } : {}, { replace: true })} />
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <NotesPanel />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('nav.candidatePool')}>
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        {showNew && <PoolTabs notes={false} onChange={(v: boolean) => setParams(v ? { tab: 'notes' } : {}, { replace: true })} />}
        <div className="bg-white dark:bg-[#1e1e1e] border-b border-[#e6dddb] dark:border-[#2a2423] p-4 flex flex-col gap-4 z-10 shadow-soft">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
            <div className="relative w-full md:w-64 group">
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
                onClick={() => setIntakeOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                {t('candidates.add')}
              </button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-1 custom-scrollbar">
              <FilterMenu icon="workspace_premium" label={t('candidates.filter.seniority')} wide options={opt(seniorities)} value={q.seniority ?? ''} onChange={(v) => patch({ seniority: v })} anyLabel={any} />
              <div className="space-y-1.5 w-64">
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[20px] pointer-events-none group-focus-within:text-primary transition-colors">category</span>
                  <input
                    className="w-full py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed pl-10 pr-4 hover:border-primary/50"
                    placeholder={t('candidates.filter.stack')}
                    type="text"
                    value={q.stack ?? ''}
                    onChange={(e) => patch({ stack: e.target.value })}
                  />
                </div>
              </div>
              <FilterMenu icon="translate" label={t('candidates.filter.english')} options={opt(englishLevels)} value={q.english ?? ''} onChange={(v) => patch({ english: v })} anyLabel={any} />
              <FilterMenu icon="person" label={t('candidates.filter.owner')} options={opt(owners, (v) => userName(users, v))} value={q.owner ?? ''} onChange={(v) => patch({ owner: v })} anyLabel={any} testId="candidates-cvowner-filter" />
              {showNew && (
                <FilterMenu icon="sell" label={t('candidates.filter.tag')} options={opt(tags)} value={q.tags?.[0] ?? ''} onChange={(v) => patch({ tags: v ? [v] : [] })} anyLabel={any} />
              )}
              <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#896a61] hover:text-primary transition-colors whitespace-nowrap">
                <span className="material-symbols-outlined text-[18px]">filter_list_off</span>
                {t('candidates.filter.clear')}
              </button>
            </div>
            <FilterMenu icon="sort" label={t('candidates.filter.sort')} options={sortOptions} value={sort === 'newest' ? '' : sort} onChange={(v) => { setSort((v || 'newest') as CandidateSort); setPage(1); }} anyLabel={t('candidates.sort.newest')} />
          </div>
        </div>

        <div className="flex-1 bg-[#f8f6f6] dark:bg-[#221410] p-4 md:p-6">
          {showNew && selected.size > 0 && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1e1e1e] border border-primary/40 rounded-xl shadow-sm">
              <span className="text-sm font-medium text-[#181211] dark:text-white">{t('candidates.bulk.selected', { count: selected.size })}</span>
              <button
                onClick={() => onAddToPipeline([...selected])}
                className="px-3 py-1.5 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
              >
                {t('candidates.bulk.addToPipeline')}
              </button>
              <button onClick={() => setSelected(new Set())} className="text-sm font-medium text-[#896a61] hover:text-primary transition-colors">
                {t('candidates.bulk.clear')}
              </button>
            </div>
          )}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e6dddb] dark:border-[#2a2423] shadow-sm flex flex-col border-0 shadow-none rounded-none">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 w-12 border-b border-[#e6dddb] dark:border-[#2a2423]">
                      <div className="flex items-center">
                        <input className={CHECKBOX} type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all" />
                      </div>
                    </th>
                    <th className={TH}><div className="flex items-center gap-1">{t('candidates.col.name')}</div></th>
                    <th className={TH}>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1">
                          {t('candidates.col.contact')}{' '}
                          <span className="material-symbols-outlined text-[14px]" title={t('candidates.pii.protected')}>lock</span>
                        </div>
                      </div>
                    </th>
                    <th className={TH}><div className="flex items-center gap-1">{t('candidates.col.seniority')}</div></th>
                    <th className={TH}><div className="flex items-center gap-1">{t('candidates.col.stack')}</div></th>
                    <th className={TH}><div className="flex items-center gap-1">{t('candidates.col.english')}</div></th>
                    <th className={TH}><div className="flex items-center gap-1">{t('candidates.col.openToWork')}</div></th>
                    <th className={TH}><div className="flex items-center gap-1">{t('candidates.col.owner')}</div></th>
                    <th className="px-6 py-4 w-16 border-b border-[#e6dddb] dark:border-[#2a2423] text-xs font-bold text-[#896a61] uppercase tracking-wider text-center">{t('candidates.col.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                  {rows.map((c) => {
                    const { shown, hidden } = splitSkills(c.skills);
                    return (
                      <tr key={c.id} onClick={() => go(c)} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <input className={CHECKBOX} type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
                        </td>
                        <td className={TD}>
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} tone={MOCKUP_AVATAR_TONES[c.id] ?? toneFor(c.name)} />
                            <div>
                              <div className="font-bold text-[#181211] dark:text-white">{c.name}</div>
                              <div className="text-xs text-[#896a61]">{c.title}</div>
                            </div>
                          </div>
                        </td>
                        <td className={TD} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5 relative">
                              <span className="text-sm text-[#181211] dark:text-white ">{mask(c.email)}</span>
                              <span className="text-xs text-[#896a61] ">{mask(c.phone)}</span>
                            </div>
                            <button
                              onClick={() => setPii(!piiUnlocked)}
                              className="size-8 flex items-center justify-center rounded-lg border border-[#e6dddb] dark:border-[#3a3433] text-[#896a61] hover:bg-white dark:hover:bg-[#2a2423] hover:text-primary transition-colors hover:shadow-sm"
                              title={t(piiUnlocked ? 'candidates.pii.unlocked' : 'candidates.pii.locked')}
                            >
                              <span className="material-symbols-outlined text-[18px]">{piiUnlocked ? 'lock_open' : 'lock'}</span>
                            </button>
                          </div>
                        </td>
                        <td className={TD}>
                          <span className={`${BADGE} font-semibold ${BADGES[SENIORITY_BADGE[c.seniority.toLowerCase()] ?? 'gray']}`}>
                            <span className="size-1.5 rounded-full bg-current"></span>{c.seniority}
                          </span>
                        </td>
                        <td className={TD}>
                          <div className="flex flex-nowrap gap-1.5 max-w-[300px]">
                            {shown.map((s) => <span key={s} className={`${CHIP} whitespace-nowrap`}>{s}</span>)}
                            {hidden > 0 && <span className={`${CHIP} flex-shrink-0`}>+{hidden}</span>}
                          </div>
                        </td>
                        <td className={TD}>
                          <span className={`${BADGE} font-medium ${BADGES[ENGLISH_BADGE[c.english.toLowerCase()] ?? 'gray']}`}>
                            <span className="size-1.5 rounded-full bg-current"></span>{c.english}
                          </span>
                        </td>
                        <td className={TD}>
                          <div className="pointer-events-none opacity-60">
                            <div className="flex flex-col gap-2 ">
                              <div className="flex items-center gap-3 mt-1">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input className="sr-only peer" type="checkbox" readOnly tabIndex={-1} aria-label="Open to Work" />
                                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-[#2a2423] peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                </label>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={TD}>
                          <span data-testid={`candidate-cvowner-${c.id}`} className="text-sm text-[#181211] dark:text-[#e6dddb] whitespace-nowrap">{userName(users, c.cvOwner)}</span>
                        </td>
                        <td className={`${TD}text-center`} onClick={(e) => e.stopPropagation()}>
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
                                <MenuItem onClick={() => { close(); onAddToPipeline([c.id]); }}>{t('candidates.menu.addToPipeline')}</MenuItem>
                                <MenuItem onClick={() => { close(); go(c, true); }}>{t('candidates.menu.edit')}</MenuItem>
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
                <div className="py-16 text-center text-sm text-[#896a61]">{t('candidates.empty')}</div>
              )}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} noun="candidates" onPage={setPage} />
          </div>
        </div>
      </div>
      <IntakeModal open={intakeOpen} onClose={() => setIntakeOpen(false)} />
      {showNew && (
        <AddToPipelineModal open={pipelineIds !== null} onClose={() => setPipelineIds(null)} candidateIds={pipelineIds ?? []} />
      )}
    </AppLayout>
  );
}

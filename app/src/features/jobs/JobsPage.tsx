import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Pagination, usePaginationLabels } from '../../components/Pagination';
import { MenuItem, Popover } from '../../components/Popover';
import { JOB_SORTS, jobStats, sortJobs, type JobSort, type JobStats } from '../../domain/jobInsights';
import { PriorityBadge } from '../../components/PriorityBadge';
import { isOverdue, priorityOf, todayIso } from '../../domain/jobUrgency';
import { HIRING_PRIORITIES, type HiringPriority, type Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { stageCounts } from '../../store/selectors';
import { can, jobsInScope } from '../../domain/permissions';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { JobStatusBadge, StageBar } from './JobBits';
import { ago, editorPath } from './jobForm';
import { useJobActions } from './useJobActions';

const PAGE_SIZES = [10, 20, 50];
const FILTER_BTN =
  'flex items-center gap-1.5 h-9 px-3 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-full text-sm text-[#896a61] hover:border-primary/50 transition-colors whitespace-nowrap';
const TH = 'px-3 py-3 text-xs font-medium text-[#896a61] border-b border-[#e6dddb] dark:border-[#2a2423] whitespace-nowrap';
const TD = 'px-3 py-3 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400';
const ROW_ICON = 'p-1.5 rounded-lg transition-colors text-[#896a61] hover:bg-gray-100 dark:hover:bg-white/10';

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());

function FilterButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={FILTER_BTN}>
      <span>{label}</span>
      <span className="font-semibold text-[#181211] dark:text-white">{value}</span>
      <span className="material-symbols-outlined text-[18px]">expand_more</span>
    </button>
  );
}

export function JobsPage() {
  const t = useT();
  const paginationLabels = usePaginationLabels();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { jobs: allJobs, applications, activities, campaigns } = useStore();
  const user = useMe();
  // Everyone sees only the jobs they work on (all of them for Super Admin / Recruitment Lead).
  const jobs = useMemo(() => jobsInScope(user, allJobs), [user, allJobs]);
  const canEdit = can(user, 'job.edit');
  // Without campaign access (Hiring Managers) the campaign name is plain text, not a link into "No access".
  const canCampaign = can(user, 'campaign');
  const { actionsFor, dialog } = useJobActions();
  const [q, setQ] = useState('');
  // `?status=open` (from the dashboard) preselects the status filter.
  const [status, setStatus] = useState(() => params.get('status') ?? '');
  // `?priority=urgent,critical` and `?overdue=1` (from the dashboard tiles) preselect the urgency filters.
  const [priorities, setPriorities] = useState<HiringPriority[]>(() =>
    (params.get('priority') ?? '').split(',').filter((p): p is HiringPriority => (HIRING_PRIORITIES as readonly string[]).includes(p)));
  const [overdueOnly, setOverdueOnly] = useState(() => params.get('overdue') === '1');
  const [department, setDepartment] = useState('');
  const [sort, setSort] = useState<JobSort>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const openEditor = (mode: 'create' | 'edit' | 'duplicate', id?: string) => navigate(editorPath(mode, id), { state: { from: '/jobs' } });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const now = Date.now();
  const stats = useMemo(() => {
    const m = new Map<string, JobStats>();
    for (const j of jobs) m.set(j.id, jobStats(j, applications, activities, now));
    return m;
    // `now` moves every render; the numbers only need to follow the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, applications, activities]);

  // The campaign each job runs in (picked on the job form).
  const campaignOf = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);

  const today = todayIso();
  const departments = useMemo(() => [...new Set(jobs.map((j) => j.department))].sort(), [jobs]);
  const filtered = useMemo(
    () =>
      sortJobs(
        jobs.filter(
          (j) =>
            (!q.trim() || has(j.title, q) || has(j.department, q) || has(j.location, q)) &&
            (!status || j.status === status) &&
            (!department || j.department === department) &&
            (priorities.length === 0 || priorities.includes(priorityOf(j))) &&
            (!overdueOnly || isOverdue(j, applications, today)),
        ),
        sort,
        stats,
      ),
    [jobs, q, status, department, priorities, overdueOnly, applications, today, sort, stats],
  );
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const optionMenu = (value: string, set: (v: string) => void, options: Array<[string, string]>) => (close: () => void) => (
    <>
      {options.map(([v, label]) => (
        <MenuItem key={v} active={v === value} onClick={() => { set(v); close(); }}>{label}</MenuItem>
      ))}
    </>
  );
  const all: [string, string] = ['', t('jobs.filter.all')];
  const label = (key: 'jobs.filter.status' | 'jobs.filter.department' | 'jobs.filter.sort') => t(key, { value: '' }).replace(/\s*$/, '');
  const statuses: Job['status'][] = ['open', 'pending_approval', 'on_hold', 'draft', 'closed'];

  // Old links (`?new=1` from the end of sign-up, `?fromJd=` from a JD) now live at /jobs/new.
  const fromJd = params.get('fromJd');
  if (canEdit && (fromJd || params.get('new') === '1')) return <Navigate to={editorPath('create', undefined, fromJd ?? undefined)} replace />;

  return (
    <AppLayout title={t('nav.jobs')} subtitle={t('jobs.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-5 min-h-full">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61]">search</span>
            <input
              aria-label={t('jobs.searchToggle')}
              className="h-9 w-[346px] pl-9 pr-3 rounded-full bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 text-sm text-[#181211] dark:text-white placeholder-[#896a61]"
              placeholder={t('jobs.search')}
              value={q}
              onChange={(e) => reset(setQ)(e.target.value)}
            />
          </div>
          <Popover trigger={({ toggle }) => <FilterButton label={label('jobs.filter.status')} value={status ? t(`jobs.status.${status as Job['status']}`) : all[1]} onClick={toggle} />}>
            {optionMenu(status, reset(setStatus), [all, ...statuses.map((s): [string, string] => [s, t(`jobs.status.${s}`)])])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton label={label('jobs.filter.department')} value={department || all[1]} onClick={toggle} />}>
            {optionMenu(department, reset(setDepartment), [all, ...departments.map((d): [string, string] => [d, d])])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton label={t('jobs.filter.priority')} value={priorities.length ? priorities.map((p) => t(`priority.${p}`)).join(', ') : all[1]} onClick={toggle} />}>
            {() => (
              <>
                <MenuItem active={priorities.length === 0} onClick={() => reset(setPriorities)([])}>{all[1]}</MenuItem>
                {HIRING_PRIORITIES.map((p) => (
                  <MenuItem key={p} active={priorities.includes(p)} onClick={() => reset(setPriorities)(priorities.includes(p) ? priorities.filter((x) => x !== p) : [...priorities, p])}>
                    {t(`priority.${p}`)}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>
          <button type="button" aria-pressed={overdueOnly} onClick={() => reset(setOverdueOnly)(!overdueOnly)} className={`${FILTER_BTN} ${overdueOnly ? '!border-red-300 !text-red-600 bg-red-50' : ''}`}>
            <span className="material-symbols-outlined text-[18px]">event_busy</span>{t('jobs.filter.overdue')}
          </button>
          <Popover trigger={({ toggle }) => <FilterButton label={label('jobs.filter.sort')} value={t(`jobs.sort.${sort}`)} onClick={toggle} />}>
            {optionMenu(sort, (v) => reset(setSort)(v as JobSort), JOB_SORTS.map((s): [string, string] => [s, t(`jobs.sort.${s}`)]))}
          </Popover>
          </div>

          {canEdit && (
            <button onClick={() => openEditor('create')} className="h-9 px-4 bg-brand-accent hover:bg-brand-strong text-white rounded-full font-semibold flex items-center gap-1.5 transition-colors text-sm shrink-0">
              <span className="material-symbols-outlined text-[18px]">add</span> {t('jobs.new')}
            </button>
          )}
        </div>

        {/* No height cap: the box grows to show every row on the page (Rows per page) and the page scrolls. */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-[#e6dddb] dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white dark:bg-[#251f1e] sticky top-0 z-10">
                <tr>
                  {(['jobs.col.title', 'jobs.col.applicants', 'jobs.col.status', 'jobs.col.campaign', 'jobs.col.updated'] as const).map((k) => (
                    <th key={k} className={TH}>{t(k)}</th>
                  ))}
                  <th className={`${TH} w-24`}>{t('jobs.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {rows.map((job) => {
                  const s = stats.get(job.id)!;
                  const when = ago(s.updatedAt, now);
                  const menu = actionsFor(job);
                  return (
                    <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3 min-w-[300px]">
                        <div className="flex items-center gap-2">
                          <Link to={`/jobs/${job.id}`} className="font-semibold text-sm text-[#181211] dark:text-gray-100 group-hover:text-primary transition-colors">{job.title}</Link>
                          <PriorityBadge priority={priorityOf(job)} reason={job.urgencyReason} />
                        </div>
                        <div className="text-xs text-[#896a61] mt-0.5">{[job.department, job.location, job.level].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className={`${TD} group/cell`}><StageBar compact job={job} counts={stageCounts(applications, job.id)} /></td>
                      <td className={TD}><JobStatusBadge status={job.status} /></td>
                      <td className={TD}>
                        {(() => {
                          const c = job.campaignId ? campaignOf.get(job.campaignId) : undefined;
                          if (!c) return <span className="text-gray-300">—</span>;
                          return canCampaign
                            ? <Link to={`/campaigns/${c.id}`} title={c.name} className="block max-w-[180px] truncate hover:text-primary hover:underline">{c.name}</Link>
                            : <span title={c.name} className="block max-w-[180px] truncate">{c.name}</span>;
                        })()}
                      </td>
                      <td className={TD} title={new Date(s.updatedAt).toLocaleString()}>{t(`jobs.ago.${when.unit}`, { n: when.n })}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          {canEdit && (
                            <>
                              <button aria-label={`${t('jobs.menu.edit')} ${job.title}`} title={t('jobs.menu.edit')} onClick={() => openEditor('edit', job.id)} className={`${ROW_ICON} hover:text-primary`}>
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button aria-label={`${t('jobs.menu.duplicate')} ${job.title}`} title={t('jobs.menu.duplicate')} onClick={() => openEditor('duplicate', job.id)} className={`${ROW_ICON} hover:text-primary`}>
                                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                              </button>
                            </>
                          )}
                          <Popover
                            align="right"
                            trigger={({ toggle }) => (
                              <button aria-label={`${t('jobs.col.actions')} ${job.title}`} onClick={toggle} className={`${ROW_ICON} hover:text-slate-900 dark:hover:text-white`}>
                                <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                              </button>
                            )}
                          >
                            {(close) => (
                              <>
                                <MenuItem onClick={() => { close(); navigate(`/jobs/${job.id}`); }}>{t('jobs.menu.view')}</MenuItem>
                                {menu.map((a) => (
                                  <MenuItem key={a.id} onClick={() => { close(); a.run(); }}>{a.label}</MenuItem>
                                ))}
                              </>
                            )}
                          </Popover>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('jobs.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            labels={paginationLabels} page={page} pageSize={pageSize} total={filtered.length} noun={t('jobs.noun')} onPage={setPage}
            pageSizes={PAGE_SIZES} onPageSize={(n) => { setPageSize(n); setPage(1); }} rowsLabel={t('jobs.rowsPerPage')}
          />
        </div>
      </div>
      {dialog}
    </AppLayout>
  );
}

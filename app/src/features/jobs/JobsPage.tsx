import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Pagination, usePaginationLabels } from '../../components/Pagination';
import { MenuItem, Popover } from '../../components/Popover';
import { HIGH_MATCH, JOB_SORTS, jobStats, jobTag, sortJobs, type JobSort, type JobStats } from '../../domain/jobInsights';
import type { Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { stageCounts } from '../../store/selectors';
import { can, jobsInScope } from '../../domain/permissions';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { JobStatusBadge, JobTagChip, StageBar } from './JobBits';
import { JobDrawer } from './JobDrawer';
import { ago } from './jobForm';
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
  const [params, setParams] = useSearchParams();
  const { jobs: allJobs, jds, applications, activities, campaigns } = useStore();
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
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [sort, setSort] = useState<JobSort>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const fromJd = params.get('fromJd');
  const [editor, setEditor] = useState<{ job?: Job; copyFrom?: Job; jdId?: string } | null>(
    !can(user, 'job.edit') ? null
      : fromJd && jds.some((j) => j.id === fromJd) ? { jdId: fromJd }
      // `?new=1` (end of sign-up): open an empty job form straight away.
      : params.get('new') === '1' ? {} : null,
  );
  const closeEditor = () => {
    setEditor(null);
    if (params.has('fromJd') || params.has('new')) {
      params.delete('fromJd');
      params.delete('new');
      setParams(params, { replace: true });
    }
  };
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const now = Date.now();
  const stats = useMemo(() => {
    const m = new Map<string, JobStats>();
    for (const j of jobs) m.set(j.id, jobStats(j, applications, activities, now));
    return m;
    // `now` moves every render; the numbers only need to follow the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, applications, activities]);

  // Campaigns each job runs in, active ones first.
  const campaignsByJob = useMemo(() => {
    const rank = { active: 0, paused: 1, ended: 2 } as const;
    const m = new Map<string, typeof campaigns>();
    for (const c of [...campaigns].sort((a, b) => rank[a.status] - rank[b.status])) {
      for (const id of c.jobIds) m.set(id, [...(m.get(id) ?? []), c]);
    }
    return m;
  }, [campaigns]);

  const departments = useMemo(() => [...new Set(jobs.map((j) => j.department))].sort(), [jobs]);
  const locations = useMemo(() => [...new Set(jobs.map((j) => j.location))].sort(), [jobs]);
  const filtered = useMemo(
    () =>
      sortJobs(
        jobs.filter(
          (j) =>
            (!q.trim() || has(j.title, q) || has(j.department, q) || has(j.location, q)) &&
            (!status || j.status === status) &&
            (!department || j.department === department) &&
            (!location || j.location === location),
        ),
        sort,
        stats,
      ),
    [jobs, q, status, department, location, sort, stats],
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
  const label = (key: 'jobs.filter.status' | 'jobs.filter.department' | 'jobs.filter.location' | 'jobs.filter.sort') => t(key, { value: '' }).replace(/\s*$/, '');
  const statuses: Job['status'][] = ['open', 'pending_approval', 'on_hold', 'draft', 'closed'];

  return (
    <AppLayout title={t('nav.jobs')} subtitle={t('jobs.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-5 min-h-full">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61]">search</span>
            <input
              aria-label={t('jobs.searchToggle')}
              className="h-9 w-72 pl-9 pr-3 rounded-full bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 text-sm text-[#181211] dark:text-white placeholder-[#896a61]"
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
          <Popover trigger={({ toggle }) => <FilterButton label={label('jobs.filter.location')} value={location || all[1]} onClick={toggle} />}>
            {optionMenu(location, reset(setLocation), [all, ...locations.map((l): [string, string] => [l, l])])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton label={label('jobs.filter.sort')} value={t(`jobs.sort.${sort}`)} onClick={toggle} />}>
            {optionMenu(sort, (v) => reset(setSort)(v as JobSort), JOB_SORTS.map((s): [string, string] => [s, t(`jobs.sort.${s}`)]))}
          </Popover>

          {canEdit && (
            <button onClick={() => setEditor({})} className="ml-auto h-9 px-4 bg-brand-accent hover:bg-brand-strong text-white rounded-full font-semibold flex items-center gap-1.5 transition-colors text-sm shrink-0">
              <span className="material-symbols-outlined text-[18px]">add</span> {t('jobs.new')}
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-[#e6dddb] dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white dark:bg-[#251f1e] sticky top-0 z-10">
                <tr>
                  {(['jobs.col.title', 'jobs.col.applicants', 'jobs.col.aiMatch', 'jobs.col.status', 'jobs.col.campaign', 'jobs.col.updated'] as const).map((k) => (
                    <th key={k} className={TH}>{t(k)}</th>
                  ))}
                  <th className={`${TH} w-24`}>{t('jobs.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {rows.map((job) => {
                  const s = stats.get(job.id)!;
                  const tag = jobTag(job, s, now);
                  const when = ago(s.updatedAt, now);
                  const menu = actionsFor(job);
                  return (
                    <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3 min-w-[300px]">
                        <div className="flex items-center gap-2">
                          <Link to={`/jobs/${job.id}`} className="font-semibold text-sm text-[#181211] dark:text-gray-100 group-hover:text-primary transition-colors">{job.title}</Link>
                          {tag && <JobTagChip tag={tag} />}
                        </div>
                        <div className="text-xs text-[#896a61] mt-0.5">{[job.department, job.location, job.level].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className={TD}><StageBar compact job={job} counts={stageCounts(applications, job.id)} /></td>
                      <td className={TD}>
                        {s.aiAvg === undefined ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={s.aiAvg >= HIGH_MATCH ? 'font-semibold text-emerald-600' : 'font-medium'}>{s.aiAvg}%</span>
                        )}
                      </td>
                      <td className={TD}><JobStatusBadge status={job.status} /></td>
                      <td className={TD}>
                        {(() => {
                          const cs = campaignsByJob.get(job.id) ?? [];
                          if (cs.length === 0) return <span className="text-gray-300">—</span>;
                          return (
                            <span className="flex items-center gap-1.5" title={cs.map((c) => c.name).join('\n')}>
                              {canCampaign ? <Link to={`/campaigns/${cs[0].id}`} className="max-w-[180px] truncate hover:text-primary hover:underline">{cs[0].name}</Link> : <span className="max-w-[180px] truncate">{cs[0].name}</span>}
                              {cs.length > 1 && <span className="text-xs text-[#896a61]">+{cs.length - 1}</span>}
                            </span>
                          );
                        })()}
                      </td>
                      <td className={TD} title={new Date(s.updatedAt).toLocaleString()}>{t(`jobs.ago.${when.unit}`, { n: when.n })}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          {canEdit && (
                            <>
                              <button aria-label={`${t('jobs.menu.edit')} ${job.title}`} title={t('jobs.menu.edit')} onClick={() => setEditor({ job })} className={`${ROW_ICON} hover:text-primary`}>
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button aria-label={`${t('jobs.menu.duplicate')} ${job.title}`} title={t('jobs.menu.duplicate')} onClick={() => setEditor({ copyFrom: job })} className={`${ROW_ICON} hover:text-primary`}>
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
      <JobDrawer open={editor !== null} jdId={editor?.jdId} job={editor?.job} copyFrom={editor?.copyFrom} onClose={closeEditor} />
      {dialog}
    </AppLayout>
  );
}

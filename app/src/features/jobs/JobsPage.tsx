import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Pagination, usePaginationLabels } from '../../components/Pagination';
import { MenuItem, Popover } from '../../components/Popover';
import { toast } from '../../components/Toast';
import type { Job } from '../../domain/types';
import { userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { stageCounts } from '../../store/selectors';
import { useStore } from '../../store/store';
import { JobStatusBadge, StageBar } from './JobBits';
import { JobDrawer } from './JobDrawer';
import { daysOpen } from './jobForm';

const PAGE_SIZE = 10;
const FILTER_BTN =
  'flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm font-medium text-[#181211] dark:text-white hover:border-primary/50 transition-colors whitespace-nowrap ';
const INPUT =
  'w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] focus:border-primary focus:ring-0 rounded-lg text-sm text-[#181211] dark:text-white transition-all placeholder-[#896a61]';
const TH = 'px-6 py-4 text-xs font-bold text-[#896a61] uppercase tracking-wider border-b border-[#e6dddb] dark:border-[#2a2423]  ';
const TD = 'px-6 py-4 whitespace-nowrap ';

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());

function FilterButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={FILTER_BTN}>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">{icon}</span>
      <span>{label}</span>
      <span className="material-symbols-outlined text-[18px] text-[#896a61]">expand_more</span>
    </button>
  );
}

export function JobsPage() {
  const t = useT();
  const paginationLabels = usePaginationLabels();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { jobs, jds, applications, users } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [page, setPage] = useState(1);
  const fromJd = params.get('fromJd');
  const [editor, setEditor] = useState<{ job?: Job; jdId?: string } | null>(
    fromJd && jds.some((j) => j.id === fromJd) ? { jdId: fromJd } : null,
  );
  const closeEditor = () => {
    setEditor(null);
    if (params.has('fromJd')) {
      params.delete('fromJd');
      setParams(params, { replace: true });
    }
  };
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const departments = useMemo(() => [...new Set(jobs.map((j) => j.department))].sort(), [jobs]);
  const locations = useMemo(() => [...new Set(jobs.map((j) => j.location))].sort(), [jobs]);
  const filtered = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (!q.trim() || has(j.title, q) || has(j.department, q) || has(j.location, q)) &&
          (!status || j.status === status) &&
          (!department || j.department === department) &&
          (!location || j.location === location),
      ),
    [jobs, q, status, department, location],
  );
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setJobStatus = (job: Job, next: Job['status']) => {
    useStore.getState().setJobStatus(job.id, next);
    toast(t(next === 'open' ? 'jobs.toast.published' : 'jobs.toast.closed'));
  };

  const optionMenu = (value: string, set: (v: string) => void, options: Array<[string, string]>) => (close: () => void) => (
    <>
      {options.map(([v, label]) => (
        <MenuItem key={v} active={v === value} onClick={() => { set(v); close(); }}>{label}</MenuItem>
      ))}
    </>
  );
  const all: [string, string] = ['', t('jobs.filter.all')];
  const statusLabel = status ? t(`jobs.status.${status as Job['status']}`) : all[1];

  const createButton = (
    <button onClick={() => setEditor({})} className="px-6 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform active:scale-95 text-sm shrink-0">
      <span className="material-symbols-outlined text-[20px]">add</span> {t('jobs.create')}
    </button>
  );

  return (
    <AppLayout title={t('nav.jobs')} subtitle={t('jobs.subtitle')} actions={createButton}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-8 min-h-full">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px] max-w-md relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#896a61] group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input className={INPUT} placeholder={t('jobs.search')} type="text" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          </div>
          <Popover trigger={({ toggle }) => <FilterButton icon="radio_button_checked" label={t('jobs.filter.status', { value: statusLabel })} onClick={toggle} />}>
            {optionMenu(status, reset(setStatus), [all, ['open', t('jobs.status.open')], ['draft', t('jobs.status.draft')], ['closed', t('jobs.status.closed')]])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton icon="corporate_fare" label={t('jobs.filter.department', { value: department || all[1] })} onClick={toggle} />}>
            {optionMenu(department, reset(setDepartment), [all, ...departments.map((d): [string, string] => [d, d])])}
          </Popover>
          <Popover trigger={({ toggle }) => <FilterButton icon="location_on" label={t('jobs.filter.location', { value: location || all[1] })} onClick={toggle} />}>
            {optionMenu(location, reset(setLocation), [all, ...locations.map((l): [string, string] => [l, l])])}
          </Popover>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] sticky top-0 z-10">
                <tr>
                  {(['jobs.col.title', 'jobs.col.department', 'jobs.col.location', 'jobs.col.level', 'jobs.col.status', 'jobs.col.applicants', 'jobs.col.daysOpen', 'jobs.col.manager'] as const).map((k) => (
                    <th key={k} className={TH}>{t(k)}</th>
                  ))}
                  <th className="px-6 py-4 w-16 border-b border-[#e6dddb] dark:border-[#2a2423] text-xs font-bold text-[#896a61] uppercase tracking-wider text-center">{t('jobs.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
                {rows.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                    <td className={TD}>
                      <div className="flex gap-4 items-center">
                        <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50 text-orange-500">
                          <span className="material-symbols-outlined">work</span>
                        </div>
                        <Link to={`/jobs/${job.id}`} className="font-bold text-sm text-slate-800 dark:text-gray-200 group-hover:text-primary transition-colors">{job.title}</Link>
                      </div>
                    </td>
                    <td className={`${TD} text-sm font-semibold text-slate-600 dark:text-gray-400`}>{job.department}</td>
                    <td className={`${TD} text-sm font-semibold text-slate-600 dark:text-gray-400`}>{job.location}</td>
                    <td className={`${TD} text-sm font-semibold text-slate-600 dark:text-gray-400`}>{job.level}</td>
                    <td className={TD}><JobStatusBadge status={job.status} /></td>
                    <td className={TD}><StageBar counts={stageCounts(applications, job.id)} /></td>
                    <td className={`${TD} text-sm font-bold text-gray-500`}>
                      {job.status === 'draft' ? <span className="text-gray-300">—</span> : t('jobs.days', { n: daysOpen(job) })}
                    </td>
                    <td className={`${TD} text-sm font-semibold text-slate-600 dark:text-gray-400`}>{userName(users, job.hiringManager)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Popover
                        align="right"
                        trigger={({ toggle }) => (
                          <button aria-label={`${t('jobs.col.actions')} ${job.title}`} onClick={toggle} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-slate-900 dark:hover:text-white">
                            <span className="material-symbols-outlined">more_horiz</span>
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <MenuItem onClick={() => { close(); navigate(`/jobs/${job.id}`); }}>{t('jobs.menu.view')}</MenuItem>
                            <MenuItem onClick={() => { close(); setEditor({ job }); }}>{t('jobs.menu.edit')}</MenuItem>
                            {job.status !== 'open' && <MenuItem onClick={() => { close(); setJobStatus(job, 'open'); }}>{t(job.status === 'closed' ? 'jobs.menu.reopen' : 'jobs.menu.publish')}</MenuItem>}
                            {job.status === 'open' && <MenuItem onClick={() => { close(); setJobStatus(job, 'closed'); }}>{t('jobs.menu.close')}</MenuItem>}
                          </>
                        )}
                      </Popover>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-10 text-center text-sm text-[#896a61]">{t('jobs.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination labels={paginationLabels} page={page} pageSize={PAGE_SIZE} total={filtered.length} noun={t('jobs.noun')} onPage={setPage} />
        </div>
      </div>
      <JobDrawer open={editor !== null} jdId={editor?.jdId} job={editor?.job} onClose={closeEditor} />
    </AppLayout>
  );
}

import { MenuItem, Popover } from '../../components/Popover';
import type { Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { AddFromPoolButton } from './AddFromPoolModal';

export type PipelineView = 'kanban' | 'list';
export type PipelineQuery = { text: string; source: string };

type Props = {
  job: Job;
  /** Omit inside a job's own page, where the job is fixed. */
  switchable?: Job[];
  onSwitch?: (jobId: string) => void;
  summary: { total: number; overdue: number; daysOpen: number };
  sources: string[];
  query: PipelineQuery;
  onQuery: (q: PipelineQuery) => void;
  view: PipelineView;
  onView: (v: PipelineView) => void;
  /** The job has no applications: only the Add button is useful. */
  empty?: boolean;
};

const FIELD = 'h-9 rounded-full bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] text-sm text-slate-700 dark:text-white';

/** Compact bar over the board: job switcher, summary, search, source filter, view toggle, add-from-pool. */
export function PipelineHeader({ job, switchable, onSwitch, summary, sources, query, onQuery, view, onView, empty }: Props) {
  const t = useT();
  const toggle = (v: PipelineView, icon: string, label: string, text: string) => (
    <button
      key={v}
      aria-label={label}
      aria-pressed={view === v}
      title={label}
      onClick={() => onView(v)}
      className={`h-7 px-2.5 rounded-full flex items-center gap-1 text-xs font-bold ${view === v ? 'bg-primary text-white' : 'text-[#896a61] hover:bg-[#f8f6f6] dark:hover:bg-white/5'}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span>
      {text}
    </button>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      {switchable && onSwitch && <Popover
        align="left"
        trigger={({ toggle: open }) => (
          <button onClick={open} className={`${FIELD} px-4 font-bold flex items-center gap-2 hover:border-primary/50 transition-colors max-w-[170px]`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-[#896a61] shrink-0">work</span>
            <span className="truncate">{t('pipeline.job', { title: job.title })}</span>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] shrink-0">expand_more</span>
          </button>
        )}
      >
        {(close) =>
          switchable.map((j) => (
            <MenuItem key={j.id} active={j.id === job.id} onClick={() => { close(); onSwitch(j.id); }}>
              {j.title}
            </MenuItem>
          ))
        }
      </Popover>}
      <span className="text-sm text-[#896a61] whitespace-nowrap">{t('pipeline.summary', { total: summary.total, overdue: summary.overdue, days: summary.daysOpen })}</span>
      {empty ? <span className="ml-auto" /> : <>
      <input
        type="search"
        value={query.text}
        onChange={(e) => onQuery({ ...query, text: e.target.value })}
        placeholder={t('pipeline.search')}
        aria-label={t('pipeline.search')}
        className={`${FIELD} px-4 w-36 ml-auto focus:outline-none focus:border-primary/50`}
      />
      <select
        value={query.source}
        onChange={(e) => onQuery({ ...query, source: e.target.value })}
        aria-label={t('pipeline.allSources')}
        className={`${FIELD} px-3`}
      >
        <option value="">{t('pipeline.allSources')}</option>
        {sources.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="flex items-center gap-0.5 p-1 rounded-full bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433]">
        {toggle('kanban', 'view_kanban', t('pipeline.viewKanban'), t('pipeline.viewKanbanShort'))}
        {toggle('list', 'view_list', t('pipeline.viewList'), t('pipeline.viewListShort'))}
      </div>
      </>}
      <AddFromPoolButton jobId={job.id} />
    </div>
  );
}

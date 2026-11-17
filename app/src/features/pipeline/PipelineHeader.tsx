import { MenuItem, Popover } from '../../components/Popover';
import type { Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { AddFromPoolButton } from './AddFromPoolModal';

export type PipelineView = 'kanban' | 'list';
export type PipelineQuery = { text: string; source: string };

type Props = {
  job: Job;
  switchable: Job[];
  onSwitch: (jobId: string) => void;
  summary: { total: number; overdue: number; daysOpen: number };
  sources: string[];
  query: PipelineQuery;
  onQuery: (q: PipelineQuery) => void;
  view: PipelineView;
  onView: (v: PipelineView) => void;
};

const FIELD = 'h-9 rounded-full bg-white dark:bg-[#2a2423] border border-[#e6dddb] dark:border-[#3a3433] text-sm text-slate-700 dark:text-white';

/** Compact bar over the board: job switcher, summary, search, source filter, view toggle, add-from-pool. */
export function PipelineHeader({ job, switchable, onSwitch, summary, sources, query, onQuery, view, onView }: Props) {
  const t = useT();
  const toggle = (v: PipelineView, icon: string, label: string) => (
    <button
      key={v}
      aria-label={label}
      aria-pressed={view === v}
      title={label}
      onClick={() => onView(v)}
      className={`size-7 rounded-full flex items-center justify-center ${view === v ? 'bg-primary text-white' : 'text-[#896a61] hover:bg-[#f8f6f6] dark:hover:bg-white/5'}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <Popover
        align="left"
        trigger={({ toggle: open }) => (
          <button onClick={open} className={`${FIELD} px-4 font-bold flex items-center gap-2 hover:border-primary/50 transition-colors max-w-[240px]`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-[#896a61]">work</span>
            <span className="truncate">{t('pipeline.job', { title: job.title })}</span>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">expand_more</span>
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
      </Popover>
      <span className="text-sm text-[#896a61] whitespace-nowrap">{t('pipeline.summary', { total: summary.total, overdue: summary.overdue, days: summary.daysOpen })}</span>
      <input
        type="search"
        value={query.text}
        onChange={(e) => onQuery({ ...query, text: e.target.value })}
        placeholder={t('pipeline.search')}
        aria-label={t('pipeline.search')}
        className={`${FIELD} px-4 w-40 ml-auto focus:outline-none focus:border-primary/50`}
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
        {toggle('kanban', 'view_kanban', t('pipeline.viewKanban'))}
        {toggle('list', 'view_list', t('pipeline.viewList'))}
      </div>
      <AddFromPoolButton jobId={job.id} />
    </div>
  );
}

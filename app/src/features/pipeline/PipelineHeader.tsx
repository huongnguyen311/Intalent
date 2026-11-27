import { useState } from 'react';
import type { Job, Stage } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useCan } from '../../store/session';
import { AddToPipelineModal } from '../candidates/AddToPipelineModal';

export type PipelineView = 'kanban' | 'list';
export type PipelineQuery = { text: string; source: string; stage: Stage | ''; recruiter: string; sinceDays: number; minScore: number };
export const EMPTY_QUERY: PipelineQuery = { text: '', source: '', stage: '', recruiter: '', sinceDays: 0, minScore: 0 };
export type PipelineSort = 'board' | 'ai';

type Props = {
  /** The job on screen; omitted = "All jobs". */
  job?: Job;
  /** Jobs offered by the job filter; omit inside a job's own page, where the job is fixed. */
  switchable?: Job[];
  /** Picks a job; '' = All jobs. */
  onSwitch?: (jobId: string) => void;
  query: PipelineQuery;
  onQuery: (q: PipelineQuery) => void;
  view: PipelineView;
  onView: (v: PipelineView) => void;
  /** No applications in scope: no search or view toggle. */
  empty?: boolean;
  /** Opens Pipeline settings (rounds, SLA, automation); omitted = no button. */
  onConfigure?: () => void;
};

const FIELD = 'h-9 rounded-full bg-white dark:bg-dark-raised border border-line dark:border-dark-line text-sm text-slate-700 dark:text-white';

/** Bar over the board: search, then the "Job" filter (All jobs by default); on the right the icon view toggle, settings and "Add from Candidate Pool". */
export function PipelineHeader({ job, switchable, onSwitch, query, onQuery, view, onView, empty, onConfigure }: Props) {
  // Adding from the Candidate Pool needs pool access (not Hiring Managers).
  const canAdd = useCan()('pool');
  const [addOpen, setAddOpen] = useState(false);
  const t = useT();
  // Icon-only segmented toggle; the name stays in aria-label and the tooltip.
  const toggle = (v: PipelineView, icon: string, label: string) => (
    <button
      key={v}
      aria-label={label}
      aria-pressed={view === v}
      title={label}
      onClick={() => onView(v)}
      className={`ui-seg-item size-7 rounded-full flex items-center justify-center ${view === v ? 'bg-primary text-white' : 'text-ink-muted hover:bg-background-light dark:hover:bg-white/5'}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
  return (
    <div className="flex items-center gap-3 flex-wrap mb-3">
      {!empty && (
        <div className={`${FIELD} w-64 flex items-center gap-2 pl-3.5 pr-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-colors`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-ink-muted shrink-0">search</span>
          <input
            type="search"
            value={query.text}
            onChange={(e) => onQuery({ ...query, text: e.target.value })}
            placeholder={t('pipeline.search')}
            aria-label={t('pipeline.search')}
            className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm focus:outline-none focus:ring-0 placeholder:text-[#b3a29d]"
          />
        </div>
      )}
      {switchable && onSwitch && (
        <label className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-ink-muted shrink-0">{t('pipeline.filter.job')}</span>
          <select
            aria-label={t('pipeline.filter.job')}
            value={job?.id ?? ''}
            onChange={(e) => onSwitch(e.target.value)}
            className={`${FIELD} pl-4 pr-9 font-bold max-w-[260px] truncate cursor-pointer hover:border-primary/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10`}
          >
            <option value="">{t('pipeline.allJobs')}</option>
            {switchable.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </label>
      )}
      <span className="ml-auto" />
      {!empty && (
        <div className="ui-seg flex items-center gap-0.5 p-1 rounded-full bg-white dark:bg-dark-raised border border-line dark:border-dark-line">
          {toggle('kanban', 'view_kanban', t('pipeline.viewKanban'))}
          {toggle('list', 'view_list', t('pipeline.viewList'))}
        </div>
      )}
      {onConfigure && (
        <button onClick={onConfigure} aria-label={t('pipeline.config.open')} title={t('pipeline.config.open')} className={`${FIELD} w-9 flex items-center justify-center text-ink-muted hover:border-primary/50 hover:text-primary`}>
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">tune</span>
        </button>
      )}
      {/* A fixed job must be open; on "All jobs" the dialog asks which open job. */}
      {canAdd && (!job || job.status === 'open') && (
        <button
          onClick={() => setAddOpen(true)}
          className="h-9 px-4 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">person_add</span>
          {t('pipeline.addFromPool')}
        </button>
      )}
      {canAdd && <AddToPipelineModal open={addOpen} jobId={job?.id} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

import { jobStageLabel, jobStages } from '../../domain/pipelineConfig';
import { STAGES, stageLabel } from '../../domain/stages';
import type { JobTag } from '../../domain/jobInsights';
import type { Job, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';

const STATUS_STYLE: Record<Job['status'], { pill: string; dot: string }> = {
  open: { pill: 'bg-[#ECFDF5] text-[#10B981]', dot: 'bg-[#10B981]' },
  draft: { pill: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  pending_approval: { pill: 'bg-violet-50 text-violet-600', dot: 'bg-violet-500' },
  on_hold: { pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  closed: { pill: 'bg-red-50 text-red-500', dot: 'bg-red-400' },
};

export function JobStatusBadge({ status }: { status: Job['status'] }) {
  const t = useT();
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold ${s.pill}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`}></span>
      {t(`jobs.status.${status}`)}
    </span>
  );
}

const TAG_STYLE: Record<JobTag, { cls: string; icon: string }> = {
  high_match: { cls: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'workspace_premium' },
  fast_hiring: { cls: 'bg-sky-50 text-sky-700 border-sky-100', icon: 'local_fire_department' },
  needs_attention: { cls: 'bg-rose-50 text-rose-600 border-rose-100', icon: 'error' },
};

/** Highlight chip next to a job title on the Jobs list. */
export function JobTagChip({ tag }: { tag: JobTag }) {
  const t = useT();
  const s = TAG_STYLE[tag];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-2xs font-semibold whitespace-nowrap ${s.cls}`}>
      <span className="material-symbols-outlined text-[13px]">{s.icon}</span>
      {t(`jobs.tag.${tag}`)}
    </span>
  );
}

export const STAGE_COLOR: Record<Stage, string> = {
  new: '#94a3b8',
  ai_screening: '#06b6d4',
  screening: '#3b82f6',
  interview: '#8b5cf6',
  assessment: '#a855f7',
  final_interview: '#d946ef',
  custom_1: '#0ea5e9',
  custom_2: '#14b8a6',
  custom_3: '#84cc16',
  custom_4: '#eab308',
  custom_5: '#ec4899',
  custom_6: '#6366f1',
  offer: '#F97316',
  hired: '#10b981',
  rejected: '#ef4444',
  withdrawn: '#64748b',
};

/** Proportional segments per stage with a hover legend. */
/** `compact` fits the Jobs table at 1440px; elsewhere the bar keeps its full width. */
/** With `job`, the legend lists only that job's columns, in its order and with its own names (no unused custom slots). */
export function StageBar({ counts, compact, job }: { counts: Record<Stage, number>; compact?: boolean; job?: Pick<Job, 'pipeline' | 'stageNames'> }) {
  const t = useT();
  const [lang] = useLang();
  const total = STAGES.reduce((n, s) => n + counts[s], 0);
  const used = STAGES.filter((s) => counts[s] > 0).map((stage) => ({ stage }));
  const stages = job ? jobStages(job, used) : STAGES;
  const label = (s: Stage) => (job ? jobStageLabel(job, s, lang) : stageLabel(s, lang));
  return (
    <div className={`relative group ${compact ? 'w-28' : 'w-40'}`}>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {stages.filter((s) => counts[s] > 0).map((s) => (
          <div key={s} data-stage={s} style={{ width: `${(counts[s] / total) * 100}%`, background: STAGE_COLOR[s] }} />
        ))}
      </div>
      <div className="text-2xs font-bold text-muted mt-1">{t('jobs.bar.total', { n: total })}</div>
      <div role="tooltip" className="hidden group-hover:block absolute left-0 top-full mt-1 z-20 bg-white border border-gray-100 shadow-lg rounded-xl p-3 w-52 space-y-1">
        {stages.map((s) => (
          <div key={s} className="flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[s] }}></span>
              <span className="truncate">{label(s)}</span>
            </span>
            <span className="font-bold">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { STAGES, stageLabel } from '../../domain/stages';
import type { Job, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';

const STATUS_STYLE: Record<Job['status'], { pill: string; dot: string }> = {
  open: { pill: 'bg-[#ECFDF5] text-[#10B981]', dot: 'bg-[#10B981]' },
  draft: { pill: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  closed: { pill: 'bg-red-50 text-red-500', dot: 'bg-red-400' },
};

export function JobStatusBadge({ status }: { status: Job['status'] }) {
  const t = useT();
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${s.pill}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`}></span>
      {t(`jobs.status.${status}`)}
    </span>
  );
}

export const STAGE_COLOR: Record<Stage, string> = {
  new: '#94a3b8',
  screening: '#3b82f6',
  interview: '#8b5cf6',
  offer: '#F97316',
  hired: '#10b981',
  rejected: '#ef4444',
};

/** Proportional segments per stage with a hover legend. */
export function StageBar({ counts }: { counts: Record<Stage, number> }) {
  const t = useT();
  const [lang] = useLang();
  const total = STAGES.reduce((n, s) => n + counts[s], 0);
  return (
    <div className="relative group w-40">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {STAGES.filter((s) => counts[s] > 0).map((s) => (
          <div key={s} data-stage={s} style={{ width: `${(counts[s] / total) * 100}%`, background: STAGE_COLOR[s] }} />
        ))}
      </div>
      <div className="text-[10px] font-bold text-gray-400 mt-1">{t('jobs.bar.total', { n: total })}</div>
      <div role="tooltip" className="hidden group-hover:block absolute left-0 top-full mt-1 z-20 bg-white border border-gray-100 shadow-lg rounded-xl p-3 w-44 space-y-1">
        {STAGES.map((s) => (
          <div key={s} className="flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[s] }}></span>
              {stageLabel(s, lang)}
            </span>
            <span className="font-bold">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

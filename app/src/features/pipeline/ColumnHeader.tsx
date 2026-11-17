import { stageLabel } from '../../domain/stages';
import type { StageMetrics } from '../../domain/pipeline';
import type { Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { STAGE_COLOR } from '../jobs/JobBits';

type Props = {
  stage: Stage;
  /** Visible (filtered) cards in the column. */
  count: number;
  metrics: StageMetrics;
  onToggleCollapse?: () => void;
};

/** Expanded column title: stage + count, SLA / late line, and the stage's share of the job's applications. */
export function ColumnHeader({ stage, count, metrics, onToggleCollapse }: Props) {
  const t = useT();
  const [lang] = useLang();
  const color = STAGE_COLOR[stage];
  const name = stageLabel(stage, lang);
  const { sla, overdue, share } = metrics;
  return (
    <header
      data-testid="column-header"
      className="mb-2 rounded-lg border-l-[3px] px-2 py-1.5"
      style={{ borderLeftColor: color, background: `${color}14` }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{name}</span>
        <span className="flex items-center gap-1 shrink-0">
          <span data-testid="column-count" className="min-w-6 px-2 py-0.5 rounded-full bg-white dark:bg-[#2a2423] border border-gray-100 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-gray-300 text-center">
            {count}
          </span>
          {onToggleCollapse && (
            <button
              aria-label={t('pipeline.collapse', { stage: name })}
              title={t('pipeline.collapse', { stage: name })}
              onClick={onToggleCollapse}
              className="size-6 rounded-full flex items-center justify-center text-[#896a61] hover:text-primary hover:bg-white dark:hover:bg-white/5"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          )}
        </span>
      </div>
      {sla !== undefined && (
        <div className={`mt-0.5 text-[11px] font-semibold truncate ${overdue > 0 ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
          {overdue > 0 ? t('pipeline.col.sla', { days: sla, n: overdue }) : t('pipeline.col.onTime', { days: sla })}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-white dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${share}%`, background: color }} />
        </div>
        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">{share}%</span>
      </div>
    </header>
  );
}

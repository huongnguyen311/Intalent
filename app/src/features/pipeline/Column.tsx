import { useDroppable } from '@dnd-kit/core';
import { stageLabel } from '../../domain/stages';
import type { StageMetrics } from '../../domain/pipeline';
import type { Application, Candidate, Job, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { STAGE_COLOR } from '../jobs/JobBits';
import { CandidateCard } from './CandidateCard';
import { ColumnHeader } from './ColumnHeader';

type Props = {
  stage: Stage;
  apps: Application[];
  candidates: Map<string, Candidate>;
  job: Job;
  /** SLA / late / share numbers computed from the job's unfiltered applications. */
  metrics: StageMetrics;
  onOpen: (appId: string) => void;
  onMove: (appId: string, to: Stage) => void;
  /** Collapsed: a narrow strip that is still a drop target for its stage. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function Column({ stage, apps, candidates, job, metrics, onOpen, onMove, collapsed, onToggleCollapse }: Props) {
  const t = useT();
  const [lang] = useLang();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const over = isOver ? 'border-primary/50 bg-orange-50/60 dark:bg-white/5' : 'border-gray-100 dark:border-white/10 bg-[#f8f6f6] dark:bg-[#1a1a1a]';
  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        data-testid={`column-${stage}`}
        aria-label={stageLabel(stage, lang)}
        className={`w-12 shrink-0 flex flex-col items-center gap-2 rounded-2xl border py-2 transition-colors ${over}`}
      >
        <button
          aria-label={t('pipeline.expand', { stage: stageLabel(stage, lang) })}
          title={t('pipeline.expand', { stage: stageLabel(stage, lang) })}
          onClick={onToggleCollapse}
          className="size-7 rounded-full flex items-center justify-center text-[#896a61] hover:text-primary hover:bg-white dark:hover:bg-white/5"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <span data-testid="column-count" className="min-w-6 px-2 py-0.5 rounded-full bg-white dark:bg-[#2a2423] border border-gray-100 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-gray-300 text-center">
          {apps.length}
        </span>
        <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[stage] }}></span>
        <span style={{ writingMode: 'vertical-rl' }} className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
          {stageLabel(stage, lang)}
        </span>
      </section>
    );
  }
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${stage}`}
      aria-label={stageLabel(stage, lang)}
      className={`flex-1 min-w-[160px] flex flex-col rounded-2xl border p-2 transition-colors ${over}`}
    >
      <ColumnHeader
        stage={stage}
        count={apps.length}
        metrics={metrics}
        onToggleCollapse={onToggleCollapse}
      />
      <div className="flex-1 flex flex-col gap-1.5 min-h-[80px]">
        {apps.map((a) => (
          <CandidateCard
            key={a.id}
            app={a}
            candidate={candidates.get(a.candidateId)}
            job={job}
            onOpen={() => onOpen(a.id)}
            onMove={(to) => onMove(a.id, to)}
          />
        ))}
        {apps.length === 0 && (
          <div className="flex-1 rounded-xl border-2 border-dashed border-[#e6dddb] dark:border-[#3a3433] flex items-center justify-center text-xs text-gray-400 py-4">
            {t('pipeline.dropHere')}
          </div>
        )}
      </div>
    </section>
  );
}

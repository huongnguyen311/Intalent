import { useDroppable } from '@dnd-kit/core';
import { stageLabel } from '../../domain/stages';
import type { Application, Candidate, Job, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { STAGE_COLOR } from '../jobs/JobBits';
import { CandidateCard } from './CandidateCard';

type Props = {
  stage: Stage;
  apps: Application[];
  candidates: Map<string, Candidate>;
  job: Job;
  onOpen: (appId: string) => void;
  onMove: (appId: string, to: Stage) => void;
};

export function Column({ stage, apps, candidates, job, onOpen, onMove }: Props) {
  const t = useT();
  const [lang] = useLang();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${stage}`}
      aria-label={stageLabel(stage, lang)}
      className={`flex-1 min-w-[160px] flex flex-col rounded-2xl border p-3 transition-colors ${isOver ? 'border-primary/50 bg-orange-50/60 dark:bg-white/5' : 'border-gray-100 dark:border-white/10 bg-[#f8f6f6] dark:bg-[#1a1a1a]'}`}
    >
      <header className="flex items-center justify-between px-1 pb-3">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[stage] }}></span>
          {stageLabel(stage, lang)}
        </span>
        <span data-testid="column-count" className="min-w-6 px-2 py-0.5 rounded-full bg-white dark:bg-[#2a2423] border border-gray-100 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-gray-300 text-center">
          {apps.length}
        </span>
      </header>
      <div className="flex-1 flex flex-col gap-3 min-h-[120px]">
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
          <div className="flex-1 rounded-xl border-2 border-dashed border-[#e6dddb] dark:border-[#3a3433] flex items-center justify-center text-xs text-gray-400 py-8">
            {t('pipeline.dropHere')}
          </div>
        )}
      </div>
    </section>
  );
}

import { useStageName } from './jobStageContext';
import { useDroppable } from '@dnd-kit/core';
import type { Application, Candidate, Job, Stage } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { STAGE_COLOR } from '../jobs/JobBits';
import { CandidateCard } from './CandidateCard';
import { ColumnHeader } from './ColumnHeader';
import { JobStageProvider } from './jobStageContext';

type Props = {
  stage: Stage;
  apps: Application[];
  candidates: Map<string, Candidate>;
  /** The job each card belongs to (one job, or many on the "All jobs" board). */
  jobOf: (app: Application) => Job;
  /** "All jobs" board: cards name their job and offer that job's own columns. */
  showJob?: boolean;
  onOpen: (appId: string) => void;
  onMove: (appId: string, to: Stage) => void;
  /** Bulk selection (ids across the whole board); omit to hide checkboxes. */
  selected?: Set<string>;
  onSelect?: (ids: string[], on: boolean) => void;
};

export function Column({ stage, apps, candidates, jobOf, showJob, onOpen, onMove, selected, onSelect }: Props) {
  const t = useT();
  const label = useStageName();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const over = isOver ? 'border-primary/50 bg-orange-50/60 dark:bg-white/5' : 'bg-slate-50 dark:bg-[#1a1a1a]';
  // Each column carries only a whisper of its stage colour (very light wash + border) so the board stays easy on the eyes.
  const color = STAGE_COLOR[stage];
  const tint = isOver
    ? undefined
    : {
        backgroundImage: `linear-gradient(to bottom, ${color}0a, transparent 35%)`,
        borderColor: `${color}26`,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      };
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${stage}`}
      aria-label={label(stage)}
      className={`w-[252px] shrink-0 flex flex-col rounded-xl border overflow-hidden p-2 transition-[background-color,box-shadow] ${over}`}
      style={tint}
    >
      <ColumnHeader stage={stage} count={apps.length} />
      <div className="flex-1 flex flex-col gap-2 min-h-[80px] pt-1">
        {apps.map((a) => {
          const card = (
          <CandidateCard
            key={a.id}
            app={a}
            candidate={candidates.get(a.candidateId)}
            job={jobOf(a)}
            showJob={showJob}
            onOpen={() => onOpen(a.id)}
            onMove={(to) => onMove(a.id, to)}
            selected={selected?.has(a.id)}
            selecting={!!selected && selected.size > 0}
            onSelect={onSelect && !a.handoff ? (on) => onSelect([a.id], on) : undefined}
          />
          );
          return showJob ? <JobStageProvider key={a.id} job={jobOf(a)}>{card}</JobStageProvider> : card;
        })}
        {apps.length === 0 && (
          <div className="flex-1 rounded-xl border-2 border-dashed border-[#e6dddb] dark:border-[#3a3433] flex items-center justify-center text-xs text-gray-400 py-4">
            {t('pipeline.dropHere')}
          </div>
        )}
      </div>
    </section>
  );
}

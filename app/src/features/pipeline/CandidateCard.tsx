import { useJobStages, useStageName } from './jobStageContext';
import { useDraggable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { MenuItem, Popover } from '../../components/Popover';
import { latestEvaluation } from '../../domain/aiEvaluation';
import { awaitsScorecardFrom } from '../../domain/hiring';
import { daysInStage, isOverSla } from '../../domain/pipeline';
import type { Application, Candidate, Job, Stage } from '../../domain/types';
import { canMoveTo, normalizeRole } from '../../domain/permissions';
import { useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { fullDate } from '../jds/format';

type MoveProps = { current: Stage; onMove: (to: Stage) => void; button: (toggle: () => void) => ReactNode };

/** Keyboard/screen-reader friendly alternative to dragging: lists every other stage. */
export function MoveToMenu({ current, onMove, button }: MoveProps) {
  const label = useStageName();
  const user = useMe();
  // Only stages this user may move to (Hiring Managers: next step or Rejected); nothing to offer = no menu.
  const stages = useJobStages();
  const targets = stages.filter((s) => s !== current && canMoveTo(user, { stage: current }, s, stages));
  if (targets.length === 0) return null;
  return (
    <Popover align="right" trigger={({ toggle }) => button(toggle)}>
      {(close) =>
        targets.map((s) => (
          <MenuItem key={s} onClick={() => { close(); onMove(s); }}>{label(s)}</MenuItem>
        ))
      }
    </Popover>
  );
}

/** `showJob` ("All jobs" board): the second line names the job instead of the candidate's title. */
type BodyProps = { app: Application; candidate?: Candidate; job: Job; menu?: ReactNode; showJob?: boolean };

const CARD = 'relative group bg-white dark:bg-dark-surface rounded-lg border border-gray-200/80 dark:border-white/10 shadow-[0_1px_3px_rgba(15,23,42,0.08)] px-3 pt-2.5 pb-1.5 space-y-1';


/** An over-SLA card gets this accent; the text stays neutral. */

/**
 * Card content kept to three short lines: name, title, then AI match / days-in-stage chips (source and date in the tooltip).
 * Also rendered on its own inside the DragOverlay.
 */
export function CardBody({ app, candidate, job, menu, showJob }: BodyProps) {
  const t = useT();
  const name = candidate?.name ?? app.candidateId;
  const late = isOverSla(app, job);
  return (
    <>
      <div className="font-bold text-[13px] text-slate-800 dark:text-white leading-tight line-clamp-2 break-words" title={`${name} · ${app.source} · ${t('pipeline.card.added', { date: fullDate(app.addedAt) })}`}>{name}</div>
      {showJob ? (
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1" title={job.title}>
          <span aria-hidden="true" className="material-symbols-outlined text-[14px] shrink-0">work</span>
          <span className="truncate">{job.title}</span>
        </div>
      ) : (
        candidate?.title && <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={candidate.title}>{candidate.title}</div>
      )}
      <div className="flex items-center gap-1.5 text-2xs min-w-0 min-h-6">
        <AiBadge app={app} />
        <SlaChip days={daysInStage(app)} sla={job.stageSla[app.stage]} late={late} />
        {menu && <span className="ml-auto -mr-1.5">{menu}</span>}
      </div>
      <HiringLine app={app} />
    </>
  );
}

/** AI colour on the pipeline (card and list cell): yellow text and icon only, no background, kept apart from the SLA red. */
export const AI_PILL = 'text-yellow-600 dark:text-yellow-400';

/** Shared pill shape for the AI score. */
const PILL = 'shrink-0 h-5 px-1.5 rounded-md flex items-center gap-0.5 text-2xs font-bold tabular-nums';

/** AI match pill, first chip on the bottom row: sparkle + "54%". Hidden from an interviewer until their scorecard is in. */
function AiBadge({ app }: { app: Application }) {
  const t = useT();
  const user = useMe();
  if (normalizeRole(user.role) === 'Interviewer' && awaitsScorecardFrom(app, user.id)) return null;
  const spark = (color?: string) => (
    <span aria-hidden="true" className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1", color }}>auto_awesome</span>
  );
  if (app.aiPending) {
    return (
      <span title={t('ai.badge.pending')} aria-label={t('ai.badge.pending')} className={`${PILL} bg-slate-100 dark:bg-white/10 text-muted dark:text-gray-400 animate-pulse`}>
        {spark()}<span>…</span>
      </span>
    );
  }
  const e = latestEvaluation(app);
  if (!e) return null;
  if (e.noCriteria) {
    return (
      <span title={t('ai.badge.noCriteria')} aria-label={t('ai.badge.noCriteria')} className={`${PILL} bg-slate-100 dark:bg-white/10 text-muted dark:text-gray-400`}>
        {spark()}<span>—</span>
      </span>
    );
  }
  // One soft yellow for every score so the pill never reads as the red/amber SLA warning; the number carries the band.
  return (
    <span data-testid="ai-pill" title={t('ai.badge.score', { n: e.score })} aria-label={t('ai.badge.score', { n: e.score })} className={`shrink-0 h-5 flex items-center gap-0.5 text-2xs font-bold tabular-nums ${AI_PILL}`}>
      {spark()}<span>{`${e.score}%`}</span>
    </span>
  );
}

/** Days in this stage as a chip; over SLA it just turns red ("8d"), the SLA itself is in the tooltip. */
function SlaChip({ days, sla, late }: { days: number; sla?: number; late: boolean }) {
  const t = useT();
  const over = late && sla !== undefined;
  return (
    <span
      data-testid="sla-card"
      title={over ? t('pipeline.overSla', { n: sla }) : sla !== undefined ? t('pipeline.col.onTime', { days: sla }) : undefined}
      className={`shrink-0 h-5 px-1.5 rounded-md flex items-center gap-0.5 font-semibold tabular-nums ${
        late ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'text-muted dark:text-gray-500'
      }`}
    >
      <span>{t('pipeline.daysShort', { n: days })}</span>
    </span>
  );
}

/** Optional 4th line: hand-off or offer status. */
function HiringLine({ app }: { app: Application }) {
  const t = useT();
  const [icon, text, cls] = app.handoff
    ? ['verified', t('card.handedOff'), 'text-emerald-600 dark:text-emerald-400']
    : app.offer && app.stage === 'offer'
      ? ['request_quote', t(`offer.status.${app.offer.status}`), app.offer.status === 'declined' ? 'text-red-500' : 'text-blue-600 dark:text-blue-400']
      : [null, '', ''];
  if (!icon) return null;
  return (
    <div className={`flex items-center gap-1 text-2xs font-semibold min-w-0 ${cls}`}>
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      <span className="truncate">{app.offer && app.stage === 'offer' && !app.handoff ? `${t('offer.title')}: ${text}` : text}</span>
    </div>
  );
}

export function OverlayCard(props: Omit<BodyProps, 'menu'>) {
  return (
    <div className={`${CARD} shadow-lg rotate-1 cursor-grabbing`}>
      <CardBody {...props} />
    </div>
  );
}

type CardProps = Omit<BodyProps, 'menu'> & {
  onOpen: () => void;
  onMove: (to: Stage) => void;
  /** Bulk selection: omit `onSelect` to hide the checkbox. */
  selected?: boolean;
  onSelect?: (on: boolean) => void;
  /** Some card is selected: keep every checkbox visible, not only on hover/focus. */
  selecting?: boolean;
};

/** Draggable card (pointer or keyboard: focus it, Space to lift, arrows between columns, Space to drop). */
export function CandidateCard({ app, candidate, job, showJob, onOpen, onMove, selected = false, onSelect, selecting = false }: CardProps) {
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: app.id });
  const setRef = (el: HTMLElement | null) => {
    setNodeRef(el);
    setActivatorNodeRef(el);
  };
  // The menu must neither start a drag nor open the drawer.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const menu = app.handoff ? undefined : (
    <div onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      <MoveToMenu
        current={app.stage}
        onMove={onMove}
        button={(toggle) => (
          <button aria-label={t('pipeline.moveTo')} onClick={toggle} className="size-6 shrink-0 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/5">
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
        )}
      />
    </div>
  );
  return (
    <div
      ref={setRef}
      data-testid={`card-${app.id}`}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen();
        listeners?.onKeyDown?.(e);
      }}
      className={`${CARD} cursor-grab select-none hover:border-primary/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${isDragging ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-primary/50 border-primary/40' : ''}`}
    >
      <CardBody app={app} candidate={candidate} job={job} menu={menu} showJob={showJob} />
      {onSelect && (
        // Sits over the avatar; must neither start a drag nor open the drawer.
        <span
          onClick={stop}
          onPointerDown={stop}
          onKeyDown={stop}
          className={`absolute -top-1.5 -left-1.5 size-5 rounded-full bg-white dark:bg-dark-surface shadow-sm flex items-center justify-center transition-opacity ${selected || selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={t('pipeline.bulk.select', { name: candidate?.name ?? app.candidateId })}
            className="size-3.5 rounded border-[#d6cdcb] text-primary focus:ring-primary cursor-pointer"
          />
        </span>
      )}
    </div>
  );
}

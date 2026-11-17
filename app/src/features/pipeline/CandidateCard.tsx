import { useDraggable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { Avatar, toneFor } from '../../components/Avatar';
import { MenuItem, Popover } from '../../components/Popover';
import { averageRating, daysInStage, isOverSla } from '../../domain/pipeline';
import { SOURCE_CAREERS, SOURCE_CV_UPLOAD, SOURCE_MANUAL, SOURCE_REFERRAL, SOURCE_TALENT_POOL, SOURCE_ULTRA_UPLOAD } from '../../domain/sources';
import { STAGES, stageLabel } from '../../domain/stages';
import type { Application, Candidate, Job, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';

type MoveProps = { current: Stage; onMove: (to: Stage) => void; button: (toggle: () => void) => ReactNode };

/** Keyboard/screen-reader friendly alternative to dragging: lists every other stage. */
export function MoveToMenu({ current, onMove, button }: MoveProps) {
  const [lang] = useLang();
  return (
    <Popover align="right" trigger={({ toggle }) => button(toggle)}>
      {(close) =>
        STAGES.filter((s) => s !== current).map((s) => (
          <MenuItem key={s} onClick={() => { close(); onMove(s); }}>{stageLabel(s, lang)}</MenuItem>
        ))
      }
    </Popover>
  );
}

type BodyProps = { app: Application; candidate?: Candidate; job: Job; menu?: ReactNode };

const CARD = 'relative group bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-100 dark:border-white/10 shadow-sm px-2.5 py-2 space-y-1';

const SOURCE_DOT: Record<string, string> = {
  [SOURCE_CAREERS]: '#10b981',
  [SOURCE_CV_UPLOAD]: '#3b82f6',
  [SOURCE_ULTRA_UPLOAD]: '#6366f1',
  [SOURCE_TALENT_POOL]: '#F97316',
  [SOURCE_MANUAL]: '#94a3b8',
  [SOURCE_REFERRAL]: '#a855f7',
  Facebook: '#1877f2',
  LinkedIn: '#0a66c2',
  'Facebook Groups': '#4267b2',
  VietnamWorks: '#f59e0b',
  TopCV: '#14b8a6',
};
const sourceDot = (source: string) => SOURCE_DOT[source] ?? '#94a3b8';

/** An over-SLA card gets this accent; the text stays neutral. */
const lateBorder = (late: boolean) => (late ? ' border-l-4 border-l-red-500' : '');

/** Card content (3 lines); also rendered on its own inside the DragOverlay. */
export function CardBody({ app, candidate, job, menu }: BodyProps) {
  const t = useT();
  const name = candidate?.name ?? app.candidateId;
  const late = isOverSla(app, job);
  const avg = averageRating(app);
  return (
    <>
      <div className="flex items-start gap-2 min-w-0">
        <Avatar name={name} tone={toneFor(name)} small />
        <span className="font-bold text-sm text-slate-800 dark:text-white break-words leading-tight min-w-0 pr-6 line-clamp-2" title={name}>{name}</span>
      </div>
      {menu && (
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[role=menu]]:opacity-100 bg-white dark:bg-[#1e1e1e] rounded-full">{menu}</div>
      )}
      <div className="text-xs text-[#896a61] truncate" title={candidate?.title}>{candidate?.title}</div>
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 min-w-0">
        <span aria-hidden="true" className="size-1.5 rounded-full shrink-0" style={{ background: sourceDot(app.source) }}></span>
        <span className="truncate">{app.source}</span>
        <span
          title={late ? t('pipeline.overSla', { n: job.stageSla[app.stage] ?? 0 }) : undefined}
          className="font-medium shrink-0"
        >
          {daysInStage(app)}d{late ? ' ⚠' : ''}
        </span>
        {avg !== undefined && (
          <span aria-label={t('pipeline.avgRating', { n: avg })} className="ml-auto flex items-center gap-0.5 font-bold text-slate-600 dark:text-gray-300 shrink-0">
            <span className="material-symbols-outlined text-[12px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            {avg}
          </span>
        )}
      </div>
    </>
  );
}

export function OverlayCard(props: Omit<BodyProps, 'menu'>) {
  return (
    <div className={`${CARD}${lateBorder(isOverSla(props.app, props.job))} shadow-lg rotate-1 cursor-grabbing`}>
      <CardBody {...props} />
    </div>
  );
}

type CardProps = Omit<BodyProps, 'menu'> & { onOpen: () => void; onMove: (to: Stage) => void };

/** Draggable card (pointer or keyboard: focus it, Space to lift, arrows between columns, Space to drop). */
export function CandidateCard({ app, candidate, job, onOpen, onMove }: CardProps) {
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: app.id });
  const setRef = (el: HTMLElement | null) => {
    setNodeRef(el);
    setActivatorNodeRef(el);
  };
  // The menu must neither start a drag nor open the drawer.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const menu = (
    <div onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      <MoveToMenu
        current={app.stage}
        onMove={onMove}
        button={(toggle) => (
          <button aria-label={t('pipeline.moveTo')} onClick={toggle} className="size-6 shrink-0 rounded-full flex items-center justify-center text-[#896a61] hover:text-primary hover:bg-[#f8f6f6] dark:hover:bg-white/5">
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
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
      className={`${CARD}${lateBorder(isOverSla(app, job))} cursor-grab select-none hover:border-primary/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardBody app={app} candidate={candidate} job={job} menu={menu} />
    </div>
  );
}

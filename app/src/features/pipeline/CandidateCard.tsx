import { useDraggable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { Avatar, toneFor } from '../../components/Avatar';
import { MenuItem, Popover } from '../../components/Popover';
import { averageRating, daysInStage, isOverSla } from '../../domain/pipeline';
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

const CARD = 'bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-4 space-y-3';

/** Card content; also rendered on its own inside the DragOverlay. */
export function CardBody({ app, candidate, job, menu }: BodyProps) {
  const t = useT();
  const name = candidate?.name ?? app.candidateId;
  const late = isOverSla(app, job);
  const avg = averageRating(app);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Avatar name={name} tone={toneFor(name)} />
        {menu}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-sm text-slate-800 dark:text-white break-words leading-snug">{name}</div>
        <div className="text-xs text-[#896a61] truncate" title={candidate?.title}>{candidate?.title}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#f4f1f0] dark:bg-[#2a2423] text-slate-600 dark:text-[#e6dddb]">{app.source}</span>
        {app.via === 'talent_pool' && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-[#F97316] flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">diversity_3</span>{t('pipeline.fromPool')}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span
          title={late ? t('pipeline.overSla', { n: job.stageSla[app.stage] ?? 0 }) : undefined}
          className={`font-medium ${late ? 'text-red-500' : 'text-gray-400'}`}
        >
          {t('pipeline.daysInStage', { n: daysInStage(app) })}
        </span>
        {avg !== undefined && (
          <span aria-label={t('pipeline.avgRating', { n: avg })} className="flex items-center gap-0.5 font-bold text-slate-600 dark:text-gray-300">
            <span className="material-symbols-outlined text-[14px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            {avg}
          </span>
        )}
      </div>
    </>
  );
}

export function OverlayCard(props: Omit<BodyProps, 'menu'>) {
  return (
    <div className={`${CARD} shadow-lg rotate-1 cursor-grabbing`}>
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
          <button aria-label={t('pipeline.moveTo')} onClick={toggle} className="size-7 rounded-full flex items-center justify-center text-[#896a61] hover:text-primary hover:bg-[#f8f6f6] dark:hover:bg-white/5">
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
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
      className={`${CARD} cursor-grab select-none hover:border-primary/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardBody app={app} candidate={candidate} job={job} menu={menu} />
    </div>
  );
}

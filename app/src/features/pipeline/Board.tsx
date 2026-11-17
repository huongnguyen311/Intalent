import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { toast } from '../../components/Toast';
import { filterApplications } from '../../domain/pipelineFilter';
import { STAGES, stageLabel } from '../../domain/stages';
import type { Job, Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { ApplicationDrawer } from './ApplicationDrawer';
import { OverlayCard } from './CandidateCard';
import { Column } from './Column';
import { MoveDialog } from './MoveDialog';
import { commitMove, handleDrop } from './moves';
import type { PipelineView } from './PipelineHeader';
import { PipelineList } from './PipelineList';

const isStage = (id: UniqueIdentifier | undefined): id is Stage => STAGES.includes(id as Stage);

/**
 * Arrow keys jump the lifted card a whole column left/right instead of nudging it by pixels.
 * dnd-kit's KeyboardSensor scrolls (rather than moves) when the target lies past the board's visible middle,
 * which would need a second key press; so the board is scrolled here first, keeping each press = one column.
 */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { active, context: { collisionRect, droppableContainers, over } }) => {
  const dir = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (!dir || !collisionRect) return undefined;
  event.preventDefault();
  const from = isStage(over?.id) ? over.id : useStore.getState().applications.find((a) => a.id === active)?.stage;
  if (!from) return undefined;
  const to = STAGES[Math.min(STAGES.length - 1, Math.max(0, STAGES.indexOf(from) + dir))];
  const node = droppableContainers.get(to)?.node.current;
  if (!node) return undefined;
  const xIn = (rect: DOMRect) => rect.left + (rect.width - collisionRect.width) / 2;
  const board = node.parentElement;
  if (board) {
    const b = board.getBoundingClientRect();
    const overshoot = xIn(node.getBoundingClientRect()) - (b.left + b.width / 2);
    if (dir * overshoot > 0) board.scrollBy({ left: overshoot, behavior: 'auto' });
  }
  return { x: xIn(node.getBoundingClientRect()), y: collisionRect.top };
};

const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] };

const END_STAGES: Stage[] = ['hired', 'rejected'];
/** Hired/Rejected start collapsed once the open stages hold more than this many applications. */
const BUSY_ACTIVE = 3;

/**
 * Per-job Kanban (or list): drag (pointer or keyboard) or "Move to…" between stages.
 * Every move asks for a note first (required for Rejected); Cancel leaves the card where it was.
 */
export function Board({ job, filter, view = 'kanban' }: { job: Job; filter?: { text?: string; source?: string }; view?: PipelineView }) {
  const t = useT();
  const [lang] = useLang();
  const allApps = useStore((s) => s.applications);
  const allCandidates = useStore((s) => s.candidates);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ appId: string; to: Stage } | null>(null);
  const [collapseOverride, setCollapseOverride] = useState<Partial<Record<Stage, boolean>>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const jobApps = useMemo(
    () => allApps.filter((a) => a.jobId === job.id).sort((a, b) => a.stageEnteredAt.localeCompare(b.stageEnteredAt)),
    [allApps, job.id],
  );
  const apps = useMemo(
    () => filterApplications(jobApps, allCandidates, { text: filter?.text, source: filter?.source }),
    [jobApps, allCandidates, filter?.text, filter?.source],
  );
  const candidates = useMemo(() => new Map(allCandidates.map((c) => [c.id, c])), [allCandidates]);
  const nameOf = (appId: UniqueIdentifier) => {
    const app = jobApps.find((a) => a.id === appId);
    return (app && candidates.get(app.candidateId)?.name) ?? String(appId);
  };
  const stageName = (id: UniqueIdentifier | undefined) => (isStage(id) ? stageLabel(id, lang) : '');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES }),
  );

  // Frozen at mount so moving a card never flips the end strips open or shut by itself.
  const [busyAtMount] = useState(() => jobApps.filter((a) => !END_STAGES.includes(a.stage)).length > BUSY_ACTIVE);
  const filtering = !!(filter?.text?.trim() || filter?.source);
  // While a filter is on, a strip that holds matches opens so they are not hidden.
  const isCollapsed = (stage: Stage) =>
    collapseOverride[stage] ??
    (END_STAGES.includes(stage) && busyAtMount && !(filtering && apps.some((a) => a.stage === stage)));

  const move = (appId: string, to: Stage | null) => {
    if (to && handleDrop(appId, to) === 'needs_note') setPending({ appId, to });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    move(String(active.id), isStage(over?.id) ? over.id : null);
  };

  const confirmMove = (note: string) => {
    if (!pending) return;
    const { appId, to } = pending;
    if (commitMove(appId, to, note)) {
      toast(to === 'rejected' ? t('pipeline.toast.rejected', { name: nameOf(appId) }) : t('pipeline.toast.moved', { name: nameOf(appId), stage: stageLabel(to, lang) }));
    }
    setPending(null);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('pipeline.a11y.picked', { name: nameOf(active.id), stage: stageName(apps.find((a) => a.id === active.id)?.stage) }),
    onDragOver: ({ active, over }) =>
      over ? t('pipeline.a11y.over', { name: nameOf(active.id), stage: stageName(over.id) }) : t('pipeline.a11y.outside', { name: nameOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over ? t('pipeline.a11y.dropped', { name: nameOf(active.id), stage: stageName(over.id) }) : undefined,
    onDragCancel: ({ active }) =>
      t('pipeline.a11y.cancelled', { name: nameOf(active.id), stage: stageName(apps.find((a) => a.id === active.id)?.stage) }),
  };

  if (jobApps.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-12 flex flex-col items-center text-center gap-3">
        <span className="size-14 rounded-full bg-orange-50 text-[#F97316] flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">view_kanban</span>
        </span>
        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{t('pipeline.empty.title')}</h3>
        <p className="text-sm text-[#896a61] max-w-md">{t('pipeline.empty.desc')}</p>
      </div>
    );
  }

  const active = activeId ? apps.find((a) => a.id === activeId) : undefined;

  const noMatch = apps.length === 0;
  return (
    <>
      {noMatch ? (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-12 text-center text-sm text-[#896a61]">
          {t('pipeline.filter.noMatch')}
        </div>
      ) : view === 'list' ? (
        <PipelineList job={job} apps={apps} candidates={candidates} onOpen={setOpenId} onMove={move} />
      ) : (
      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('pipeline.a11y.instructions') } }}
        onDragStart={({ active: a }) => setActiveId(String(a.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-4 items-stretch">
          {STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              apps={apps.filter((a) => a.stage === stage)}
              candidates={candidates}
              job={job}
              onOpen={setOpenId}
              onMove={move}
              collapsed={isCollapsed(stage)}
              onToggleCollapse={END_STAGES.includes(stage) ? () => setCollapseOverride((o) => ({ ...o, [stage]: !isCollapsed(stage) })) : undefined}
            />
          ))}
        </div>
        <DragOverlay>
          {active && <OverlayCard app={active} candidate={candidates.get(active.candidateId)} job={job} />}
        </DragOverlay>
      </DndContext>
      )}
      <ApplicationDrawer appId={openId} job={job} onClose={() => setOpenId(null)} onMove={move} />
      <MoveDialog
        open={!!pending}
        name={nameOf(pending?.appId ?? '')}
        to={pending?.to ?? 'new'}
        onCancel={() => setPending(null)}
        onConfirm={confirmMove}
      />
    </>
  );
}

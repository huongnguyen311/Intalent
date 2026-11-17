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
import { STAGES, stageLabel } from '../../domain/stages';
import type { Job, Stage } from '../../domain/types';
import { CURRENT_USER_ID } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { AddFromPoolButton } from './AddFromPoolModal';
import { ApplicationDrawer } from './ApplicationDrawer';
import { OverlayCard } from './CandidateCard';
import { Column } from './Column';
import { handleDrop } from './moves';
import { RejectDialog } from './RejectDialog';

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

/** Per-job Kanban: drag (pointer or keyboard) or "Move to…" between stages; Rejected asks for a reason first. */
export function Board({ job }: { job: Job }) {
  const t = useT();
  const [lang] = useLang();
  const allApps = useStore((s) => s.applications);
  const allCandidates = useStore((s) => s.candidates);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const apps = useMemo(
    () => allApps.filter((a) => a.jobId === job.id).sort((a, b) => a.stageEnteredAt.localeCompare(b.stageEnteredAt)),
    [allApps, job.id],
  );
  const candidates = useMemo(() => new Map(allCandidates.map((c) => [c.id, c])), [allCandidates]);
  const nameOf = (appId: UniqueIdentifier) => {
    const app = apps.find((a) => a.id === appId);
    return (app && candidates.get(app.candidateId)?.name) ?? String(appId);
  };
  const stageName = (id: UniqueIdentifier | undefined) => (isStage(id) ? stageLabel(id, lang) : '');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES }),
  );

  const move = (appId: string, to: Stage | null) => {
    const outcome = handleDrop(appId, to);
    if (outcome === 'needs_reason') setRejectingId(appId);
    if (outcome === 'moved' && to) toast(t('pipeline.toast.moved', { name: nameOf(appId), stage: stageLabel(to, lang) }));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    move(String(active.id), isStage(over?.id) ? over.id : null);
  };

  const confirmReject = (reason: string) => {
    if (!rejectingId) return;
    if (useStore.getState().moveStage(rejectingId, 'rejected', CURRENT_USER_ID, reason)) {
      toast(t('pipeline.toast.rejected', { name: nameOf(rejectingId) }));
    }
    setRejectingId(null);
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

  if (apps.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-12 flex flex-col items-center text-center gap-3">
        <span className="size-14 rounded-full bg-orange-50 text-[#F97316] flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">view_kanban</span>
        </span>
        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{t('pipeline.empty.title')}</h3>
        <p className="text-sm text-[#896a61] max-w-md">{t('pipeline.empty.desc')}</p>
        <AddFromPoolButton jobId={job.id} />
      </div>
    );
  }

  const active = activeId ? apps.find((a) => a.id === activeId) : undefined;
  const rejecting = rejectingId ? apps.find((a) => a.id === rejectingId) : undefined;

  return (
    <>
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
            />
          ))}
        </div>
        <DragOverlay>
          {active && <OverlayCard app={active} candidate={candidates.get(active.candidateId)} job={job} />}
        </DragOverlay>
      </DndContext>
      <ApplicationDrawer appId={openId} job={job} onClose={() => setOpenId(null)} onMove={move} />
      <RejectDialog
        open={!!rejecting}
        name={rejecting ? nameOf(rejecting.id) : ''}
        onCancel={() => setRejectingId(null)}
        onConfirm={confirmReject}
      />
    </>
  );
}

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
import { useSearchParams } from 'react-router-dom';
import { sortByAiScore } from '../../domain/aiEvaluation';
import { filterApplications, type ApplicationQuery } from '../../domain/pipelineFilter';
import { STAGES } from '../../domain/stages';
import { jobStages } from '../../domain/pipelineConfig';
import type { Application, Job, Stage } from '../../domain/types';
import { toast } from '../../components/Toast';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { useMe } from '../../store/session';
import { canMoveTo } from '../../domain/permissions';
import { ApplicationDrawer } from './ApplicationDrawer';
import { BulkBar } from './BulkBar';
import { JobStageProvider, useJobStages, useStageName } from './jobStageContext';
import { OverlayCard } from './CandidateCard';
import { Column } from './Column';
import type { PipelineSort, PipelineView } from './PipelineHeader';
import { PipelineList } from './PipelineList';
import { useStageMove } from './useStageMove';

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
  // Columns in the order this job's board shows them (render order; each job orders its own columns).
  const order = [...droppableContainers.values()].map((c) => c.id).filter(isStage);
  const to = order[Math.min(order.length - 1, Math.max(0, order.indexOf(from) + dir))];
  if (!to) return undefined;
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

/**
 * Per-job Kanban (or list): drag (pointer or keyboard) or "Move to…" between stages.
 * Without `job` it is the "All jobs" board: every application of `jobs`, cards labelled with their job.
 * Every move asks for a note first (required for Rejected); Cancel leaves the card where it was.
 */
type BoardProps = {
  /** One job's board; omit for "All jobs". */
  job?: Job;
  /** "All jobs" scope (ignored when `job` is set). */
  jobs?: Job[];
  filter?: ApplicationQuery;
  view?: PipelineView;
  sort?: PipelineSort;
  /** Opens Pipeline settings (the "+" tile after the last column); omitted = no tile. */
  onConfigure?: () => void;
};

export function Board(props: BoardProps) {
  return (
    <JobStageProvider job={props.job} jobs={props.jobs}>
      <BoardInner {...props} />
    </JobStageProvider>
  );
}

function BoardInner({ job, jobs, filter, view = 'kanban', sort = 'board', onConfigure }: BoardProps) {
  const t = useT();
  const allApps = useStore((s) => s.applications);
  const allCandidates = useStore((s) => s.candidates);
  // `?app=<id>` (from the to-do list) opens that application's drawer.
  const [params] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => params.get('app'));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const allJobs = !job;
  const jobById = useMemo(() => new Map((job ? [job] : jobs ?? []).map((j) => [j.id, j])), [job, jobs]);
  const jobOf = (a: Application) => jobById.get(a.jobId)!;
  const jobApps = useMemo(
    () => allApps.filter((a) => jobById.has(a.jobId)).sort((a, b) => a.stageEnteredAt.localeCompare(b.stageEnteredAt)),
    [allApps, jobById],
  );
  const apps = useMemo(() => {
    const shown = filterApplications(jobApps, allCandidates, filter ?? {});
    return sort === 'ai' ? sortByAiScore(shown) : shown;
  }, [jobApps, allCandidates, filter, sort]);
  const candidates = useMemo(() => new Map(allCandidates.map((c) => [c.id, c])), [allCandidates]);
  const nameOf = (appId: UniqueIdentifier) => {
    const app = jobApps.find((a) => a.id === appId);
    return (app && candidates.get(app.candidateId)?.name) ?? String(appId);
  };
  const label = useStageName();
  const stageName = (id: UniqueIdentifier | undefined) => (isStage(id) ? label(id) : '');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates, keyboardCodes: KEYBOARD_CODES }),
  );


  const { move, moveMany, dialog } = useStageMove();
  const stages = useJobStages();
  // Only cards still on screen count as selected (a filter or a move can hide them).
  const selected = useMemo(() => new Set(apps.filter((a) => picked.has(a.id)).map((a) => a.id)), [apps, picked]);
  const select = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const clearSelection = () => setPicked(new Set());
  // Bulk "Move to" only lists columns at least one selected card may enter (Hiring Managers: next step only).
  const user = useMe();
  const bulkStages = stages.filter((s) =>
    [...selected].some((id) => {
      const a = jobApps.find((x) => x.id === id);
      return !!a && a.stage !== s && canMoveTo(user, a, s, jobStages(jobOf(a)));
    }),
  );

  // On "All jobs" a column may belong to other jobs only: a card moves only into a column its own job runs.
  const hasColumn = (appId: string, to: Stage) => {
    const a = jobApps.find((x) => x.id === appId);
    return !a || jobStages(jobOf(a), jobApps.filter((x) => x.jobId === a.jobId)).includes(to);
  };
  const moveTo = (appId: string, to: Stage | null) => {
    if (allJobs && to && !hasColumn(appId, to)) {
      toast(t('pipeline.toast.noColumn', { stage: label(to) }), 'info');
      return;
    }
    move(appId, to);
  };
  const moveSelected = (to: Stage) => {
    const ids = allJobs ? [...selected].filter((id) => hasColumn(id, to)) : [...selected];
    if (ids.length === 0) toast(t('pipeline.toast.noColumn', { stage: label(to) }), 'info');
    else moveMany(ids, to, clearSelection);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    moveTo(String(active.id), isStage(over?.id) ? over.id : null);
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
        <span className="size-14 rounded-full bg-orange-50 text-brand-accent flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">view_kanban</span>
        </span>
        <h3 className="ty-section font-bold text-lg text-slate-800 dark:text-white">{t('pipeline.empty.title')}</h3>
        <p className="text-sm text-[#896a61] max-w-md">{t('pipeline.empty.desc')}</p>
      </div>
    );
  }

  const active = activeId ? apps.find((a) => a.id === activeId) : undefined;
  // The drawer always speaks for the opened application's own job.
  const openApp = openId ? jobApps.find((a) => a.id === openId) : undefined;
  const drawerJob = job ?? (openApp ? jobOf(openApp) : undefined);

  const noMatch = apps.length === 0;
  return (
    <>
      {selected.size > 0 && (
        <BulkBar count={selected.size} stages={bulkStages} onClear={clearSelection} onMove={moveSelected} />
      )}
      {noMatch ? (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-12 text-center text-sm text-[#896a61]">
          {t('pipeline.filter.noMatch')}
        </div>
      ) : view === 'list' ? (
        <PipelineList jobOf={jobOf} showJob={allJobs} apps={apps} candidates={candidates} onOpen={setOpenId} onMove={moveTo} aiOrder={sort === 'ai'} selected={selected} onSelect={select} />
      ) : (
      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t('pipeline.a11y.instructions') } }}
        onDragStart={({ active: a }) => setActiveId(String(a.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-3 items-stretch min-h-[calc(100vh-210px)]">
          {stages.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              apps={apps.filter((a) => a.stage === stage)}
              candidates={candidates}
              jobOf={jobOf}
              showJob={allJobs}
              onOpen={setOpenId}
              onMove={moveTo}
              selected={selected}
              onSelect={select}
            />
          ))}
          {onConfigure && (
            <button
              onClick={onConfigure}
              aria-label={t('pipeline.col.add')}
              title={t('pipeline.col.add')}
              className="w-12 shrink-0 self-start h-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e1e] shadow-sm flex items-center justify-center text-slate-600 dark:text-gray-300 hover:text-primary hover:border-primary/50"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">add</span>
            </button>
          )}
        </div>
        <DragOverlay>
          {active && <OverlayCard app={active} candidate={candidates.get(active.candidateId)} job={jobOf(active)} showJob={allJobs} />}
        </DragOverlay>
      </DndContext>
      )}
      {drawerJob && (
        <JobStageProvider job={drawerJob}>
          <ApplicationDrawer appId={openId} job={drawerJob} onClose={() => setOpenId(null)} onMove={move} />
        </JobStageProvider>
      )}
      {dialog}
    </>
  );
}

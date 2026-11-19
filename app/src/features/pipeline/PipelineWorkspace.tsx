import { useMemo, useState } from 'react';
import type { Job } from '../../domain/types';
import { useCan } from '../../store/session';
import { useStore } from '../../store/store';
import { Board } from './Board';
import { PipelineConfigDrawer } from './PipelineConfigDrawer';
import { EMPTY_QUERY, PipelineHeader, type PipelineQuery, type PipelineView } from './PipelineHeader';

type Props = {
  /** One job's pipeline; omit for "All jobs" (every job in `switchable`). */
  job?: Job;
  /** Jobs offered by the job filter (and shown together under "All jobs"). */
  switchable?: Job[];
  /** Picks a job; '' = All jobs. */
  onSwitch?: (jobId: string) => void;
};

/** Header (search, job filter, view toggle) plus the board or list. Mount with `key` per job so the search starts clean. */
export function PipelineWorkspace({ job, switchable, onSwitch }: Props) {
  const applications = useStore((s) => s.applications);
  const [query, setQuery] = useState<PipelineQuery>(EMPTY_QUERY);
  const [view, setView] = useState<PipelineView>('kanban');
  const [configOpen, setConfigOpen] = useState(false);
  // Rounds, SLA and automation are part of one job's setup (nothing to configure on "All jobs").
  const canConfigure = useCan()('job.edit');
  const configure = job && canConfigure ? () => setConfigOpen(true) : undefined;
  const scope = useMemo(() => new Set((job ? [job] : switchable ?? []).map((j) => j.id)), [job, switchable]);
  const empty = useMemo(() => !applications.some((a) => scope.has(a.jobId)), [applications, scope]);
  return (
    <>
      <PipelineHeader job={job} switchable={switchable} onSwitch={onSwitch} query={query} onQuery={setQuery} view={view} onView={setView} empty={empty} onConfigure={configure} />
      <Board job={job} jobs={switchable} filter={query} view={view} onConfigure={configure} />
      {job && configure && <PipelineConfigDrawer job={job} open={configOpen} onClose={() => setConfigOpen(false)} />}
    </>
  );
}

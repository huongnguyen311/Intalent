import { useMemo, useState } from 'react';
import { pipelineSummary } from '../../domain/pipelineFilter';
import type { Job } from '../../domain/types';
import { useStore } from '../../store/store';
import { Board } from './Board';
import { PipelineHeader, type PipelineQuery, type PipelineView } from './PipelineHeader';

type Props = { job: Job; switchable?: Job[]; onSwitch?: (jobId: string) => void };

/** Header (summary, search, source filter, view toggle) plus the board or list for one job. Mount with `key={job.id}` so filters start clean per job. */
export function PipelineWorkspace({ job, switchable, onSwitch }: Props) {
  const applications = useStore((s) => s.applications);
  const [stored, setStored] = useState<PipelineQuery>({ text: '', source: '' });
  const [view, setView] = useState<PipelineView>('kanban');
  const jobApps = useMemo(() => applications.filter((a) => a.jobId === job.id), [applications, job.id]);
  const sources = useMemo(() => [...new Set(jobApps.map((a) => a.source))].sort(), [jobApps]);
  // A source this job doesn't have is ignored.
  const query: PipelineQuery = { text: stored.text, source: sources.includes(stored.source) ? stored.source : '' };
  const summary = useMemo(() => pipelineSummary(jobApps, job, Date.now()), [jobApps, job]);
  return (
    <>
      <PipelineHeader job={job} switchable={switchable} onSwitch={onSwitch} summary={summary} sources={sources} query={query} onQuery={setStored} view={view} onView={setView} empty={jobApps.length === 0} />
      <Board job={job} filter={query} view={view} />
    </>
  );
}

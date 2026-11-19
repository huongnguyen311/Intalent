import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { jobStageLabel, jobStages } from '../../domain/pipelineConfig';
import { STAGES } from '../../domain/stages';
import type { Job, Stage } from '../../domain/types';
import { useLang } from '../../i18n/i18n';
import { useStore } from '../../store/store';

type Ctx = { job?: Job; stages: Stage[] };

const JobStageContext = createContext<Ctx>({ stages: STAGES });

/**
 * Gives every pipeline component the job's own column order and names.
 * Without `job` ("All jobs"): every column any of `jobs` runs, in the standard order, with standard names.
 */
export function JobStageProvider({ job, jobs, children }: { job?: Job; jobs?: Job[]; children: ReactNode }) {
  const applications = useStore((s) => s.applications);
  const stages = useMemo(() => {
    const of = (j: Job) => jobStages(j, applications.filter((a) => a.jobId === j.id));
    if (job) return of(job);
    const used = new Set((jobs ?? []).flatMap(of));
    return used.size ? STAGES.filter((s) => used.has(s)) : jobStages({});
  }, [job, jobs, applications]);
  const value = useMemo(() => ({ job, stages }), [job, stages]);
  return <JobStageContext.Provider value={value}>{children}</JobStageContext.Provider>;
}

/** Column label for the current job (standard label outside a job). Pass `job` to label for a specific job. */
export function useStageName(): (stage: Stage, job?: Job) => string {
  const { job: current } = useContext(JobStageContext);
  const [lang] = useLang();
  return (stage, job) => jobStageLabel(job ?? current, stage, lang);
}

/** The current job's columns in board order (every stage outside a job). */
export const useJobStages = (): Stage[] => useContext(JobStageContext).stages;

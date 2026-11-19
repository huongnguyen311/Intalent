import { aiRank } from './aiEvaluation';
import { CUSTOM_STAGES, STAGES, stageLabel } from './stages';
import type { Application, AutomationRule, Job, Lang, RejectCode, Stage } from './types';

/** Columns every job has: New first, Hired and Rejected last. */
export const FIXED_START: Stage[] = ['new'];
export const FIXED_END: Stage[] = ['hired', 'rejected'];

/** Middle columns a job may add, remove and reorder (built-in rounds plus custom slots). */
export const OPTIONAL_STAGES: Stage[] = ['ai_screening', 'screening', 'interview', 'assessment', 'final_interview', ...CUSTOM_STAGES, 'offer'];

/** A job that never edited its columns: New, HR Screening, 1st Interview, 2nd Interview, Offer, Hired, Rejected. */
export const DEFAULT_PIPELINE: Stage[] = ['screening', 'interview', 'final_interview', 'offer'];

export const REJECT_CODES: RejectCode[] = ['skills', 'experience', 'salary', 'culture', 'english', 'no_response', 'filled', 'other'];

type PipelineJob = Pick<Job, 'pipeline'>;

/** The job's middle columns in its own order. */
export const middleStages = (job: PipelineJob): Stage[] => (job.pipeline ?? DEFAULT_PIPELINE).filter((s) => OPTIONAL_STAGES.includes(s));

/** Withdrawn is an optional end column (a candidate can still withdraw; the column then appears). */
const showsWithdrawn = (job: PipelineJob) => !!job.pipeline?.includes('withdrawn');

/**
 * Columns a job's board shows, in its order: New, its middle columns, Hired, Rejected (and Withdrawn when on).
 * A removed column that still holds applications stays (before Hired) so no card disappears.
 */
export function jobStages(job: PipelineJob, apps: Pick<Application, 'stage'>[] = []): Stage[] {
  const used = new Set(apps.map((a) => a.stage));
  const mid = middleStages(job);
  const stranded = STAGES.filter((s) => OPTIONAL_STAGES.includes(s) && !mid.includes(s) && used.has(s));
  const end = [...FIXED_END, ...(showsWithdrawn(job) || used.has('withdrawn') ? (['withdrawn'] as Stage[]) : [])];
  return [...FIXED_START, ...mid, ...stranded, ...end];
}

/** True when this job runs the stage (an automation never moves a card into a removed column). */
export const stageEnabled = (job: PipelineJob, stage: Stage): boolean =>
  FIXED_START.includes(stage) || FIXED_END.includes(stage) || (stage === 'withdrawn' ? showsWithdrawn(job) : middleStages(job).includes(stage));

/** The job's own name for a column, else the standard label. */
export function jobStageLabel(job: Pick<Job, 'stageNames'> | undefined, stage: Stage, lang: Lang): string {
  return job?.stageNames?.[stage]?.trim() || stageLabel(stage, lang);
}

/** First unused custom slot for this job, or undefined when all six are taken. */
export const nextCustomStage = (job: PipelineJob): Stage | undefined => CUSTOM_STAGES.find((s) => !middleStages(job).includes(s));

/** Starter rules offered in Pipeline settings: once the AI has scored a new application, route it by score. */
export function suggestedRules(): AutomationRule[] {
  return [
    { id: 'r-pass', enabled: true, from: 'new', when: 'score_gte', score: 70, to: 'screening' },
    { id: 'r-fail', enabled: true, from: 'new', when: 'score_lt', score: 40, to: 'rejected', rejectCode: 'skills' },
  ];
}

/** First enabled rule that fires for this application right now, or undefined. Pure: the store applies it. */
export function matchRule(app: Pick<Application, 'stage' | 'aiEvaluations' | 'aiPending' | 'handoff'>, job: Pick<Job, 'automations' | 'pipeline'>): AutomationRule | undefined {
  if (app.handoff) return undefined;
  return (job.automations ?? []).find((r) => {
    if (!r.enabled || r.from !== app.stage || r.to === app.stage || !stageEnabled(job, r.to)) return false;
    if (r.when === 'on_enter') return true;
    if (app.aiPending) return false;
    const score = aiRank(app);
    if (score < 0 || r.score === undefined) return false;
    return r.when === 'score_gte' ? score >= r.score : score < r.score;
  });
}

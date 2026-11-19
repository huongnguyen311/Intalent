import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { useStore } from '../store/store';
import { AUTOMATION_ACTOR } from '../store/actions/applications';
import { jobStageLabel, jobStages, matchRule, suggestedRules } from './pipelineConfig';
import { filterApplications } from './pipelineFilter';
import type { AiEvaluation, Application } from './types';

const evalOf = (score: number) => ({ score } as AiEvaluation);

describe('jobStages', () => {
  it('the 7 basic columns when the job never configured its pipeline', () => {
    expect(jobStages({})).toEqual(['new', 'screening', 'interview', 'final_interview', 'offer', 'hired', 'rejected']);
  });
  it('follows the job order, keeps occupied removed columns, shows Withdrawn when on or occupied', () => {
    expect(jobStages({ pipeline: ['custom_2', 'interview'] }, [{ stage: 'assessment' }])).toEqual(['new', 'custom_2', 'interview', 'assessment', 'hired', 'rejected']);
    expect(jobStages({ pipeline: ['interview', 'withdrawn'] })).toEqual(['new', 'interview', 'hired', 'rejected', 'withdrawn']);
    expect(jobStages({}, [{ stage: 'withdrawn' }])).toContain('withdrawn');
  });
  it('names: the job name wins, else the standard label', () => {
    expect(jobStageLabel({ stageNames: { custom_1: 'Phone call' } }, 'custom_1', 'en')).toBe('Phone call');
    expect(jobStageLabel({}, 'interview', 'en')).toBe('1st Interview');
    expect(jobStageLabel(undefined, 'final_interview', 'vi')).toBe('Phỏng vấn vòng 2');
  });
});

describe('matchRule', () => {
  const job = { automations: suggestedRules() };
  const app = (stage: Application['stage'], score?: number) => ({ stage, aiEvaluations: score === undefined ? [] : [evalOf(score)] });
  it('routes a scored new application by its latest AI score', () => {
    expect(matchRule(app('new', 82), job)?.to).toBe('screening');
    expect(matchRule(app('new', 20), job)?.to).toBe('rejected');
    expect(matchRule(app('new', 55), job)).toBeUndefined();
    expect(matchRule(app('new'), job)).toBeUndefined();
  });
  it('never fires into a removed column or for disabled rules', () => {
    expect(matchRule(app('new', 90), { ...job, pipeline: ['interview'] })).toBeUndefined();
    expect(matchRule(app('new', 90), { automations: [{ ...suggestedRules()[0], enabled: false }] })).toBeUndefined();
    expect(matchRule(app('new'), { automations: [{ id: 'x', enabled: true, from: 'new', when: 'on_enter', to: 'ai_screening' }], pipeline: ['ai_screening'] })?.to).toBe('ai_screening');
  });
});

describe('store automation', () => {
  beforeEach(() => {
    const seed = buildSeed();
    useStore.setState({ ...seed, applications: [], activities: [] });
  });
  const openJob = () => useStore.getState().jobs.find((j) => j.status === 'open')!;

  it('an on-entry rule moves a new application at once, then the AI score routes it, logged as automatic', () => {
    const job = openJob();
    // Threshold 0 so whatever the simulated AI scores, the pass rule fires.
    useStore.getState().updateJob(job.id, {
      pipeline: ['ai_screening', 'screening', 'interview', 'offer'],
      automations: [
        { id: 'r-enter', enabled: true, from: 'new', when: 'on_enter', to: 'ai_screening' },
        { id: 'r-pass', enabled: true, from: 'ai_screening', when: 'score_gte', score: 0, to: 'screening' },
      ],
    });
    const res = useStore.getState().addToPipeline(useStore.getState().candidates[0].id, job.id, { via: 'manual', source: 'Manual', by: 'u-thu' });
    if (!res.ok) throw new Error('not added');
    expect(res.application.stage).toBe('ai_screening');
    useStore.getState().runAiEvaluation(res.application.id, 'InTalent AI');
    const after = useStore.getState().applications.find((a) => a.id === res.application.id)!;
    expect(after.stage).toBe('screening');
    expect(after.history[after.history.length - 1]).toMatchObject({ by: AUTOMATION_ACTOR, ruleId: 'r-pass' });
  });

  it('without rules nothing moves by itself', () => {
    const job = openJob();
    const res = useStore.getState().addToPipeline(useStore.getState().candidates[0].id, job.id, { via: 'manual', source: 'Manual', by: 'u-thu' });
    if (!res.ok) throw new Error('not added');
    useStore.getState().runAiEvaluation(res.application.id, 'InTalent AI');
    expect(useStore.getState().applications.find((a) => a.id === res.application.id)!.stage).toBe('new');
  });

  it('rejecting by category alone is allowed; no category and no reason is refused', () => {
    const job = openJob();
    const res = useStore.getState().addToPipeline(useStore.getState().candidates[0].id, job.id, { via: 'manual', source: 'Manual', by: 'u-thu' });
    if (!res.ok) throw new Error('not added');
    const id = res.application.id;
    expect(useStore.getState().moveStage(id, 'rejected', 'u-thu')).toBe(false);
    expect(useStore.getState().moveStage(id, 'rejected', 'u-thu', undefined, undefined, { code: 'english' })).toBe(true);
    expect(useStore.getState().applications.find((a) => a.id === id)).toMatchObject({ stage: 'rejected', rejectedCode: 'english' });
    // Moving out clears the category with the reason.
    expect(useStore.getState().moveStage(id, 'screening', 'u-thu')).toBe(true);
    expect(useStore.getState().applications.find((a) => a.id === id)!.rejectedCode).toBeUndefined();
  });
});

describe('filter by AI score', () => {
  it('keeps only applications scored at least minScore', () => {
    const apps = [
      { id: 'x', aiEvaluations: [evalOf(80)] },
      { id: 'y', aiEvaluations: [evalOf(50)] },
      { id: 'z' },
    ] as unknown as Application[];
    expect(filterApplications(apps, [], { minScore: 60 }).map((a) => a.id)).toEqual(['x']);
  });
});

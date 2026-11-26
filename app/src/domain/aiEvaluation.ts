import { jdRequirements } from './jdExtract';
import { estimateYears, scoreCandidate, WEIGHTS, type Requirements } from './scoring';
import { fold, hasToken } from './techVocab';
import type { AiCriterion, AiEvaluation, AiFinding, AiQuestion, Application, Candidate, Jd, Job, TaxonomyItem } from './types';

export const AI_MODEL = 'intalent-match-v1' as const;

const CRITERIA: AiCriterion[] = ['stack', 'experience', 'domain', 'english'];

/** Requirements come from the job's JD alone; a job whose JD is gone gets an empty stack (no criteria to miss). */
export function requirementsForJob(job: Job, jds: Jd[], taxonomy: TaxonomyItem[]): Requirements {
  const jd = jds.find((j) => j.id === job.jdId);
  return jd ? jdRequirements(jd, taxonomy) : { stack: [] };
}

/** First sentence of the CV text or an experience description that mentions `term`; never paraphrased. */
export function findEvidence(c: Candidate, term: string): string | undefined {
  const texts = [c.cv ?? '', ...(c.experience ?? []).map((e) => e.description ?? '')];
  const needle = fold(term);
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?\n])\s+/)) {
      const s = sentence.trim();
      if (s && hasToken(fold(s), needle)) return s;
    }
  }
  return undefined;
}

type Params = Record<string, string | number>;

const finding = (c: Candidate, criterion: AiCriterion, key: string, params?: Params, term?: string): AiFinding => {
  const evidence = term ? findEvidence(c, term) : undefined;
  return { criterion, key, ...(params ? { params } : {}), ...(evidence ? { evidence } : {}) };
};

const hasCriteria = (req: Requirements) =>
  req.stack.length > 0 || !!req.seniority || !!req.years || !!req.domains?.length || !!req.english;

/** Rule-based stand-in for the AI matcher: explainable score, findings with CV evidence, questions for each gap. */
export function evaluateApplication(c: Candidate, req: Requirements, at: string, id: string): AiEvaluation {
  if (!hasCriteria(req)) {
    return {
      id, score: 0, noCriteria: true,
      breakdown: CRITERIA.map((key) => ({ key, points: 0, max: WEIGHTS[key] })),
      strengths: [], gaps: [{ criterion: 'stack', key: 'ai.f.noCriteria' }], questions: [{ key: 'ai.q.noCriteria' }],
      model: AI_MODEL, at,
    };
  }
  const r = scoreCandidate(c, req);
  const strengths: AiFinding[] = [];
  const gaps: AiFinding[] = [];
  const questions: AiQuestion[] = [];

  for (const s of r.have) strengths.push(finding(c, 'stack', 'ai.f.has', { s }, s));
  for (const s of r.miss) {
    gaps.push(finding(c, 'stack', 'ai.f.noSkill', { s }));
    questions.push({ key: 'ai.q.skill', params: { s } });
  }

  if (req.seniority || req.years) {
    // The UI composes "Senior, ~6 yrs" on each side so the years read in the viewer's language.
    const params: Params = { have: c.seniority || '-', years: estimateYears(c), want: req.seniority ?? '', wantYears: req.years ?? 0 };
    if (r.breakdown.experience >= 0.8 * WEIGHTS.experience) strengths.push(finding(c, 'experience', 'ai.f.expMeets', params));
    else {
      gaps.push(finding(c, 'experience', 'ai.f.expBelow', params));
      questions.push({ key: 'ai.q.experience' });
    }
  }

  const mine = new Set(c.domains.map(fold));
  for (const d of req.domains ?? []) {
    if (mine.has(fold(d))) strengths.push(finding(c, 'domain', 'ai.f.domain', { d }, d));
    else {
      gaps.push(finding(c, 'domain', 'ai.f.noDomain', { d }));
      questions.push({ key: 'ai.q.domain', params: { d } });
    }
  }

  if (req.english) {
    const params = { have: c.english || '-', want: req.english };
    if (r.breakdown.english >= WEIGHTS.english) strengths.push(finding(c, 'english', 'ai.f.englishMeets', params));
    else {
      gaps.push(finding(c, 'english', 'ai.f.englishBelow', params));
      questions.push({ key: 'ai.q.english' });
    }
  }

  return {
    id,
    score: r.score,
    breakdown: CRITERIA.map((key) => ({ key, points: r.breakdown[key], max: WEIGHTS[key] })),
    strengths,
    gaps,
    questions,
    model: AI_MODEL,
    at,
  };
}

export function latestEvaluation(app: Pick<Application, 'aiEvaluations'>): AiEvaluation | undefined {
  return app.aiEvaluations?.[app.aiEvaluations.length - 1];
}

/** Latest score, or -1 when there is none to rank by (pending, never run, or a JD without criteria). */
export function aiRank(app: Pick<Application, 'aiEvaluations'>): number {
  const e = latestEvaluation(app);
  return !e || e.noCriteria ? -1 : e.score;
}

/** Highest latest score first; applications without a usable score keep their order, last. */
export function sortByAiScore<T extends Pick<Application, 'aiEvaluations'>>(apps: T[]): T[] {
  return [...apps].sort((a, b) => aiRank(b) - aiRank(a));
}

import type { Interview, Jd, Job, Scorecard, ScoreCriterionDef } from './types';
import { SCORE_CRITERIA } from './types';

/**
 * Scorecards built for the job being hired for: the JD's own skills, the competencies of the job family,
 * leadership for lead roles, and a focus that follows the round (a technical round digs into skills,
 * a final round into fit and motivation). Each saved card keeps the criteria it was scored on.
 */

export type RoleFamily = 'engineering' | 'marketing' | 'general';
export type RoundFocus = 'technical' | 'final' | 'general';

/** Skills from the JD worth scoring one by one; more than this and interviewers stop reading. */
export const MAX_SKILLS = 5;

const CORE: Record<RoleFamily, string[]> = {
  engineering: ['problem', 'design', 'communication', 'culture'],
  marketing: ['strategy', 'analytics', 'execution', 'communication', 'culture'],
  general: ['problem', 'ownership', 'communication', 'culture'],
};

export function roleFamily(job: Pick<Job, 'department' | 'title'> | undefined): RoleFamily {
  const s = `${job?.department ?? ''} ${job?.title ?? ''}`;
  if (/engineer|developer|dev\b|tech|software|mobile|frontend|backend|data|qa|it\b/i.test(s)) return 'engineering';
  if (/marketing|growth|brand|content|seo|sales/i.test(s)) return 'marketing';
  return 'general';
}

export function roundFocus(round: string): RoundFocus {
  if (/final|cuối|hr\b|culture|văn hoá|văn hóa|manager|director|ceo/i.test(round)) return 'final';
  if (/tech|kỹ thuật|coding|code|system|design|case|test|assignment|bài/i.test(round)) return 'technical';
  return 'general';
}

const isLead = (job: Pick<Job, 'level' | 'title'> | undefined) => /lead|manager|head|principal|director/i.test(`${job?.level ?? ''} ${job?.title ?? ''}`);

export type ScorecardTemplate = { family: RoleFamily; focus: RoundFocus; criteria: ScoreCriterionDef[] };

/** The criteria for one round of one job; `jd` brings the skills, absent on jobs without a JD. */
export function scorecardTemplate(job: Job | undefined, jd: Pick<Jd, 'skills'> | undefined, round: string): ScorecardTemplate {
  const family = roleFamily(job);
  const focus = roundFocus(round);
  const core = [...CORE[family]];
  if (isLead(job)) core.splice(core.length - 1, 0, 'leadership');
  if (focus === 'final') core.push('motivation');
  const skills: ScoreCriterionDef[] = (jd?.skills ?? []).slice(0, MAX_SKILLS).map((s) => ({ key: `skill:${s}`, group: 'skill', label: s }));
  const coreDefs: ScoreCriterionDef[] = core.map((key) => ({ key, group: 'core' }));
  // The round's focus leads: skills first in a technical round, competencies first otherwise.
  return { family, focus, criteria: focus === 'technical' || focus === 'general' ? [...skills, ...coreDefs] : [...coreDefs, ...skills] };
}

/** Core competencies must be scored; a skill the interviewer did not probe can stay unscored. */
export const isRequired = (c: ScoreCriterionDef) => c.group === 'core';

/** Every competency with built-in wording, offered when the interviewer adds one to a card. */
export const COMPETENCY_KEYS = ['problem', 'design', 'communication', 'culture', 'strategy', 'analytics', 'execution', 'ownership', 'leadership', 'motivation'];

/**
 * The interviewer's own addition, placed at the end of its group. `knownKey` names a built-in competency;
 * otherwise the text becomes the label. Blank text or a criterion already on the card changes nothing.
 */
export function addCriterion(list: ScoreCriterionDef[], group: ScoreCriterionDef['group'], text: string, knownKey?: string): ScoreCriterionDef[] {
  const label = text.trim();
  if (!label && !knownKey) return list;
  const def: ScoreCriterionDef = knownKey ? { key: knownKey, group } : { key: `${group}:${label}`, group, label };
  const same = (c: ScoreCriterionDef) => c.key.toLowerCase() === def.key.toLowerCase() || (!knownKey && c.label?.toLowerCase() === label.toLowerCase());
  if (list.some(same)) return list;
  let at = list.length;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].group === group) { at = i + 1; break; }
  return [...list.slice(0, at), def, ...list.slice(at)];
}

/** Drops a criterion, except the last core competency: a card with none could not be compared with the others. */
export function removeCriterion(list: ScoreCriterionDef[], key: string): ScoreCriterionDef[] {
  const target = list.find((c) => c.key === key);
  if (!target || (isRequired(target) && list.filter(isRequired).length === 1)) return list;
  return list.filter((c) => c.key !== key);
}

/** Criteria a card was scored on: its own copy, or the four fixed ones of cards saved before templates. */
export function criteriaOf(card: Pick<Scorecard, 'criteria'>): ScoreCriterionDef[] {
  return card.criteria ?? SCORE_CRITERIA.map((key) => ({ key, group: 'core' as const }));
}

/** At least one core competency, every required criterion scored 1–5, every optional one either unscored or 1–5. */
export function validScores(scores: Record<string, number>, criteria: ScoreCriterionDef[]): boolean {
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;
  return criteria.some(isRequired) && criteria.every((c) => (isRequired(c) ? ok(scores[c.key]) : !scores[c.key] || ok(scores[c.key])));
}

/** Average over the criteria actually scored, one decimal. */
export function averageOf(scores: Record<string, number>): number {
  const vals = Object.values(scores).filter((n) => n > 0);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
}

/** The template for a round, from the store's job and JD records. */
export function templateFor(iv: Pick<Interview, 'round'>, job: Job | undefined, jds: Jd[]): ScorecardTemplate {
  return scorecardTemplate(job, jds.find((j) => j.id === job?.jdId), iv.round);
}

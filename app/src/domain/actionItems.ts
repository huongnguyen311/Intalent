import { isEnded } from './stages';
import { can, jobsInScope, normalizeRole } from './permissions';
import { isOverSla } from './pipeline';
import type { Application, Job, User } from './types';

/** Most urgent first: an accepted decision waiting on paperwork, then missing feedback, then late, then fresh. */
export type ActionKind = 'offer' | 'scorecard' | 'overdue' | 'new';
const ORDER: ActionKind[] = ['offer', 'scorecard', 'overdue', 'new'];

export interface ActionItem {
  kind: ActionKind;
  appId: string;
  jobId: string;
  candidateId: string;
  /** For `scorecard`: the panel members who have not sent theirs. */
  waitingOn?: string[];
}

/** How long a new application counts as "new" for the to-do list. */
const NEW_DAYS = 3;
const DAY = 86_400_000;

/** Panel members of past, not-cancelled rounds who still owe a scorecard. */
function missingScorecards(app: Application, now: number): string[] {
  const owed = new Set<string>();
  for (const iv of app.interviews ?? []) {
    if (iv.status === 'cancelled' || Date.parse(iv.at) > now) continue;
    for (const u of iv.interviewers) if (!iv.scorecards.some((c) => c.by === u)) owed.add(u);
  }
  return [...owed];
}

/**
 * The signed-in user's to-do list, one item per application (its most urgent reason), scoped to the jobs they
 * work on, in priority order. Interviewers only see the scorecards they owe. Handed-off and closed-out
 * applications never appear.
 */
export function actionItems(apps: Application[], jobs: Job[], user: User | undefined, now: number = Date.now()): ActionItem[] {
  if (!user) return [];
  const interviewer = normalizeRole(user.role) === 'Interviewer';
  const scope = new Map(jobsInScope(user, jobs).map((j) => [j.id, j]));
  const items: ActionItem[] = [];
  for (const app of apps) {
    if (app.handoff || isEnded(app.stage)) continue;
    const base = { appId: app.id, jobId: app.jobId, candidateId: app.candidateId };
    const owed = missingScorecards(app, now);
    if (interviewer) {
      if (owed.includes(user.id)) items.push({ kind: 'scorecard', ...base, waitingOn: [user.id] });
      continue;
    }
    const job = scope.get(app.jobId);
    if (!job) continue;
    const kind: ActionKind | undefined =
      app.stage === 'offer' && !app.offer && can(user, 'offer.manage') ? 'offer'
      : owed.length ? 'scorecard'
      : isOverSla(app, job, now) ? 'overdue'
      : app.stage === 'new' && now - Date.parse(app.addedAt) < NEW_DAYS * DAY ? 'new'
      : undefined;
    if (kind) items.push({ kind, ...base, ...(kind === 'scorecard' ? { waitingOn: owed } : {}) });
  }
  // Priority: the kind first (ORDER), then, within a kind, whatever has sat longest in its current stage.
  const since = new Map(apps.map((a) => [a.id, Date.parse(a.stageEnteredAt || a.addedAt)]));
  return items.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (since.get(a.appId) ?? 0) - (since.get(b.appId) ?? 0));
}

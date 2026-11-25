import { actionItems } from './actionItems';
import { jobsInScope } from './permissions';
import { CAREERS_ACTOR } from './sources';
import type { Activity, Application, Job, User } from './types';

export type NotificationKind = 'new_application' | 'interview_assigned' | 'feedback_due';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  at: string;
  appId: string;
  jobId: string;
  candidateId: string;
}

/**
 * PRD 3.8 in-app notifications for one user, newest first:
 * - a candidate applied (careers page, credited to a campaign or not) to a job the user works on;
 * - someone else put the user on an interview panel;
 * - an interview the user sat on is waiting for their feedback.
 */
export function notificationsFor(user: User, activities: Activity[], apps: Application[], jobs: Job[], now = Date.now()): AppNotification[] {
  const scope = new Set(jobsInScope(user, jobs).map((j) => j.id));
  const byId = new Map(apps.map((a) => [a.id, a]));
  const out: AppNotification[] = [];
  activities.forEach((act, i) => {
    const app = act.applicationId ? byId.get(act.applicationId) : undefined;
    if (!app) return;
    const base = { id: `${act.type}-${i}`, at: act.at, appId: app.id, jobId: app.jobId, candidateId: app.candidateId };
    if (act.type === 'added_to_pipeline' && act.by === CAREERS_ACTOR && scope.has(app.jobId)) {
      out.push({ ...base, kind: 'new_application' });
    } else if (
      act.type === 'interview_scheduled' && act.by !== user.id &&
      app.interviews?.some((iv) => iv.status !== 'cancelled' && iv.interviewers.includes(user.id))
    ) {
      out.push({ ...base, kind: 'interview_assigned' });
    }
  });
  for (const item of actionItems(apps, jobs, user, now)) {
    if (item.kind === 'scorecard' && item.waitingOn?.includes(user.id)) {
      out.push({ id: `feedback-${item.appId}`, kind: 'feedback_due', at: new Date(now).toISOString(), appId: item.appId, jobId: item.jobId, candidateId: item.candidateId });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Unread = newer than the last time the user opened the bell; "feedback due" stays unread until it is done. */
export function unreadCount(list: AppNotification[], seenAt?: string): number {
  return list.filter((n) => n.kind === 'feedback_due' || !seenAt || n.at > seenAt).length;
}

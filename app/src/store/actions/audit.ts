import type { Activity } from '../../domain/types';
import { CURRENT_USER_ID } from '../../domain/users';
import type { Get, Set } from './types';

/** The signed-in user as the store sees it (the demo "View as" user, else the demo admin). */
export const actorOf = (get: Get): string => get().ui.actingAs ?? CURRENT_USER_ID;

/** Appends an audit event (PRD 3.1): `by` defaults to the signed-in user. */
export function logAudit(set: Set, get: Get, at: string, event: Omit<Activity, 'at' | 'by'> & { by?: string }): void {
  const entry: Activity = { ...event, by: event.by ?? actorOf(get), at };
  set((s) => ({ activities: [...s.activities, entry] }));
}

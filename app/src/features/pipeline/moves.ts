import type { Stage } from '../../domain/types';
import { CURRENT_USER_ID } from '../../domain/users';
import { useStore } from '../../store/store';

/** 'needs_reason': the caller must collect a rejection reason before calling `moveStage`. */
export type DropOutcome = 'none' | 'moved' | 'needs_reason';

/**
 * What a drop (or a "Move to…" pick) does. Dropping outside any column or back on the card's own column
 * changes nothing: no history entry, no activity.
 */
export function handleDrop(appId: string, over: Stage | null, by: string = CURRENT_USER_ID): DropOutcome {
  const store = useStore.getState();
  const app = store.applications.find((a) => a.id === appId);
  if (!app || !over || over === app.stage) return 'none';
  if (over === 'rejected') return 'needs_reason';
  return store.moveStage(appId, over, by) ? 'moved' : 'none';
}

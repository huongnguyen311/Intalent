import type { Stage } from '../../domain/types';
import { CURRENT_USER_ID } from '../../domain/users';
import { useStore } from '../../store/store';

/** 'needs_note': a real move; the caller collects an optional note (required for Rejected) then calls `commitMove`. */
export type DropOutcome = 'none' | 'needs_note';

/**
 * What a drop (or a "Move to…" pick) does. Dropping outside any column or back on the card's own column
 * changes nothing; any real move waits for the note dialog and is applied by `commitMove`.
 */
export function handleDrop(appId: string, over: Stage | null): DropOutcome {
  const app = useStore.getState().applications.find((a) => a.id === appId);
  if (!app || !over || over === app.stage) return 'none';
  return 'needs_note';
}

/** Applies a confirmed move; the note lands on the history entry (and is the rejection reason for Rejected). */
export function commitMove(appId: string, to: Stage, note: string, by: string = CURRENT_USER_ID): boolean {
  return useStore.getState().moveStage(appId, to, by, undefined, note);
}

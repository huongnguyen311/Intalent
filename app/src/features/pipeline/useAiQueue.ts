import { useEffect } from 'react';
import { useStore } from '../../store/store';

/** Actor recorded on evaluations the simulated AI queue runs by itself. */
export const AI_ACTOR = 'InTalent AI';

/**
 * Simulated AI queue: each application waiting for its evaluation (`aiPending`) is scored `delayMs` after it is
 * first seen. Mounted once in the internal layout, so careers applications are scored when staff next open the app.
 */
export function useAiQueue(delayMs = 2000): void {
  const pending = useStore((s) => s.applications.filter((a) => a.aiPending).map((a) => a.id).join(','));
  useEffect(() => {
    if (!pending) return;
    const ids = pending.split(',');
    const timer = setTimeout(() => {
      for (const id of ids) {
        // Re-check: a re-run or another tab may already have cleared it.
        if (useStore.getState().applications.find((a) => a.id === id)?.aiPending) useStore.getState().runAiEvaluation(id, AI_ACTOR);
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);
}

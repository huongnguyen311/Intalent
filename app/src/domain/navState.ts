export type NavState = { rail: boolean; folded: Record<string, boolean> };

export const NAV_KEY = 'intalent-ui-nav';

const defaults = (): NavState => ({ rail: false, folded: { 'nav.group.configuration': true } });

function store(storage?: Storage): Storage | undefined {
  try {
    return storage ?? window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadNavState(storage?: Storage): NavState {
  try {
    const raw = store(storage)?.getItem(NAV_KEY);
    if (!raw) return defaults();
    const v = JSON.parse(raw);
    if (!v || typeof v.rail !== 'boolean' || !v.folded || typeof v.folded !== 'object' || Array.isArray(v.folded)) return defaults();
    const folded: Record<string, boolean> = {};
    for (const [k, f] of Object.entries(v.folded)) folded[k] = f === true;
    return { rail: v.rail, folded };
  } catch {
    return defaults();
  }
}

export function saveNavState(s: NavState, storage?: Storage): void {
  try {
    store(storage)?.setItem(NAV_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked or full: fold state just won't persist */
  }
}

export function isGroupOpen(groupKey: string, state: NavState, activeInGroup: boolean): boolean {
  return activeInGroup || !state.folded[groupKey];
}

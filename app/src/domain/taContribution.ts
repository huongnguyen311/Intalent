import type { Activity, DemoState } from './types';
import { CAREERS_ACTOR } from './sources';
import { userName } from './users';

export type Period = 'day' | 'week' | '3m' | '6m' | 'all';

export const UNATTRIBUTED = 'Unattributed (before CV Owner tracking)';

export interface TaRow {
  ta: string;
  newCv: number;
  duplicate: number;
  parseError: number;
  processing: number;
  transferIn: number;
  transferOut: number;
  /** newCv + duplicate + transferIn - transferOut; parse errors and in-flight CVs do not count. */
  total: number;
}

const DAY = 86_400_000;
const WINDOW: Record<Period, number> = { day: DAY, week: 7 * DAY, '3m': 90 * DAY, '6m': 180 * DAY, all: Infinity };

const empty = (ta: string): TaRow => ({ ta, newCv: 0, duplicate: 0, parseError: 0, processing: 0, transferIn: 0, transferOut: 0, total: 0 });

export function inPeriod(a: Activity, period: Period, now: number): boolean {
  return period === 'all' || Date.parse(a.at) >= now - WINDOW[period];
}

/**
 * Per-TA contribution from the activity log: a created profile is a new CV, a merge is a duplicate upload,
 * owner transfers move one CV between TAs. The store keeps no parse failures or in-flight uploads, so those stay 0.
 */
export function taContribution(
  state: Pick<DemoState, 'users' | 'activities'>,
  period: Period,
  now: number = Date.now(),
): { rows: TaRow[]; totals: TaRow } {
  const byName = new Map<string, TaRow>();
  const row = (id: string | undefined): TaRow => {
    const known = id ? state.users.some((u) => u.id === id || u.name === id) : false;
    const ta = known ? userName(state.users, id!) : UNATTRIBUTED;
    if (!byName.has(ta)) byName.set(ta, empty(ta));
    return byName.get(ta)!;
  };
  for (const a of state.activities) {
    if (!inPeriod(a, period, now)) continue;
    // Self-service applicants are not CVs a TA uploaded.
    if ('by' in a && a.by === CAREERS_ACTOR) continue;
    if (a.type === 'candidate_created') row(a.by).newCv++;
    else if (a.type === 'candidate_merged') row(a.by).duplicate++;
    else if (a.type === 'owner_transferred') {
      row(a.from).transferOut++;
      row(a.to).transferIn++;
    }
  }
  const rows = [...byName.values()];
  for (const r of rows) r.total = r.newCv + r.duplicate + r.transferIn - r.transferOut;
  // Real TAs by contribution, the unattributed bucket last.
  rows.sort((a, b) => Number(a.ta === UNATTRIBUTED) - Number(b.ta === UNATTRIBUTED) || b.total - a.total || a.ta.localeCompare(b.ta));
  const totals = empty('Tổng');
  for (const r of rows) for (const k of ['newCv', 'duplicate', 'parseError', 'processing', 'transferIn', 'transferOut', 'total'] as const) totals[k] += r[k];
  return { rows, totals };
}

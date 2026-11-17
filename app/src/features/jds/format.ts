const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

/** "Jun 8" */
export const monthDay = (iso: string) => fmt(iso, { month: 'short', day: 'numeric' });
/** "2026" */
export const year = (iso: string) => fmt(iso, { year: 'numeric' });
/** "Jun 8, 2026" */
export const fullDate = (iso: string) => fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' });

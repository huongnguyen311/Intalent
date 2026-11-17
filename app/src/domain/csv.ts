const needsQuote = /[",\r\n]/;
const cell = (v: string | number) => {
  const s = String(v);
  return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180: header from the first row's keys, CRLF row breaks, cells with commas/quotes/newlines quoted. */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  return [keys, ...rows.map((r) => keys.map((k) => r[k] ?? ''))].map((r) => r.map(cell).join(',')).join('\r\n');
}

import type { ReactNode } from 'react';
import { BTN_GHOST, BTN_PRIMARY, BTN_SMALL, FIELD } from '../../components/ui';
export { BTN_GHOST, BTN_PRIMARY, BTN_SMALL, FIELD };

export const FILLED = { fontVariationSettings: "'FILL' 1" };

export function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'violet'; children: ReactNode }) {
  const cls = {
    gray: 'bg-gray-100 text-slate-600 dark:bg-white/10 dark:text-gray-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300',
  }[tone];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${cls}`}>{children}</span>;
}

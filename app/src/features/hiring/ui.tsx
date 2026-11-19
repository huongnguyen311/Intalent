import type { ReactNode } from 'react';

export const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
export const BTN_PRIMARY =
  'px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const BTN_GHOST =
  'px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const BTN_SMALL =
  'px-3 py-1.5 text-xs font-bold border border-[#e6dddb] dark:border-[#3a3433] rounded-full hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed';
export const FILLED = { fontVariationSettings: "'FILL' 1" };

export function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[#896a61]">{label}</label>
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
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{children}</span>;
}

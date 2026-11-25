import type { ReactNode } from 'react';

export const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
export const BTN_PRIMARY = 'px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors';
export const BTN_GHOST =
  'px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors';
export const LEGEND = 'text-xs font-semibold text-[#896a61] mb-1';
export const CHECKBOX = 'rounded border-gray-300 text-primary focus:ring-primary';

export function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[#896a61]">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

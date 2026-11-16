import type { ReactNode } from 'react';

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-[#f4f1f0] dark:bg-[#2a2423] text-[#181211] dark:text-[#e6dddb] rounded border border-[#e6dddb] dark:border-[#3a3433] whitespace-nowrap">
      {children}
    </span>
  );
}

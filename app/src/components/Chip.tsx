import type { ReactNode } from 'react';

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-dark-raised text-ink dark:text-[#e6dddb] rounded border border-line dark:border-dark-line whitespace-nowrap">
      {children}
    </span>
  );
}

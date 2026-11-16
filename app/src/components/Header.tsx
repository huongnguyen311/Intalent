import type { ReactNode } from 'react';

type Props = { title: string; subtitle?: string; actions?: ReactNode };

export function Header({ title, subtitle, actions }: Props) {
  return (
    <header className="h-16 bg-white dark:bg-[#1e1e1e] border-b border-[#e6dddb] dark:border-[#2a2423] px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {subtitle ? (
          <div>
            <h2 className="text-xl font-bold text-[#181211] dark:text-white">{title}</h2>
            <p className="text-gray-500 font-medium text-sm">{subtitle}</p>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-[#181211] dark:text-white">{title}</h2>
        )}
      </div>
      {actions}
    </header>
  );
}

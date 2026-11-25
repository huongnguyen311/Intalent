import type { ReactNode } from 'react';
import { isFixtureMode } from '../data/fixtureMockup';
import { TodoBell } from '../features/todo/TodoList';
import { BackButton } from './BackButton';

export type Back = { label: string; onClick: () => void };
type Props = { title: string; subtitle?: string; actions?: ReactNode; back?: Back };

export function Header({ title, subtitle, actions, back }: Props) {
  return (
    <header className="h-16 bg-white dark:bg-[#1e1e1e] border-b border-[#e6dddb] dark:border-[#2a2423] px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {back && <BackButton size="sm" label={back.label} onClick={back.onClick} />}
        {subtitle ? (
          <div>
            <h2 className="text-xl font-bold text-[#181211] dark:text-white">{title}</h2>
            <p className="text-gray-500 font-medium text-sm">{subtitle}</p>
          </div>
        ) : (
          <h2 className="text-xl font-bold text-[#181211] dark:text-white">{title}</h2>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {/* The static mockup has no bell; the app shows the to-do count on every page. */}
        {!isFixtureMode() && <TodoBell />}
      </div>
    </header>
  );
}

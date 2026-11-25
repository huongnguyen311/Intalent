import { useId, type ReactNode } from 'react';

type Props = {
  /** Material Symbols name shown in the tile before the title. */
  icon: string;
  title: string;
  /** Small number after the title (rounds, comments...). */
  count?: number;
  /** Button or link at the right of the heading. */
  action?: ReactNode;
  /** Tile colour; AI uses violet so it reads as machine output, everything else stays neutral. */
  tone?: 'neutral' | 'violet';
  children: ReactNode;
};

const TILE = {
  neutral: 'bg-[#f4f1f0] text-[#896a61] dark:bg-white/10 dark:text-gray-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
};

/**
 * One block of a side drawer. Blocks are split by a full-width band (the drawer body pads 24px, hence -mx-6),
 * so each reads as its own section rather than one long scroll.
 */
export function DrawerSection({ icon, title, count, action, tone = 'neutral', children }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="-mx-6 px-6 py-5 border-t-8 border-[#f8f6f6] dark:border-[#161212] first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2.5 mb-4">
        <span aria-hidden="true" className={`size-7 shrink-0 rounded-lg grid place-items-center ${TILE[tone]}`}>
          <span className="material-symbols-outlined text-[17px]">{icon}</span>
        </span>
        <h4 id={id} className="flex-1 min-w-0 text-[15px] font-bold text-slate-800 dark:text-white">
          {title}
          {count !== undefined && <span className="ml-1.5 text-[#896a61] font-medium">({count})</span>}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}
